"""
Testy bezpiecznikow kosztow rozmow Daily (call_guard.py, call_usage.py, core/config.py):
prog miesieczny z prawdziwego zuzycia, dzienny budzet tworzacego, rate limit, awaria Redis,
endpoint admina, odpornosc Settings na smieciowe env i szukanie klucza w odpowiedziach/logach.
Dostep, pokoj, token i bledy Daily: test_whiteboard_call.py.
"""
import logging
import time
from datetime import datetime, timezone

import httpx
import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

import api.v1.whiteboard.call_guard as guard
import api.v1.whiteboard.call_usage as call_usage
import api.v1.whiteboard.daily_client as daily_client
from core import redis_client as redis_client_module
from core.config import Settings, get_settings

from .daily_fake import (
    API_KEY, DAILY_TOKEN, add_board, add_member, daily_error, get_usage, meeting, post_call, room_of,
)

HOUR = 3600


def budget_of(sync_redis_client, user) -> int:
    return int(sync_redis_client.get(f"call:budget:{user.id}:{guard.day_of(int(time.time()))}") or 0)


def someone_present() -> list[dict]:
    return [{"id": "p1", "userId": None, "userName": "X", "duration": 5}]


class BrokenRedis:
    """Redis, ktory na kazda komende odpowiada bledem polaczenia."""

    def __getattr__(self, name):
        async def fail(*args, **kwargs):
            raise RedisConnectionError("redis down")

        return fail


