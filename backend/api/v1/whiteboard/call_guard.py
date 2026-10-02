"""
Bezpieczniki kosztow i naduzyc rozmow Daily - czesc LOKALNA (bez wywolan Daily):
ustawienia z twardymi sufitami, listy uzytkownikow z env, rate limit, dzienny budzet
tworzacego i rejestr aktywnych pokoi w Redis.

Awaria Redis = FAIL CLOSED (503 VOICE_GUARD_UNAVAILABLE), inaczej niz w reszcie aplikacji:
bez licznikow nie umiemy ograniczyc kosztow, a brak rozmowy jest tanszy niz rachunek.

Klucze Redis:
  ratelimit:voice_call:user:<id> / ip:<ip>   - rate limit (core/rate_limit.enforce_rate_limit)
  call:budget:<user_id>:<YYYYMMDD>           - sekundy pokoi zarezerwowane dzis (UTC) przez tworzacego
  call:owner_room:<user_id>                  - JSON {room, exp, day}: jedyny aktywny pokoj tworzacego
  call:rooms                                 - ZSET nazwa pokoju -> exp (rezerwacja globalna + sprzatanie)
"""
import json
import math
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone

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

RATE_LIMIT_SCOPE = "voice_call"
RATE_LIMIT_USER = (10, 60)  # 10 / min na uzytkownika
RATE_LIMIT_IP = (30, 60 * 60)  # 30 / h na IP

BUDGET_KEY_TTL_SECONDS = 48 * 60 * 60
ROOMS_KEY = "call:rooms"


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


def _parse_ids(raw: str | None) -> frozenset[int] | None:
    """Lista id po przecinku. Pusta -> pusty zbior; cokolwiek nie do sparsowania -> None."""
    text = (raw or "").strip()
    if not text:
        return frozenset()
    ids = set()
    for part in text.split(","):
        part = part.strip()
        if not part.isascii() or not part.isdigit():
            return None
        ids.add(int(part))
    return frozenset(ids)


def creator_allowed(user_id: int) -> bool:
    """CALL_ALLOWED_USER_IDS: pusta = kazdy wlasciciel; smieci = nikt (fail closed)."""
    ids = _parse_ids(get_settings().call_allowed_user_ids)
    if ids is None:
        logger.error("CALL_ALLOWED_USER_IDS nie da się sparsować - nikt nie może tworzyć pokoi rozmów")
        return False
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


def _redis():
    return redis_client_module.get_redis_client()


@asynccontextmanager
async def _fail_closed(what: str):
    try:
        yield
    except (RedisError, ValueError, TypeError, KeyError) as e:
        # ValueError/TypeError/KeyError: uszkodzona wartosc w Redis - tez nie zgadujemy.
        logger.error(f"Rozmowa: bezpiecznik niedostępny ({what}): {type(e).__name__} - odmawiam (fail closed)")
        raise guard_unavailable()


async def enforce_rate_limits(user_id: int, client_ip: str) -> None:
    """10/min na uzytkownika i 30/h na IP; awaria Redis = 503 (fail closed)."""
    async with _fail_closed("rate limit"):
        redis = _redis()
        await enforce_rate_limit(RATE_LIMIT_SCOPE, f"user:{user_id}", *RATE_LIMIT_USER, redis_client=redis)
        await enforce_rate_limit(RATE_LIMIT_SCOPE, f"ip:{client_ip}", *RATE_LIMIT_IP, redis_client=redis)


def day_of(now: int) -> str:
    return datetime.fromtimestamp(now, tz=timezone.utc).strftime("%Y%m%d")


def _budget_key(user_id: int, day: str) -> str:
    return f"call:budget:{user_id}:{day}"


async def budget_left_seconds(user_id: int, now: int) -> int:
    async with _fail_closed("budżet dzienny"):
        used = int(await _redis().get(_budget_key(user_id, day_of(now))) or 0)
    return max(0, user_daily_cap_seconds() - max(0, used))


