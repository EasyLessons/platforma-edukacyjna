"""
Bezpieczniki kosztow i naduzyc rozmow Daily - czesc LOKALNA (bez wywolan Daily):
ustawienia z twardymi sufitami, listy uzytkownikow z env, rate limit, blokada tworzacego,
dzienny budzet tworzacego i rejestr pokoi w Redis.

Awaria Redis = FAIL CLOSED (503 VOICE_GUARD_UNAVAILABLE), inaczej niz w reszcie aplikacji:
bez licznikow nie umiemy ograniczyc kosztow, a brak rozmowy jest tanszy niz rachunek.

Klucze Redis:
  ratelimit:voice_call:user:<id>   - 10/min, KAZDE zadanie rozmowy (takze tanie odmowy)
  ratelimit:voice_call:ip:<ip>     - 30/h, tylko proby tworzenia i wydania tokenu
  ratelimit:voice_usage:user:<id>  - 10/min, endpoint admina (osobny kubelek)
  call:lock:creator:<user_id>      - blokada: jeden tworzacy = jedna operacja naraz
  call:owner:<user_id>             - JSON: pokoje tworzacego z ostatnich dni (budzet dzienny
                                     to SUMA ich `charged`, nie osobny licznik - zwrotu nie da
                                     sie wziac dwa razy)
  call:rooms                       - ZSET "<nazwa>|<utworzony>|<max_participants>" -> koniec
                                     pokoju (exp albo chwila potwierdzonego skasowania)
"""
import asyncio
import json
import math
import re
import secrets
import time
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone

from pydantic import SecretStr
from redis.exceptions import RedisError

from core import redis_client as redis_client_module
from core.config import get_settings
from core.exceptions import AppException
from core.logging import get_logger
from core.rate_limit import enforce_rate_limit

logger = get_logger(__name__)

# Twarde sufity w kodzie - env moze je tylko ZAOSTRZYC.
ROOM_MAX_TTL_SECONDS = 3 * 60 * 60
ROOM_MIN_TTL_SECONDS = 10 * 60
MAX_PARTICIPANTS_CEILING = 20
# Darmowa pula Daily to 10 000 minut uczestnika / mies.; prog nigdy nie podejdzie blizej niz 500.
MONTHLY_CAP_CEILING_MINUTES = 9500
USER_DAILY_CAP_CEILING_MINUTES = 24 * 60

DEFAULT_ROOM_PREFIX = "easylesson"

RATE_LIMIT_SCOPE = "voice_call"
RATE_LIMIT_USER = (10, 60)  # 10 / min na uzytkownika - kazde zadanie
RATE_LIMIT_IP = (30, 60 * 60)  # 30 / h na IP - proby tworzenia i wydane tokeny
USAGE_RATE_LIMIT_SCOPE = "voice_usage"

# Pokoj zostaje w rezerwacji miesiecznej jeszcze tyle po swoim koncu: Daily moze raportowac
# spotkanie dopiero po wyjsciu uczestnikow (zalozenie: najpozniej po 25 min = karencja - cache).
RESERVATION_GRACE_SECONDS = 30 * 60
REGISTRY_PRUNE_SECONDS = 24 * 60 * 60
# Najmniejsze obciazenie budzetu za utworzony pokoj (nawet od razu skasowany).
MIN_CHARGE_SECONDS = 60
MAX_ROOMS_PER_DAY = 40

LOCK_TTL_SECONDS = 120
LOCK_WAIT_SECONDS = 10.0
LOCK_POLL_SECONDS = 0.1
# Cala operacja tworzacego musi skonczyc sie przed wygasnieciem blokady.
CREATOR_TIMEOUT_SECONDS = 90

OWNER_KEY_TTL_SECONDS = 72 * 60 * 60
ROOMS_KEY = "call:rooms"

_state = {"warned_open_list": False}


def room_ttl_seconds() -> int:
    minutes = get_settings().daily_room_ttl_minutes
    return min(max(minutes * 60, ROOM_MIN_TTL_SECONDS), ROOM_MAX_TTL_SECONDS)


def max_participants() -> int:
    return min(max(get_settings().call_max_participants, 2), MAX_PARTICIPANTS_CEILING)