class TestMonthlyUsage:

    def test_zuzycie_to_suma_minut_uczestnikow_z_daily(self, client, daily, caplog, test_user, test_board):
        daily.meetings = [meeting([30, 30.5]), meeting([10])]  # 30 + 31 + 10

        with caplog.at_level(logging.INFO):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert "zużycie miesiąca=71 min" in caplog.text
        params = daily.calls("GET", "/meetings")[0].url.params
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        assert int(params["timeframe_start"]) == int(month_start.timestamp())
        assert int(params["timeframe_end"]) >= int(time.time())

    def test_zuzycie_powyzej_progu_blokuje_tworzenie(self, client, daily, test_user, test_board):
        daily.meetings = [meeting([2000, 2000, 2000, 2000])]

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"
        assert r.json()["error"] == "Limit rozmów w tym miesiącu wyczerpany"
        assert daily.writes() == []
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_zuzycie_powyzej_progu_blokuje_takze_dolaczanie(self, client, daily, db_session, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "editor")
        daily.add_room(room_of(test_board))
        daily.meetings = [meeting([8000])]

        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_prog_z_env(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "daily_monthly_minutes_cap", 100)
        daily.meetings = [meeting([100])]
        assert post_call(client, test_board.id, test_user.id).json()["code"] == "VOICE_MONTHLY_LIMIT"

    def test_nowy_pokoj_ktory_przekroczylby_prog_nie_powstaje(self, client, daily, sync_redis_client, test_user, test_board):
        # 7500 zuzyte + najgorszy przypadek nowego pokoju (4 osoby x 180 min = 720) > 8000
        daily.meetings = [meeting([7500])]

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"
        assert daily.calls("POST", "/rooms") == []
        assert budget_of(sync_redis_client, test_user) == 0  # rezerwacja budzetu zwrocona

    def test_trwajace_pokoje_sa_rezerwowane_do_progu(self, client, daily, monkeypatch, sync_redis_client, test_user, test_board):
        # Prog 1000: trwajacy pokoj innej tablicy rezerwuje 4 x 180 = 720 min, nowy juz sie nie miesci.
        monkeypatch.setattr(get_settings(), "daily_monthly_minutes_cap", 1000)
        sync_redis_client.zadd("call:rooms", {"easylesson-board-999": int(time.time()) + 3 * HOUR})

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"
        assert daily.calls("POST", "/rooms") == []

    def test_trwajace_spotkanie_w_nieznanym_pokoju_jest_szacowane(self, client, daily, monkeypatch, test_user, test_board):
        # 2 osoby w pokoju spoza rejestru: szacunek 2 x 180 min = 360 > prog 300
        monkeypatch.setattr(get_settings(), "daily_monthly_minutes_cap", 300)
        daily.meetings = [meeting([1, 1], room="reczny-pokoj", ongoing=True)]

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"

    def test_prog_ma_twardy_sufit_w_kodzie(self, monkeypatch):
        monkeypatch.setattr(get_settings(), "daily_monthly_minutes_cap", 50000)
        assert guard.monthly_cap_minutes() == 9500

    def test_paginacja_czyta_wszystkie_strony(self, client, daily, caplog, test_user, test_board):
        daily.meetings = [meeting([1]) for _ in range(250)]

        with caplog.at_level(logging.INFO):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert "zużycie miesiąca=250 min" in caplog.text
        pages = daily.calls("GET", "/meetings")
        assert len(pages) == 3
        assert pages[1].url.params["starting_after"] == daily.meetings[99]["id"]

    def test_odrzucony_limit_strony_czyta_domyslnymi_stronami(self, client, daily, caplog, test_user, test_board):
        daily.meetings = [meeting([1]) for _ in range(45)]

        def no_limit(request):
            if "limit" in request.url.params:
                return daily_error(400, "invalid-request-error", "limit")
            return daily._meetings(request)

        daily.override("GET", "/meetings", no_limit)

        with caplog.at_level(logging.INFO):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert "zużycie miesiąca=45 min" in caplog.text

    def test_cache_5_min_nie_pyta_daily_drugi_raz(self, client, daily, test_user, test_board):
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert len(daily.calls("GET", "/meetings")) == 1

        sync_usage_cache_reset(client)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert len(daily.calls("GET", "/meetings")) == 2

    def test_swiezosc_cache(self):
        usage = call_usage.MonthUsage(month="2026-10", minutes=1, meetings=1, fetched_at=1000)
        assert call_usage._fresh(usage, "2026-10", 1000 + 299) is True
        assert call_usage._fresh(usage, "2026-10", 1000 + 300) is False
        assert call_usage._fresh(usage, "2026-11", 1001) is False  # nowy miesiac = nowe liczenie
        assert call_usage._fresh(usage, "2026-10", 999) is False  # zegar cofniety
        assert call_usage._fresh(None, "2026-10", 1000) is False

    @pytest.mark.asyncio
    async def test_bez_redis_cache_dziala_w_pamieci_procesu(self, daily, call_settings, monkeypatch):
        monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: BrokenRedis())
        call_usage.reset_memory_cache()
        daily.meetings = [meeting([5])]

        async with daily_client.daily_http_client(API_KEY) as http:
            first = await call_usage.get_month_usage(http, API_KEY)
            second = await call_usage.get_month_usage(http, API_KEY)

        assert first.minutes == second.minutes == 5
        assert len(daily.calls("GET", "/meetings")) == 1
        call_usage.reset_memory_cache()


def sync_usage_cache_reset(client) -> None:
    """Uniewaznia cache zuzycia (Redis + pamiec), jakby minelo 5 minut."""
    redis = redis_client_module.get_redis_client()
    client.portal.call(redis.delete, f"call:daily_usage:{call_usage.month_of(int(time.time()))[0]}")
    call_usage.reset_memory_cache()


def broken_meeting(**changes) -> dict:
    item = meeting([5])
    item.update(changes)
    return {k: v for k, v in item.items() if v is not ...}


