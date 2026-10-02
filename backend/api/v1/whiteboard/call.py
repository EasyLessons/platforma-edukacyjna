"""
Rozmowa glosowa tablicy przez Daily (https://docs.daily.co/reference/rest-api).

POST /api/v1/whiteboard/{board_id}/call (router.py -> WhiteboardService.create_call) wola
`create_board_call`. Kolejnosc: najpierw tanie i lokalne (wylacznik, klucz, rate limit),
potem zuzycie miesiaca, na koncu pokoj i token w Daily. Pelny opis i model zagrozen:
docs/architecture/pipelines.md pkt 5a.

  * TWORZY (i przedluza) pokoj tylko wlasciciel przestrzeni dopuszczony przez
    CALL_ALLOWED_USER_IDS; pozostali czlonkowie tylko DOLACZAJA do aktywnego pokoju
    (zero zapisow w Daily) albo dostaja 409 VOICE_CALL_NOT_STARTED,
  * token dostaje tylko pokoj spelniajacy wymogi (`_room_problem`): prywatny, z `exp` <= 3 h,
    `eject_at_room_exp`, `max_participants` <= limit, bez platnych funkcji. Inny pokoj
    wlasciciel kasuje i tworzy od nowa, dolaczajacy dostaje odmowe,
  * token ZAWSZE ma `room_name` (bez niego otwiera kazdy pokoj domeny), krotki `exp`
    (tylko na wejscie) i `eject_after_elapsed` liczone tak, by nikt nie zostal po `exp` pokoju,
  * klucz API i token nigdy nie trafiaja do logow ani do tresci bledow.

Kody statusow Daily, ktorych dokumentacja nie potwierdza (brak pokoju: 404 albo 400
"not found"; duplikat nazwy przy tworzeniu; limit pokoi), obslugujemy w obu wariantach.
"""
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

DEFAULT_ROOM_PREFIX = "easylesson"
USER_NAME_MAX_LENGTH = 64
USER_NAME_FALLBACK = "Uczestnik"

# Token sluzy tylko do WEJSCIA: wazny 5 min. Wyrzucenie z rozmowy ustawia `eject_after_elapsed`
# = czas do `exp` pokoju minus te 5 min - nawet wejscie w ostatniej sekundzie waznosci tokenu
# konczy sie najpozniej z `exp` pokoju (ustawienia eject w tokenie NADPISUJA te z pokoju - docs Daily).
TOKEN_ENTRY_SECONDS = 5 * 60
# Ponizej tego czasu do `exp` pokoj traktujemy jak nieaktywny (nie warto do niego wpuszczac).
MIN_JOIN_REMAINING_SECONDS = TOKEN_ENTRY_SECONDS + 60
# Wlasciciel przedluza pokoj dopiero, gdy do `exp` zostalo mniej niz tyle - odswiezenie strony
# w trakcie lekcji nie zuzywa dziennego budzetu.
EXTEND_THRESHOLD_SECONDS = 15 * 60
EXP_SKEW_SECONDS = 60

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
# Limit dotyczy PROB (kazda to do 2 wywolan Daily), nie udanych kasowan.
CLEANUP_LIST_LIMIT = 100
CLEANUP_MAX_ATTEMPTS = 5
CLEANUP_GRACE_SECONDS = 300

_BLANKS = "\t\n\r\x0b\x0c"
_ROOM_URL = re.compile(r"https://[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.daily\.co/([a-z0-9-]+)")


@dataclass
class CallUser:
    id: int
    username: str | None
    email_verified: bool


def room_name_for_board(board_id: int) -> str:
    """Deterministyczna nazwa pokoju: tylko male litery, cyfry i myslnik."""
    prefix = re.sub(r"[^a-z0-9-]", "", (get_settings().daily_room_prefix or "").lower()).strip("-")
    return f"{prefix or DEFAULT_ROOM_PREFIX}-board-{int(board_id)}"


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
    return exp if isinstance(exp, (int, float)) and not isinstance(exp, bool) else None


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
    return None


def _call_not_started() -> AppException:
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


