"""
Tryb awaryjny Redis (core/redis_client.py: ResilientRedis) - aplikacja ma dzialac bez Redis.

Atrapa `BrokenPrimary` rzuca ConnectionError na KAZDA komende (jak redis-py przy padnietej
instancji). Sprawdzamy: logowanie, rejestracja + weryfikacja kodu, refresh, limit prob
liczony w pamieci, presence, /health "degraded" oraz aliasy /health i /healthz.
"""
import secrets

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import ResponseError as RedisResponseError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from core import redis_client as redis_client_module
from core.database import get_db, get_session_factory
from core.exceptions import AppException
from core.presence import PresenceService
from core.rate_limit import rate_limit
from core.redis_client import ResilientRedis
from main import app

ANY_PASSWORD = secrets.token_urlsafe(12)

# SELECT 1 dla /health; check_same_thread=False, bo ping_db leci w watku (asyncio.to_thread).
_healthy_engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
HealthySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_healthy_engine)


class BrokenPrimary:
    """Klient, ktorego kazda komenda konczy sie bledem polaczenia. Liczy proby."""

    def __init__(self):
        self.calls = 0

    def pipeline(self, transaction=True, shard_hint=None):
        raise RedisConnectionError("Error 111 connecting to redis-secret-host:6379. Connection refused.")

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)

        async def fail(*args, **kwargs):
            self.calls += 1
            raise RedisConnectionError("Error 111 connecting to redis-secret-host:6379. Connection refused.")

        return fail


@pytest.fixture
def broken_primary(monkeypatch):
    """Singleton Redis = padnieta instancja; ResilientRedis ma przejsc na pamiec procesu."""
    broken = BrokenPrimary()
    monkeypatch.setattr(redis_client_module, "_redis_client", broken)
    return broken


@pytest.fixture
def client(db_session, broken_primary):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # /health pinguje DB przez fabryke sesji (nie get_db) - SQLite in-memory jak w tests/v1/health.
    app.dependency_overrides[get_session_factory] = lambda: HealthySessionLocal
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ─── ResilientRedis (jednostkowo) ─────────────────────────────────────────────


class TestResilientRedis:
    @pytest.mark.asyncio
    async def test_awaria_polaczenia_przelacza_na_pamiec_i_omija_redis(self, broken_primary):
        r = ResilientRedis(broken_primary)
        assert await r.incr("k") == 1
        assert await r.incr("k") == 2
        assert await r.get("k") == "2"
        # Tylko pierwsza komenda poszla do Redis; kolejne omijaja go przez REDIS_RETRY_SECONDS.
        assert broken_primary.calls == 1
        assert redis_client_module.redis_degraded() is True

    @pytest.mark.asyncio
    async def test_ttl_dziala_w_pamieci(self, broken_primary):
        r = ResilientRedis(broken_primary)
        await r.setex("code", 900, "123456")
        assert await r.get("code") == "123456"
        assert 0 < await r.ttl("code") <= 900

    @pytest.mark.asyncio
    async def test_po_oknie_ponowienia_probuje_redis_i_wraca_do_niego(self, redis_client, monkeypatch):
        """Pierwsza komenda pada, Redis zostaje omijany; po oknie proba na zywo - Redis dziala -> koniec trybu."""
        broken = BrokenPrimary()
        monkeypatch.setattr(redis_client_module, "REDIS_RETRY_SECONDS", 0.0)
        r = ResilientRedis(broken)
        await r.incr("k")  # w pamieci
        assert broken.calls == 1

        healthy = ResilientRedis(redis_client)
        await healthy.incr("k")  # okno = 0 s -> od razu proba na zywo, Redis (fake) odpowiada
        assert redis_client_module.redis_degraded() is False
        assert await redis_client.get("k") == "1"
        # Zapasowy magazyn wyczyszczony - stare liczniki z awarii nie wracaja.
        assert redis_client_module._fallback is None

    @pytest.mark.asyncio
    async def test_response_error_nie_wlacza_trybu_awaryjnego(self):
        class ReadOnlyRedis:
            async def incr(self, key):
                raise RedisResponseError("READONLY You can't write against a read only replica.")

        r = ResilientRedis(ReadOnlyRedis())
        with pytest.raises(RedisResponseError):
            await r.incr("k")
        assert redis_client_module.redis_degraded() is False

    @pytest.mark.asyncio
    async def test_log_bez_tresci_wyjatku(self, broken_primary, caplog):
        """W logu tylko typ wyjatku - tresc zawiera host (i potrafi zawierac haslo) z REDIS_URL."""
        r = ResilientRedis(broken_primary)
        with caplog.at_level("WARNING"):
            await r.incr("k")
        joined = " ".join(rec.getMessage() for rec in caplog.records)
        assert "ConnectionError" in joined
        assert "redis-secret-host" not in joined


# ─── rate limit bez Redis ─────────────────────────────────────────────────────


