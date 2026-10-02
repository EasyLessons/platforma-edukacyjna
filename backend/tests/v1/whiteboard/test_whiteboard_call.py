"""
Testy rozmowy glosowej tablicy - POST /api/v1/whiteboard/{id}/call (api/v1/whiteboard/call.py):
kto moze tworzyc/dolaczac, wymogi pokoju, token, bledy Daily, sprzatanie pokoi.
Limity kosztow, zuzycie, admin i szukanie klucza: test_whiteboard_call_guard.py.
"""
import logging
import time
from datetime import datetime

import httpx
import pytest

import api.v1.whiteboard.call as call
import api.v1.whiteboard.call_guard as guard
from core.config import get_settings

from .daily_fake import (
    API_KEY, DAILY_DOMAIN, DAILY_TOKEN, add_board, add_member, daily_error, post_call, room_of,
)

HOUR = 3600


def assert_no_secrets(response, caplog) -> None:
    assert API_KEY not in response.text
    assert DAILY_TOKEN not in response.text
    assert API_KEY not in caplog.text
    assert DAILY_TOKEN not in caplog.text


class TestNotConfigured:

    @pytest.mark.parametrize("value", ["", "   "])
    def test_pusty_klucz_daje_503_bez_wywolan_http(self, client, daily, monkeypatch, test_user, test_board, value):
        monkeypatch.setattr(get_settings(), "daily_api_key", value)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_NOT_CONFIGURED"
        assert r.json()["success"] is False
        assert daily.requests == []

    def test_wylacznik_call_enabled_daje_503_bez_wywolan_http(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "call_enabled", False)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_DISABLED"
        assert daily.requests == []

    def test_nie_czlonek_przy_wylaczonych_rozmowach_dostaje_404(self, client, daily, monkeypatch, test_user2, test_board):
        monkeypatch.setattr(get_settings(), "call_enabled", False)
        monkeypatch.setattr(get_settings(), "daily_api_key", "")
        assert post_call(client, test_board.id, test_user2.id).status_code == 404


class TestAccess:

    def test_nie_czlonek_dostaje_404_i_zero_wywolan_daily(self, client, daily, test_user2, test_board):
        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 404
        assert r.json()["code"] == "NOT_FOUND"
        assert daily.requests == []

    def test_nieistniejaca_tablica_404(self, client, daily, test_user):
        assert post_call(client, 999999, test_user.id).status_code == 404
        assert daily.requests == []

    def test_bez_logowania_401(self, client, daily, test_board):
        assert client.post(f"/api/v1/whiteboard/{test_board.id}/call").status_code == 401
        assert daily.requests == []

    def test_niezweryfikowany_email_403_i_zero_wywolan_daily(self, client, daily, db_session, unverified_user, test_board):
        add_member(db_session, test_board, unverified_user, "editor")
        daily.add_room(room_of(test_board))

        r = post_call(client, test_board.id, unverified_user.id)

        assert r.status_code == 403
        assert daily.requests == []

    @pytest.mark.asyncio
    async def test_niezweryfikowany_email_jest_odrzucany_takze_w_serwisie(self, daily, db_session, unverified_user, test_board):
        from api.v1.whiteboard.service import WhiteboardService
        from core.exceptions import AppException

        with pytest.raises(AppException) as error:
            await WhiteboardService(db_session).create_call(test_board.id, unverified_user, "127.0.0.1")

        assert error.value.code == "VOICE_EMAIL_NOT_VERIFIED"
        assert daily.requests == []

    def test_wlasciciel_tworzy_pokoj(self, client, daily, test_user, test_board):
        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert len(daily.calls("POST", "/rooms")) == 1
        assert set(r.json()["data"]) == {"room_url", "token", "expires_at"}

    @pytest.mark.parametrize("role", ["viewer", "editor"])
    def test_czlonek_nie_tworzy_pokoju_gdy_rozmowa_sie_nie_zaczela(
        self, client, daily, db_session, test_user2, test_board, role
    ):
        add_member(db_session, test_board, test_user2, role)

        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 409
        assert r.json()["code"] == "VOICE_CALL_NOT_STARTED"
        assert "poczekaj na nauczyciela" in r.json()["error"]
        assert daily.writes() == []
        assert daily.calls("POST", "/meeting-tokens") == []

    @pytest.mark.parametrize("role", ["viewer", "editor"])
    def test_czlonek_dolacza_do_aktywnego_pokoju_i_nie_przesuwa_exp(
        self, client, daily, db_session, test_user2, test_board, role
    ):
        add_member(db_session, test_board, test_user2, role)
        exp = int(time.time()) + 20 * 60
        daily.add_room(room_of(test_board), exp=exp)

        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 200
        assert daily.writes() == []  # zero zapisow w Daily - takze przy konczacym sie pokoju
        assert daily.rooms[room_of(test_board)]["config"]["exp"] == exp
        assert daily.token_properties()["permissions"] == {"canAdmin": False}

    def test_czlonek_nie_dolacza_do_wygaslego_pokoju(self, client, daily, db_session, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "editor")
        daily.add_room(room_of(test_board), exp=int(time.time()) - 10)

        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 409
        assert daily.writes() == []
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_rola_owner_bez_bycia_tworca_przestrzeni_nie_tworzy_pokoju(self, client, daily, db_session, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "owner")

        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 409
        assert daily.writes() == []


