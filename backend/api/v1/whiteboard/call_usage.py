"""
Zuzycie minut uczestnikow Daily w biezacym miesiacu kalendarzowym (UTC) - z PRAWDZIWYCH danych
Daily (GET /meetings), nie z naszych zapisow. Uzywane przy kazdym wydaniu tokenu (call.py)
i w endpoincie admina.

GET /meetings (docs.daily.co/reference/rest-api/meetings/list-meetings, potwierdzone 02.10.2026):
  parametry `timeframe_start`, `timeframe_end` (unix s), `limit`, `starting_after` (id spotkania),
  `ongoing`, `no_participants`; odpowiedz `{total_count, data:[{id, room, start_time, duration,
  ongoing, max_participants, participants:[{user_id, participant_id, user_name, join_time,
  duration}]}]}`, czasy w sekundach. Kamera i samo audio licza sie tak samo (minuta uczestnika).
NIEPOTWIERDZONE w dokumentacji: maksymalny `limit` i kolejnosc stron - dlatego strony czytamy
do pustej albo do `total_count`, a kazda niespojnosc (powtorzone id, mniej spotkan niz
`total_count`, nieoczekiwany ksztalt, za duzo stron) = FAIL CLOSED: brak zuzycia = brak tokenu.

Cache 5 min: Redis (wspolny dla wszystkich workerow), a gdy Redis nie dziala - pamiec procesu
(kazdy worker pyta wtedy Daily sam, najwyzej raz na 5 min). Nieudane pobranie jest pamietane
30 s, zeby awaria Daily nie zamieniala kazdego klikniecia w serie zapytan.
"""
import json
import math
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

import httpx
from redis.exceptions import RedisError

from core import redis_client as redis_client_module
from core.config import get_settings
from core.exceptions import AppException
from core.logging import get_logger

from . import call_guard as guard
from . import daily_client
from .schemas import CallUsageResponse

logger = get_logger(__name__)

USAGE_CACHE_SECONDS = 5 * 60
USAGE_FAILURE_CACHE_SECONDS = 30
MEETINGS_PAGE_LIMIT = 100
MEETINGS_MAX_PAGES = 100


@dataclass
class MonthUsage:
    month: str  # "YYYY-MM" (UTC)
    minutes: int  # minuty uczestnikow: suma po uczestnikach, kazdy zaokraglony w gore
    meetings: int
    fetched_at: int
    # Trwajace spotkania: [nazwa pokoju, szczytowa liczba uczestnikow]
    ongoing: list[list] = field(default_factory=list)


_memory: dict = {"usage": None, "failed_until": 0.0}


def reset_memory_cache() -> None:
    _memory["usage"] = None
    _memory["failed_until"] = 0.0


def usage_unavailable() -> AppException:
    return AppException(
        "Nie udało się sprawdzić limitu rozmów, spróbuj ponownie za chwilę",
        code="VOICE_USAGE_UNAVAILABLE",
        status_code=503,
    )


def month_of(now: int) -> tuple[str, int]:
    """("YYYY-MM", unix poczatku miesiaca) w UTC."""
    moment = datetime.fromtimestamp(now, tz=timezone.utc)
    start = moment.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start.strftime("%Y-%m"), int(start.timestamp())


def _seconds(value) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0 or value != value:
        raise ValueError("duration")
    return int(math.ceil(value))


async def fetch_month_usage(client: httpx.AsyncClient, now: int) -> MonthUsage:
    """Czyta WSZYSTKIE spotkania miesiaca z Daily. Kazda watpliwosc -> ValueError / AppException."""
    month, month_start = month_of(now)
    minutes = 0
    seen: set[str] = set()
    ongoing: list[list] = []
    total_count = None
    starting_after = None

    page_limit: int | None = MEETINGS_PAGE_LIMIT
    for _ in range(MEETINGS_MAX_PAGES):
        params = {"timeframe_start": month_start, "timeframe_end": now + 60}
        if page_limit:
            params["limit"] = page_limit
        if starting_after:
            params["starting_after"] = starting_after
        response = await daily_client.request(client, "GET", "/meetings", params=params)
        if response.status_code == 400 and page_limit and not seen:
            # Maksymalny `limit` nie jest udokumentowany: gdyby Daily odrzucil nasz, czytamy
            # domyslnymi stronami (te same dane, wiecej zapytan) zamiast trwale odmawiac rozmow.
            page_limit = None
            del params["limit"]
            response = await daily_client.request(client, "GET", "/meetings", params=params)
        if response.status_code != 200:
            raise ValueError(f"HTTP {response.status_code}")
        page = response.json()
        data = page.get("data") if isinstance(page, dict) else None
        if not isinstance(data, list):
            raise ValueError("brak data[]")
        count = page.get("total_count")
        if isinstance(count, int) and not isinstance(count, bool) and count >= 0:
            total_count = count if total_count is None else max(total_count, count)

        for meeting in data:
            meeting_id = meeting.get("id") if isinstance(meeting, dict) else None
            participants = meeting.get("participants") if isinstance(meeting, dict) else None
            if not isinstance(meeting_id, str) or not meeting_id or not isinstance(participants, list):
                raise ValueError("spotkanie bez id / participants")
            if meeting_id in seen:
                raise ValueError("paginacja nie przesuwa się (powtórzone spotkanie)")
            seen.add(meeting_id)
            for participant in participants:
                if not isinstance(participant, dict):
                    raise ValueError("uczestnik")
                minutes += math.ceil(_seconds(participant.get("duration")) / 60)
            if meeting.get("ongoing") is True:
                peak = meeting.get("max_participants")
                peak = peak if isinstance(peak, int) and not isinstance(peak, bool) and peak > 0 else 0
                ongoing.append([str(meeting.get("room") or ""), max(peak, len(participants), 1)])
            elif meeting.get("ongoing") is not False:
                raise ValueError("spotkanie bez pola ongoing")

        if not data or (total_count is not None and len(seen) >= total_count):
            break
        starting_after = data[-1]["id"]
    else:
        raise ValueError("za dużo stron /meetings")

    if total_count is not None and len(seen) < total_count:
        raise ValueError("paginacja niepełna (mniej spotkań niż total_count)")
    return MonthUsage(month=month, minutes=minutes, meetings=len(seen), fetched_at=now, ongoing=ongoing)