async def _delete_room(client: httpx.AsyncClient, name: str, api_key: str) -> bool:
    """
    Kasuje pokoj; brak pokoju = OK. Inny blad -> wyjatek (nie tworzymy nic na niepewnym stanie).
    Zwraca True, gdy tuz przed skasowaniem pokoj byl na pewno pusty - tylko wtedy wolno zwrocic
    tworzacemu niewykorzystany budzet (dokumentacja Daily nie potwierdza, ze DELETE rozlacza
    trwajaca rozmowe; uczestnikow i tak konczy `eject_after_elapsed` z ich tokenow).
    """
    was_empty = await _room_is_empty(client, name)
    response = await daily.request(client, "DELETE", f"/rooms/{name}")
    if response.status_code != 200 and not _is_room_missing(response):
        raise daily.provider_error(response, "kasowanie pokoju", api_key)
    await guard.unregister_room(name)
    return was_empty


async def _cleanup_expired_rooms(client: httpx.AsyncClient, own_name: str, now: int) -> None:
    """
    Best-effort: kasuje wygasle pokoje INNYCH tablic z naszym prefiksem (limit 50 pokoi konta).
    Kandydaci: nasz rejestr w Redis (lista Daily moze nie zwracac pokoi po `exp`) + lista Daily.
    Przed kazdym DELETE pokoj jest pobierany ponownie - odswiezonego w miedzyczasie nie kasujemy.
    Nigdy nie rzuca: blad sprzatania nie moze zablokowac rozmowy.
    """
    ours = re.compile(rf"^{re.escape(own_name[: own_name.rindex('-') + 1])}\d+$")
    try:
        candidates = await guard.expired_rooms(now, CLEANUP_GRACE_SECONDS, CLEANUP_MAX_ATTEMPTS)
        if len(candidates) < CLEANUP_MAX_ATTEMPTS:
            listed = await daily.request(client, "GET", "/rooms", params={"limit": CLEANUP_LIST_LIMIT})
            rooms = daily.body(listed).get("data") if listed.status_code == 200 else None
            for room in rooms if isinstance(rooms, list) else []:
                exp = _room_exp(room) if isinstance(room, dict) else None
                if exp is not None and exp <= now - CLEANUP_GRACE_SECONDS and isinstance(room.get("name"), str):
                    candidates.append(room["name"])

        attempts = 0
        for name in dict.fromkeys(candidates):
            if attempts >= CLEANUP_MAX_ATTEMPTS:
                break
            if name == own_name or not ours.fullmatch(name):
                continue
            attempts += 1
            fresh = await daily.request(client, "GET", f"/rooms/{name}")
            if _is_room_missing(fresh):
                await guard.unregister_room(name)
                continue
            exp = _room_exp(daily.body(fresh)) if fresh.status_code == 200 else None
            if exp is None or exp > int(time.time()) - CLEANUP_GRACE_SECONDS:
                continue  # odswiezony albo nieczytelny - zostaje
            result = await daily.request(client, "DELETE", f"/rooms/{name}")
            if result.status_code == 200 or _is_room_missing(result):
                await guard.unregister_room(name)
            else:
                logger.warning(f"Daily - kasowanie wygasłego pokoju {name}: HTTP {result.status_code}")
        if attempts:
            logger.info(f"Daily - sprzątanie wygasłych pokoi: {attempts} prób")
    except Exception as e:  # AppException, Redis, nieoczekiwany ksztalt odpowiedzi
        logger.warning(f"Daily - sprzątanie wygasłych pokoi nieudane ({type(e).__name__}), pomijam")