class TestAllowedCreators:

    def test_wlasciciel_spoza_listy_nie_tworzy_pokoju(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "call_allowed_user_ids", str(test_user.id + 1000))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 403
        assert r.json()["code"] == "VOICE_CREATE_NOT_ALLOWED"
        assert daily.writes() == []
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_wlasciciel_z_listy_tworzy_pokoj(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "call_allowed_user_ids", f" 999999 , {test_user.id} ")
        assert post_call(client, test_board.id, test_user.id).status_code == 200

    @pytest.mark.parametrize("value", ["abc", "1;2", "1,,2", "1 2", "-1", "1.5", ",", "１"])
    def test_smieciowa_lista_zamyka_tworzenie(self, client, daily, monkeypatch, test_user, test_board, value):
        monkeypatch.setattr(get_settings(), "call_allowed_user_ids", value)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 403
        assert daily.writes() == []

    def test_wlasciciel_spoza_listy_moze_dolaczyc_do_aktywnego_pokoju(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "call_allowed_user_ids", "999999")
        daily.add_room(room_of(test_board))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert daily.writes() == []


class TestRoom:

    def test_nowy_pokoj_ma_wymagane_wlasciwosci(self, client, daily, test_user, test_board):
        before = int(time.time())

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        name = room_of(test_board)
        created = daily.body("POST", "/rooms")
        assert created["name"] == name
        assert created["privacy"] == "private"
        props = created["properties"]
        assert before + 3 * HOUR <= props["exp"] <= int(time.time()) + 3 * HOUR
        assert props["eject_at_room_exp"] is True
        assert props["max_participants"] == 4
        assert props["start_video_off"] is True
        assert props["start_audio_off"] is False
        # platne funkcje: jawnie wylaczone albo nieustawione
        assert props["enable_dialout"] is False
        assert props["enable_transcription_storage"] is False
        assert props["enable_knocking"] is False
        assert props["permissions"] == {"canAdmin": False}
        for forbidden in ("enable_recording", "sip", "streaming_endpoints", "auto_transcription_settings"):
            assert forbidden not in props
        assert r.json()["data"]["room_url"] == f"{DAILY_DOMAIN}/{name}"
        assert r.headers["cache-control"] == "no-store"

    @pytest.mark.parametrize("ttl, expected", [(999, 3 * HOUR), (0, 600), (60, HOUR)])
    def test_exp_ma_twardy_sufit_3_h_niezaleznie_od_env(self, client, daily, monkeypatch, test_user, test_board, ttl, expected):
        monkeypatch.setattr(get_settings(), "daily_room_ttl_minutes", ttl)
        before = int(time.time())

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert before + expected <= daily.body("POST", "/rooms")["properties"]["exp"] <= int(time.time()) + expected

    @pytest.mark.parametrize("value, expected", [(500, 20), (0, 2), (6, 6)])
    def test_max_participants_z_env_z_sufitem(self, client, daily, monkeypatch, test_user, test_board, value, expected):
        monkeypatch.setattr(get_settings(), "call_max_participants", value)
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert daily.body("POST", "/rooms")["properties"]["max_participants"] == expected

    def test_brak_pokoju_jako_400_not_found(self, client, daily, test_user, test_board):
        daily.missing_room_response = lambda: daily_error(400, "invalid-request-error", "room x not found")
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert len(daily.calls("POST", "/rooms")) == 1

    def test_aktywny_pokoj_wlasciciela_nie_jest_ruszany(self, client, daily, test_user, test_board):
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        writes = len(daily.writes())

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert len(daily.writes()) == writes  # odswiezenie strony: zero zapisow w Daily

    def test_wyscig_przy_tworzeniu_konczy_sie_ponownym_get(self, client, daily, test_user, test_board):
        name = room_of(test_board)

        def lost_race(request):
            daily.add_room(name, exp=int(time.time()) + HOUR)
            return daily_error(400, "invalid-request-error", f"a room named {name} already exists")

        daily.override("POST", "/rooms", lost_race)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert r.json()["data"]["room_url"] == f"{DAILY_DOMAIN}/{name}"

    def test_daily_odrzuca_wlasciwosc_nie_tworzymy_luzniejszego_pokoju(self, client, daily, caplog, test_user, test_board):
        daily.override("POST", "/rooms", daily_error(400, "invalid-request-error", "unknown property enable_dialout"))

        with caplog.at_level(logging.ERROR):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert r.json()["code"] == "VOICE_PROVIDER_ERROR"
        assert len(daily.calls("POST", "/rooms")) == 1  # zadnej drugiej proby z ubozszym zestawem
        assert daily.calls("POST", "/meeting-tokens") == []
        assert "unknown property" in caplog.text

    @pytest.mark.parametrize("ignored", ["eject_at_room_exp", "max_participants"])
    def test_pokoj_utworzony_bez_wymaganych_ustawien_jest_kasowany(self, client, daily, test_user, test_board, ignored):
        daily.ignored_room_properties = {ignored}

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert room_of(test_board) not in daily.rooms
        assert daily.calls("POST", "/meeting-tokens") == []

    @pytest.mark.parametrize(
        "response",
        [
            daily_error(402, "payment-required", "billing"),
            daily_error(400, "invalid-request-error", "account has reached the maximum number of rooms"),
            daily_error(403, "forbidden-error", "room limit reached"),
        ],
    )
    def test_limit_pokoi_albo_platnosc_daje_czytelny_kod_i_log(self, client, daily, caplog, test_user, test_board, response):
        daily.override("POST", "/rooms", response)

        with caplog.at_level(logging.ERROR):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 503
        assert r.json()["code"] == "VOICE_PROVIDER_LIMIT"
        assert "limit konta" in caplog.text
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_prefiks_z_konfiguracji_jest_czyszczony(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "daily_room_prefix", " Dev_Śr/../x ")
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert daily.body("POST", "/rooms")["name"] == f"devrx-board-{test_board.id}"

    def test_pusty_prefiks_wraca_do_domyslnego(self, monkeypatch):
        monkeypatch.setattr(get_settings(), "daily_room_prefix", "--")
        assert call.room_name_for_board(7) == "easylesson-board-7"