def _fresh(usage: MonthUsage | None, month: str, now: int) -> bool:
    return usage is not None and usage.month == month and 0 <= now - usage.fetched_at < USAGE_CACHE_SECONDS


def _from_json(raw) -> MonthUsage | None:
    try:
        data = json.loads(raw)
        return MonthUsage(
            month=str(data["month"]),
            minutes=int(data["minutes"]),
            meetings=int(data["meetings"]),
            fetched_at=int(data["fetched_at"]),
            ongoing=[[str(room), int(peak)] for room, peak in data["ongoing"]],
        )
    except (ValueError, TypeError, KeyError):
        return None


async def get_month_usage(client: httpx.AsyncClient, api_key: str, now: int | None = None) -> MonthUsage:
    """Zuzycie miesiaca z cache (5 min) albo z Daily. Nie da sie ustalic -> 503 VOICE_USAGE_UNAVAILABLE."""
    now = int(time.time()) if now is None else now
    month, _ = month_of(now)
    cache_key = f"call:daily_usage:{month}"

    redis = None
    try:
        redis = redis_client_module.get_redis_client()
        raw = await redis.get(cache_key)
        cached = _from_json(raw) if raw else None
        if _fresh(cached, month, now):
            return cached
    except RedisError:
        redis = None
        if _fresh(_memory["usage"], month, now):
            return _memory["usage"]

    if time.monotonic() < _memory["failed_until"]:
        raise usage_unavailable()
    try:
        usage = await fetch_month_usage(client, now)
    except (AppException, ValueError, TypeError, AttributeError) as e:
        _memory["failed_until"] = time.monotonic() + USAGE_FAILURE_CACHE_SECONDS
        detail = e.code if isinstance(e, AppException) else daily_client.log_text(e, api_key)
        logger.error(f"Rozmowa: nie udało się ustalić zużycia minut Daily ({detail}) - odmawiam (fail closed)")
        raise usage_unavailable()

    _memory["usage"] = usage
    if redis is not None:
        try:
            await redis.set(cache_key, json.dumps(asdict(usage)), ex=USAGE_CACHE_SECONDS)
        except RedisError:
            logger.warning("Rozmowa: nie udało się zapisać zużycia Daily w Redis (zostaje w pamięci procesu)")
    return usage


def unknown_ongoing_minutes(usage: MonthUsage, known_rooms: dict[str, int], ceiling_seconds: int) -> int:
    """
    Narzut na trwajace spotkania w pokojach, ktorych NIE ma w naszym rejestrze (utworzone recznie,
    rejestr utracony): szczytowa liczba uczestnikow x maksymalny czas pokoju.
    """
    people = sum(peak for room, peak in usage.ongoing if room not in known_rooms)
    return math.ceil(people * ceiling_seconds / 60)


async def _rooms_count(client: httpx.AsyncClient) -> int | None:
    try:
        response = await daily_client.request(client, "GET", "/rooms", params={"limit": 100})
    except AppException:
        return None
    data = daily_client.body(response) if response.status_code == 200 else {}
    count, rooms = data.get("total_count"), data.get("data")
    if isinstance(count, int) and not isinstance(count, bool):
        return count
    return len(rooms) if isinstance(rooms, list) else None


async def usage_report(user_id: int, client_ip: str) -> CallUsageResponse:
    """Stan bezpiecznikow dla admina (CALL_ADMIN_USER_IDS). Nigdy nie zwraca klucza ani tokenow."""
    if not guard.is_call_admin(user_id):
        raise AppException("Brak dostępu", code="FORBIDDEN", status_code=403)
    await guard.enforce_rate_limits(user_id, client_ip)

    settings = get_settings()
    now = int(time.time())
    month, _ = month_of(now)
    cap = guard.monthly_cap_minutes()
    report = CallUsageResponse(
        state="enabled",
        month=month,
        cap_minutes=cap,
        user_daily_cap_minutes=guard.user_daily_cap_seconds() // 60,
        max_participants=guard.max_participants(),
    )
    api_key = (settings.daily_api_key or "").strip()
    if not settings.call_enabled:
        report.state = "disabled"
        return report
    if not api_key:
        report.state = "not_configured"
        return report

    async with daily_client.daily_http_client(api_key) as client:
        report.rooms_count = await _rooms_count(client)
        try:
            usage = await get_month_usage(client, api_key, now)
        except AppException:
            report.state = "unknown"
            return report

    known = await guard.active_rooms(now)
    reserved = guard.reserved_minutes(known, now) + unknown_ongoing_minutes(
        usage, known, guard.ROOM_MAX_TTL_SECONDS
    )
    report.used_minutes = usage.minutes
    report.reserved_minutes = reserved
    report.planned_minutes = usage.minutes + reserved
    report.meetings = usage.meetings
    report.ongoing_meetings = len(usage.ongoing)
    report.active_rooms = len(known)
    report.fetched_at = datetime.fromtimestamp(usage.fetched_at, tz=timezone.utc)
    if report.planned_minutes > cap or usage.minutes >= cap:
        report.state = "limit"
    return report