USAGE_FAILURES = {
    "http_500": daily_error(500, "server-error"),
    "http_401": daily_error(401, "authentication-error"),
    "http_429": daily_error(429, "rate-limit-error"),
    "timeout": httpx.ReadTimeout("timeout"),
    "siec": httpx.ConnectError("down"),
    "nie_json": httpx.Response(200, content=b"<html>oops</html>"),
    "lista_zamiast_obiektu": httpx.Response(200, json=[1, 2]),
    "brak_data": httpx.Response(200, json={"total_count": 0}),
    "data_nie_lista": httpx.Response(200, json={"total_count": 1, "data": {"a": 1}}),
    "spotkanie_nie_obiekt": httpx.Response(200, json={"total_count": 1, "data": ["x"]}),
    "brak_participants": httpx.Response(200, json={"total_count": 1, "data": [broken_meeting(participants=...)]}),
    "brak_id": httpx.Response(200, json={"total_count": 1, "data": [broken_meeting(id=...)]}),
    "brak_ongoing": httpx.Response(200, json={"total_count": 1, "data": [broken_meeting(ongoing=...)]}),
    "duration_tekst": httpx.Response(
        200, json={"total_count": 1, "data": [broken_meeting(participants=[{"duration": "600"}])]}
    ),
    "duration_ujemne": httpx.Response(
        200, json={"total_count": 1, "data": [broken_meeting(participants=[{"duration": -5}])]}
    ),
    "brak_duration": httpx.Response(
        200, json={"total_count": 1, "data": [broken_meeting(participants=[{"user_name": "x"}])]}
    ),
    "paginacja_stoi": httpx.Response(200, json={"total_count": 500, "data": [dict(meeting([5]), id="ten-sam")]}),
    "mniej_niz_total_count": [
        httpx.Response(200, json={"total_count": 3, "data": [meeting([5])]}),
        httpx.Response(200, json={"total_count": 3, "data": []}),
    ],
}


class TestUsageFailClosed:

    @pytest.mark.parametrize("failure", USAGE_FAILURES.keys())
    def test_brak_wiarygodnego_zuzycia_to_brak_tokenu(self, client, daily, caplog, db_session, test_user, test_user2, test_board, failure):
        responses = USAGE_FAILURES[failure]
        daily.override("GET", "/meetings", *(responses if isinstance(responses, list) else [responses]))
        add_member(db_session, test_board, test_user2, "editor")
        daily.add_room(room_of(test_board))

        with caplog.at_level(logging.DEBUG):
            as_owner = post_call(client, test_board.id, test_user.id)
            as_member = post_call(client, test_board.id, test_user2.id)

        for r in (as_owner, as_member):
            assert r.status_code == 503
            assert r.json()["code"] == "VOICE_USAGE_UNAVAILABLE"
            assert API_KEY not in r.text
        assert daily.writes() == []
        assert daily.calls("POST", "/meeting-tokens") == []
        assert API_KEY not in caplog.text
        assert "fail closed" in caplog.text

    def test_nieudane_pobranie_jest_pamietane_i_nie_zalewa_daily(self, client, daily, test_user, test_board):
        daily.override("GET", "/meetings", daily_error(500, "server-error"))

        for _ in range(3):
            assert post_call(client, test_board.id, test_user.id).status_code == 503

        assert len(daily.calls("GET", "/meetings")) == 1