NONCOMPLIANT = [
    {"privacy": "public"},
    {"eject_at_room_exp": False},
    {"eject_at_room_exp": None},
    {"max_participants": 50},
    {"max_participants": None},
    {"enable_recording": "cloud"},
    {"enable_recording": ["local"]},
    {"enable_dialout": True},
    {"sip": {"sip_mode": "dial-in", "display_name": "x"}},
    {"streaming_endpoints": [{"name": "rtmp"}]},
    {"enable_transcription_storage": True},
    {"auto_transcription_settings": {"language": "pl"}},
    {"enable_knocking": True},
    {"exp": "far"},
    {"exp": None},
]


class TestNoncompliantRoom:
    """Pokoj utworzony recznie albo przez stara wersje - nigdy nie dostaje tokenu w zastanym stanie."""

    def add(self, daily, name, overrides):
        overrides = dict(overrides)
        if overrides.get("exp") == "far":
            overrides["exp"] = int(time.time()) + 24 * HOUR
        privacy = overrides.pop("privacy", "private")
        room = daily.add_room(name, privacy=privacy)
        room["config"].update(overrides)
        room["config"] = {k: v for k, v in room["config"].items() if v is not None}

    @pytest.mark.parametrize("overrides", NONCOMPLIANT)
    def test_dolaczajacy_dostaje_odmowe(self, client, daily, db_session, test_user2, test_board, overrides):
        add_member(db_session, test_board, test_user2, "editor")
        self.add(daily, room_of(test_board), overrides)

        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 409
        assert daily.calls("POST", "/meeting-tokens") == []
        assert daily.writes() == []

    @pytest.mark.parametrize("overrides", NONCOMPLIANT)
    def test_wlasciciel_zastepuje_pokoj_zgodnym(self, client, daily, test_user, test_board, overrides):
        name = room_of(test_board)
        self.add(daily, name, overrides)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert len(daily.calls("DELETE", f"/rooms/{name}")) == 1
        assert call._room_problem(daily.rooms[name], name, int(time.time())) is None

    def test_nieudane_kasowanie_niezgodnego_pokoju_daje_502_bez_tokenu(self, client, daily, test_user, test_board):
        name = room_of(test_board)
        self.add(daily, name, {"privacy": "public"})
        daily.override("DELETE", f"/rooms/{name}", daily_error(500, "server-error"))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert daily.calls("POST", "/meeting-tokens") == []


