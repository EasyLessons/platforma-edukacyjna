"""
Testy rozmowy glosowej tablicy - POST /api/v1/whiteboard/{id}/call (api/v1/whiteboard/call.py).

API Daily jest podmienione na httpx.MockTransport (FakeDaily) - zadnych prawdziwych wywolan.
Klucz i token sa losowane w runtime (zadnych literalow wygladajacych na sekret).
"""
import json
import logging
import secrets
import time
from datetime import datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError

import api.v1.whiteboard.call as call
from api.v1.auth.utils import create_access_token
from core import redis_client as redis_client_module
from core.config import get_settings
from core.database import get_db
from core.models import WorkspaceMember
from main import app

API_KEY = secrets.token_urlsafe(24)
DAILY_TOKEN = secrets.token_urlsafe(48)
DAILY_DOMAIN = "https://easylesson-test.daily.co"


def user_headers(user_id: int) -> dict:
    settings = get_settings()
    token = create_access_token({"sub": str(user_id)}, settings.secret_key, settings.algorithm)
    return {"Authorization": f"Bearer {token}"}


def daily_error(status: int, error: str, info: str = "") -> httpx.Response:
    return httpx.Response(status, json={"error": error, "info": info})


class FakeDaily:
    """Atrapa REST API Daily: pokoje w pamieci + nagrane zadania + nadpisywane odpowiedzi."""

    def __init__(self):
        self.rooms: dict[str, dict] = {}
        self.requests: list[httpx.Request] = []
        # (metoda, sciezka) -> lista odpowiedzi/wyjatkow zuzywanych po kolei (ostatnia zostaje)
        self.overrides: dict[tuple[str, str], list] = {}
        self.missing_room_response = lambda: daily_error(404, "not-found", "room not found")

    # --- pomocnicze dla testow ---

    def add_room(self, name: str, *, exp: int | None = None, privacy: str = "private") -> None:
        self.rooms[name] = {
            "id": secrets.token_hex(8),
            "name": name,
            "api_created": True,
            "privacy": privacy,
            "url": f"{DAILY_DOMAIN}/{name}",
            "created_at": "2026-10-02T10:00:00.000Z",
            "config": {"exp": exp if exp is not None else int(time.time()) + 600},
        }

    def override(self, method: str, path: str, *responses) -> None:
        self.overrides[(method, path)] = list(responses)

    def calls(self, method: str | None = None, path: str | None = None) -> list[httpx.Request]:
        return [
            r for r in self.requests
            if (method is None or r.method == method) and (path is None or r.url.path == f"/v1{path}")
        ]

    def body(self, method: str, path: str, index: int = -1) -> dict:
        return json.loads(self.calls(method, path)[index].content)

    # --- transport ---

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        assert request.url.host == "api.daily.co"
        path = request.url.path.removeprefix("/v1")

        queue = self.overrides.get((request.method, path))
        if queue:
            item = queue.pop(0) if len(queue) > 1 else queue[0]
            if isinstance(item, Exception):
                raise item
            if callable(item):
                return item(request)
            return httpx.Response(item.status_code, content=item.content, headers={"content-type": "application/json"})

        if request.method == "POST" and path == "/meeting-tokens":
            return httpx.Response(200, json={"token": DAILY_TOKEN})
        if request.method == "GET" and path == "/rooms":
            return httpx.Response(200, json={"total_count": len(self.rooms), "data": list(self.rooms.values())})
        if request.method == "POST" and path == "/rooms":
            payload = json.loads(request.content)
            if payload["name"] in self.rooms:
                return daily_error(400, "invalid-request-error", f"a room named {payload['name']} already exists")
            self.add_room(payload["name"], exp=payload["properties"]["exp"], privacy=payload.get("privacy", "public"))
            return httpx.Response(200, json=self.rooms[payload["name"]])
        if path.startswith("/rooms/"):
            name = path.removeprefix("/rooms/")
            room = self.rooms.get(name)
            if room is None:
                return self.missing_room_response()
            if request.method == "DELETE":
                del self.rooms[name]
                return httpx.Response(200, json={"deleted": True, "name": name})
            if request.method == "POST":
                room["config"].update(json.loads(request.content).get("properties", {}))
            return httpx.Response(200, json=room)
        return daily_error(404, "not-found")


@pytest.fixture
def daily(monkeypatch):
    fake = FakeDaily()
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        call.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(fake.handler), **kwargs),
    )
    monkeypatch.setattr(call, "DAILY_RATE_LIMIT_BACKOFF_SECONDS", 0)
    return fake