class TestUserDailyCap:

    def test_wiele_tablic_nie_obchodzi_dziennego_limitu(self, client, daily, db_session, sync_redis_client, test_user, test_workspace, test_board):
        second = add_board(db_session, test_workspace, test_user)
        third = add_board(db_session, test_workspace, test_user)
        now = int(time.time())

        assert post_call(client, test_board.id, test_user.id).status_code == 200  # 180 z 240 min
        daily.presence[room_of(test_board)] = someone_present()  # ktos zostal - bez zwrotu budzetu
        assert post_call(client, second.id, test_user.id).status_code == 200  # zostaje 60 min
        daily.presence[room_of(second)] = someone_present()
        r = post_call(client, third.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_USER_LIMIT"
        assert len(daily.calls("POST", "/rooms")) == 2
        second_exp = daily.body("POST", "/rooms", 1)["properties"]["exp"]
        assert now + HOUR - 5 <= second_exp <= int(time.time()) + HOUR
        assert budget_of(sync_redis_client, test_user) == 240 * 60
        assert room_of(test_board) not in daily.rooms  # jeden aktywny pokoj na tworzacego

    def test_pusty_poprzedni_pokoj_zwraca_niewykorzystany_czas(self, client, daily, db_session, sync_redis_client, test_user, test_workspace, test_board):
        second = add_board(db_session, test_workspace, test_user)
        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert post_call(client, second.id, test_user.id).status_code == 200

        assert len(daily.calls("GET", f"/rooms/{room_of(test_board)}/presence")) == 1
        assert 3 * HOUR <= budget_of(sync_redis_client, test_user) <= 3 * HOUR + 10

    @pytest.mark.parametrize(
        "presence", [daily_error(500, "server-error"), httpx.ReadTimeout("t"), httpx.Response(200, json={"data": None})]
    )
    def test_niepotwierdzona_obecnosc_to_brak_zwrotu(self, client, daily, db_session, sync_redis_client, test_user, test_workspace, test_board, presence):
        second = add_board(db_session, test_workspace, test_user)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        daily.override("GET", f"/rooms/{room_of(test_board)}/presence", presence)

        assert post_call(client, second.id, test_user.id).status_code == 200

        assert budget_of(sync_redis_client, test_user) == 240 * 60

    def test_skasowanie_i_odtworzenie_pokoju_nie_zeruje_budzetu(self, client, daily, sync_redis_client, test_user, test_board):
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        daily.rooms.clear()  # pokoj zniknal poza nami (panel Daily)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        daily.rooms.clear()

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_USER_LIMIT"
        assert budget_of(sync_redis_client, test_user) == 240 * 60

    def test_podwojne_klikniecie_nie_placi_dwa_razy(self, client, daily, sync_redis_client, test_user, test_board):
        name = room_of(test_board)

        def lost_race(request):
            daily.add_room(name, exp=int(time.time()) + 3 * HOUR)
            return daily_error(400, "invalid-request-error", f"a room named {name} already exists")

        daily.override("POST", "/rooms", lost_race)

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert budget_of(sync_redis_client, test_user) == 0  # zaplacilo zadanie, ktore utworzylo pokoj

    def test_limit_zero_wylacza_tworzenie(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "call_user_daily_minutes_cap", 0)

        r = post_call(client, test_board.id, test_user.id)

        assert r.json()["code"] == "VOICE_USER_LIMIT"
        assert daily.writes() == []

    def test_limit_dotyczy_tworzacego_a_nie_dolaczajacych(self, client, daily, monkeypatch, db_session, test_user2, test_board):
        monkeypatch.setattr(get_settings(), "call_user_daily_minutes_cap", 0)
        add_member(db_session, test_board, test_user2, "viewer")
        daily.add_room(room_of(test_board))
        assert post_call(client, test_board.id, test_user2.id).status_code == 200

    def test_uszkodzony_licznik_w_redis_to_odmowa(self, client, daily, sync_redis_client, test_user, test_board):
        sync_redis_client.set(f"call:budget:{test_user.id}:{guard.day_of(int(time.time()))}", "abc")

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_GUARD_UNAVAILABLE"
        assert daily.calls("POST", "/rooms") == []
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_sufit_limitu_dziennego(self, monkeypatch):
        monkeypatch.setattr(get_settings(), "call_user_daily_minutes_cap", 10**9)
        assert guard.user_daily_cap_seconds() == 24 * HOUR


class TestRateLimit:

    def test_10_na_minute_na_uzytkownika(self, client, daily, test_user, test_board):
        for _ in range(10):
            assert post_call(client, test_board.id, test_user.id).status_code == 200
        requests_before = len(daily.requests)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "RATE_LIMITED"
        assert len(daily.requests) == requests_before

    def test_30_na_godzine_na_ip(self, client, daily, sync_redis_client, test_user, test_board):
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        (ip_key,) = sync_redis_client.keys("ratelimit:voice_call:ip:*")
        assert 0 < sync_redis_client.ttl(ip_key) <= HOUR
        (user_key,) = sync_redis_client.keys("ratelimit:voice_call:user:*")
        assert user_key == f"ratelimit:voice_call:user:{test_user.id}"
        assert 0 < sync_redis_client.ttl(user_key) <= 60
        sync_redis_client.set(ip_key, 30, keepttl=True)
        requests_before = len(daily.requests)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "RATE_LIMITED"
        assert len(daily.requests) == requests_before

    def test_nie_czlonek_nie_zuzywa_limitu_ip(self, client, daily, sync_redis_client, test_user2, test_board):
        assert post_call(client, test_board.id, test_user2.id).status_code == 404
        assert sync_redis_client.keys("ratelimit:voice_call:*") == []

    def test_awaria_redis_to_odmowa_bez_wywolan_daily(self, client, daily, caplog, monkeypatch, test_user, test_board):
        monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: BrokenRedis())

        with caplog.at_level(logging.ERROR):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_GUARD_UNAVAILABLE"
        assert daily.requests == []
        assert "fail closed" in caplog.text


