"""
Rozmowa glosowa tablicy przez Daily (https://docs.daily.co/reference/rest-api).

POST /api/v1/whiteboard/{board_id}/call (router.py -> WhiteboardService.create_call) wola
`create_board_call`. Kolejnosc: najpierw tanie i lokalne (wylacznik, klucz, rate limit, rejestr),
potem zuzycie miesiaca, na koncu pokoj i token w Daily. Pelny opis i model zagrozen:
docs/architecture/pipelines.md pkt 5a.

  * TWORZY (i przedluza) pokoj tylko wlasciciel przestrzeni dopuszczony przez
    CALL_ALLOWED_USER_IDS - pod blokada na tworzacego (jedna operacja naraz, najwyzej jeden
    zywy pokoj). Pozostali czlonkowie tylko DOLACZAJA do pokoju z rejestru (zero zapisow
    w Daily); bez pokoju odmowa jest lokalna: 409 VOICE_CALL_NOT_STARTED / VOICE_CALL_ENDING,
  * kazdy pokoj jest wpisywany do rejestru i budzetu PRZED wywolaniem Daily (rezerwacja
    pelnego czasu zycia x max_participants); nieudane tworzenie cofa wpis,
  * token dostaje tylko pokoj spelniajacy wymogi (`_room_problem`): prywatny, z `exp` <= 3 h,
    `eject_at_room_exp`, `max_participants` <= limit, bez platnych funkcji i bez adminow.
    Inny pokoj wlasciciel kasuje i tworzy od nowa, dolaczajacy dostaje odmowe,
  * token ZAWSZE ma `room_name` (bez niego otwiera kazdy pokoj domeny), krotki `exp`
    (tylko na wejscie) i `eject_after_elapsed` liczone tak, by nikt nie zostal po `exp` pokoju,
  * klucz API i token nigdy nie trafiaja do logow ani do tresci bledow.

Kody statusow Daily, ktorych dokumentacja nie potwierdza (brak pokoju: 404 albo 400
"not found"; duplikat nazwy przy tworzeniu; limit pokoi), obslugujemy w obu wariantach.
"""
import asyncio
import math
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from core.config import get_settings
from core.exceptions import AppException
from core.logging import get_logger

from . import call_guard as guard
from . import call_usage
from . import daily_client as daily
from .schemas import CallResponse

logger = get_logger(__name__)

USER_NAME_MAX_LENGTH = 64
USER_NAME_FALLBACK = "Uczestnik"

# Token sluzy tylko do WEJSCIA: wazny 5 min. Wyrzucenie z rozmowy ustawia `eject_after_elapsed`
# = czas do `exp` pokoju minus te 5 min - nawet wejscie w ostatniej sekundzie waznosci tokenu
# konczy sie najpozniej z `exp` pokoju (ustawienia eject w tokenie NADPISUJA te z pokoju - docs Daily).
TOKEN_ENTRY_SECONDS = 5 * 60
# Ponizej tego czasu do `exp` pokoj traktujemy jak nieaktywny (nie warto do niego wpuszczac).
MIN_JOIN_REMAINING_SECONDS = TOKEN_ENTRY_SECONDS + 60
# Wlasciciel przedluza pokoj dopiero, gdy do `exp` zostalo mniej niz tyle.
EXTEND_THRESHOLD_SECONDS = 15 * 60
# Wlasciciel klika "Rozmowa", a jego pokoj (starszy niz tyle) jest PUSTY: stary pokoj jest
# rozliczany do tej chwili i zastepowany nowym z pelnym czasem (kolejna lekcja na tej samej tablicy).
RECYCLE_MIN_AGE_SECONDS = 10 * 60
EXP_SKEW_SECONDS = 60
# Ile zakonczonych pokoi tworzacego rozliczamy wg spotkan z Daily przy jednym zadaniu.
SETTLE_MAX_PER_REQUEST = 3

# Platne / ryzykowne wlasciwosci pokoju - pokoj z ktorakolwiek wlaczona nie dostaje tokenu.
# Nazwy potwierdzone w docs Daily (rooms/create-room, 02.10.2026). `enable_recording` nie ma
# wartosci "off" (enum: cloud, cloud-audio-only, local, raw-tracks) - wylaczone = nieustawione.
FORBIDDEN_ROOM_PROPERTIES = (
    "enable_recording",
    "enable_dialout",
    "sip",
    "sip_uri",
    "dialin",
    "streaming_endpoints",
    "auto_transcription_settings",
    "auto_start_transcription",
    "enable_transcription_storage",
    "enable_knocking",
)

