"""
SEC-18: POST /auth/refresh i /auth/logout odrzucaja obcy Origin (api/v1/auth/router.py).
"""
import pytest
from fastapi.testclient import TestClient

from api.v1.auth.schemas import LoginData
from api.v1.auth.service import AuthService
from core.database import get_db
from main import app

OWN_ORIGIN = "http://localhost:3000"
FOREIGN_ORIGINS = ["https://evil.example", "https://evil.vercel.app", "null"]


@pytest.fixture(autouse=True)
def use_fake_redis_singleton(monkeypatch, redis_client):
    import core.redis_client as redis_client_module

    monkeypatch.setattr(redis_client_module, "_redis_client", redis_client)


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def refresh_cookie(db_session, test_user):
    import asyncio

    # Wlasna petla: asyncio.get_event_loop() zalezy od stanu po wczesniejszych testach
    # (pytest-asyncio zostawia "brak biezacej petli") i w pelnym przebiegu rzucalo RuntimeError.
    loop = asyncio.new_event_loop()
    try:
        _, token = loop.run_until_complete(
            AuthService(db_session).login_user(LoginData(login=test_user.username, password="testpassword"))
        )
    finally:
        loop.close()
    return token


class TestRefresh:
    @pytest.mark.parametrize("origin", FOREIGN_ORIGINS)
    def test_obcy_origin_403_i_sesja_nietknieta(self, client, refresh_cookie, origin):
        client.cookies.set("refresh_token", refresh_cookie)
        r = client.post("/api/v1/auth/refresh", headers={"Origin": origin})
        assert r.status_code == 403
        assert r.json()["code"] == "FORBIDDEN_ORIGIN"
        assert "set-cookie" not in r.headers  # bez rotacji, bez czyszczenia

        # ten sam token dalej dziala z wlasnego originu
        ok = client.post("/api/v1/auth/refresh", headers={"Origin": OWN_ORIGIN})
        assert ok.status_code == 200

    def test_wlasny_origin_przechodzi(self, client, refresh_cookie):
        client.cookies.set("refresh_token", refresh_cookie)
        r = client.post("/api/v1/auth/refresh", headers={"Origin": OWN_ORIGIN})
        assert r.status_code == 200
        assert r.json()["data"]["access_token"]

    def test_bez_origin_jak_dotad(self, client, refresh_cookie):
        client.cookies.set("refresh_token", refresh_cookie)
        assert client.post("/api/v1/auth/refresh").status_code == 200
        client.cookies.clear()
        assert client.post("/api/v1/auth/refresh").status_code == 401


class TestLogout:
    def test_obcy_origin_nie_wylogowuje(self, client, refresh_cookie):
        client.cookies.set("refresh_token", refresh_cookie)
        r = client.post("/api/v1/auth/logout", headers={"Origin": "https://evil.example"})
        assert r.status_code == 403
        # sesja zyje: refresh z wlasnego originu dziala
        assert client.post("/api/v1/auth/refresh", headers={"Origin": OWN_ORIGIN}).status_code == 200

    def test_wlasny_origin_wylogowuje(self, client, refresh_cookie):
        client.cookies.set("refresh_token", refresh_cookie)
        r = client.post("/api/v1/auth/logout", headers={"Origin": OWN_ORIGIN})
        assert r.status_code == 200
        assert client.post("/api/v1/auth/refresh", headers={"Origin": OWN_ORIGIN}).status_code == 401