class TestAdminUsage:

    def admin(self, monkeypatch, user) -> None:
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", f"{user.id}")

    @pytest.mark.parametrize("value", ["", "abc", "1,,", "999999"])
    def test_bez_wpisu_na_liscie_403_i_zero_wywolan_daily(self, client, daily, monkeypatch, test_user, value):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", value)

        r = get_usage(client, test_user.id)

        assert r.status_code == 403
        assert r.json()["code"] == "FORBIDDEN"
        assert daily.requests == []

    def test_bez_logowania_401(self, client, daily):
        assert client.get("/api/v1/whiteboard/call/usage").status_code == 401

    def test_admin_widzi_zuzycie_prog_stan_i_liczbe_pokoi(self, client, daily, monkeypatch, test_user, test_board):
        self.admin(monkeypatch, test_user)
        daily.meetings = [meeting([30, 30]), meeting([10, 10], room="inny", ongoing=True)]
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        daily.add_room("cudzy-pokoj")

        r = get_usage(client, test_user.id)

        assert r.status_code == 200
        assert r.headers["cache-control"] == "no-store"
        data = r.json()["data"]
        assert data["state"] == "enabled"
        assert data["month"] == datetime.now(timezone.utc).strftime("%Y-%m")
        assert data["cap_minutes"] == 8000
        assert data["user_daily_cap_minutes"] == 240
        assert data["max_participants"] == 4
        assert data["used_minutes"] == 80
        # nasz pokoj: 4 x ~180 min; trwajace spotkanie w nieznanym pokoju: 2 x 180 min
        assert 720 + 360 - 4 <= data["reserved_minutes"] <= 720 + 360
        assert data["planned_minutes"] == data["used_minutes"] + data["reserved_minutes"]
        assert data["meetings"] == 2
        assert data["ongoing_meetings"] == 1
        assert data["active_rooms"] == 1
        assert data["rooms_count"] == 2
        assert data["fetched_at"] is not None
        assert API_KEY not in r.text and DAILY_TOKEN not in r.text

    def test_stan_limit(self, client, daily, monkeypatch, test_user):
        self.admin(monkeypatch, test_user)
        daily.meetings = [meeting([8000])]
        data = get_usage(client, test_user.id).json()["data"]
        assert data["state"] == "limit"
        assert data["used_minutes"] == 8000

    def test_stan_disabled_i_not_configured_bez_wywolan_daily(self, client, daily, monkeypatch, test_user):
        self.admin(monkeypatch, test_user)
        monkeypatch.setattr(get_settings(), "daily_api_key", "")
        assert get_usage(client, test_user.id).json()["data"]["state"] == "not_configured"
        monkeypatch.setattr(get_settings(), "call_enabled", False)
        assert get_usage(client, test_user.id).json()["data"]["state"] == "disabled"
        assert daily.requests == []

    def test_stan_unknown_gdy_daily_nie_odpowiada(self, client, daily, monkeypatch, test_user):
        self.admin(monkeypatch, test_user)
        daily.override("GET", "/meetings", daily_error(500, "server-error", f"echo {API_KEY}"))
        daily.override("GET", "/rooms", httpx.ConnectError(f"down {API_KEY}"))

        r = get_usage(client, test_user.id)

        assert r.status_code == 200
        data = r.json()["data"]
        assert data["state"] == "unknown"
        assert data["used_minutes"] is None and data["rooms_count"] is None
        assert API_KEY not in r.text

    def test_awaria_redis_503(self, client, daily, monkeypatch, test_user):
        self.admin(monkeypatch, test_user)
        monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: BrokenRedis())
        r = get_usage(client, test_user.id)
        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_GUARD_UNAVAILABLE"


def _echo(status: int = 500) -> httpx.Response:
    """Daily, ktory w tresci bledu odsyla nasz klucz i jakis token."""
    return daily_error(status, f"server-error {API_KEY}", f"key={API_KEY} token={DAILY_TOKEN}")


