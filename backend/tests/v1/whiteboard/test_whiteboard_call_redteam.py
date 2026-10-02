"""
Testy regresyjne po red teamie PR #107 (02.10.2026): kazdy odtwarza jedno znalezisko
(wyscig tworzacego, czas trwajacych rozmow, paginacja, zatruty cache, canAdmin, budzet uczciwego
nauczyciela, kubelki rate limitu, drobne) i pilnuje, zeby nie wrocilo.
Na koncu symulacja najgorszego przypadku minut w miesiacu przy domyslnych ustawieniach.
"""
import asyncio
import json
import logging
import time
from datetime import datetime, timezone

import httpx
import pytest
from pydantic import SecretStr
from redis.exceptions import ConnectionError as RedisConnectionError

import api.v1.whiteboard.call as call
import api.v1.whiteboard.call_guard as guard
import api.v1.whiteboard.call_usage as call_usage
import api.v1.whiteboard.daily_client as daily_client
from core import redis_client as redis_client_module
from core.config import Settings, get_settings
from core.exceptions import AppException

from .daily_fake import (
    API_KEY, FakeDaily, add_board, add_member, budget_of, daily_error, get_usage, meeting, owner_rooms,
    post_call, registry, room_of,
)

HOUR = 3600
TTL = 90 * 60


def someone_present() -> list[dict]:
    return [{"id": "p1", "userId": None, "userName": "X", "duration": 5}]


def reset_rate_limits(sync_redis_client) -> None:
    for key in sync_redis_client.keys("ratelimit:*"):
        sync_redis_client.delete(key)


def mid_month() -> int:
    """10. dzien biezacego miesiaca, 06:00 UTC - testy z zegarem nie trafiaja w przelom doby/miesiaca."""
    return int(datetime.now(timezone.utc).replace(day=10, hour=6, minute=0, second=0, microsecond=0).timestamp())


def usage_cache_key() -> str:
    return f"call:daily_usage:{call_usage.month_of(int(time.time()))[0]}"


@pytest.fixture
def async_daily(monkeypatch, redis_client, sync_redis_client, call_settings):
    """Atrapa Daily z opoznionym transportem - do rownoleglych zadan (asyncio.gather)."""
    fake = FakeDaily()
    fake.redis = sync_redis_client
    fake.delay = 0.002

    async def slow(request):
        await asyncio.sleep(fake.delay)
        return fake.handler(request)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        daily_client.httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(slow), **kwargs)
    )
    monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: redis_client)
    call_usage.reset_memory_cache()
    yield fake
    call_usage.reset_memory_cache()


async def create(user_id: int, board_id: int, *, owner: bool = True, ip: str = "10.0.0.1"):
    """create_board_call wprost (bez HTTP): 200 albo kod bledu."""
    user = call.CallUser(id=user_id, username="t", email_verified=True)
    try:
        await call.create_board_call(board_id, user=user, is_workspace_owner=owner, client_ip=ip)
        return 200
    except AppException as e:
        return e.code