def _room_payload(name: str, exp: int) -> dict:
    return {
        "name": name,
        "privacy": "private",
        "properties": {
            "exp": exp,
            # Bezpiecznik kosztow: po `exp` Daily konczy spotkanie, zapomniana karta nie nabija minut.
            "eject_at_room_exp": True,
            "max_participants": guard.max_participants(),
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


async def _create_room(
    client: httpx.AsyncClient,
    name: str,
    user_id: int,
    now: int,
    planned_minutes: int,
    api_key: str,
    replaced_was_empty: bool,
) -> dict:
    """Tworzy pokoj wlasciciela: budzet dzienny -> prog miesieczny -> Daily. Zwraca pokoj."""
    # Jeden aktywny pokoj na tworzacego: poprzedni (inna tablica) kasujemy. Niewykorzystany czas
    # wraca do budzetu TYLKO, gdy Daily potwierdzil, ze skasowany pokoj byl pusty.
    previous = await guard.get_owner_room(user_id)
    if previous is not None and previous.exp > now:
        was_empty = replaced_was_empty
        if previous.room != name:
            was_empty = await _delete_room(client, previous.room, api_key)
        if was_empty:
            await guard.refund_budget(user_id, previous.exp - now, previous.day)
    if previous is not None:
        await guard.clear_owner_room(user_id)

    ttl = await guard.reserve_budget(user_id, guard.room_ttl_seconds(), guard.ROOM_MIN_TTL_SECONDS, now)
    day = guard.day_of(now)
    try:
        if planned_minutes + -(-ttl * guard.max_participants() // 60) > guard.monthly_cap_minutes():
            logger.warning("Rozmowa: nowy pokój przekroczyłby miesięczny próg minut - odmawiam")
            raise _monthly_limit()

        await _cleanup_expired_rooms(client, name, now)
        exp = now + ttl
        created = await daily.request(client, "POST", "/rooms", json=_room_payload(name, exp))
        raced = False
        if created.status_code == 200:
            room = daily.body(created)
        elif created.status_code == 400 and not daily.looks_like_account_limit(created):
            # Najpewniej wyscig (dwa klikniecia wlasciciela): pokoj juz jest.
            room = await _get_room(client, name, api_key)
            if room is None:
                raise daily.provider_error(created, "tworzenie pokoju", api_key)
            raced = True
        else:
            raise daily.provider_error(created, "tworzenie pokoju", api_key)

        problem = _room_problem(room, name, now)
        if problem is None and (_room_exp(room) or 0) < now + MIN_JOIN_REMAINING_SECONDS:
            problem = "pokój wygasa"
        if problem is not None:
            # Daily nie zastosowal wymaganych ustawien - pokoju "luzniejszego" nie zostawiamy.
            logger.error(f"Daily - utworzony pokój {name} nie spełnia wymogów ({problem}), kasuję")
            await _delete_room(client, name, api_key)
            raise daily.provider_unavailable()
    except BaseException:
        await guard.refund_budget(user_id, ttl, day)
        raise

    room_exp = int(_room_exp(room))
    if raced:
        # Pokoj utworzylo rownolegle zadanie tego samego wlasciciela i ono za niego zaplacilo -
        # podwojne klikniecie nie zjada budzetu drugi raz.
        await guard.refund_budget(user_id, ttl, day)
    else:
        await guard.set_owner_room(user_id, name, room_exp, day, now)
    await guard.register_room(name, room_exp)
    return room


async def _extend_room(
    client: httpx.AsyncClient, room: dict, name: str, user_id: int, now: int, planned_minutes: int, api_key: str
) -> dict:
    """Przedluza konczacy sie pokoj wlasciciela o tyle, na ile pozwala budzet. Bez budzetu - bez zmian."""
    old_exp = int(_room_exp(room))
    wanted = now + guard.room_ttl_seconds() - old_exp
    extra_minutes = -(-wanted * guard.max_participants() // 60)
    if wanted < 60 or planned_minutes + extra_minutes > guard.monthly_cap_minutes():
        return room
    try:
        added = await guard.reserve_budget(user_id, wanted, 60, now)
    except AppException as e:
        if e.code != "VOICE_USER_LIMIT":
            raise
        return room
    day = guard.day_of(now)
    try:
        updated = await daily.request(client, "POST", f"/rooms/{name}", json={"properties": {"exp": old_exp + added}})
        if updated.status_code != 200:
            raise daily.provider_error(updated, "przedłużenie pokoju", api_key)
        fresh = daily.body(updated)
        if _room_problem(fresh, name, now) is not None or int(_room_exp(fresh) or 0) < old_exp:
            logger.error(f"Daily - pokój {name} po przedłużeniu nie spełnia wymogów")
            raise daily.provider_unavailable()
    except BaseException:
        await guard.refund_budget(user_id, added, day)
        raise
    new_exp = int(_room_exp(fresh))
    await guard.set_owner_room(user_id, name, new_exp, day, now)
    await guard.register_room(name, new_exp)
    return fresh


async def _create_token(
    client: httpx.AsyncClient, *, room_name: str, user: CallUser, is_creator: bool, room_exp: int, now: int, api_key: str
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
                # `is_owner` daje tez prawo uruchamiania platnych funkcji (streaming, transkrypcja),
                # wiec nikt go nie dostaje; tworzacy moze tylko zarzadzac uczestnikami.
                "is_owner": False,
                "permissions": {"canAdmin": ["participants"] if is_creator else False},
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
    api_key = (settings.daily_api_key or "").strip()
    if not api_key:
        logger.warning("Rozmowa głosowa wyłączona: brak DAILY_API_KEY")
        raise AppException(
            "Rozmowy głosowe są chwilowo wyłączone", code="VOICE_NOT_CONFIGURED", status_code=503
        )
    return api_key


async def create_board_call(
    board_id: int, *, user: CallUser, is_workspace_owner: bool, client_ip: str
) -> CallResponse:
    """Pokoj + token rozmowy dla CZLONKA tablicy (czlonkostwo sprawdza wolajacy). Kody bledow: pipelines.md 5a."""
    if not user.email_verified:
        raise AppException("Potwierdź adres e-mail, aby korzystać z rozmów", code="VOICE_EMAIL_NOT_VERIFIED", status_code=403)
    api_key = call_api_key()
    await guard.enforce_rate_limits(user.id, client_ip)

    name = room_name_for_board(board_id)
    now = int(time.time())
    can_create = bool(is_workspace_owner) and guard.creator_allowed(user.id)

    async with daily.daily_http_client(api_key) as client:
        usage = await call_usage.get_month_usage(client, api_key, now)
        known = await guard.active_rooms(now)
        planned = (
            usage.minutes
            + guard.reserved_minutes(known, now)
            + call_usage.unknown_ongoing_minutes(usage, known, guard.ROOM_MAX_TTL_SECONDS)
        )
        cap = guard.monthly_cap_minutes()
        if planned > cap or usage.minutes >= cap:
            logger.warning(f"Rozmowa: miesięczny próg minut osiągnięty ({planned}/{cap} min) - odmawiam")
            raise _monthly_limit()

        room = await _get_room(client, name, api_key)
        problem = _room_problem(room, name, now) if room is not None else "brak pokoju"
        remaining = int(_room_exp(room) or 0) - now if problem is None else 0

        if not can_create:
            if problem is not None or remaining < MIN_JOIN_REMAINING_SECONDS:
                if room is not None and problem is not None:
                    logger.error(f"Daily - pokój {name} nie spełnia wymogów ({problem}) - odmawiam tokenu")
                if is_workspace_owner:
                    raise AppException(
                        "To konto nie może jeszcze rozpoczynać rozmów", code="VOICE_CREATE_NOT_ALLOWED", status_code=403
                    )
                raise _call_not_started()
            # Rejestr mogl zniknac (restart Redis) - trwajacy pokoj wraca do rezerwacji progu.
            await guard.register_room(name, now + remaining)
        elif problem is not None or remaining < MIN_JOIN_REMAINING_SECONDS:
            was_empty = False
            if room is not None:
                if _room_exp(room) is None or _room_exp(room) > now:
                    logger.warning(f"Daily - pokój {name} zastępuję nowym ({problem or 'wygasa'})")
                was_empty = await _delete_room(client, name, api_key)
            # Rezerwacja kasowanego pokoju nie liczy sie juz do progu.
            planned -= guard.reserved_minutes({name: known[name]} if name in known else {}, now)
            room = await _create_room(client, name, user.id, now, planned, api_key, was_empty)
        else:
            await guard.register_room(name, now + remaining)
            if remaining < EXTEND_THRESHOLD_SECONDS:
                room = await _extend_room(client, room, name, user.id, now, planned, api_key)

        room_exp = int(_room_exp(room))
        token, token_exp = await _create_token(
            client, room_name=name, user=user, is_creator=can_create, room_exp=room_exp, now=now, api_key=api_key
        )

    logger.info(
        f"Rozmowa: wydano token (board_id={board_id}, tworzący={can_create}, "
        f"zużycie miesiąca={usage.minutes} min, z rezerwacjami={planned}/{cap} min)"
    )
    return CallResponse(
        room_url=room["url"],
        token=token,
        expires_at=datetime.fromtimestamp(token_exp, tz=timezone.utc),
    )