def monthly_cap_minutes() -> int:
    return min(max(get_settings().daily_monthly_minutes_cap, 0), MONTHLY_CAP_CEILING_MINUTES)


def user_daily_cap_seconds() -> int:
    minutes = min(max(get_settings().call_user_daily_minutes_cap, 0), USER_DAILY_CAP_CEILING_MINUTES)
    return minutes * 60


def daily_api_key() -> str:
    """
    Klucz API z ustawien albo "" (brak / nie nadaje sie do naglowka HTTP). W Settings to
    SecretStr - repr(Settings) i logi go nie pokazuja.
    """
    raw = get_settings().daily_api_key
    key = (raw.get_secret_value() if isinstance(raw, SecretStr) else str(raw or "")).strip()
    if key and not (key.isascii() and key.isprintable() and " " not in key):
        logger.error("DAILY_API_KEY zawiera niedozwolone znaki - rozmowy wyłączone")
        return ""
    return key


def room_prefix() -> str:
    prefix = re.sub(r"[^a-z0-9-]", "", (get_settings().daily_room_prefix or "").lower()).strip("-")
    return prefix or DEFAULT_ROOM_PREFIX


def is_board_room(name) -> bool:
    """Czy to nazwa pokoju tablicy z NASZYM prefiksem (<prefiks>-board-<id>)."""
    return isinstance(name, str) and re.fullmatch(rf"{re.escape(room_prefix())}-board-\d+", name) is not None


def _parse_ids(raw: str | None) -> frozenset[int] | None:
    """
    Lista id po przecinku. Pusta -> pusty zbior. Puste segmenty ("1," albo "1,,2") sa pomijane;
    kazdy NIEPUSTY segment nie do sparsowania albo sama interpunkcja (",") -> None (fail closed).
    """
    text = (raw or "").strip()
    if not text:
        return frozenset()
    ids = set()
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        if not part.isascii() or not part.isdigit():
            return None
        ids.add(int(part))
    return frozenset(ids) if ids else None


def creator_allowed(user_id: int) -> bool:
    """CALL_ALLOWED_USER_IDS: pusta = kazdy wlasciciel; smieci = nikt (fail closed)."""
    ids = _parse_ids(get_settings().call_allowed_user_ids)
    if ids is None:
        logger.error("CALL_ALLOWED_USER_IDS nie da się sparsować - nikt nie może tworzyć pokoi rozmów")
        return False
    if not ids and not _state["warned_open_list"]:
        _state["warned_open_list"] = True
        logger.warning(
            "DAILY_API_KEY jest ustawiony, a CALL_ALLOWED_USER_IDS pusta - pokoje rozmów może tworzyć "
            "KAŻDY właściciel przestrzeni. Ustaw CALL_ALLOWED_USER_IDS na id zaufanych kont."
        )
    return not ids or user_id in ids


def is_call_admin(user_id: int) -> bool:
    """CALL_ADMIN_USER_IDS: pusta albo smieci = nikt."""
    ids = _parse_ids(get_settings().call_admin_user_ids)
    if ids is None:
        logger.error("CALL_ADMIN_USER_IDS nie da się sparsować - endpoint zużycia rozmów jest zamknięty")
        return False
    return user_id in ids


def guard_unavailable() -> AppException:
    return AppException(
        "Rozmowa jest chwilowo niedostępna, spróbuj ponownie za chwilę",
        code="VOICE_GUARD_UNAVAILABLE",
        status_code=503,
    )


def user_limit_reached() -> AppException:
    return AppException(
        "Dzienny limit rozmów dla tego konta został wyczerpany",
        code="VOICE_USER_LIMIT",
        status_code=429,
    )


def call_busy() -> AppException:
    return AppException(
        "Rozmowa jest właśnie uruchamiana - spróbuj ponownie za chwilę",
        code="VOICE_CALL_BUSY",
        status_code=429,
    )


def _redis():
    return redis_client_module.get_redis_client()