class TestCreatorRace:
    """Znalezisko 1: rownolegle tworzenie brało zwrot budzetu wiele razy (9 zywych pokoi przy 180/240 min)."""

    @pytest.mark.asyncio
    async def test_rownolegle_tworzenie_gdy_pokoje_sa_zajete_nie_przekracza_budzetu(self, async_daily, sync_redis_client):
        async_daily.default_presence = someone_present()  # zadnego zwrotu: w kazdym pokoju ktos jest
        results = [await create(1, 1)]
        for round_no in range(4):
            reset_rate_limits(sync_redis_client)
            boards = [10 + round_no * 3 + i for i in range(3)]
            results += await asyncio.gather(*(create(1, board) for board in boards))

        assert results.count(200) == 3  # 90 + 90 + 60 min
        assert set(results) == {200, "VOICE_USER_LIMIT"}
        created_seconds = sum(room["exp"] - room["created"] for room in async_daily.history)
        assert created_seconds <= 240 * 60
        assert budget_of(sync_redis_client, 1) == 240 * 60
        assert len(async_daily.rooms) == 1  # najwyzej jeden zywy pokoj tworzacego

    @pytest.mark.asyncio
    async def test_rownolegle_tworzenie_gdy_pokoje_sa_puste_zostawia_jeden_pokoj(self, async_daily, sync_redis_client):
        results = [await create(1, 1)]
        for round_no in range(4):
            reset_rate_limits(sync_redis_client)
            boards = [10 + round_no * 3 + i for i in range(3)]
            results += await asyncio.gather(*(create(1, board) for board in boards))

        assert results == [200] * 13
        assert len(async_daily.rooms) == 1
        # 12 pustych pokoi rozliczonych po minimum 1 min + jeden zywy z pelna rezerwacja;
        # budzet to SUMA wpisow, wiec zwrotu nie da sie wziac dwa razy
        rooms = owner_rooms(sync_redis_client, 1)
        assert [room["open"] for room in rooms].count(True) == 1
        assert budget_of(sync_redis_client, 1) == sum(room["charged"] for room in rooms) == TTL + 12 * 60

    @pytest.mark.asyncio
    async def test_piec_rownoleglych_klikniec_na_tej_samej_tablicy(self, async_daily, sync_redis_client):
        results = await asyncio.gather(*(create(1, 1) for _ in range(5)))

        assert results == [200] * 5  # zadnego mylacego VOICE_USER_LIMIT
        assert len(async_daily.calls("POST", "/rooms")) == 1
        assert len(async_daily.calls("POST", "/meeting-tokens")) == 5
        assert budget_of(sync_redis_client, 1) == TTL

    @pytest.mark.asyncio
    async def test_zajeta_blokada_tworzacego_daje_429_busy_bez_zapisow(self, async_daily, monkeypatch, sync_redis_client):
        monkeypatch.setattr(guard, "LOCK_WAIT_SECONDS", 0.3)
        sync_redis_client.set("call:lock:creator:1", "inne-zadanie", ex=60)

        assert await create(1, 1) == "VOICE_CALL_BUSY"

        assert async_daily.requests == []
        assert sync_redis_client.get("call:lock:creator:1") == "inne-zadanie"  # cudzej blokady nie zdejmujemy
        assert await create(2, 2) == 200  # blokada jest na tworzacego, nie globalna

    @pytest.mark.asyncio
    async def test_blokada_jest_zwalniana_takze_po_bledzie(self, async_daily, sync_redis_client):
        async_daily.override("POST", "/rooms", daily_error(500, "server-error"))

        assert await create(1, 1) == "VOICE_PROVIDER_ERROR"

        assert sync_redis_client.keys("call:lock:*") == []

    @pytest.mark.asyncio
    async def test_rownolegli_tworzacy_nie_przekraczaja_progu_miesiecznego_razem(
        self, async_daily, monkeypatch, sync_redis_client
    ):
        # Prog 800 = miejsce na dwa pokoje po 360 min; pieciu tworzacych naraz.
        monkeypatch.setattr(get_settings(), "daily_monthly_minutes_cap", 800)

        results = await asyncio.gather(*(create(user, user, ip=f"10.0.0.{user}") for user in range(1, 6)))

        assert set(results) <= {200, "VOICE_MONTHLY_LIMIT"}
        assert len(async_daily.history) == results.count(200) <= 2
        assert sync_redis_client.zcard("call:rooms") == results.count(200)  # odmowy cofnely rezerwacje
        reset_rate_limits(sync_redis_client)
        assert await create(1, 1) == 200  # po wyscigu miejsce nadal jest do wziecia


class TestOngoingTimeIsReserved:
    """Znalezisko 2B: czas trwajacych rozmow, ktorych Daily (jeszcze) nie raportuje."""

    def fill(self, sync_redis_client, count: int, age: int, left: int) -> None:
        now = int(time.time())
        for i in range(count):
            sync_redis_client.zadd("call:rooms", {f"easylesson-board-{500 + i}|{now - age}|4": now + left})

    def test_11_pelnych_pokoi_niewidocznych_w_daily_blokuje_druga_fale(
        self, client, daily, monkeypatch, sync_redis_client, test_user, test_board
    ):
        # 11 pokoi x 4 osoby trwa od 170 min; Daily nie raportuje nic (duration dopiero po wyjsciu).
        self.fill(sync_redis_client, 11, age=170 * 60, left=10 * 60)
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", str(test_user.id))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"
        assert daily.calls("POST", "/rooms") == []
        report = get_usage(client, test_user.id).json()["data"]
        assert report["used_minutes"] == 0
        assert report["reserved_minutes"] == 11 * 4 * 180  # pelny czas zycia, nie "pozostaly"

    def test_rezerwacja_trwa_jeszcze_przez_okres_karencji_po_koncu_pokoju(
        self, client, daily, monkeypatch, sync_redis_client, test_user
    ):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", str(test_user.id))
        now = int(time.time())
        sync_redis_client.zadd("call:rooms", {f"easylesson-board-500|{now - 4 * HOUR}|4": now - 29 * 60})
        sync_redis_client.zadd("call:rooms", {f"easylesson-board-501|{now - 4 * HOUR}|4": now - 31 * 60})

        report = get_usage(client, test_user.id).json()["data"]

        # pokoj zakonczony 29 min temu nadal liczy sie w calosci (3 h 31 min x 4), ten sprzed 31 min juz nie
        assert report["reserved_minutes"] == (4 * 60 - 29) * 4
        assert report["active_rooms"] == 0

    def test_trwajace_spotkanie_z_duration_zero_liczy_czas_od_wejscia(self, client, daily, monkeypatch, test_user):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", str(test_user.id))
        item = meeting([0, 0, 0, 0], room="reczny", ongoing=True)
        for participant in item["participants"]:
            participant["join_time"] = int(time.time()) - 100 * 60
        daily.meetings = [item]

        report = get_usage(client, test_user.id).json()["data"]

        assert 400 <= report["used_minutes"] <= 404

    def test_trwajace_spotkanie_bez_czasu_wejscia_to_brak_tokenu(self, client, daily, test_user, test_board):
        item = meeting([0], ongoing=True)
        item["participants"][0].pop("join_time")
        item.pop("start_time")
        daily.meetings = [item]

        assert post_call(client, test_board.id, test_user.id).json()["code"] == "VOICE_USAGE_UNAVAILABLE"

    def test_pokoj_skasowany_z_ludzmi_w_srodku_zostaje_w_rezerwacji_do_swojego_exp(
        self, client, daily, db_session, sync_redis_client, test_user, test_workspace, test_board
    ):
        second = add_board(db_session, test_workspace, test_user)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        first_exp = daily.rooms[room_of(test_board)]["config"]["exp"]
        daily.presence[room_of(test_board)] = someone_present()

        assert post_call(client, second.id, test_user.id).status_code == 200

        assert registry(sync_redis_client)[room_of(test_board)] == first_exp

    def test_utrata_rejestru_redis_nie_zeruje_rezerwacji_zywych_pokoi(
        self, client, daily, monkeypatch, sync_redis_client, test_user, test_board
    ):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", str(test_user.id))
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        daily.add_room("easylesson-board-777", register=False)["config"].pop("exp")  # pokoj bez exp
        daily.add_room("cudzy-pokoj", register=False)
        sync_redis_client.flushall()
        call_usage.reset_memory_cache()

        report = get_usage(client, test_user.id).json()["data"]

        # nasz pokoj z listy Daily: 90 min x 4; pokoj tablicy bez exp: 3 h x limit osob z pokoju
        assert report["active_rooms"] == 0
        assert report["reserved_minutes"] == 360 + 3 * 60 * 4

    def test_lista_pokoi_niedostepna_to_brak_tokenu(self, client, daily, test_user, test_board):
        daily.override("GET", "/rooms", daily_error(500, "server-error"))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_USAGE_UNAVAILABLE"
        assert daily.writes() == []