class TestRateLimitWithoutRedis:
    @pytest.mark.asyncio
    async def test_zaleznosc_przepuszcza_i_liczy_w_pamieci(self, broken_primary):
        from unittest.mock import MagicMock

        request = MagicMock()
        request.client.host = "1.1.1.1"
        request.headers.get.return_value = None
        request.headers.getlist.return_value = []
        fn = rate_limit("scope", limit=2, window_seconds=60)
        await fn(request)
        await fn(request)
        with pytest.raises(AppException) as exc:
            await fn(request)
        assert exc.value.status_code == 429

    def test_logowanie_dziala_bez_redis(self, client, test_user):
        r = client.post("/api/v1/auth/login", json={"login": "testuser", "password": "testpassword"})
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True

    def test_limit_logowania_dalej_obowiazuje_bez_redis(self, client):
        statuses = [
            client.post("/api/v1/auth/login", json={"login": "nikt", "password": ANY_PASSWORD}).status_code
            for _ in range(11)
        ]
        assert statuses[:10] == [401] * 10
        assert statuses[10] == 429

    def test_refresh_bez_cookie_401_nie_503(self, client):
        assert client.post("/api/v1/auth/refresh").status_code == 401

    def test_pierwsza_komenda_idzie_do_redis_kolejne_juz_nie(self, client, broken_primary, test_user):
        for _ in range(3):
            client.post("/api/v1/auth/login", json={"login": "testuser", "password": "testpassword"})
        # Jedna nieudana proba otwiera tryb awaryjny; przez 30 s zadne zadanie nie czeka na timeout Redis.
        assert broken_primary.calls == 1
        assert redis_client_module.redis_degraded() is True


# ─── rejestracja i kody weryfikacyjne bez Redis ───────────────────────────────


class TestVerificationCodesWithoutRedis:
    def test_rejestracja_i_weryfikacja_kodu_z_pamieci(self, client, monkeypatch):
        monkeypatch.setattr("api.v1.auth.service.get_settings", lambda: _settings_skip_email())
        r = client.post(
            "/api/v1/auth/register",
            json={
                "username": "nowy",
                "email": "nowy@example.com",
                "password": ANY_PASSWORD + "A1!",
                "password_confirm": ANY_PASSWORD + "A1!",
                "full_name": "Nowy User",
            },
        )
        assert r.status_code == 201, r.text
        user_id = r.json()["data"]["user"]["id"]

        # Kod wyladowal w zapasowym magazynie w pamieci procesu.
        fallback = redis_client_module._get_fallback()
        code = _sync_get(fallback, f"auth:email_verification:{user_id}")
        assert code and len(code) == 6

        r = client.post("/api/v1/auth/verify-email", json={"user_id": user_id, "code": code})
        assert r.status_code == 200, r.text

    def test_zly_kod_limit_prob_w_pamieci(self, client, test_user, monkeypatch):
        monkeypatch.setattr("api.v1.auth.service.get_settings", lambda: _settings_skip_email())
        assert client.post("/api/v1/auth/request-password-reset", json={"email": test_user.email}).status_code == 200
        bad = {"email": test_user.email, "code": "000000"}
        statuses = [client.post("/api/v1/auth/verify-reset-code", json=bad).status_code for _ in range(6)]
        assert statuses[:5] == [400] * 5
        assert statuses[5] == 429


def _settings_skip_email():
    from core.config import get_settings

    settings = get_settings().model_copy()
    settings.resend_api_key = "SKIP"
    return settings


def _sync_get(fake_async_client, key):
    import asyncio

    return asyncio.get_event_loop().run_until_complete(fake_async_client.get(key))


# ─── presence i health ────────────────────────────────────────────────────────


class TestPresenceAndHealthWithoutRedis:
    @pytest.mark.asyncio
    async def test_presence_w_pamieci(self, db_session, broken_primary, test_user, test_board):
        presence = PresenceService(db_session)
        await presence.mark_online(test_board.id, test_user.id)
        online = await presence.get_online_users([test_board.id])
        assert [u.user_id for u in online[test_board.id]] == [test_user.id]

    def test_health_raportuje_degraded(self, client):
        r = client.get("/api/v1/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "degraded"
        assert body["checks"]["redis"]["status"] == "error"
        assert body["checks"]["redis"]["error"] == "ConnectionError"

    @pytest.mark.parametrize("path", ["/health", "/healthz", "/api/v1/health/live"])
    def test_aliasy_liveness_bez_db_i_redis(self, client, path):
        class BrokenFactory:
            def __call__(self):
                raise RuntimeError("DB down")

        app.dependency_overrides[get_session_factory] = lambda: BrokenFactory()
        try:
            r = client.get(path)
        finally:
            app.dependency_overrides.pop(get_session_factory, None)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_aliasy_poza_schematem_openapi(self, client):
        paths = client.get("/api/v1/openapi.json").json()["paths"]
        assert "/health" not in paths and "/healthz" not in paths
        assert "/api/v1/health/live" in paths