@pytest.fixture
def client(db_session, monkeypatch, redis_client):
    settings = get_settings()
    monkeypatch.setattr(settings, "daily_api_key", API_KEY)
    monkeypatch.setattr(settings, "daily_room_prefix", "easylesson")
    monkeypatch.setattr(settings, "daily_room_ttl_minutes", 180)
    monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: redis_client)

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def add_member(db_session, board, user, role: str) -> None:
    db_session.add(WorkspaceMember(workspace_id=board.workspace_id, user_id=user.id, role=role))
    db_session.commit()


def post_call(client, board_id: int, user_id: int):
    return client.post(f"/api/v1/whiteboard/{board_id}/call", headers=user_headers(user_id))


def room_of(board) -> str:
    return f"easylesson-board-{board.id}"


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

    def test_domyslna_konfiguracja_ma_pusty_klucz(self):
        from core.config import Settings

        assert Settings.model_fields["daily_api_key"].default == ""

    def test_nie_czlonek_bez_klucza_dostaje_404_a_nie_503(self, client, daily, monkeypatch, test_user2, test_board):
        monkeypatch.setattr(get_settings(), "daily_api_key", "")
        r = post_call(client, test_board.id, test_user2.id)
        assert r.status_code == 404


class TestAccess:

    def test_nie_czlonek_dostaje_404_i_zero_wywolan_daily(self, client, daily, test_user2, test_board):
        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 404
        assert r.json()["code"] == "NOT_FOUND"
        assert daily.requests == []

    def test_nieistniejaca_tablica_404(self, client, daily, test_user):
        r = post_call(client, 999999, test_user.id)
        assert r.status_code == 404
        assert daily.requests == []

    def test_bez_logowania_401(self, client, daily, test_board):
        r = client.post(f"/api/v1/whiteboard/{test_board.id}/call")
        assert r.status_code == 401
        assert daily.requests == []

    def test_viewer_moze_dolaczyc_ale_nie_jest_ownerem(self, client, daily, db_session, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "viewer")

        r = post_call(client, test_board.id, test_user2.id)

        assert r.status_code == 200
        assert daily.body("POST", "/meeting-tokens")["properties"]["is_owner"] is False

    def test_editor_nie_jest_ownerem(self, client, daily, db_session, test_user2, test_board):
        add_member(db_session, test_board, test_user2, "editor")
        assert post_call(client, test_board.id, test_user2.id).status_code == 200
        assert daily.body("POST", "/meeting-tokens")["properties"]["is_owner"] is False

    def test_wlasciciel_przestrzeni_jest_ownerem(self, client, daily, test_user, test_board):
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert daily.body("POST", "/meeting-tokens")["properties"]["is_owner"] is True