@asynccontextmanager
async def _fail_closed(what: str):
    try:
        yield
    except (RedisError, ValueError, TypeError, KeyError, AttributeError) as e:
        # ValueError/TypeError/KeyError: uszkodzona wartosc w Redis - tez nie zgadujemy.
        logger.error(f"Rozmowa: bezpiecznik niedostępny ({what}): {type(e).__name__} - odmawiam (fail closed)")
        raise guard_unavailable()


async def enforce_user_rate_limit(user_id: int, scope: str = RATE_LIMIT_SCOPE) -> None:
    """10/min na uzytkownika - liczy KAZDE zadanie; awaria Redis = 503 (fail closed)."""
    async with _fail_closed("rate limit"):
        await enforce_rate_limit(scope, f"user:{user_id}", *RATE_LIMIT_USER, redis_client=_redis())


async def count_ip_attempt(client_ip: str) -> None:
    """
    30/h na IP - liczy tylko proby tworzenia pokoju i wydania tokenu. Tanie odmowy lokalne
    (uczen czekajacy na nauczyciela) go nie zuzywaja, wiec klasa za jednym NAT-em nie
    blokuje nauczycielowi rozpoczecia rozmowy.
    """
    async with _fail_closed("rate limit"):
        await enforce_rate_limit(RATE_LIMIT_SCOPE, f"ip:{client_ip}", *RATE_LIMIT_IP, redis_client=_redis())


@asynccontextmanager
async def creator_lock(user_id: int):
    """
    Jeden tworzacy = jedna operacja naraz (SET NX). Rownolegle zadanie czeka krotko, potem
    429 VOICE_CALL_BUSY. Dzieki temu dwa zadania nie rozlicza tego samego pokoju dwa razy
    i tworzacy ma najwyzej jeden zywy pokoj.
    """
    key = f"call:lock:creator:{user_id}"
    token = secrets.token_hex(8)
    deadline = time.monotonic() + LOCK_WAIT_SECONDS
    async with _fail_closed("blokada tworzącego"):
        redis = _redis()
        while not await redis.set(key, token, nx=True, ex=LOCK_TTL_SECONDS):
            if time.monotonic() >= deadline:
                raise call_busy()
            await asyncio.sleep(LOCK_POLL_SECONDS)
    try:
        yield
    finally:
        try:
            if await redis.get(key) == token:
                await redis.delete(key)
        except RedisError:
            pass  # blokada wygasnie sama


def day_of(now: int) -> str:
    return datetime.fromtimestamp(now, tz=timezone.utc).strftime("%Y%m%d")


# --- pokoje tworzacego i budzet dzienny ---


@dataclass
class OwnerRoom:
    room: str
    member: str  # wpis w rejestrze call:rooms
    created: int
    end: int  # exp pokoju albo chwila potwierdzonego skasowania pustego pokoju
    charged: int  # sekundy obciazajace budzet dnia `day`
    day: str
    open: bool = True  # False = pokoj zakonczony (skasowany / zastapiony / zniknal)
    settled: bool = False  # True = rozliczony wg spotkan z Daily, wiecej nie pytamy


@dataclass
class OwnerState:
    rooms: list[OwnerRoom] = field(default_factory=list)

    def live(self, now: int) -> OwnerRoom | None:
        alive = [room for room in self.rooms if room.open and room.end > now]
        return alive[-1] if alive else None

    def used(self, day: str) -> int:
        return sum(room.charged for room in self.rooms if room.day == day)

    def count(self, day: str) -> int:
        return sum(1 for room in self.rooms if room.day == day)


def budget_left(state: OwnerState, day: str) -> int:
    return max(0, user_daily_cap_seconds() - state.used(day))


def _owner_room(data: dict) -> OwnerRoom:
    room = OwnerRoom(
        room=data["room"], member=data["member"], created=data["created"], end=data["end"],
        charged=data["charged"], day=data["day"], open=data["open"], settled=data["settled"],
    )
    numbers = (room.created, room.end, room.charged)
    if any(isinstance(n, bool) or not isinstance(n, int) or n < 0 for n in numbers):
        raise ValueError("pokój tworzącego: liczby")
    if not all(isinstance(text, str) and text for text in (room.room, room.member, room.day)):
        raise ValueError("pokój tworzącego: tekst")
    if not isinstance(room.open, bool) or not isinstance(room.settled, bool):
        raise ValueError("pokój tworzącego: flagi")
    return room