class TestRoomUrl:

    @pytest.mark.parametrize(
        "url",
        [
            "https://evil.example/{name}",
            "https://x.daily.co.evil.example/{name}",
            "https://evildaily.co/{name}",
            "https://daily.co.evil.example/{name}",
            "https://.daily.co/{name}",
            "https://-.daily.co/{name}",
            "http://easylesson-test.daily.co/{name}",
            "https://user@easylesson-test.daily.co/{name}",
            "https://easylesson-test.daily.co:8443/{name}",
            "https://easylesson-test.daily.co:x/{name}",
            "https://easylesson-test.daily.co/inny-pokoj",
            "https://easylesson-test.daily.co/{name}/../x",
            "https://easylesson-test.daily.co/{name}?t=1",
            "https://easylesson-test.daily.co/{name}#x",
            "https://easylesson-test.daily.co@evil.example/{name}",
            "https://evil.example\\.daily.co/{name}",
            "https://evil.example\\@x.daily.co/{name}",
            "https://evil.example .daily.co/{name}",
            "https://evil.example\t.daily.co/{name}",
            "https://evil.example;.daily.co/{name}",
            "https://evil.example%2f.daily.co/{name}",
            "https://evil.example%2F.daily.co/{name}",
            "https://a.b.daily.co/{name}",
            "https://easylesson-test.daily.co/{name}\n",
            " https://easylesson-test.daily.co/{name}",
            "https://easylesson-test.daily.co/{name}%2f",
            "https://easylesson-test.dаily.co/{name}",  # cyrylickie "а"
            "javascript:alert(1)",
            12345,
            None,
        ],
    )
    def test_adres_pokoju_spoza_daily_nie_dostaje_tokenu(self, client, daily, db_session, test_user2, test_board, url):
        name = room_of(test_board)
        if isinstance(url, str):
            url = url.replace("{name}", name)
        assert call._is_daily_room_url(url, name) is False
        add_member(db_session, test_board, test_user2, "editor")
        daily.add_room(name)["url"] = url

        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 409
        assert "evil" not in r.text
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_adres_z_subdomeny_daily_jest_przyjmowany(self):
        name = "easylesson-board-5"
        assert call._is_daily_room_url(f"https://Konto-1.daily.co/{name}", name) is True