class TestPagination:
    """Znalezisko 2C: czytanie do pustej strony, nie do `total_count`."""

    def paged(self, daily, total_count, page_size=None):
        def respond(request):
            if page_size:
                request.url = request.url.copy_set_param("limit", str(page_size))
            page = FakeDaily.meetings_page(request, daily.meetings).json()
            count = total_count(page) if callable(total_count) else total_count
            body = {"data": page["data"]} if count is None else {"total_count": count, "data": page["data"]}
            return httpx.Response(200, json=body)

        daily.override("GET", "/meetings", respond)

    @pytest.mark.parametrize(
        "variant", ["total_count_to_rozmiar_strony", "bez_total_count", "total_count_tekstem", "strony_po_20"]
    )
    def test_wszystkie_strony_sa_policzone(self, client, daily, caplog, test_user, test_board, variant):
        daily.meetings = [meeting([40]) for _ in range(250)]  # 10 000 min
        if variant == "total_count_to_rozmiar_strony":
            self.paged(daily, lambda page: len(page["data"]))
        elif variant == "bez_total_count":
            self.paged(daily, None)
        elif variant == "total_count_tekstem":
            self.paged(daily, "0")
        else:
            self.paged(daily, 250, page_size=20)

        with caplog.at_level(logging.WARNING):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"
        assert "10000/8000" in caplog.text

    def test_pusta_pierwsza_strona_z_dodatnim_total_count_to_brak_tokenu(self, client, daily, test_user, test_board):
        daily.override("GET", "/meetings", httpx.Response(200, json={"total_count": 5, "data": []}))
        assert post_call(client, test_board.id, test_user.id).json()["code"] == "VOICE_USAGE_UNAVAILABLE"

    def test_za_duzo_stron_to_brak_tokenu(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(call_usage, "MEETINGS_MAX_PAGES", 2)
        daily.meetings = [meeting([1]) for _ in range(250)]
        assert post_call(client, test_board.id, test_user.id).json()["code"] == "VOICE_USAGE_UNAVAILABLE"


class TestMeetingShapes:
    """Znaleziska 2D i 2E: pusta lista uczestnikow, Infinity/NaN, nieoczekiwany wyjatek."""

    def test_spotkanie_bez_listy_uczestnikow_liczy_caly_czas_razy_limit_osob(self, client, daily, test_user, test_board):
        item = meeting([2000])
        item["participants"] = []  # duration spotkania 2000 min, a lista pusta
        daily.meetings = [item]

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429  # 2000 min x 4 osoby = 8000
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"

    def test_spotkanie_bez_uczestnikow_i_bez_duration_to_brak_tokenu(self, client, daily, test_user, test_board):
        item = meeting([5])
        item["participants"] = []
        item.pop("duration")
        daily.meetings = [item]
        assert post_call(client, test_board.id, test_user.id).json()["code"] == "VOICE_USAGE_UNAVAILABLE"

    @pytest.mark.parametrize("value", ["Infinity", "-Infinity", "NaN", "1e999"])
    def test_nieskonczone_duration_daje_503_a_nie_500(self, client, daily, test_user, test_board, value):
        raw = json.dumps({"total_count": 1, "data": [meeting([5])]}).replace('"duration": 300', f'"duration": {value}')
        assert value in raw
        daily.override("GET", "/meetings", httpx.Response(200, content=raw.encode()))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_USAGE_UNAVAILABLE"

    @pytest.mark.parametrize("path", ["/meetings", "/rooms", "/meeting-tokens"])
    def test_nieoczekiwany_wyjatek_transportu_nie_wycieka_do_logu(self, client, daily, caplog, test_user, test_board, path):
        method = "POST" if path == "/meeting-tokens" else "GET"
        daily.override(method, path, RuntimeError(f"Authorization: Bearer {API_KEY}"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code in (502, 503)
        assert API_KEY not in caplog.text and API_KEY not in r.text


class TestPoisonedCache:
    """Znalezisko 2E: wpis cache, ktorego nie mogl zapisac backend, jest odrzucany."""

    def entry(self, **changes) -> str:
        data = {
            "month": call_usage.month_of(int(time.time()))[0], "minutes": 0, "meetings": 0,
            "fetched_at": int(time.time()), "ongoing": [], "rooms": [], "expired": [],
        }
        data.update(changes)
        return json.dumps({k: v for k, v in data.items() if v is not ...})

    @pytest.mark.parametrize(
        "changes",
        [
            {"minutes": -999999}, {"minutes": "abc"}, {"minutes": "5"}, {"minutes": 1.5}, {"minutes": True},
            {"minutes": None}, {"meetings": -1}, {"fetched_at": -5}, {"fetched_at": "x"},
            {"ongoing": [["pokoj", -3]]}, {"ongoing": "x"}, {"rooms": [["a", 1, 2]]}, {"rooms": ...},
            {"expired": ...}, {"month": 202610},
        ],
    )
    def test_zatruty_wpis_jest_ignorowany_i_zuzycie_czytane_z_daily(
        self, client, daily, sync_redis_client, test_user, test_board, changes
    ):
        sync_redis_client.set(usage_cache_key(), self.entry(**changes), ex=300)
        daily.meetings = [meeting([8000])]

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 429
        assert r.json()["code"] == "VOICE_MONTHLY_LIMIT"
        assert len(daily.calls("GET", "/meetings")) == 2

    def test_wpis_z_przyszlosci_jest_ignorowany(self, client, daily, sync_redis_client, test_user, test_board):
        sync_redis_client.set(usage_cache_key(), self.entry(fetched_at=int(time.time()) + 3600), ex=300)
        daily.meetings = [meeting([8000])]
        assert post_call(client, test_board.id, test_user.id).json()["code"] == "VOICE_MONTHLY_LIMIT"

    def test_poprawny_wpis_jest_uzywany(self, client, daily, sync_redis_client, test_user, test_board):
        sync_redis_client.set(usage_cache_key(), self.entry(minutes=8000), ex=300)
        assert post_call(client, test_board.id, test_user.id).json()["code"] == "VOICE_MONTHLY_LIMIT"
        assert daily.requests == []


class TestNobodyIsAdmin:
    """Znalezisko 3: nikt nie dostaje canAdmin, a pokoj z adminami jest niezgodny."""

    def test_token_tworzacego_i_dolaczajacego_bez_canadmin(self, client, daily, db_session, test_user, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "editor")

        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert post_call(client, test_board.id, test_user2.id).status_code == 200

        for index in (0, 1):
            props = daily.token_properties(index)
            assert props["permissions"] == {"canAdmin": False}
            assert props["is_owner"] is False

    @pytest.mark.parametrize("value", [True, ["participants"], ["streaming"], [[]], "all", 1, 0, ""])
    def test_pokoj_z_canadmin_jest_niezgodny(self, daily, value):
        room = daily.add_room("easylesson-board-5", permissions={"canAdmin": value})
        assert call._room_problem(room, "easylesson-board-5", int(time.time())) == "permissions.canAdmin"

    @pytest.mark.parametrize(
        "permissions", [{"canAdmin": False}, {"canAdmin": False, "hasPresence": True}, {"canAdmin": []}, {}]
    )
    def test_pokoj_bez_adminow_jest_zgodny(self, daily, permissions):
        room = daily.add_room("easylesson-board-5", permissions=permissions)
        assert call._room_problem(room, "easylesson-board-5", int(time.time())) is None


class TestHonestTeacherBudget:
    """Znalezisko 4: budzet dzienny liczy REALNY czas rozmow, nie rezerwacje pokoi."""

    def lesson(self, daily, name: str, minutes: int, people: int = 2) -> None:
        """Daily raportuje zakonczone spotkanie w pokoju `name`, zaczete teraz."""
        now = int(time.time())
        daily.meetings.append({
            "id": f"m{len(daily.meetings)}", "room": name, "start_time": now, "duration": minutes * 60,
            "ongoing": False, "max_participants": people,
            "participants": [
                {"participant_id": f"p{i}", "join_time": now, "duration": minutes * 60} for i in range(people)
            ],
        })

    def test_cztery_lekcje_po_60_min_z_przerwami_mieszcza_sie_w_240_min(
        self, client, daily, clock, sync_redis_client, test_user, test_board
    ):
        clock.set(mid_month())
        name = room_of(test_board)
        for number in range(4):
            reset_rate_limits(sync_redis_client)
            r = post_call(client, test_board.id, test_user.id)
            assert r.status_code == 200, f"lekcja {number + 1}: {r.json()['code']}"
            # pokoj wystarcza na cala lekcje
            assert daily.rooms[name]["config"]["exp"] - int(time.time()) >= 60 * 60 - 5
            self.lesson(daily, name, 60)
            clock.advance(2 * HOUR)

        # dzien wykorzystany realnie w calosci: piata lekcja juz sie nie miesci
        reset_rate_limits(sync_redis_client)
        fifth = post_call(client, test_board.id, test_user.id)
        assert fifth.status_code == 429
        assert fifth.json()["code"] == "VOICE_USER_LIMIT"
        assert budget_of(sync_redis_client, test_user.id) == 240 * 60

    def test_pokoje_uzywane_do_konca_wyczerpuja_budzet_po_240_min(
        self, client, daily, clock, sync_redis_client, test_user, test_board
    ):
        clock.set(mid_month())
        name = room_of(test_board)
        codes = []
        for _ in range(4):
            reset_rate_limits(sync_redis_client)
            r = post_call(client, test_board.id, test_user.id)
            codes.append(r.status_code)
            if r.status_code == 200:
                minutes = round((daily.rooms[name]["config"]["exp"] - time.time()) / 60)
                self.lesson(daily, name, minutes, people=4)  # atakujacy trzyma pokoj pelny do exp
            clock.advance(2 * HOUR)

        assert codes == [200, 200, 200, 429]
        assert sum(m["duration"] for m in daily.meetings) == 240 * 60

    @pytest.mark.parametrize("state", ["trwa", "blad_daily", "bez_duration", "przed_karencja"])
    def test_niepewne_rozliczenie_zostawia_pelne_obciazenie(
        self, client, daily, clock, sync_redis_client, test_user, test_board, state
    ):
        clock.set(mid_month())
        name = room_of(test_board)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        self.lesson(daily, name, 10)
        if state == "trwa":
            daily.meetings[0]["ongoing"] = True
        elif state == "bez_duration":
            daily.meetings[0].pop("duration")
        clock.advance(TTL + (10 * 60 if state == "przed_karencja" else 45 * 60))
        if state == "blad_daily":
            # zuzycie miesiaca czyta sie poprawnie, zapytanie o spotkania pokoju juz nie
            daily.override(
                "GET", "/meetings",
                lambda request: daily_error(500, "x") if request.url.params.get("room") else daily._meetings(request),
            )
        if state in ("trwa", "bez_duration"):
            daily.override(  # zuzycie miesiaca: puste; spotkania pokoju: jak wyzej
                "GET", "/meetings",
                lambda request: daily._meetings(request) if request.url.params.get("room")
                else httpx.Response(200, json={"total_count": 0, "data": []}),
            )
        reset_rate_limits(sync_redis_client)

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        first = owner_rooms(sync_redis_client, test_user.id)[0]
        assert first["charged"] == TTL and first["settled"] is False

    def test_rozliczenie_wg_spotkan_tylko_zmniejsza_i_dzieje_sie_raz(
        self, client, daily, clock, sync_redis_client, test_user, test_board
    ):
        clock.set(mid_month())
        name = room_of(test_board)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        self.lesson(daily, name, 500)  # Daily twierdzi, ze spotkanie trwalo dluzej niz pokoj
        clock.advance(TTL + 45 * 60)
        for _ in range(2):
            reset_rate_limits(sync_redis_client)
            assert post_call(client, test_board.id, test_user.id).status_code == 200

        first = owner_rooms(sync_redis_client, test_user.id)[0]
        assert first["charged"] == TTL and first["settled"] is True
        assert len([r for r in daily.calls("GET", "/meetings") if r.url.params.get("room")]) == 2  # strona + pusta

    def test_kolejna_lekcja_na_tej_samej_tablicy_gdy_pokoj_pusty_rozlicza_stary_i_tworzy_nowy(
        self, client, daily, clock, sync_redis_client, test_user, test_board
    ):
        clock.set(mid_month())
        name = room_of(test_board)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        clock.advance(70 * 60)  # lekcja skonczona, pokoj pusty, zostalo mu 20 min

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        now = int(time.time())
        assert now + TTL - 5 <= daily.rooms[name]["config"]["exp"] <= now + TTL  # pelny czas na nowa lekcje
        assert len(daily.calls("DELETE", f"/rooms/{name}")) == 1
        first, second = owner_rooms(sync_redis_client, test_user.id)
        # stary pokoj: czas od utworzenia do potwierdzenia pustki
        assert 70 * 60 <= first["charged"] <= 70 * 60 + 5 and first["open"] is False
        assert (second["charged"], second["open"]) == (TTL, True)
        # zwrot jest jednorazowy: kolejne klikniecie niczego juz nie oddaje
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert budget_of(sync_redis_client, test_user.id) == first["charged"] + TTL

    def test_trwajaca_lekcja_nie_jest_przerywana_odswiezeniem_strony(
        self, client, daily, clock, sync_redis_client, test_user, test_board
    ):
        clock.set(mid_month())
        name = room_of(test_board)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        daily.presence[name] = someone_present()
        clock.advance(40 * 60)
        writes = len(daily.writes())

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert len(daily.writes()) == writes
        assert budget_of(sync_redis_client, test_user.id) == TTL

    def test_wlasciciel_przejmuje_zgodny_pokoj_bez_wpisu_i_placi_za_pozostaly_czas(
        self, client, daily, monkeypatch, sync_redis_client, test_user, test_board
    ):
        name = room_of(test_board)
        daily.add_room(name, exp=int(time.time()) + 40 * 60, register=False)  # np. po utracie danych Redis

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert daily.writes() == []
        assert 40 * 60 - 5 <= budget_of(sync_redis_client, test_user.id) <= 40 * 60
        assert registry(sync_redis_client)[name] == daily.rooms[name]["config"]["exp"]

        sync_redis_client.flushall()
        monkeypatch.setattr(get_settings(), "call_user_daily_minutes_cap", 30)
        r = post_call(client, test_board.id, test_user.id)
        assert r.json()["code"] == "VOICE_USER_LIMIT"  # bez budzetu nie ma darmowego przejecia

    def test_spotkanie_zaczete_przed_przejeciem_pokoju_liczy_sie_przy_rozliczeniu(
        self, client, daily, clock, sync_redis_client, test_user, test_board
    ):
        clock.set(mid_month())
        name = room_of(test_board)
        daily.add_room(name, exp=int(time.time()) + 40 * 60, register=False)
        assert post_call(client, test_board.id, test_user.id).status_code == 200  # przejecie: 40 min
        # rozmowa trwala juz 50 min przed przejeciem i skonczyla sie z pokojem
        daily.meetings.append({
            "id": "wczesniejsze", "room": name, "start_time": int(time.time()) - 50 * 60, "duration": 90 * 60,
            "ongoing": False, "max_participants": 2,
            "participants": [{"participant_id": "p", "join_time": int(time.time()) - 50 * 60, "duration": 90 * 60}],
        })
        clock.advance(40 * 60 + 45 * 60)
        reset_rate_limits(sync_redis_client)

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        first = owner_rooms(sync_redis_client, test_user.id)[0]
        assert 40 * 60 - 5 <= first["charged"] <= 40 * 60 and first["settled"] is True  # nie spadlo do minimum

    def test_limit_liczby_pokoi_na_dobe(self, client, daily, monkeypatch, sync_redis_client, db_session, test_user, test_workspace, test_board):
        monkeypatch.setattr(guard, "MAX_ROOMS_PER_DAY", 3)
        boards = [test_board] + [add_board(db_session, test_workspace, test_user) for _ in range(3)]

        codes = [post_call(client, board.id, test_user.id).json()["code"] for board in boards]

        assert codes == [None, None, None, "VOICE_USER_LIMIT"]


class TestRateLimitBuckets:
    """Znalezisko 5: limit IP liczy wydane tokeny i proby tworzenia, nie tanie odmowy."""

    def test_uczniowie_czekajacy_za_tym_samym_nat_nie_blokuja_nauczyciela(
        self, client, daily, db_session, sync_redis_client, test_user, test_user2, test_user3, test_board
    ):
        add_member(db_session, test_board, test_user2, "editor")
        add_member(db_session, test_board, test_user3, "viewer")
        codes = set()
        for attempt in range(40):
            if attempt % 5 == 0:
                reset_user = [k for k in sync_redis_client.keys("ratelimit:voice_call:user:*")]
                for key in reset_user:
                    sync_redis_client.delete(key)
            student = test_user2 if attempt % 2 else test_user3
            codes.add(post_call(client, test_board.id, student.id).json()["code"])

        assert codes == {"VOICE_CALL_NOT_STARTED"}
        assert daily.requests == []  # odmowa lokalna: zero wywolan Daily
        assert sync_redis_client.keys("ratelimit:voice_call:ip:*") == []

        assert post_call(client, test_board.id, test_user.id).status_code == 200  # nauczyciel z tego samego IP
        assert post_call(client, test_board.id, test_user2.id).status_code == 200

    def test_limit_ip_liczy_wydane_tokeny_i_proby_tworzenia(
        self, client, daily, db_session, sync_redis_client, test_user, test_user2, test_board
    ):
        add_member(db_session, test_board, test_user2, "editor")
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert post_call(client, test_board.id, test_user2.id).status_code == 200
        (ip_key,) = sync_redis_client.keys("ratelimit:voice_call:ip:*")
        assert sync_redis_client.get(ip_key) == "2"

        sync_redis_client.set(ip_key, 30, keepttl=True)
        tokens = len(daily.calls("POST", "/meeting-tokens"))
        for user in (test_user, test_user2):
            r = post_call(client, test_board.id, user.id)
            assert (r.status_code, r.json()["code"]) == (429, "RATE_LIMITED")
        assert len(daily.calls("POST", "/meeting-tokens")) == tokens

    def test_zalew_tanich_odmow_ogranicza_limit_na_uzytkownika(self, client, daily, db_session, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "editor")
        codes = [post_call(client, test_board.id, test_user2.id).json()["code"] for _ in range(12)]
        assert codes == ["VOICE_CALL_NOT_STARTED"] * 10 + ["RATE_LIMITED"] * 2

    def test_podglad_admina_ma_osobny_kubelek(self, client, daily, monkeypatch, sync_redis_client, test_user, test_board):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", str(test_user.id))

        statuses = [get_usage(client, test_user.id).status_code for _ in range(11)]

        assert statuses == [200] * 10 + [429]
        assert sync_redis_client.keys("ratelimit:voice_call:*") == []
        assert post_call(client, test_board.id, test_user.id).status_code == 200  # rozmowa admina dziala


class FlakyRedis:
    """Prawdziwy (fake) Redis, ktory od wlaczenia `broken` odpowiada bledem polaczenia."""

    def __init__(self, real):
        self._real = real
        self.broken: set[str] | bool = False

    def __getattr__(self, name):
        if self.broken is True or (self.broken and name in self.broken):
            async def fail(*args, **kwargs):
                raise RedisConnectionError("redis down")

            return fail
        return getattr(self._real, name)


class TestMinor:
    """Znalezisko 6 i 7: drobne."""

    def test_repr_ustawien_nie_zawiera_klucza(self):
        settings = Settings(_env_file=None, daily_api_key=API_KEY)
        for text in (repr(settings), str(settings), settings.model_dump_json(), str(settings.model_dump())):
            assert API_KEY not in text
        assert settings.daily_api_key.get_secret_value() == API_KEY

    def test_klucz_z_env_jest_czytany(self, monkeypatch):
        monkeypatch.setenv("DAILY_API_KEY", f"  {API_KEY} ")
        monkeypatch.setattr(get_settings(), "daily_api_key", Settings(_env_file=None).daily_api_key)
        assert guard.daily_api_key() == API_KEY

    @pytest.mark.parametrize("key", ["zażółć-klucz", "abc def", "abc\ndef", "abc\x00def"])
    def test_klucz_nie_do_naglowka_http_wylacza_rozmowy_bez_500(self, client, daily, monkeypatch, test_user, test_board, key):
        monkeypatch.setattr(get_settings(), "daily_api_key", SecretStr(key))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_NOT_CONFIGURED"
        assert daily.requests == []

    def test_rooms_count_nie_jest_ujemne(self, client, daily, monkeypatch, test_user):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", str(test_user.id))
        daily.override("GET", "/rooms", httpx.Response(200, json={"total_count": -5, "data": []}))
        assert get_usage(client, test_user.id).json()["data"]["rooms_count"] == 0

    @pytest.mark.parametrize("value, admin", [("1,", True), (",1", True), ("1,,2", True), ("2,", False), (",", False), ("1,x", False)])
    def test_lista_adminow_z_pustym_segmentem(self, monkeypatch, value, admin):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", value)
        assert guard.is_call_admin(1) is admin

    def test_ostrzezenie_gdy_klucz_ustawiony_a_lista_tworzacych_pusta(self, client, daily, caplog, monkeypatch, test_user, test_board):
        with caplog.at_level(logging.WARNING):
            assert post_call(client, test_board.id, test_user.id).status_code == 200
            assert post_call(client, test_board.id, test_user.id).status_code == 200
        warnings = [r for r in caplog.records if "CALL_ALLOWED_USER_IDS pusta" in r.getMessage()]
        assert len(warnings) == 1 and warnings[0].levelno == logging.WARNING  # raz na proces

        caplog.clear()
        monkeypatch.setitem(guard._state, "warned_open_list", False)
        monkeypatch.setattr(get_settings(), "call_allowed_user_ids", str(test_user.id))
        with caplog.at_level(logging.WARNING):
            assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert "CALL_ALLOWED_USER_IDS" not in caplog.text

    def test_dolaczajacy_nie_dostaje_tokenu_do_pokoju_spoza_rejestru(self, client, daily, db_session, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "editor")
        daily.add_room(room_of(test_board), register=False)

        r = post_call(client, test_board.id, test_user2.id)

        assert r.json()["code"] == "VOICE_CALL_NOT_STARTED"
        assert daily.requests == []

    def test_redis_pada_przed_utworzeniem_pokoju_nic_nie_trafia_do_daily(self, client, daily, monkeypatch, redis_client, test_user, test_board):
        flaky = FlakyRedis(redis_client)
        flaky.broken = {"zadd"}
        monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: flaky)

        r = post_call(client, test_board.id, test_user.id)

        assert r.json()["code"] == "VOICE_GUARD_UNAVAILABLE"
        assert daily.writes() == [] and daily.calls("POST", "/meeting-tokens") == []

    def test_redis_pada_po_utworzeniu_pokoju_pokoj_jest_kasowany(self, client, daily, monkeypatch, redis_client, test_user, test_board):
        name = room_of(test_board)
        flaky = FlakyRedis(redis_client)
        monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: flaky)

        def created_with_other_exp(request):
            # Daily zwraca pokoj z innym exp -> backend musi zapisac poprawke, a Redis wlasnie padl
            daily.add_room(name, exp=int(time.time()) + HOUR, register=False)
            flaky.broken = True
            return httpx.Response(200, json=daily.rooms[name])

        daily.override("POST", "/rooms", created_with_other_exp)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_GUARD_UNAVAILABLE"
        assert name not in daily.rooms  # pokoj nie zostaje w Daily bez nadzoru
        assert daily.calls("POST", "/meeting-tokens") == []


class TestWorstCaseMonth:
    """
    Najgorszy przypadek przy DOMYSLNYCH ustawieniach (prog 8000, pokoj 90 min, 4 osoby, budzet
    240 min/dzien, cache zuzycia 5 min, karencja 30 min): 12 kont-wlascicieli tworzy pokoje bez
    przerwy, kazdy pokoj jest PELNY (4 osoby) od utworzenia do exp. Liczymy minuty uczestnikow,
    ktore faktycznie powstaly, w trzech wariantach zachowania Daily.
    """

    OWNERS = 12
    STEP = 15 * 60
    STEPS = 30 * 4  # 30 godzin: z przelomem doby (nowe budzety dzienne)

    def reported(self, fake: FakeDaily, mode: str):
        def respond(request):
            now = int(time.time())
            items = []
            for index, room in enumerate(fake.history):
                ended = now >= room["exp"]
                if mode == "po_wyjsciu" and now < room["exp"] + 20 * 60:
                    continue  # Daily pokazuje spotkanie dopiero 20 min po jego koncu
                elapsed = min(now, room["exp"]) - room["created"]
                duration = elapsed if ended or mode == "na_biezaco" else 0
                items.append({
                    "id": f"m{index}", "room": room["name"], "start_time": room["created"], "duration": duration,
                    "ongoing": not ended, "max_participants": 4,
                    "participants": [
                        {"participant_id": f"{index}-{i}", "join_time": room["created"], "duration": duration}
                        for i in range(4)
                    ],
                })
            return FakeDaily.meetings_page(request, items)

        return respond

    @pytest.mark.parametrize("mode", ["na_biezaco", "duration_zero_do_wyjscia", "po_wyjsciu"])
    @pytest.mark.asyncio
    async def test_realne_minuty_nie_przekraczaja_progu(self, async_daily, clock, sync_redis_client, mode):
        fake = async_daily
        fake.delay = 0
        fake.default_presence = someone_present()
        fake.override("GET", "/meetings", self.reported(fake, mode))
        clock.set(mid_month())

        refused = set()
        for _ in range(self.STEPS):
            reset_rate_limits(sync_redis_client)
            for owner in range(1, self.OWNERS + 1):
                result = await create(owner, owner, ip=f"10.0.{owner}.1")
                if result != 200:
                    refused.add(result)
            clock.advance(self.STEP)

        real_minutes = sum((room["exp"] - room["created"]) * 4 for room in fake.history) / 60
        cap = guard.monthly_cap_minutes()
        assert cap == 8000 and guard.room_ttl_seconds() == TTL and guard.max_participants() == 4
        assert "VOICE_MONTHLY_LIMIT" in refused  # atak naprawde doszedl do progu
        assert refused <= {"VOICE_MONTHLY_LIMIT", "VOICE_USER_LIMIT"}
        assert real_minutes <= cap, f"{mode}: {real_minutes} min"
        assert real_minutes >= 3500, f"{mode}: symulacja nie wygenerowala ruchu ({real_minutes} min)"
        print(f"[najgorszy przypadek] {mode}: {real_minutes:.0f} min uczestnikow przy progu {cap}")