# Sprzatanie wygaslych pokoi (limit 50 pokoi na koncie Daily) - tylko przy tworzeniu nowego.
# Limit dotyczy PROB (kazda to do 2 wywolan Daily), nie udanych kasowan. Kasujemy dopiero po
# okresie karencji rezerwacji (`guard.RESERVATION_GRACE_SECONDS`).
CLEANUP_MAX_ATTEMPTS = 5

_BLANKS = "\t\n\r\x0b\x0c"
_ROOM_URL = re.compile(r"https://[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.daily\.co/([a-z0-9-]+)")


@dataclass
class CallUser:
    id: int
    username: str | None
    email_verified: bool


@dataclass
class _Owner:
    """Kontekst jednej operacji tworzacego (pod blokada `guard.creator_lock`)."""

    client: httpx.AsyncClient
    api_key: str
    user_id: int
    state: guard.OwnerState
    usage: call_usage.MonthUsage
    now: int
    planned: int = 0


def room_name_for_board(board_id: int) -> str:
    """Deterministyczna nazwa pokoju: tylko male litery, cyfry i myslnik."""
    return f"{guard.room_prefix()}-board-{int(board_id)}"


def clean_user_name(username: str | None) -> str:
    """
    Nazwa pokazywana w rozmowie: bez znakow sterujacych i niewidocznych (kategorie
    Unicode C*: sterujace, formatujace - np. odwracanie kierunku tekstu), biale znaki
    scalone do pojedynczej spacji, przycieta.
    """
    # Uwaga: str.isspace() uznaje tez separatory sterujace (\x1c-\x1f) - te maja zniknac.
    text = "".join(
        " " if ch in _BLANKS or unicodedata.category(ch).startswith("Z") else ch
        for ch in (username or "")
        if ch in _BLANKS or not unicodedata.category(ch).startswith("C")
    )
    text = " ".join(text.split())[:USER_NAME_MAX_LENGTH].strip()
    return text or USER_NAME_FALLBACK


def _is_daily_room_url(url, name: str) -> bool:
    """
    Tylko dokladnie `https://<subdomena>.daily.co/<nazwa pokoju>`: caly adres musi pasowac do
    allowlisty znakow (zadnych spacji, tabow, backslashy, `;`, `%`, `@`, portu, query, fragmentu).
    Parsera URL celowo nie uzywamy - przegladarka i urlsplit roznie czytaja np. `\\`.
    """
    if not isinstance(url, str):
        return False
    match = _ROOM_URL.fullmatch(url)
    return match is not None and match.group(1) == name