class TestExtend:

    def test_wlasciciel_przedluza_konczacy_sie_pokoj(self, client, daily, sync_redis_client, test_user, test_board):
        name = room_of(test_board)
        old_exp = int(time.time()) + 10 * 60
        daily.add_room(name, exp=old_exp)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        new_exp = daily.body("POST", f"/rooms/{name}")["properties"]["exp"]
        assert int(time.time()) + 3 * HOUR - 5 <= new_exp <= int(time.time()) + 3 * HOUR
        reserved = int(sync_redis_client.get(f"call:budget:{test_user.id}:{guard.day_of(int(time.time()))}"))
        assert reserved == new_exp - old_exp  # budzet obciaza tylko przyrost

    def test_bez_budzetu_pokoj_nie_jest_przedluzany_ale_token_jest(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "call_user_daily_minutes_cap", 0)
        name = room_of(test_board)
        daily.add_room(name, exp=int(time.time()) + 10 * 60)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert daily.writes() == []

    def test_nieudane_przedluzenie_zwraca_rezerwacje(self, client, daily, sync_redis_client, test_user, test_board):
        name = room_of(test_board)
        daily.add_room(name, exp=int(time.time()) + 10 * 60)
        daily.override("POST", f"/rooms/{name}", daily_error(500, "server-error"))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert int(sync_redis_client.get(f"call:budget:{test_user.id}:{guard.day_of(int(time.time()))}")) == 0


class TestCleanup:

    def old_rooms(self, daily, count, start=900):
        for i in range(count):
            daily.add_room(f"easylesson-board-{start + i}", exp=int(time.time()) - HOUR)

    def test_przy_tworzeniu_kasuje_tylko_wygasle_pokoje_z_naszym_prefiksem(self, client, daily, test_user, test_board):
        self.old_rooms(daily, 2)
        daily.add_room("easylesson-board-950", exp=int(time.time()) + HOUR)  # aktywny
        daily.add_room("easylesson-board-951", exp=int(time.time()) - 60)  # w okresie karencji
        daily.add_room("cudzy-pokoj", exp=int(time.time()) - HOUR)
        daily.add_room("easylesson-board-abc", exp=int(time.time()) - HOUR)

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert "easylesson-board-900" not in daily.rooms and "easylesson-board-901" not in daily.rooms
        for kept in ("easylesson-board-950", "easylesson-board-951", "cudzy-pokoj", "easylesson-board-abc"):
            assert kept in daily.rooms

    def test_pokoj_odswiezony_po_pobraniu_listy_nie_jest_kasowany(self, client, daily, test_user, test_board):
        self.old_rooms(daily, 1)
        stale = dict(daily.rooms["easylesson-board-900"], config={"exp": int(time.time()) - HOUR})
        daily.override("GET", "/rooms", httpx.Response(200, json={"total_count": 1, "data": [stale]}))
        daily.rooms["easylesson-board-900"]["config"]["exp"] = int(time.time()) + HOUR

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert "easylesson-board-900" in daily.rooms
        assert daily.calls("DELETE", "/rooms/easylesson-board-900") == []

    def test_limit_dotyczy_prob_a_nie_udanych_kasowan(self, client, daily, test_user, test_board):
        self.old_rooms(daily, 12)
        for i in range(12):
            daily.override("DELETE", f"/rooms/easylesson-board-{900 + i}", daily_error(500, "server-error"))

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert len(daily.calls("DELETE")) == call.CLEANUP_MAX_ATTEMPTS

    def test_wygasly_pokoj_z_rejestru_jest_kasowany_nawet_gdy_lista_go_nie_zwraca(
        self, client, daily, sync_redis_client, test_user, test_board
    ):
        self.old_rooms(daily, 1)
        sync_redis_client.zadd("call:rooms", {"easylesson-board-900": int(time.time()) - HOUR})
        daily.override("GET", "/rooms", httpx.Response(200, json={"total_count": 0, "data": []}))

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert "easylesson-board-900" not in daily.rooms
        assert sync_redis_client.zscore("call:rooms", "easylesson-board-900") is None

    @pytest.mark.parametrize(
        "failure", [daily_error(500, "server-error"), httpx.ConnectError("down"), httpx.Response(200, json=[1, 2])]
    )
    def test_blad_sprzatania_nie_blokuje_rozmowy(self, client, daily, test_user, test_board, failure):
        daily.override("GET", "/rooms", failure)
        assert post_call(client, test_board.id, test_user.id).status_code == 200