# nazwa -> (przygotowanie, oczekiwany status); kazda sciezka bledu endpointu rozmowy
LEAK_SCENARIOS = {
    "sukces": (lambda d, s, name: None, 200),
    "brak_klucza": (lambda d, s, name: setattr(s, "daily_api_key", ""), 503),
    "wylaczone": (lambda d, s, name: setattr(s, "call_enabled", False), 503),
    "spoza_listy": (lambda d, s, name: setattr(s, "call_allowed_user_ids", "999999"), 403),
    "limit_dzienny": (lambda d, s, name: setattr(s, "call_user_daily_minutes_cap", 0), 429),
    "limit_miesieczny": (lambda d, s, name: setattr(s, "daily_monthly_minutes_cap", 0), 429),
    "meetings_blad": (lambda d, s, name: d.override("GET", "/meetings", _echo()), 503),
    "meetings_siec": (lambda d, s, name: d.override("GET", "/meetings", httpx.ConnectError(API_KEY)), 503),
    "get_room_401": (lambda d, s, name: d.override("GET", f"/rooms/{name}", _echo(401)), 502),
    "get_room_timeout": (lambda d, s, name: d.override("GET", f"/rooms/{name}", httpx.ReadTimeout(API_KEY)), 504),
    "create_room_blad": (lambda d, s, name: d.override("POST", "/rooms", _echo(400)), 502),
    "create_room_402": (lambda d, s, name: d.override("POST", "/rooms", _echo(402)), 503),
    "lista_pokoi_blad": (lambda d, s, name: d.override("GET", "/rooms", _echo()), 200),
    "token_blad": (lambda d, s, name: d.override("POST", "/meeting-tokens", _echo(403)), 502),
    "token_siec": (lambda d, s, name: d.override("POST", "/meeting-tokens", httpx.ConnectError(API_KEY)), 502),
    "delete_blad": (
        lambda d, s, name: (d.add_room(name, privacy="public"), d.override("DELETE", f"/rooms/{name}", _echo())), 502,
    ),
    "presence_blad": (
        lambda d, s, name: (d.add_room(name, privacy="public"), d.override("GET", f"/rooms/{name}/presence", _echo())),
        200,
    ),
}


class TestKeyNeverLeaks:
    """Pkt 9: DAILY_API_KEY nie wystepuje w zadnej odpowiedzi endpointow rozmowy ani w logach."""

    @pytest.mark.parametrize("scenario", LEAK_SCENARIOS.keys())
    def test_klucza_nie_ma_w_odpowiedzi_ani_w_logach(self, client, daily, caplog, monkeypatch, call_settings, test_user, test_user2, test_board, scenario):
        prepare, expected_status = LEAK_SCENARIOS[scenario]
        monkeypatch.setattr(call_settings, "call_admin_user_ids", str(test_user.id))
        settings = SettingsProxy(monkeypatch, call_settings)
        prepare(daily, settings, room_of(test_board))

        with caplog.at_level(logging.DEBUG):
            responses = [
                post_call(client, test_board.id, test_user.id),
                post_call(client, test_board.id, test_user2.id),  # nie-czlonek
                client.post(f"/api/v1/whiteboard/{test_board.id}/call"),  # bez logowania
                get_usage(client, test_user.id),
                get_usage(client, test_user2.id),
            ]

        assert responses[0].status_code == expected_status
        for r in responses:
            assert API_KEY not in r.text
            assert API_KEY not in str(r.headers)
            if r is not responses[0] or expected_status != 200:
                assert DAILY_TOKEN not in r.text
        assert API_KEY not in caplog.text
        assert DAILY_TOKEN not in caplog.text
        for record in caplog.records:
            assert API_KEY not in str(record.__dict__)

    def test_rate_limit_i_awaria_redis_tez_bez_klucza(self, client, daily, caplog, monkeypatch, test_user, test_board):
        with caplog.at_level(logging.DEBUG):
            limited = [post_call(client, test_board.id, test_user.id) for _ in range(11)][-1]
            monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: BrokenRedis())
            broken = post_call(client, test_board.id, test_user.id)

        assert limited.status_code == 429 and broken.status_code == 503
        assert API_KEY not in limited.text + broken.text
        assert API_KEY not in caplog.text and DAILY_TOKEN not in caplog.text

    def test_fragment_do_logu_jest_czyszczony_z_klucza(self):
        text = daily_client.log_text(f"Bearer {API_KEY}\n  x" + "y" * 500, API_KEY)
        assert API_KEY not in text and "\n" not in text and len(text) <= 200


