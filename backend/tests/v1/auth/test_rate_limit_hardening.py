"""
Testy odporności rate limitu na złe body (SEC-21), limitów per IP na /refresh i /logout
oraz logowania hasłem na konto Google bez hasła (SEC-25).
"""
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError

import core.rate_limit as rl
from api.v1.auth.schemas import LoginData
from api.v1.auth.service import AuthService
from core.database import get_db
from core.exceptions import AuthenticationError
from core.models import User
from core.rate_limit import rate_limit
from main import app


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
def google_user(db_session):
    user = User(
        username="googleuser",
        email="google@example.com",
        hashed_password=None,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


class TestBadBody:
    """Złe body ma kończyć się 422 z walidacji, a nie 500 z zależności rate limitu."""

    @pytest.mark.parametrize(
        "content",
        [
            b"{not json",
            b"[]",
            b'["login", "password"]',
            b'"string"',
            b"123",
            b"null",
            b"",
        ],
    )
    def test_login_returns_422(self, client, content):
        r = client.post(
            "/api/v1/auth/login",
            content=content,
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 422
        assert r.json()["code"] == "VALIDATION_ERROR"

    def test_undecodable_body_returns_400(self, client):
        """Body nie-UTF-8: FastAPI samo odpowiada 400 ("error parsing the body") - ważne, że nie 500."""
        r = client.post(
            "/api/v1/auth/login",
            content=b"\xff\xfe\x00",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400

    def test_non_scalar_identifier_returns_422(self, client):
        r = client.post("/api/v1/auth/login", json={"login": {"a": 1}, "password": ["x"]})
        assert r.status_code == 422

    def test_bad_body_still_counts_towards_ip_limit(self, client):
        last = None
        for _ in range(11):
            last = client.post(
                "/api/v1/auth/login",
                content=b"[]",
                headers={"Content-Type": "application/json"},
            )
        assert last.status_code == 429


class TestSessionEndpointsLimits:
    def test_refresh_is_limited_per_ip(self, client):
        statuses = [client.post("/api/v1/auth/refresh").status_code for _ in range(301)]
        assert set(statuses[:300]) == {401}  # brak cookie -> 401, ale w limicie
        assert statuses[300] == 429

    def test_logout_is_limited_per_ip(self, client):
        statuses = [client.post("/api/v1/auth/logout").status_code for _ in range(61)]
        assert set(statuses[:60]) == {200}
        assert statuses[60] == 429

    def test_refresh_survives_redis_outage(self, client, monkeypatch):
        """fail_open: awaria Redis nie może blokować odświeżania sesji (401 = brak cookie)."""

        class BrokenRedis:
            async def incr(self, key):
                raise RedisConnectionError("connection refused")

        monkeypatch.setattr(rl, "get_redis_client", lambda: BrokenRedis())
        assert client.post("/api/v1/auth/refresh").status_code == 401

    @pytest.mark.asyncio
    async def test_fail_closed_is_still_the_default(self, monkeypatch):
        from unittest.mock import MagicMock

        from core.exceptions import AppException

        class BrokenRedis:
            async def incr(self, key):
                raise RedisConnectionError("connection refused")

        monkeypatch.setattr(rl, "get_redis_client", lambda: BrokenRedis())
        request = MagicMock()
        request.client.host = "1.1.1.1"
        with pytest.raises(AppException) as exc:
            await rate_limit("scope", limit=1, window_seconds=60)(request)
        assert exc.value.status_code == 503


class TestPasswordLoginOnGoogleAccount:
    @pytest.mark.asyncio
    async def test_service_raises_authentication_error(self, db_session, google_user):
        with pytest.raises(AuthenticationError) as exc:
            await AuthService(db_session).login_user(
                LoginData(login=google_user.email, password="cokolwiek123")
            )
        assert exc.value.status_code == 401

    def test_endpoint_returns_401_not_500(self, client, google_user):
        r = client.post(
            "/api/v1/auth/login",
            json={"login": google_user.email, "password": "cokolwiek123"},
        )
        assert r.status_code == 401
        assert r.json()["code"] == "AUTH_ERROR"
