"""
Zuzycie minut uczestnikow Daily w biezacym miesiacu kalendarzowym (UTC) - z PRAWDZIWYCH danych
Daily (GET /meetings), nie z naszych zapisow. Uzywane przy kazdym wydaniu tokenu (call.py)
i w endpoincie admina.

Prog miesieczny porownujemy z suma (`reserved_total` + `MonthUsage.minutes`):
  1. minuty zaraportowane przez Daily; dla spotkan trwajacych liczymy na uczestnika
     max(duration, teraz - join_time) - Daily moze podawac `duration` dopiero po wyjsciu,
  2. PELNY czas zycia kazdego pokoju z rejestru x max_participants - od utworzenia, przez caly
     czas istnienia pokoju i jeszcze `RESERVATION_GRACE_SECONDS` po jego koncu. Ta czesc NIE
     zalezy od tego, co i kiedy raportuje Daily. Minuty liczone podwojnie (1 i 2) to swiadome
     zawyzenie: zanizenie = rachunek,
  3. pokoje tablic widoczne w GET /rooms, ktorych nie ma w rejestrze (utrata danych Redis),
     i trwajace spotkania w pokojach spoza rejestru.

GET /meetings (docs.daily.co/reference/rest-api/meetings/list-meetings, potwierdzone 02.10.2026):
  parametry `room`, `timeframe_start`, `timeframe_end` (unix s), `limit`, `starting_after`
  (id spotkania), `ongoing`, `no_participants`; odpowiedz `{total_count, data:[{id, room,
  start_time, duration, ongoing, max_participants, participants:[{user_id, participant_id,
  user_name, join_time, duration}]}]}`, czasy w sekundach.
NIEPOTWIERDZONE: maksymalny `limit`, kolejnosc stron, znaczenie `total_count` - dlatego strony
czytamy do PUSTEJ strony (nigdy "do total_count"), a kazda niespojnosc (powtorzone id, mniej
spotkan niz `total_count`, nieoczekiwany ksztalt, za duzo stron) = FAIL CLOSED: brak tokenu.

Cache 5 min: Redis (wspolny dla wszystkich workerow), a gdy Redis nie dziala - pamiec procesu.
Nieudane pobranie jest pamietane 30 s, zeby awaria Daily nie zamieniala klikniec w serie zapytan.
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
ROOMS_LIST_LIMIT = 100
EXPIRED_ROOMS_KEPT = 20

# Bledy, ktore przy czytaniu odpowiedzi Daily oznaczaja "nie wiemy".
UNREADABLE =(AppException, ValueError, TypeError, AttributeError, KeyError, OverflowError)


@dataclass
class MonthUsage:
    month: str  # "YYYY-MM" (UTC)
    minutes: int  # minuty uczestnikow: suma po uczestnikach, kazdy zaokraglony w gore
    meetings: int
    fetched_at: int
    # Trwajace spotkania: [nazwa pokoju, szczytowa liczba uczestnikow]
    ongoing: list[list] = field(default_factory=list)
    # Pokoje tablic wg GET /rooms: [nazwa, utworzony (0 = nieznane), exp (0 = brak), limit osob (0 = brak)]
    rooms: list[list] = field(default_factory=list)
    # Nazwy pokoi tablic wygaslych dawniej niz okres karencji (kandydaci do sprzatania)
    expired: list[str] = field(default_factory=list)


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


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _seconds(value) -> int:
    if not _is_number(value) or value < 0:
        raise ValueError("duration")
    return int(math.ceil(value))


def _count(value) -> int:
    """Nieujemna liczba calkowita (nie bool, nie tekst) albo ValueError."""
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("licznik")
    return value


async def read_meetings(client: httpx.AsyncClient, params: dict) -> list[dict]:
    """
    Wszystkie spotkania pasujace do `params`: strony czytane do PUSTEJ (pole `total_count`
    nie konczy czytania - sluzy tylko do wykrycia brakow). Watpliwosc -> ValueError / AppException.
    """
    meetings: list[dict] = []
    seen: set[str] = set()
    total_count = 0
    starting_after = None
    page_limit: int | None = MEETINGS_PAGE_LIMIT

    for _ in range(MEETINGS_MAX_PAGES):
        query = dict(params)
        if page_limit:
            query["limit"] = page_limit
        if starting_after:
            query["starting_after"] = starting_after
        response = await daily_client.request(client, "GET", "/meetings", params=query)
        if response.status_code == 400 and page_limit and not seen:
            # Maksymalny `limit` nie jest udokumentowany: gdyby Daily odrzucil nasz, czytamy
            # domyslnymi stronami (te same dane, wiecej zapytan) zamiast trwale odmawiac rozmow.
            page_limit = None
            del query["limit"]
            response = await daily_client.request(client, "GET", "/meetings", params=query)
        if response.status_code != 200:
            raise ValueError(f"HTTP {response.status_code}")
        page = response.json()
        data = page.get("data") if isinstance(page, dict) else None
        if not isinstance(data, list):
            raise ValueError("brak data[]")
        count = page.get("total_count")
        if isinstance(count, int) and not isinstance(count, bool) and count > total_count:
            total_count = count
        if not data:
            break
        for meeting in data:
            meeting_id = meeting.get("id") if isinstance(meeting, dict) else None
            if not isinstance(meeting_id, str) or not meeting_id:
                raise ValueError("spotkanie bez id")
            if meeting_id in seen:
                raise ValueError("paginacja nie przesuwa się (powtórzone spotkanie)")
            seen.add(meeting_id)
            meetings.append(meeting)
        starting_after = data[-1]["id"]
    else:
        raise ValueError("za dużo stron /meetings")

    if len(meetings) < total_count:
        raise ValueError("paginacja niepełna (mniej spotkań niż total_count)")
    return meetings


def _meeting_minutes(meeting: dict, now: int) -> tuple[int, list | None]:
    """(minuty uczestnikow spotkania, [pokoj, szczyt] dla trwajacego albo None)."""
    participants = meeting.get("participants")
    if not isinstance(participants, list):
        raise ValueError("spotkanie bez participants")
    ongoing = meeting.get("ongoing")
    if not isinstance(ongoing, bool):
        raise ValueError("spotkanie bez pola ongoing")
    start = meeting.get("start_time")
    peak = meeting.get("max_participants")
    peak = peak if isinstance(peak, int) and not isinstance(peak, bool) and peak > 0 else 0

    def running(seconds: int, since) -> int:
        # Trwajace: Daily moze podawac `duration` dopiero po wyjsciu - liczymy czas od wejscia.
        if not ongoing:
            return seconds
        since = since if _is_number(since) and since > 0 else start
        if not _is_number(since) or since <= 0:
            raise ValueError("trwające spotkanie bez join_time / start_time")
        return max(seconds, int(math.ceil(now - since)))

    minutes = 0
    for participant in participants:
        if not isinstance(participant, dict):
            raise ValueError("uczestnik")
        seconds = running(_seconds(participant.get("duration")), participant.get("join_time"))
        minutes += math.ceil(seconds / 60)
    if not participants:
        # Brak listy uczestnikow przy trwajacym / odbytym spotkaniu: NIE zero - caly czas
        # spotkania x limit osob w pokoju.
        seconds = running(_seconds(meeting.get("duration")), start)
        minutes = math.ceil(seconds / 60) * max(peak, guard.max_participants())
    people = max(peak, len(participants), 1)
    return minutes, ([str(meeting.get("room") or ""), people] if ongoing else None)


def room_created(room: dict) -> int:
    try:
        moment = datetime.fromisoformat(str(room.get("created_at")).replace("Z", "+00:00"))
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        return max(0, int(moment.timestamp()))
    except (ValueError, OverflowError):
        return 0


async def _board_rooms(client: httpx.AsyncClient, now: int) -> tuple[list[list], list[str]]:
    """Pokoje tablic istniejace w Daily (zywe / w karencji) i nazwy dawno wygaslych."""
    response = await daily_client.request(client, "GET", "/rooms", params={"limit": ROOMS_LIST_LIMIT})
    if response.status_code != 200:
        raise ValueError(f"/rooms HTTP {response.status_code}")
    page = response.json()
    data = page.get("data") if isinstance(page, dict) else None
    if not isinstance(data, list):
        raise ValueError("/rooms bez data[]")
    rooms: list[list] = []
    expired: list[str] = []
    for room in data:
        if not isinstance(room, dict):
            raise ValueError("/rooms: pokój")
        name = room.get("name")
        if not guard.is_board_room(name):
            continue
        config = room.get("config") if isinstance(room.get("config"), dict) else {}
        exp = config.get("exp")
        exp = int(exp) if _is_number(exp) and exp > 0 else 0
        if exp and exp <= now - guard.RESERVATION_GRACE_SECONDS:
            if len(expired) < EXPIRED_ROOMS_KEPT:
                expired.append(name)
            continue
        limit = config.get("max_participants")
        limit = limit if isinstance(limit, int) and not isinstance(limit, bool) and limit > 0 else 0
        rooms.append([name, room_created(room), exp, limit])
    return rooms, expired


async def fetch_month_usage(client: httpx.AsyncClient, now: int) -> MonthUsage:
    """Czyta WSZYSTKIE spotkania miesiaca i liste pokoi z Daily. Kazda watpliwosc -> wyjatek."""
    month, month_start = month_of(now)
    meetings = await read_meetings(client, {"timeframe_start": month_start, "timeframe_end": now + 60})
    minutes = 0
    ongoing: list[list] = []
    for meeting in meetings:
        meeting_minutes, running = _meeting_minutes(meeting, now)
        minutes += meeting_minutes
        if running is not None:
            ongoing.append(running)
    rooms, expired = await _board_rooms(client, now)
    return MonthUsage(
        month=month, minutes=minutes, meetings=len(meetings), fetched_at=now,
        ongoing=ongoing, rooms=rooms, expired=expired,
    )


async def room_meeting_seconds(
    client: httpx.AsyncClient, room: str, created: int, end: int, now: int
) -> int | None:
    """
    Ile sekund ktokolwiek byl w pokoju `room` miedzy `created` a `end` (suma czasow spotkan).
    None = jakies spotkanie jeszcze trwa. Do rozliczenia dziennego budzetu tworzacego.
    """
    meetings = await read_meetings(
        client, {"room": room, "timeframe_start": created - 60, "timeframe_end": now + 60}
    )
    total = 0
    for meeting in meetings:
        if meeting.get("room") != room:
            continue
        start = meeting.get("start_time")
        if not _is_number(start):
            raise ValueError("spotkanie bez start_time")
        if start > end + 60:
            continue
        if meeting.get("ongoing") is not False:
            return None
        participants = meeting.get("participants")
        if not isinstance(participants, list):
            raise ValueError("spotkanie bez participants")
        longest = max((_seconds(p.get("duration")) for p in participants), default=0)
        duration = max(_seconds(meeting.get("duration")), longest)
        # Liczy sie kazde spotkanie ZACHODZACE na czas pokoju (takze zaczete wczesniej, np. przed
        # przejeciem pokoju) - w calosci.
        if start + duration >= created - 60:
            total += duration
    return total


def _fresh(usage: MonthUsage | None, month: str, now: int) -> bool:
    return usage is not None and usage.month == month and 0 <= now - usage.fetched_at < USAGE_CACHE_SECONDS


def _from_json(raw) -> MonthUsage | None:
    """Wpis z cache albo None, gdy cokolwiek sie nie zgadza (ujemne, nieliczbowe, zly ksztalt)."""
    try:
        data = json.loads(raw)
        month = data["month"]
        if not isinstance(month, str):
            raise ValueError("month")
        ongoing = [[str(room), _count(peak)] for room, peak in data["ongoing"]]
        rooms = [
            [str(name), _count(created), _count(exp), _count(limit)]
            for name, created, exp, limit in data["rooms"]
        ]
        expired = [str(name) for name in data["expired"]]
        return MonthUsage(
            month=month,
            minutes=_count(data["minutes"]),
            meetings=_count(data["meetings"]),
            fetched_at=_count(data["fetched_at"]),
            ongoing=ongoing,
            rooms=rooms,
            expired=expired,
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
    except Exception as e:  # kazdy blad (takze nieprzewidziany) = brak zuzycia = brak tokenu
        _memory["failed_until"] = time.monotonic() + USAGE_FAILURE_CACHE_SECONDS
        if isinstance(e, AppException):
            detail = e.code
        elif isinstance(e, ValueError):
            detail = daily_client.log_text(e, api_key)
        else:
            detail = type(e).__name__
        logger.error(f"Rozmowa: nie udało się ustalić zużycia minut Daily ({detail}) - odmawiam (fail closed)")
        raise usage_unavailable()

    _memory["usage"] = usage
    if redis is not None:
        try:
            await redis.set(cache_key, json.dumps(asdict(usage)), ex=USAGE_CACHE_SECONDS)
        except RedisError:
            logger.warning("Rozmowa: nie udało się zapisać zużycia Daily w Redis (zostaje w pamięci procesu)")
    return usage


def reserved_total(usage: MonthUsage, records: list[guard.RoomRecord], now: int) -> int:
    """
    Minuty ZAREZERWOWANE (poza zaraportowanym zuzyciem): pelny czas zycia pokoi z rejestru
    + pokoje spoza rejestru: pokoje tablic z listy Daily (rejestr utracony) i trwajace
    spotkania w obcych pokojach (szczyt uczestnikow x maksymalny czas pokoju).
    """
    known = {record.name for record in records}
    unknown: dict[str, int] = {}
    for room, peak in usage.ongoing:
        if room not in known:
            unknown[room] = unknown.get(room, 0) + math.ceil(peak * guard.ROOM_MAX_TTL_SECONDS / 60)
    for name, created, exp, limit in usage.rooms:
        if name in known or (exp and exp <= now - guard.RESERVATION_GRACE_SECONDS):
            continue
        lifetime = exp - created if 0 < created < exp else guard.ROOM_MAX_TTL_SECONDS
        people = limit or guard.MAX_PARTICIPANTS_CEILING
        unknown[name] = max(unknown.get(name, 0), math.ceil(lifetime * people / 60))
    return guard.reserved_minutes(records) + sum(unknown.values())


async def _rooms_count(client: httpx.AsyncClient) -> int | None:
    try:
        response = await daily_client.request(client, "GET", "/rooms", params={"limit": ROOMS_LIST_LIMIT})
    except AppException:
        return None
    data = daily_client.body(response) if response.status_code == 200 else {}
    count, rooms = data.get("total_count"), data.get("data")
    if isinstance(count, int) and not isinstance(count, bool) and count >= 0:
        return count
    return len(rooms) if isinstance(rooms, list) else None


async def usage_report(user_id: int) -> CallUsageResponse:
    """Stan bezpiecznikow dla admina (CALL_ADMIN_USER_IDS). Nigdy nie zwraca klucza ani tokenow."""
    if not guard.is_call_admin(user_id):
        raise AppException("Brak dostępu", code="FORBIDDEN", status_code=403)
    # Osobny kubelek: podglad zuzycia nie zjada limitu rozmowy admina.
    await guard.enforce_user_rate_limit(user_id, guard.USAGE_RATE_LIMIT_SCOPE)

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
    api_key = guard.daily_api_key()
    if not get_settings().call_enabled:
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

    records = await guard.reserved_rooms(now)
    reserved = reserved_total(usage, records, now)
    report.used_minutes = usage.minutes
    report.reserved_minutes = reserved
    report.planned_minutes = usage.minutes + reserved
    report.meetings = usage.meetings
    report.ongoing_meetings = len(usage.ongoing)
    report.active_rooms = sum(1 for record in records if record.end > now)
    report.fetched_at = datetime.fromtimestamp(usage.fetched_at, tz=timezone.utc)
    if report.planned_minutes > cap or usage.minutes >= cap:
        report.state = "limit"
    return report