class TestRoom:

    def test_brak_pokoju_tworzy_prywatny_z_wygasaniem(self, client, daily, test_user, test_board):
        before = int(time.time())

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        name = room_of(test_board)
        created = daily.body("POST", "/rooms")
        assert created["name"] == name
        assert created["privacy"] == "private"
        props = created["properties"]
        assert before + 180 * 60 <= props["exp"] <= int(time.time()) + 180 * 60
        assert props["eject_at_room_exp"] is True
        assert props["start_video_off"] is True
        assert props["start_audio_off"] is False
        assert "enable_knocking" not in props
        assert r.json()["data"]["room_url"] == f"{DAILY_DOMAIN}/{name}"
        assert r.headers["cache-control"] == "no-store"

    def test_brak_pokoju_jako_400_not_found(self, client, daily, test_user, test_board):
        daily.missing_room_response = lambda: daily_error(400, "invalid-request-error", "room x not found")

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert len(daily.calls("POST", "/rooms")) == 1

    def test_istniejacy_pokoj_tylko_przesuwa_wygasanie(self, client, daily, test_user, test_board):
        name = room_of(test_board)
        daily.add_room(name, exp=int(time.time()) + 60)
        before = int(time.time())

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert daily.calls("POST", "/rooms") == []
        assert daily.calls("GET", "/rooms") == []
        assert daily.body("POST", f"/rooms/{name}") == {"properties": {"exp": daily.rooms[name]["config"]["exp"]}}
        assert daily.rooms[name]["config"]["exp"] >= before + 180 * 60

    def test_wyscig_przy_tworzeniu_konczy_sie_ponownym_get(self, client, daily, test_user, test_board):
        name = room_of(test_board)

        def someone_else_created_it(request):
            daily.add_room(name)
            return daily_error(400, "invalid-request-error", f"a room named {name} already exists")

        daily.override("POST", "/rooms", someone_else_created_it)

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert len(daily.calls("GET", f"/rooms/{name}")) == 1
        assert r.json()["data"]["room_url"] == f"{DAILY_DOMAIN}/{name}"

    def test_tworzenie_nieudane_i_pokoju_nadal_brak_daje_502(self, client, daily, caplog, test_user, test_board):
        daily.override("POST", "/rooms", daily_error(400, "invalid-request-error", f"room limit reached {API_KEY}"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert r.json()["code"] == "VOICE_PROVIDER_ERROR"
        assert "room limit" not in r.text
        assert "room limit reached" in caplog.text
        assert daily.calls("POST", "/meeting-tokens") == []
        assert_no_secrets(r, caplog)

    def test_publiczny_pokoj_nie_dostaje_tokenu(self, client, daily, test_user, test_board):
        daily.add_room(room_of(test_board), privacy="public")

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_odpowiedz_bez_adresu_pokoju_daje_502(self, client, daily, test_user, test_board):
        name = room_of(test_board)
        daily.override("POST", f"/rooms/{name}", httpx.Response(200, json={"name": name, "privacy": "private"}))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert daily.calls("POST", "/meeting-tokens") == []

    def test_prefiks_z_konfiguracji_jest_czyszczony(self, client, daily, monkeypatch, test_user, test_board):
        monkeypatch.setattr(get_settings(), "daily_room_prefix", "Dev_El/../x")

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert daily.body("POST", "/rooms")["name"] == f"develx-board-{test_board.id}"

    def test_pusty_prefiks_wraca_do_domyslnego(self, monkeypatch):
        monkeypatch.setattr(get_settings(), "daily_room_prefix", " -- ")
        assert call.room_name_for_board(7) == "easylesson-board-7"


class TestCleanup:

    def test_przy_tworzeniu_kasuje_tylko_wygasle_pokoje_z_naszym_prefiksem(self, client, daily, test_user, test_board):
        past = int(time.time()) - 3600
        daily.add_room("easylesson-board-901", exp=past)
        daily.add_room("easylesson-board-902")              # jeszcze wazny
        daily.add_room("inny-projekt", exp=past)             # nie nasz
        daily.add_room("easylesson-board-903-x", exp=past)   # nie pasuje do wzorca
        daily.add_room("dev-board-904", exp=past)            # inny prefiks

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert [r.url.path for r in daily.calls("DELETE")] == ["/v1/rooms/easylesson-board-901"]
        assert "easylesson-board-902" in daily.rooms

    def test_blad_sprzatania_nie_blokuje_rozmowy(self, client, daily, test_user, test_board):
        daily.override("GET", "/rooms", httpx.ReadTimeout("timeout"))
        assert post_call(client, test_board.id, test_user.id).status_code == 200

        daily.rooms.clear()
        daily.override("GET", "/rooms", httpx.Response(200, json={"data": "nie-lista"}))
        assert post_call(client, test_board.id, test_user.id).status_code == 200

        daily.rooms.clear()
        daily.add_room("easylesson-board-901", exp=1)
        del daily.overrides[("GET", "/rooms")]
        daily.override("DELETE", "/rooms/easylesson-board-901", daily_error(500, "server-error"))
        assert post_call(client, test_board.id, test_user.id).status_code == 200


class TestToken:

    def test_token_ma_pokoj_wygasanie_i_uzytkownika(self, client, daily, test_user, test_board):
        before = int(time.time())

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        props = daily.body("POST", "/meeting-tokens")["properties"]
        assert props["room_name"] == room_of(test_board)
        assert props["user_id"] == str(test_user.id)
        assert props["user_name"] == test_user.username
        assert before + 3600 <= props["exp"] <= int(time.time()) + 3600
        assert props["eject_at_token_exp"] is False
        assert props["start_video_off"] is True
        assert props["start_audio_off"] is False

        data = r.json()["data"]
        assert data["token"] == DAILY_TOKEN
        expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        assert expires_at.utcoffset().total_seconds() == 0
        assert int(expires_at.timestamp()) == props["exp"]

    def test_kazde_zadanie_do_daily_niesie_klucz_w_naglowku(self, client, daily, test_user, test_board):
        post_call(client, test_board.id, test_user.id)

        assert len(daily.requests) >= 3
        assert all(r.headers["authorization"] == f"Bearer {API_KEY}" for r in daily.requests)
        assert all(API_KEY not in str(r.url) for r in daily.requests)

    def test_user_name_ze_znakami_specjalnymi(self, client, daily, db_session, test_user, test_board):
        test_user.username = "  Jan‮\x00\n\tKowalski​ <script>\"ą🙂  "
        db_session.commit()

        assert post_call(client, test_board.id, test_user.id).status_code == 200

        assert daily.body("POST", "/meeting-tokens")["properties"]["user_name"] == 'Jan Kowalski <script>"ą🙂'

    @pytest.mark.parametrize(
        "raw, expected",
        [
            ("x" * 200, "x" * 64),
            ("\x00\x1f‮", "Uczestnik"),
            ("", "Uczestnik"),
            (None, "Uczestnik"),
            ("a\r\nb", "a b"),
            ("Zażółć Gęślą", "Zażółć Gęślą"),
        ],
    )
    def test_clean_user_name(self, raw, expected):
        assert call.clean_user_name(raw) == expected

    def test_odpowiedz_bez_tokenu_daje_502(self, client, daily, test_user, test_board):
        daily.override("POST", "/meeting-tokens", httpx.Response(200, json={}))
        r = post_call(client, test_board.id, test_user.id)
        assert r.status_code == 502
        assert r.json()["code"] == "VOICE_PROVIDER_ERROR"

    def test_udane_wywolanie_nie_loguje_tokenu_ani_klucza(self, client, daily, caplog, test_user, test_board):
        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert API_KEY not in r.text
        assert API_KEY not in caplog.text
        assert DAILY_TOKEN not in caplog.text


class TestProviderErrors:

    @pytest.mark.parametrize(
        "status, error",
        [(401, "authentication-error"), (403, "forbidden-error"), (500, "server-error"), (402, "payment-required")],
    )
    def test_blad_daily_daje_502_bez_tresci_daily(self, client, daily, caplog, test_user, test_board, status, error):
        name = room_of(test_board)
        daily.override("POST", f"/rooms/{name}", daily_error(status, error, f"sekretna tresc daily {API_KEY}"))

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
        daily.override("POST", f"/rooms/{room_of(test_board)}", daily_error(401, "authentication-error"))

        with caplog.at_level(logging.ERROR):
            post_call(client, test_board.id, test_user.id)

        assert "DAILY_API_KEY" in caplog.text

    def test_blad_przy_tokenie_daje_502(self, client, daily, caplog, test_user, test_board):
        daily.override("POST", "/meeting-tokens", daily_error(400, "invalid-request-error", f"bad {DAILY_TOKEN}"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert API_KEY not in r.text
        assert DAILY_TOKEN not in r.text
        assert API_KEY not in caplog.text

    def test_timeout_daje_504(self, client, daily, caplog, test_user, test_board):
        daily.override("POST", f"/rooms/{room_of(test_board)}", httpx.ReadTimeout("timeout"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 504
        assert r.json()["code"] == "VOICE_PROVIDER_TIMEOUT"
        assert_no_secrets(r, caplog)

    def test_blad_sieci_daje_502(self, client, daily, caplog, test_user, test_board):
        daily.override("POST", f"/rooms/{room_of(test_board)}", httpx.ConnectError(f"refused {API_KEY}"))

        with caplog.at_level(logging.DEBUG):
            r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert r.json()["code"] == "VOICE_PROVIDER_ERROR"
        assert_no_secrets(r, caplog)

    def test_429_jest_ponawiane_raz(self, client, daily, test_user, test_board):
        daily.override("POST", "/meeting-tokens", daily_error(429, "rate-limit-error"), httpx.Response(200, json={"token": DAILY_TOKEN}))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 200
        assert len(daily.calls("POST", "/meeting-tokens")) == 2

    def test_429_po_ponowieniu_daje_502(self, client, daily, test_user, test_board):
        daily.override("POST", "/meeting-tokens", daily_error(429, "rate-limit-error"))

        r = post_call(client, test_board.id, test_user.id)

        assert r.status_code == 502
        assert r.json()["code"] == "VOICE_PROVIDER_ERROR"
        assert len(daily.calls("POST", "/meeting-tokens")) == 2


class TestRateLimit:

    def test_limit_per_uzytkownik(self, client, daily, db_session, monkeypatch, test_user, test_user2, test_board):
        monkeypatch.setattr(call, "CALL_RATE_LIMIT", 2)
        add_member(db_session, test_board, test_user2, "viewer")

        assert post_call(client, test_board.id, test_user.id).status_code == 200
        assert post_call(client, test_board.id, test_user.id).status_code == 200
        blocked = post_call(client, test_board.id, test_user.id)
        assert blocked.status_code == 429
        assert blocked.json()["code"] == "RATE_LIMITED"
        # Inny uzytkownik (to samo IP - klasa za jednym NAT-em) nie jest blokowany.
        assert post_call(client, test_board.id, test_user2.id).status_code == 200

    def test_awaria_redis_przepuszcza(self, client, daily, monkeypatch, test_user, test_board):
        class BrokenRedis:
            async def incr(self, key):
                raise RedisConnectionError("redis down")

        monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: BrokenRedis())

        assert post_call(client, test_board.id, test_user.id).status_code == 200