class TestToken:

    def test_token_tworzacego(self, client, daily, test_user, test_board):
        before = int(time.time())

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        props = daily.token_properties()
        room_exp = daily.rooms[room_of(test_board)]["config"]["exp"]
        assert props["room_name"] == room_of(test_board)
        assert props["user_id"] == str(test_user.id)
        assert props["user_name"] == test_user.username
        # krotki czas na WEJSCIE, a pobyt najdluzej do exp pokoju i nigdy ponad 3 h
        assert before + 300 <= props["exp"] <= int(time.time()) + 300
        assert props["exp"] <= room_exp
        assert props["exp"] + props["eject_after_elapsed"] <= room_exp
        assert 0 < props["eject_after_elapsed"] <= 3 * HOUR
        assert props["is_owner"] is False
        assert props["permissions"] == {"canAdmin": ["participants"]}
        assert props["enable_recording_ui"] is False
        assert "enable_recording" not in props and "start_cloud_recording" not in props
        assert props["start_video_off"] is True
        assert props["start_audio_off"] is False

        data = r.json()["data"]
        assert data["token"] == DAILY_TOKEN
        expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        assert expires_at.utcoffset().total_seconds() == 0
        assert int(expires_at.timestamp()) == props["exp"]

    @pytest.mark.parametrize("minutes_left", [7, 20, 170])
    def test_token_dolaczajacego_nie_pozwala_zostac_po_exp_pokoju(
        self, client, daily, db_session, test_user2, test_board, minutes_left
    ):
        add_member(db_session, test_board, test_user2, "viewer")
        room_exp = int(time.time()) + minutes_left * 60
        daily.add_room(room_of(test_board), exp=room_exp)

        assert post_call(client, test_board.id, test_user2.id).status_code == 200

        props = daily.token_properties()
        assert props["exp"] <= room_exp
        assert props["exp"] + props["eject_after_elapsed"] <= room_exp
        assert props["eject_after_elapsed"] >= 1
        assert props["is_owner"] is False
        assert props["permissions"] == {"canAdmin": False}
        assert props["start_video_off"] is True

    def test_pokoj_tuz_przed_wygasnieciem_nie_wydaje_tokenu_dolaczajacemu(self, client, daily, db_session, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "viewer")
        daily.add_room(room_of(test_board), exp=int(time.time()) + 200)

        assert post_call(client, test_board.id, test_user2.id).status_code == 409
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_user_name_ze_znakami_specjalnymi(self, client, daily, db_session, test_user, test_board):
        test_user.username = 'Zażółć "gęślą" <jaźń> & 日本'
        db_session.commit()

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert daily.token_properties()["user_name"] == 'Zażółć "gęślą" <jaźń> & 日本'

    @pytest.mark.parametrize(
        "raw, expected",
        [
            ("  Jan   Kowalski ", "Jan Kowalski"),
            ("a\x00b\x1fc‮d​", "abcd"),
            ("x" * 200, "x" * 64),
            ("", "Uczestnik"),
            (None, "Uczestnik"),
            ("​​", "Uczestnik"),
        ],
    )
    def test_clean_user_name(self, raw, expected):
        assert call.clean_user_name(raw) == expected

    def test_odpowiedz_bez_tokenu_daje_502(self, client, daily, test_user, test_board):
        daily.override("POST", "/meeting-tokens", httpx.Response(200, json={"token": ""}))
        r = post_call(client, test_board.id, test_user.id)
        assert r.status_code == 502
        assert r.json()["code"] == "VOICE_PROVIDER_ERROR"

    def test_udane_wywolanie_nie_loguje_tokenu_ani_klucza(self, client, daily, caplog, test_user, test_board):
        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert API_KEY not in caplog.text
        assert DAILY_TOKEN not in caplog.text
        assert "wydano token" in caplog.text
        assert "zużycie miesiąca=0 min" in caplog.text