async def reserve_budget(user_id: int, wanted_seconds: int, minimum_seconds: int, now: int) -> int:
    """
    Rezerwuje czas pokoju w dziennym budzecie tworzacego. Zwraca przyznane sekundy
    (<= wanted, przyciete do reszty budzetu) albo rzuca 429 VOICE_USER_LIMIT, gdy reszta
    budzetu jest mniejsza niz `minimum_seconds`. Rezerwacja jest zapisywana PRZED wywolaniem
    Daily - rownolegle zadania (wiele tablic, wiele kart) nie obejda limitu.
    """
    cap = user_daily_cap_seconds()
    key = _budget_key(user_id, day_of(now))
    async with _fail_closed("budżet dzienny"):
        redis = _redis()
        used = max(0, int(await redis.get(key) or 0))
        grant = min(wanted_seconds, cap - used)
        if grant < minimum_seconds:
            raise user_limit_reached()
        total = await redis.incrby(key, grant)
        await redis.expire(key, BUDGET_KEY_TTL_SECONDS)
        if total > cap:  # wyscig z innym zadaniem tego samego uzytkownika
            await redis.decrby(key, grant)
            raise user_limit_reached()
    return grant


async def refund_budget(user_id: int, seconds: int, day: str) -> None:
    """Zwrot rezerwacji (nieudane tworzenie, pokoj zakonczony przed czasem). Blad = brak zwrotu."""
    if seconds <= 0:
        return
    try:
        redis = _redis()
        if await redis.decrby(_budget_key(user_id, day), seconds) < 0:
            await redis.set(_budget_key(user_id, day), 0, ex=BUDGET_KEY_TTL_SECONDS)
    except RedisError:
        logger.warning("Rozmowa: nie udało się zwrócić rezerwacji budżetu (zostaje zarezerwowana)")


@dataclass
class OwnerRoom:
    room: str
    exp: int
    day: str


async def get_owner_room(user_id: int) -> OwnerRoom | None:
    async with _fail_closed("pokój tworzącego"):
        raw = await _redis().get(f"call:owner_room:{user_id}")
        if not raw:
            return None
        data = json.loads(raw)
        return OwnerRoom(room=str(data["room"]), exp=int(data["exp"]), day=str(data["day"]))


async def set_owner_room(user_id: int, room: str, exp: int, day: str, now: int) -> None:
    async with _fail_closed("pokój tworzącego"):
        await _redis().set(
            f"call:owner_room:{user_id}",
            json.dumps({"room": room, "exp": exp, "day": day}),
            ex=max(60, exp - now) + BUDGET_KEY_TTL_SECONDS,
        )


async def clear_owner_room(user_id: int) -> None:
    async with _fail_closed("pokój tworzącego"):
        await _redis().delete(f"call:owner_room:{user_id}")


async def register_room(room: str, exp: int) -> None:
    async with _fail_closed("rejestr pokoi"):
        await _redis().zadd(ROOMS_KEY, {room: exp})


async def unregister_room(room: str) -> None:
    async with _fail_closed("rejestr pokoi"):
        await _redis().zrem(ROOMS_KEY, room)


async def active_rooms(now: int) -> dict[str, int]:
    """Pokoje z rejestru, ktore jeszcze nie wygasly: nazwa -> exp."""
    async with _fail_closed("rejestr pokoi"):
        rows = await _redis().zrangebyscore(ROOMS_KEY, f"({now}", "+inf", withscores=True)
        return {str(name): int(score) for name, score in rows}


async def expired_rooms(now: int, grace_seconds: int, limit: int) -> list[str]:
    """Pokoje z rejestru wygasle dawniej niz `grace_seconds` temu (kandydaci do skasowania w Daily)."""
    rows = await _redis().zrangebyscore(ROOMS_KEY, "-inf", now - grace_seconds, start=0, num=limit)
    return [str(name) for name in rows]


def reserved_minutes(rooms: dict[str, int], now: int) -> int:
    """
    Najgorszy przypadek dla trwajacych pokoi: kazdy zapelniony do max_participants az do exp.
    Zabezpiecza przed przekroczeniem progu miedzy odswiezeniami zuzycia z Daily (cache 5 min).
    """
    seconds = sum(max(0, exp - now) for exp in rooms.values())
    return math.ceil(seconds * max_participants() / 60)
