"""
Testy rate limitingu na endpointach auth
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError

import core.rate_limit as rl
from core.rate_limit import rate_limit
from core.exceptions import AppException
from main import app
from core.database import get_db

MOCK_EMAIL = "api.v1.auth.service.send_verification_email"


def make_request(client_host: str, body: dict):
    """Minimalny fake fastapi.Request - tylko to, czego używa dependency."""
    request = MagicMock()
    request.client.host = client_host

    async def json():
        return body

    request.json = json
    return request


# ─── Testy jednostkowe dependency (bez HTTP, bez routera) ──────────────────

class TestRateLimitDependencyUnit:

    @pytest.mark.asyncio
    async def test_allows_requests_within_limit(self, redis_client, monkeypatch):
        monkeypatch.setattr(rl, "get_redis_client", lambda: redis_client)
        fn = rate_limit("test_scope", limit=3, window_seconds=60, identifier_field="email")

        for _ in range(3):
            await fn(make_request("1.1.1.1", {"email": "a@a.com"}))
        # brak wyjątku = OK, 3 requesty mieszczą się w limicie 3

    @pytest.mark.asyncio
    async def test_blocks_after_limit_per_identifier(self, redis_client, monkeypatch):
        """Ten sam email z różnych IP i tak wpada na wspólny limit per-identyfikator"""
        monkeypatch.setattr(rl, "get_redis_client", lambda: redis_client)
        fn = rate_limit("test_scope", limit=3, window_seconds=60, identifier_field="email")

        for _ in range(3):
            await fn(make_request("1.1.1.1", {"email": "a@a.com"}))

        with pytest.raises(AppException) as exc:
            await fn(make_request("2.2.2.2", {"email": "a@a.com"}))

        assert exc.value.status_code == 429
        assert exc.value.code == "RATE_LIMITED"

    @pytest.mark.asyncio
    async def test_blocks_after_limit_per_ip(self, redis_client, monkeypatch):
        """Różne emaile z tego samego IP i tak wpadają na wspólny limit per-IP"""
        monkeypatch.setattr(rl, "get_redis_client", lambda: redis_client)
        fn = rate_limit("test_scope", limit=3, window_seconds=60, identifier_field="email")

        for i in range(3):
            await fn(make_request("1.1.1.1", {"email": f"user{i}@a.com"}))

        with pytest.raises(AppException) as exc:
            await fn(make_request("1.1.1.1", {"email": "inny@a.com"}))

        assert exc.value.status_code == 429
        assert exc.value.code == "RATE_LIMITED"

    @pytest.mark.asyncio
    async def test_different_identifier_and_ip_are_independent(self, redis_client, monkeypatch):
        """Inny IP + inny identyfikator = osobne liczniki, nie powinno się zablokować"""
        monkeypatch.setattr(rl, "get_redis_client", lambda: redis_client)
        fn = rate_limit("test_scope", limit=1, window_seconds=60, identifier_field="email")

        await fn(make_request("1.1.1.1", {"email": "a@a.com"}))
        await fn(make_request("2.2.2.2", {"email": "b@b.com"}))  # nie powinno rzucić

    @pytest.mark.asyncio
    async def test_missing_identifier_field_falls_back_to_ip_only(self, redis_client, monkeypatch):
        """Brak pola identyfikatora w body -> liczy się tylko licznik per-IP"""
        monkeypatch.setattr(rl, "get_redis_client", lambda: redis_client)
        fn = rate_limit("test_scope", limit=2, window_seconds=60, identifier_field="email")

        await fn(make_request("1.1.1.1", {}))
        await fn(make_request("1.1.1.1", {}))

        with pytest.raises(AppException) as exc:
            await fn(make_request("1.1.1.1", {}))

        assert exc.value.status_code == 429

    @pytest.mark.asyncio
    async def test_redis_connection_error_raises_503(self, monkeypatch):
        """Awaria połączenia z Redis -> fail-closed, 503 REDIS_ERROR"""

        class BrokenRedis:
            async def incr(self, key):
                raise RedisConnectionError("connection refused")

        monkeypatch.setattr(rl, "get_redis_client", lambda: BrokenRedis())
        fn = rate_limit("test_scope", limit=5, window_seconds=60)

        with pytest.raises(AppException) as exc:
            await fn(make_request("1.1.1.1", {}))

        assert exc.value.status_code == 503
        assert exc.value.code == "REDIS_ERROR"


# ─── Testy end-to-end przez TestClient (potwierdzenie wpięcia w router) ────

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def use_fake_redis_singleton(monkeypatch, redis_client):
    """
    Router korzysta z globalnego singletona core.redis_client.get_redis_client().
    Podmieniamy cache singletona na fakeredis (świeże per test dzięki
    fake_redis_server ze scope='function'), żeby testy nie łączyły się
    z prawdziwym Redisem.
    """
    import core.redis_client as redis_client_module
    monkeypatch.setattr(redis_client_module, "_redis_client", redis_client)
    yield


class TestLoginRateLimitIntegration:

    def test_exceeding_limit_returns_429(self, client, test_user):
        """POST /login: limit 10/5min per login -> 11. próba to 429"""
        last = None
        for _ in range(11):
            last = client.post(
                "/api/v1/auth/login",
                json={"login": test_user.username, "password": "zle_haslo"},
            )

        assert last.status_code == 429
        body = last.json()
        assert body["success"] is False
        assert body["code"] == "RATE_LIMITED"


class TestResendCodeRateLimitIntegration:

    def test_exceeding_limit_returns_429(self, client, unverified_user):
        """POST /resend-code: limit 3/10min per user_id -> 4. próba to 429"""
        last = None
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            for _ in range(4):
                last = client.post(
                    "/api/v1/auth/resend-code",
                    json={"user_id": unverified_user.id},
                )

        assert last.status_code == 429
        assert last.json()["code"] == "RATE_LIMITED"