class TestProviderErrors:

    @pytest.mark.parametrize(
        "status, error", [(401, "authentication-error"), (403, "forbidden-error"), (500, "server-error")]
    )
    def test_blad_daily_daje_502_bez_tresci_daily(self, client, daily, caplog, test_user, test_board, status, error):
        name = room_of(test_board)
        daily.override("GET", f"/rooms/{name}", daily_error(status, error, f"sekretna tresc daily {API_KEY}"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        body = r.json()
        assert body["success"] is False
        assert body["code"] == "VOICE_PROVIDER_ERROR"
        assert error not in r.text
        assert "sekretna tresc daily" not in r.text
        assert daily.calls("POST", "/meeting-tokens") == []
        assert_no_secrets(r, caplog)

    def test_zly_klucz_jest_nazwany_w_logu(self, client, daily, caplog, test_user, test_board):
        daily.override("GET", f"/rooms/{room_of(test_board)}", daily_error(401, "authentication-error"))

        with caplog.at_level(logging.ERROR):
            post_call(client, test_board.id, test_user.id)

        assert "DAILY_API_KEY" in caplog.text

    def test_blad_przy_tokenie_daje_502(self, client, daily, caplog, test_user, test_board):
        daily.override("POST", "/meeting-tokens", daily_error(400, "invalid-request-error", "bad"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert r.json()["code"] == "VOICE_PROVIDER_ERROR"
        assert_no_secrets(r, caplog)

    def test_timeout_daje_504(self, client, daily, caplog, test_user, test_board):
        daily.override("GET", f"/rooms/{room_of(test_board)}", httpx.ReadTimeout("timeout"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 504
        assert r.json()["code"] == "VOICE_PROVIDER_TIMEOUT"
        assert_no_secrets(r, caplog)

    def test_blad_sieci_daje_502(self, client, daily, caplog, test_user, test_board):
        daily.override("POST", "/rooms", httpx.ConnectError(f"connect failed {API_KEY}"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert r.json()["code"] == "VOICE_PROVIDER_ERROR"
        assert_no_secrets(r, caplog)

    def test_429_jest_ponawiane_raz(self, client, daily, test_user, test_board):
        daily.override(
            "POST", "/meeting-tokens", daily_error(429, "rate-limit-error"), httpx.Response(200, json={"token": DAILY_TOKEN})
        )

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert len(daily.calls("POST", "/meeting-tokens")) == 2

    def test_429_po_ponowieniu_daje_502(self, client, daily, test_user, test_board):
        daily.override("POST", "/meeting-tokens", daily_error(429, "rate-limit-error"))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert len(daily.calls("POST", "/meeting-tokens")) == 2

    def test_nieudane_tworzenie_zwraca_rezerwacje_budzetu(self, client, daily, sync_redis_client, test_user, test_board):
        daily.override("POST", "/rooms", daily_error(500, "server-error"))

        assert post_call(client, test_board.id, test_user.id).status_code == 502

        assert int(sync_redis_client.get(f"call:budget:{test_user.id}:{guard.day_of(int(time.time()))}")) == 0
        assert sync_redis_client.zcard("call:rooms") == 0


class TestOneRoomPerCreator:

    def test_nowa_rozmowa_na_innej_tablicy_konczy_poprzednia(
        self, client, daily, db_session, sync_redis_client, test_user, test_workspace, test_board
    ):
        second = add_board(db_session, test_workspace, test_user)
        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert post_call(client, second.id, test_user.id).status_code == 200

        assert room_of(test_board) not in daily.rooms
        assert room_of(second) in daily.rooms
        # budzet: poprzedni pokoj oddal niewykorzystany czas, liczy sie jeden pelny pokoj
        used = int(sync_redis_client.get(f"call:budget:{test_user.id}:{guard.day_of(int(time.time()))}"))
        assert 3 * HOUR <= used <= 3 * HOUR + 10
        assert sync_redis_client.zrange("call:rooms", 0, -1) == [room_of(second)]