class SettingsProxy:
    """setattr na ustawieniach przez monkeypatch (cofane po tescie)."""

    def __init__(self, monkeypatch, settings):
        object.__setattr__(self, "_monkeypatch", monkeypatch)
        object.__setattr__(self, "_settings", settings)

    def __setattr__(self, name, value):
        self._monkeypatch.setattr(self._settings, name, value)


INT_FIELDS = {
    "DAILY_ROOM_TTL_MINUTES": ("daily_room_ttl_minutes", 180),
    "DAILY_MONTHLY_MINUTES_CAP": ("daily_monthly_minutes_cap", 8000),
    "CALL_USER_DAILY_MINUTES_CAP": ("call_user_daily_minutes_cap", 240),
    "CALL_MAX_PARTICIPANTS": ("call_max_participants", 4),
}


class TestSettingsNeverBreakStartup:
    """Zadna pusta ani smieciowa wartosc env rozmow nie wywraca Settings() (startu backendu)."""

    @pytest.mark.parametrize("env", INT_FIELDS.keys())
    @pytest.mark.parametrize("value", ["", "   ", "abc", "12abc", "1.5", "1e3", "-5", "None", "true"])
    def test_smieciowa_liczba_wraca_do_domyslnej(self, monkeypatch, env, value):
        monkeypatch.setenv(env, value)
        field, default = INT_FIELDS[env]
        assert getattr(Settings(_env_file=None), field) == default

    @pytest.mark.parametrize("env", INT_FIELDS.keys())
    def test_poprawna_liczba_jest_czytana(self, monkeypatch, env):
        monkeypatch.setenv(env, " 7 ")
        assert getattr(Settings(_env_file=None), INT_FIELDS[env][0]) == 7

    @pytest.mark.parametrize(
        "value, expected",
        [("", True), ("  ", True), ("true", True), ("TRUE", True), ("1", True), ("on", True),
         ("false", False), ("0", False), ("off", False), ("no", False), ("nie", False), ("wylacz", False), ("2", False)],
    )
    def test_call_enabled_smieci_wylaczaja(self, monkeypatch, value, expected):
        monkeypatch.setenv("CALL_ENABLED", value)
        assert Settings(_env_file=None).call_enabled is expected

    def test_domyslne_wartosci_bez_env(self, monkeypatch):
        for env in (*INT_FIELDS, "CALL_ENABLED", "CALL_ALLOWED_USER_IDS", "CALL_ADMIN_USER_IDS", "DAILY_API_KEY"):
            monkeypatch.delenv(env, raising=False)
        settings = Settings(_env_file=None)
        assert settings.call_enabled is True
        assert settings.call_allowed_user_ids == "" and settings.call_admin_user_ids == ""
        assert settings.daily_api_key == ""
        assert (settings.daily_monthly_minutes_cap, settings.call_user_daily_minutes_cap) == (8000, 240)
        assert (settings.call_max_participants, settings.daily_room_ttl_minutes) == (4, 180)

    @pytest.mark.parametrize("value", ["abc", ";;", "1,,2", " , ", "DROP TABLE"])
    def test_smieciowe_listy_id_nie_wywracaja_startu_i_zamykaja_dostep(self, monkeypatch, value):
        monkeypatch.setenv("CALL_ALLOWED_USER_IDS", value)
        monkeypatch.setenv("CALL_ADMIN_USER_IDS", value)
        settings = Settings(_env_file=None)
        monkeypatch.setattr(get_settings(), "call_allowed_user_ids", settings.call_allowed_user_ids)
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", settings.call_admin_user_ids)
        assert guard.creator_allowed(1) is False
        assert guard.is_call_admin(1) is False