def _is_room_missing(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    if response.status_code != 400:
        return False
    data = daily.body(response)
    return "not found" in f"{data.get('error', '')} {data.get('info', '')}".lower()


def _room_exp(room: dict) -> float | None:
    config = room.get("config")
    exp = config.get("exp") if isinstance(config, dict) else None
    if isinstance(exp, bool) or not isinstance(exp, (int, float)) or not math.isfinite(exp):
        return None
    return exp


def _room_problem(room: dict, name: str, now: int) -> str | None:
    """Dlaczego pokoj NIE spelnia wymogow (None = spelnia). Wygasniecie sprawdza wolajacy."""
    if room.get("name") != name or not _is_daily_room_url(room.get("url"), name):
        return "nieoczekiwana nazwa/adres"
    if room.get("privacy") != "private":
        return "pokój nie jest prywatny"
    config = room.get("config")
    if not isinstance(config, dict):
        return "brak config"
    exp = _room_exp(room)
    if exp is None:
        return "brak exp"
    if exp > now + guard.ROOM_MAX_TTL_SECONDS + EXP_SKEW_SECONDS:
        return "exp dalej niż 3 h"
    if config.get("eject_at_room_exp") is not True:
        return "brak eject_at_room_exp"
    limit = config.get("max_participants")
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= guard.max_participants():
        return "max_participants ponad limit"
    for key in FORBIDDEN_ROOM_PROPERTIES:
        if config.get(key):
            return f"włączone {key}"
    # Nikt nie jest adminem spotkania: admin moglby nadac innym uprawnienia do platnych funkcji.
    # Dopuszczalne: brak pola, false albo pusta lista (zadnego rodzaju uprawnien admina).
    permissions = config.get("permissions")
    if permissions is not None:
        admin = permissions.get("canAdmin") if isinstance(permissions, dict) else True
        if admin is not None and admin is not False and admin != []:
            return "permissions.canAdmin"
    return None


def _join_refusal(is_workspace_owner: bool, ending: bool) -> AppException:
    if is_workspace_owner:
        return AppException(
            "To konto nie może jeszcze rozpoczynać rozmów", code="VOICE_CREATE_NOT_ALLOWED", status_code=403
        )
    if ending:
        return AppException(
            "Rozmowa właśnie się kończy - poproś nauczyciela o rozpoczęcie nowej",
            code="VOICE_CALL_ENDING",
            status_code=409,
        )
    return AppException(
        "Rozmowa jeszcze się nie zaczęła - poczekaj na nauczyciela",
        code="VOICE_CALL_NOT_STARTED",
        status_code=409,
    )


def _monthly_limit() -> AppException:
    return AppException(
        "Limit rozmów w tym miesiącu wyczerpany",
        code="VOICE_MONTHLY_LIMIT",
        status_code=429,
    )


async def _planned_minutes(usage: call_usage.MonthUsage, now: int) -> int:
    """Zuzycie z Daily + rezerwacje (rejestr czytany na swiezo). Ponad prog -> 429."""
    records = await guard.reserved_rooms(now)
    planned = usage.minutes + call_usage.reserved_total(usage, records, now)
    cap = guard.monthly_cap_minutes()
    if planned > cap or usage.minutes >= cap:
        logger.warning(f"Rozmowa: miesięczny próg minut osiągnięty ({planned}/{cap} min) - odmawiam")
        raise _monthly_limit()
    return planned


async def _get_room(client: httpx.AsyncClient, name: str, api_key: str) -> dict | None:
    response = await daily.request(client, "GET", f"/rooms/{name}")
    if response.status_code == 200:
        return daily.body(response)
    if _is_room_missing(response):
        return None
    raise daily.provider_error(response, "odczyt pokoju", api_key)


async def _room_is_empty(client: httpx.AsyncClient, name: str) -> bool:
    """True tylko gdy Daily POTWIERDZI, ze w pokoju nikogo nie ma (GET /rooms/:name/presence)."""
    try:
        response = await daily.request(client, "GET", f"/rooms/{name}/presence")
    except AppException:
        return False
    data = daily.body(response)
    return response.status_code == 200 and data.get("data") == [] and data.get("total_count") in (0, None)


async def _delete_room(client: httpx.AsyncClient, name: str, api_key: str, empty: bool | None = None) -> bool:
    """
    Kasuje pokoj; brak pokoju = OK. Inny blad -> wyjatek (nie tworzymy nic na niepewnym stanie).
    Zwraca True, gdy tuz przed skasowaniem pokoj byl na pewno pusty - tylko wtedy wolno skrocic
    jego rezerwacje i rozliczenie (dokumentacja Daily nie potwierdza, ze DELETE rozlacza
    trwajaca rozmowe; uczestnikow i tak konczy `eject_after_elapsed` z ich tokenow).
    `empty` = wynik sprawdzenia obecnosci zrobionego juz przez wolajacego.
    """
    was_empty = await _room_is_empty(client, name) if empty is None else empty
    response = await daily.request(client, "DELETE", f"/rooms/{name}")
    if response.status_code != 200 and not _is_room_missing(response):
        raise daily.provider_error(response, "kasowanie pokoju", api_key)
    return was_empty


async def _cleanup_expired_rooms(owner: _Owner, own_name: str) -> None:
    """
    Best-effort: kasuje dawno wygasle pokoje INNYCH tablic z naszym prefiksem (limit 50 pokoi konta).
    Kandydaci: wpisy rejestru po okresie karencji + wygasle pokoje z listy Daily (z odczytu zuzycia).
    Przed kazdym DELETE pokoj jest pobierany ponownie - odswiezonego w miedzyczasie nie kasujemy.
    Nigdy nie rzuca: blad sprzatania nie moze zablokowac rozmowy.
    """
    client, now = owner.client, owner.now
    try:
        stale = await guard.stale_rooms(now, CLEANUP_MAX_ATTEMPTS)
        attempts = 0
        for name in dict.fromkeys([record.name for record in stale] + list(owner.usage.expired)):
            if attempts >= CLEANUP_MAX_ATTEMPTS:
                break
            members = [record.member for record in stale if record.name == name]
            if name != own_name and guard.is_board_room(name):
                attempts += 1
                fresh = await daily.request(client, "GET", f"/rooms/{name}")
                if not _is_room_missing(fresh):
                    if fresh.status_code != 200:
                        continue  # nieczytelny - zostaje
                    exp = _room_exp(daily.body(fresh))
                    if exp is None:
                        continue
                    if exp <= int(time.time()) - guard.RESERVATION_GRACE_SECONDS:
                        result = await daily.request(client, "DELETE", f"/rooms/{name}")
                        if result.status_code != 200 and not _is_room_missing(result):
                            logger.warning(f"Daily - kasowanie wygasłego pokoju {name}: HTTP {result.status_code}")
                            continue
                    # else: pod ta nazwa zyje juz nowszy pokoj - stary wpis rejestru jest zbedny
            for member in members:
                await guard.forget_room(member)
        if attempts:
            logger.info(f"Daily - sprzątanie wygasłych pokoi: {attempts} prób")
    except Exception as e:  # AppException, Redis, nieoczekiwany ksztalt odpowiedzi
        logger.warning(f"Daily - sprzątanie wygasłych pokoi nieudane ({type(e).__name__}), pomijam")


def _room_payload(name: str, exp: int, participants: int) -> dict:
    return {
        "name": name,
        "privacy": "private",
        "properties": {
            "exp": exp,
            # Bezpiecznik kosztow: po `exp` Daily konczy spotkanie, zapomniana karta nie nabija minut.
            "eject_at_room_exp": True,
            "max_participants": participants,
            "start_video_off": True,
            "start_audio_off": False,
            "enable_prejoin_ui": True,
            "enable_chat": False,
            # Platne funkcje jawnie wylaczone. Nagrywanie, live streaming i SIP/PSTN dial-in nie maja
            # przelacznika "off" - sa wylaczone, dopoki nie ustawi sie `enable_recording`,
            # `streaming_endpoints`, `sip` (pilnuje tego `_room_problem`). Streaming i transkrypcje
            # moze uruchomic tylko administrator spotkania - nikomu nie dajemy tego uprawnienia.
            "enable_knocking": False,
            "enable_dialout": False,
            "enable_transcription_storage": False,
            "enable_live_captions_ui": False,
            "permissions": {"canAdmin": False},
        },
    }


async def _save(owner: _Owner) -> None:
    await guard.save_owner(owner.user_id, owner.state)


async def _settle_closed_rooms(owner: _Owner) -> None:
    """
    Zakonczone pokoje tworzacego, po okresie karencji: budzet dzienny obciaza REALNY czas rozmowy
    wg spotkan z Daily (nie pelna rezerwacja) - uczciwy nauczyciel nie placi za czas, gdy pokoj
    stal pusty. Rozliczenie moze obciazenie tylko ZMNIEJSZYC; kazda watpliwosc = bez zmian.
    """
    now = owner.now
    changed = False
    done = 0
    for entry in owner.state.rooms:
        if entry.settled or (entry.open and entry.end > now):
            continue
        if entry.end > now - guard.RESERVATION_GRACE_SECONDS or done >= SETTLE_MAX_PER_REQUEST:
            continue
        done += 1
        if entry.charged > guard.MIN_CHARGE_SECONDS:
            try:
                seconds = await call_usage.room_meeting_seconds(
                    owner.client, entry.room, entry.created, entry.end, now
                )
            except call_usage.UNREADABLE as e:
                logger.warning(f"Rozmowa: nie udało się rozliczyć pokoju {entry.room} ({type(e).__name__})")
                continue
            if seconds is None:
                continue
            entry.charged = min(entry.charged, max(guard.MIN_CHARGE_SECONDS, seconds))
        entry.settled = True
        changed = True
    if changed:
        await _save(owner)


async def _close_room(owner: _Owner, entry: guard.OwnerRoom, *, exists: bool, empty: bool | None = None) -> None:
    """
    Konczy pokoj tworzacego (zastapienie nowym). Niewykorzystany czas wraca do budzetu TYLKO, gdy
    Daily potwierdzil, ze pokoj byl pusty (albo pokoju juz nie ma) - rozliczenie = czas od
    utworzenia do teraz. Wpis jest zamykany raz (pod blokada), wiec zwrotu nie da sie powtorzyc.
    """
    now = owner.now
    was_empty = False
    if exists:
        was_empty = await _delete_room(owner.client, entry.room, owner.api_key, empty)
    entry.open = False
    if was_empty or not exists:
        entry.charged = min(entry.charged, max(guard.MIN_CHARGE_SECONDS, now - entry.created))
    if was_empty:
        # Pusty i skasowany: rezerwacja miesieczna konczy sie teraz (+ okres karencji).
        entry.end = max(entry.created, now)
        await guard.register_room(entry.member, entry.end)
    await _save(owner)


async def _rollback(owner: _Owner, entry: guard.OwnerRoom) -> None:
    """Cofa wpis pokoju, ktory na pewno nie powstal. Blad Redis = wpis zostaje (zawyzenie)."""
    try:
        if entry in owner.state.rooms:
            owner.state.rooms.remove(entry)
        await _save(owner)
        await guard.forget_room(entry.member)
    except AppException:
        logger.warning("Rozmowa: nie udało się cofnąć rezerwacji pokoju (zostaje zarezerwowana)")


async def _room_is_gone(owner: _Owner, name: str) -> bool:
    """Best-effort DELETE po nieudanym tworzeniu. True = pokoju na pewno nie ma w Daily."""
    try:
        response = await daily.request(owner.client, "DELETE", f"/rooms/{name}")
    except AppException:
        return False
    return response.status_code == 200 or _is_room_missing(response)


async def _create_room(owner: _Owner, name: str) -> dict:
    """
    Tworzy pokoj wlasciciela. Budzet dzienny i rejestr (rezerwacja miesieczna) sa zapisywane
    PRZED wywolaniem Daily; gdy pokoj na pewno nie powstal - wpisy sa cofane.
    """
    now, state = owner.now, owner.state
    day = guard.day_of(now)
    ttl = min(guard.room_ttl_seconds(), guard.budget_left(state, day))
    if ttl < guard.ROOM_MIN_TTL_SECONDS or state.count(day) >= guard.MAX_ROOMS_PER_DAY:
        raise guard.user_limit_reached()
    exp = now + ttl
    participants = guard.max_participants()
    entry = guard.OwnerRoom(
        room=name, member=guard.room_member(name, now, participants), created=now, end=exp, charged=ttl, day=day
    )
    state.rooms.append(entry)
    await _save(owner)

    sent = False  # czy zadanie utworzenia poszlo do Daily (pokoj MOZE istniec)
    try:
        await guard.register_room(entry.member, exp)
        owner.planned = await _planned_minutes(owner.usage, now)
        await _cleanup_expired_rooms(owner, name)
        sent = True
        created = await daily.request(
            owner.client, "POST", "/rooms", json=_room_payload(name, exp, participants)
        )
        if created.status_code == 200:
            room = daily.body(created)
        elif created.status_code == 400 and not daily.looks_like_account_limit(created):
            # Pokoj o tej nazwie juz jest (utworzony poza nami) - przejmujemy go, jesli spelnia wymogi.
            room = await _get_room(owner.client, name, owner.api_key)
            if room is None:
                raise daily.provider_error(created, "tworzenie pokoju", owner.api_key)
        else:
            raise daily.provider_error(created, "tworzenie pokoju", owner.api_key)

        problem = _room_problem(room, name, now)
        if problem is None and (_room_exp(room) or 0) < now + MIN_JOIN_REMAINING_SECONDS:
            problem = "pokój wygasa"
        if problem is not None:
            # Daily nie zastosowal wymaganych ustawien - pokoju "luzniejszego" nie zostawiamy.
            logger.error(f"Daily - utworzony pokój {name} nie spełnia wymogów ({problem}), kasuję")
            raise daily.provider_unavailable()

        room_exp = int(_room_exp(room))
        if room_exp != exp:
            entry.end = room_exp
            entry.charged = max(guard.MIN_CHARGE_SECONDS, room_exp - now)
            await _save(owner)
            await guard.register_room(entry.member, room_exp)
        return room
    except BaseException:
        # Pokoj mogl powstac, a my nie umiemy go obsluzyc (blad Daily, Redis padl w polowie):
        # probujemy go skasowac. Wpisy cofamy tylko, gdy pokoju NA PEWNO nie ma.
        if not sent or await _room_is_gone(owner, name):
            await _rollback(owner, entry)
        raise


async def _adopt_room(owner: _Owner, room: dict, name: str) -> guard.OwnerRoom:
    """
    Zgodny pokoj tablicy istnieje w Daily, ale tworzacy nie ma go w swoich wpisach (utrata danych
    Redis, pokoj utworzony poza nami): przejmujemy go - pozostaly czas obciaza budzet, a pokoj
    wraca do rejestru z czasem zycia liczonym od utworzenia wg Daily (albo 3 h).
    """
    now, state = owner.now, owner.state
    exp = int(_room_exp(room))
    day = guard.day_of(now)
    cost = max(guard.MIN_CHARGE_SECONDS, exp - now)
    if cost > guard.budget_left(state, day) or state.count(day) >= guard.MAX_ROOMS_PER_DAY:
        raise guard.user_limit_reached()
    born = call_usage.room_created(room)
    if not 0 < born <= now:
        born = exp - guard.ROOM_MAX_TTL_SECONDS
    limit = room["config"]["max_participants"]
    records = await guard.reserved_rooms(now)
    known = guard.live_record(records, name, now)
    member = known.member if known is not None else guard.room_member(name, born, limit)
    entry = guard.OwnerRoom(room=name, member=member, created=now, end=exp, charged=cost, day=day)
    state.rooms.append(entry)
    await _save(owner)
    await guard.register_room(member, exp)
    owner.planned = await _planned_minutes(owner.usage, now)
    return entry


async def _extend_room(owner: _Owner, room: dict, entry: guard.OwnerRoom, name: str) -> dict:
    """Przedluza konczacy sie pokoj wlasciciela o tyle, na ile pozwala budzet. Bez budzetu - bez zmian."""
    now, state = owner.now, owner.state
    old_exp = int(_room_exp(room))
    added = min(now + guard.room_ttl_seconds() - old_exp, guard.budget_left(state, entry.day))
    if added < 60:
        return room
    before = (entry.end, entry.charged)
    entry.end, entry.charged = old_exp + added, entry.charged + added
    await _save(owner)
    await guard.register_room(entry.member, entry.end)

    async def restore(end: int) -> None:
        entry.end, entry.charged = end, before[1] + max(0, end - old_exp)
        try:
            await _save(owner)
            await guard.register_room(entry.member, end)
        except AppException:
            logger.warning("Rozmowa: nie udało się cofnąć przedłużenia (zostaje zarezerwowane)")

    try:
        owner.planned = await _planned_minutes(owner.usage, now)
    except AppException as e:
        await restore(before[0])
        if e.code != "VOICE_MONTHLY_LIMIT":
            raise
        return room  # bez miejsca w puli miesiecznej pokoj zostaje, jaki byl

    try:
        updated = await daily.request(
            owner.client, "POST", f"/rooms/{name}", json={"properties": {"exp": entry.end}}
        )
        if updated.status_code != 200:
            raise daily.provider_error(updated, "przedłużenie pokoju", owner.api_key)
        fresh = daily.body(updated)
        if _room_problem(fresh, name, now) is not None or int(_room_exp(fresh) or 0) < old_exp:
            logger.error(f"Daily - pokój {name} po przedłużeniu nie spełnia wymogów")
            raise daily.provider_unavailable()
    except BaseException:
        # Nie wiemy, czy Daily przesunal `exp`: pytamy o stan faktyczny; bez odpowiedzi
        # zostaje dluzsza rezerwacja (zawyzenie).
        try:
            actual = await _get_room(owner.client, name, owner.api_key)
            actual_exp = _room_exp(actual) if actual is not None else None
            if actual_exp is not None:
                await restore(max(old_exp, min(int(actual_exp), entry.end)))
        except AppException:
            pass
        raise
    return fresh


async def _create_token(
    client: httpx.AsyncClient, *, room_name: str, user: CallUser, room_exp: int, now: int, api_key: str
) -> tuple[str, int]:
    token_exp = min(now + TOKEN_ENTRY_SECONDS, room_exp)
    stay = min(guard.ROOM_MAX_TTL_SECONDS, room_exp - now - TOKEN_ENTRY_SECONDS)
    response = await daily.request(
        client,
        "POST",
        "/meeting-tokens",
        json={
            "properties": {
                "room_name": room_name,
                "user_name": clean_user_name(user.username),
                "user_id": str(user.id)[:36],
                "exp": token_exp,
                "eject_at_token_exp": False,
                "eject_after_elapsed": max(1, stay),
                # `is_owner` i `canAdmin` daja prawo uruchamiania platnych funkcji (streaming,
                # transkrypcja) albo nadawania uprawnien innym - nikt ich nie dostaje, takze tworzacy.
                "is_owner": False,
                "permissions": {"canAdmin": False},
                "enable_recording_ui": False,
                "start_video_off": True,
                "start_audio_off": False,
            }
        },
    )
    if response.status_code != 200:
        raise daily.provider_error(response, "wydanie tokenu", api_key)
    token = daily.body(response).get("token")
    if not isinstance(token, str) or not token:
        logger.error("Daily - odpowiedź /meeting-tokens bez tokenu")
        raise daily.provider_unavailable()
    return token, token_exp


def call_api_key() -> str:
    """Wylacznik i klucz - lokalnie, bez zadnego wywolania HTTP. Zwraca klucz API."""
    settings = get_settings()
    if not settings.call_enabled:
        raise AppException("Rozmowy głosowe są chwilowo wyłączone", code="VOICE_DISABLED", status_code=503)
    api_key = guard.daily_api_key()
    if not api_key:
        logger.warning("Rozmowa głosowa wyłączona: brak DAILY_API_KEY")
        raise AppException(
            "Rozmowy głosowe są chwilowo wyłączone", code="VOICE_NOT_CONFIGURED", status_code=503
        )
    return api_key


async def _join_room(
    board_id: int, name: str, user: CallUser, is_workspace_owner: bool, client_ip: str, api_key: str
) -> CallResponse:
    """Dolaczajacy: tylko pokoj z rejestru, zero zapisow w Daily. Bez pokoju - odmowa lokalna."""
    now = int(time.time())
    record = guard.live_record(await guard.reserved_rooms(now), name, now)
    if record is None or record.end - now < MIN_JOIN_REMAINING_SECONDS:
        raise _join_refusal(is_workspace_owner, ending=record is not None)

    async with daily.daily_http_client(api_key) as client:
        usage = await call_usage.get_month_usage(client, api_key, now)
        planned = await _planned_minutes(usage, now)
        room = await _get_room(client, name, api_key)
        problem = _room_problem(room, name, now) if room is not None else "brak pokoju"
        remaining = int(_room_exp(room)) - now if problem is None else 0
        if problem is not None or remaining < MIN_JOIN_REMAINING_SECONDS:
            if room is not None and problem is not None:
                logger.error(f"Daily - pokój {name} nie spełnia wymogów ({problem}) - odmawiam tokenu")
            raise _join_refusal(is_workspace_owner, ending=problem is None)
        await guard.count_ip_attempt(client_ip)
        token, token_exp = await _create_token(
            client, room_name=name, user=user, room_exp=now + remaining, now=now, api_key=api_key
        )
    _log_issued(board_id, False, usage, planned)
    return CallResponse(
        room_url=room["url"], token=token, expires_at=datetime.fromtimestamp(token_exp, tz=timezone.utc)
    )


async def _owner_room(board_id: int, name: str, user: CallUser, api_key: str) -> CallResponse:
    """Tworzacy (pod blokada): rozliczenie poprzednich pokoi, pokoj tej tablicy, token."""
    now = int(time.time())
    async with daily.daily_http_client(api_key) as client:
        usage = await call_usage.get_month_usage(client, api_key, now)
        planned = await _planned_minutes(usage, now)
        state = await guard.load_owner(user.id, now)
        owner = _Owner(client=client, api_key=api_key, user_id=user.id, state=state, usage=usage, now=now, planned=planned)
        await _settle_closed_rooms(owner)

        # Jeden zywy pokoj na tworzacego: pokoj z innej tablicy konczymy.
        live = state.live(now)
        if live is not None and live.room != name:
            # Najpierw sprawdzamy, czy po zamknieciu starczy budzetu na nowy pokoj - inaczej
            # tworzacy stracilby trwajaca rozmowe i nie dostal nowej.
            empty = await _room_is_empty(client, live.room)
            day = guard.day_of(now)
            refund = live.charged - max(guard.MIN_CHARGE_SECONDS, now - live.created)
            left = guard.budget_left(state, day) + (max(0, refund) if empty and live.day == day else 0)
            if left < guard.ROOM_MIN_TTL_SECONDS:
                raise guard.user_limit_reached()
            await _close_room(owner, live, exists=True, empty=empty)
            live = None

        room = await _get_room(client, name, api_key)
        problem = _room_problem(room, name, now) if room is not None else "brak pokoju"
        remaining = int(_room_exp(room)) - now if problem is None else 0

        if problem is not None or remaining < MIN_JOIN_REMAINING_SECONDS:
            if room is not None and (_room_exp(room) is None or _room_exp(room) > now):
                logger.warning(f"Daily - pokój {name} zastępuję nowym ({problem or 'wygasa'})")
            if live is not None:
                await _close_room(owner, live, exists=room is not None)
            elif room is not None:
                await _delete_room(client, name, api_key)
            room = await _create_room(owner, name)
        else:
            if live is None:
                live = await _adopt_room(owner, room, name)
            if now - live.created >= RECYCLE_MIN_AGE_SECONDS and await _room_is_empty(client, name):
                await _close_room(owner, live, exists=True, empty=True)
                room = await _create_room(owner, name)
            elif remaining < EXTEND_THRESHOLD_SECONDS:
                room = await _extend_room(owner, room, live, name)

        room_exp = int(_room_exp(room))
        token, token_exp = await _create_token(
            client, room_name=name, user=user, room_exp=room_exp, now=now, api_key=api_key
        )
    _log_issued(board_id, True, usage, owner.planned)
    return CallResponse(
        room_url=room["url"], token=token, expires_at=datetime.fromtimestamp(token_exp, tz=timezone.utc)
    )


def _log_issued(board_id: int, creator: bool, usage: call_usage.MonthUsage, planned: int) -> None:
    logger.info(
        f"Rozmowa: wydano token (board_id={board_id}, tworzący={creator}, "
        f"zużycie miesiąca={usage.minutes} min, z rezerwacjami={planned}/{guard.monthly_cap_minutes()} min)"
    )


async def create_board_call(
    board_id: int, *, user: CallUser, is_workspace_owner: bool, client_ip: str
) -> CallResponse:
    """Pokoj + token rozmowy dla CZLONKA tablicy (czlonkostwo sprawdza wolajacy). Kody bledow: pipelines.md 5a."""
    if not user.email_verified:
        raise AppException("Potwierdź adres e-mail, aby korzystać z rozmów", code="VOICE_EMAIL_NOT_VERIFIED", status_code=403)
    api_key = call_api_key()
    await guard.enforce_user_rate_limit(user.id)

    name = room_name_for_board(board_id)
    if not (bool(is_workspace_owner) and guard.creator_allowed(user.id)):
        return await _join_room(board_id, name, user, bool(is_workspace_owner), client_ip, api_key)

    await guard.count_ip_attempt(client_ip)
    async with guard.creator_lock(user.id):
        try:
            async with asyncio.timeout(guard.CREATOR_TIMEOUT_SECONDS):
                return await _owner_room(board_id, name, user, api_key)
        except TimeoutError:
            logger.error("Rozmowa: operacja tworzącego przekroczyła limit czasu")
            raise AppException(
                "Połączenie z usługą rozmów przekroczyło limit czasu, spróbuj ponownie",
                code="VOICE_PROVIDER_TIMEOUT",
                status_code=504,
            )