async def load_owner(user_id: int, now: int) -> OwnerState:
    """Pokoje tworzacego z dzis i wczoraj (UTC) + zywy. Uszkodzony zapis = odmowa."""
    async with _fail_closed("pokoje tworzącego"):
        raw = await _redis().get(f"call:owner:{user_id}")
        if not raw:
            return OwnerState()
        rooms = [_owner_room(item) for item in json.loads(raw)["rooms"]]
    moment = datetime.fromtimestamp(now, tz=timezone.utc)
    keep = {moment.strftime("%Y%m%d"), (moment - timedelta(days=1)).strftime("%Y%m%d")}
    state = OwnerState(rooms=[room for room in rooms if room.day in keep or (room.open and room.end > now)])
    for room in state.rooms:
        if room.open and room.end <= now:
            room.open = False  # wygasl sam
    return state


async def save_owner(user_id: int, state: OwnerState) -> None:
    async with _fail_closed("pokoje tworzącego"):
        await _redis().set(
            f"call:owner:{user_id}",
            json.dumps({"rooms": [asdict(room) for room in state.rooms]}),
            ex=OWNER_KEY_TTL_SECONDS,
        )


# --- rejestr pokoi (rezerwacja miesieczna + sprzatanie) ---


@dataclass(frozen=True)
class RoomRecord:
    member: str
    name: str
    created: int
    end: int
    max_participants: int

    def minutes(self) -> int:
        """PELNY czas zycia pokoju x limit osob - niezaleznie od tego, co i kiedy raportuje Daily."""
        return math.ceil(max(0, self.end - self.created) * self.max_participants / 60)


def room_member(name: str, created: int, participants: int) -> str:
    return f"{name}|{int(created)}|{int(participants)}"


def _record(member: str, score: float) -> RoomRecord:
    end = int(score)
    name, _, rest = str(member).partition("|")
    try:
        created_text, participants_text = rest.split("|")
        created, participants = int(created_text), int(participants_text)
        if not (0 < created <= end and 1 <= participants <= MAX_PARTICIPANTS_CEILING):
            raise ValueError(member)
    except ValueError:
        # Nieczytelny wpis: zakladamy najdrozszy wariant.
        created, participants = end - ROOM_MAX_TTL_SECONDS, MAX_PARTICIPANTS_CEILING
    return RoomRecord(member=str(member), name=name, created=created, end=end, max_participants=participants)


async def register_room(member: str, end: int) -> None:
    async with _fail_closed("rejestr pokoi"):
        await _redis().zadd(ROOMS_KEY, {member: int(end)})


async def forget_room(member: str) -> None:
    async with _fail_closed("rejestr pokoi"):
        await _redis().zrem(ROOMS_KEY, member)


async def reserved_rooms(now: int) -> list[RoomRecord]:
    """Pokoje liczone do progu miesiecznego: zywe oraz zakonczone w okresie karencji."""
    async with _fail_closed("rejestr pokoi"):
        redis = _redis()
        await redis.zremrangebyscore(ROOMS_KEY, "-inf", now - REGISTRY_PRUNE_SECONDS)
        rows = await redis.zrangebyscore(
            ROOMS_KEY, f"({now - RESERVATION_GRACE_SECONDS}", "+inf", withscores=True
        )
        return [_record(member, score) for member, score in rows]


def live_record(records: list[RoomRecord], name: str, now: int) -> RoomRecord | None:
    alive = [record for record in records if record.name == name and record.end > now]
    return max(alive, key=lambda record: record.created) if alive else None


async def stale_rooms(now: int, limit: int) -> list[RoomRecord]:
    """Wpisy po okresie karencji (najstarsze pierwsze): kandydaci do skasowania w Daily."""
    rows = await _redis().zrangebyscore(
        ROOMS_KEY, "-inf", now - RESERVATION_GRACE_SECONDS, start=0, num=limit, withscores=True
    )
    return [_record(member, score) for member, score in rows]


def reserved_minutes(records: list[RoomRecord]) -> int:
    return sum(record.minutes() for record in records)
