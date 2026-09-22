"""
Testy GET /api/v1/health i GET /api/v1/health/live (etap O1 obserwowalności).

DB: fabryka sesji podmieniana przez dependency_overrides[get_session_factory]
(własny SQLite in-memory - SELECT 1 nie potrzebuje tabel - albo fabryka/sesja
symulująca awarię). Redis: fakeredis przez dependency_overrides[get_redis_client].
"""
import time

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.v1.health import router as health_router
from core.database import get_session_factory
from core.redis_client import get_redis_client
from main import app

# check_same_thread=False: ping_db leci przez asyncio.to_thread, czyli w innym wątku
# niż ten, który stworzył engine.
_healthy_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
HealthySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_healthy_engine)

# Treści wyjątków ZAWIERAJĄ "sekrety" - testy sprawdzają, że nie wyciekają do odpowiedzi.
DB_SECRET_HOST = "db-secret-host.internal"
DB_SECRET_PASSWORD = "s3cret-db-pass"
REDIS_SECRET_HOST = "redis-secret-host.internal"


class BrokenSession:
    """Sesja, której SELECT 1 kończy się błędem połączenia (jak psycopg2 przy padniętej bazie)."""

    def execute(self, *_args, **_kwargs):
        raise OperationalError(
            "SELECT 1",
            {},
            Exception(
                f'connection to server at "{DB_SECRET_HOST}" failed: '
                f'password "{DB_SECRET_PASSWORD}" rejected'
            ),
        )

    def close(self):
        pass


class SlowSession:
    """Sesja, której SELECT 1 wisi dłużej niż timeout health-checka."""

    def execute(self, *_args, **_kwargs):
        time.sleep(0.5)

    def close(self):
        pass


class BrokenRedis:
    async def ping(self):
        raise RedisConnectionError(
            f"Error 111 connecting to {REDIS_SECRET_HOST}:6379. Connection refused."
        )


@pytest.fixture
def client(redis_client):
    """Domyślnie wszystko zdrowe: SQLite in-memory + fakeredis. Testy nadpisują wybrane zależności."""
    app.dependency_overrides[get_session_factory] = lambda: HealthySessionLocal
    app.dependency_overrides[get_redis_client] = lambda: redis_client
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def no_version_env(monkeypatch):
    """Stabilny fallback "dev" niezależnie od env maszyny/CI."""
    monkeypatch.delenv("APP_VERSION", raising=False)
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)


# ─── GET /health ───────────────────────────────────────────────────────────────

class TestHealthOk:

    def test_wszystko_ok_200(self, client):
        r = client.get("/api/v1/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["checks"]["db"]["status"] == "ok"
        assert body["checks"]["redis"]["status"] == "ok"
        assert body["version"] == "dev"

    def test_latency_ms_jest_liczba(self, client):
        body = client.get("/api/v1/health").json()
        for name in ("db", "redis"):
            latency = body["checks"][name]["latency_ms"]
            assert isinstance(latency, (int, float))
            assert latency >= 0
            assert "error" not in body["checks"][name]

    def test_no_store(self, client):
        r = client.get("/api/v1/health")
        assert r.headers["cache-control"] == "no-store"


class TestHealthVersion:

    def test_app_version_z_env(self, client, monkeypatch):
        monkeypatch.setenv("APP_VERSION", "1.2.3")
        assert client.get("/api/v1/health").json()["version"] == "1.2.3"

    def test_render_git_commit_skrocony_do_7(self, client, monkeypatch):
        monkeypatch.setenv("RENDER_GIT_COMMIT", "abcdef1234567890")
        assert client.get("/api/v1/health").json()["version"] == "abcdef1"

    def test_app_version_ma_pierwszenstwo(self, client, monkeypatch):
        monkeypatch.setenv("APP_VERSION", "1.2.3")
        monkeypatch.setenv("RENDER_GIT_COMMIT", "abcdef1234567890")
        assert client.get("/api/v1/health").json()["version"] == "1.2.3"


class TestHealthDegraded:

    def test_redis_padl_200_degraded(self, client):
        """Redis nie jest krytyczny: 200 + status degraded, DB nadal ok."""
        app.dependency_overrides[get_redis_client] = lambda: BrokenRedis()

        r = client.get("/api/v1/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "degraded"
        assert body["checks"]["db"]["status"] == "ok"
        assert body["checks"]["redis"]["status"] == "error"
        assert body["checks"]["redis"]["error"] == "ConnectionError"

    def test_redis_blad_bez_sekretow(self, client):
        app.dependency_overrides[get_redis_client] = lambda: BrokenRedis()

        r = client.get("/api/v1/health")
        assert REDIS_SECRET_HOST not in r.text
        assert "6379" not in r.text
        assert "Connection refused" not in r.text


class TestHealthDown:

    def test_db_padla_503_down(self, client):
        app.dependency_overrides[get_session_factory] = lambda: BrokenSession

        r = client.get("/api/v1/health")
        assert r.status_code == 503
        body = r.json()
        assert body["status"] == "down"
        assert body["checks"]["db"]["status"] == "error"
        assert body["checks"]["db"]["error"] == "OperationalError"
        # Redis był sprawdzony niezależnie i nadal jest ok
        assert body["checks"]["redis"]["status"] == "ok"

    def test_db_blad_bez_sekretow(self, client):
        """W odpowiedzi jest tylko typ wyjątku - żadnych hostów/haseł z treści błędu."""
        app.dependency_overrides[get_session_factory] = lambda: BrokenSession

        r = client.get("/api/v1/health")
        assert r.status_code == 503
        assert DB_SECRET_HOST not in r.text
        assert DB_SECRET_PASSWORD not in r.text
        assert "connection to server" not in r.text

    def test_fabryka_sesji_rzuca_503(self, client):
        """Wyjątek już przy tworzeniu sesji (np. engine nie wstał) też daje 503, nie 500."""

        def exploding_factory():
            raise RuntimeError(f"engine for {DB_SECRET_HOST} not initialised")

        app.dependency_overrides[get_session_factory] = lambda: exploding_factory

        r = client.get("/api/v1/health")
        assert r.status_code == 503
        assert r.json()["checks"]["db"]["error"] == "RuntimeError"
        assert DB_SECRET_HOST not in r.text

    def test_db_i_redis_padly_503_oba_bledy(self, client):
        app.dependency_overrides[get_session_factory] = lambda: BrokenSession
        app.dependency_overrides[get_redis_client] = lambda: BrokenRedis()

        r = client.get("/api/v1/health")
        assert r.status_code == 503
        body = r.json()
        assert body["status"] == "down"
        assert body["checks"]["db"]["error"] == "OperationalError"
        assert body["checks"]["redis"]["error"] == "ConnectionError"


class TestHealthTimeout:

    def test_db_timeout_503_down(self, client, monkeypatch):
        """SELECT 1 wisi dłużej niż CHECK_TIMEOUT_S -> health nie czeka, zwraca down."""
        monkeypatch.setattr(health_router, "CHECK_TIMEOUT_S", 0.05)
        app.dependency_overrides[get_session_factory] = lambda: SlowSession

        started = time.perf_counter()
        r = client.get("/api/v1/health")
        elapsed = time.perf_counter() - started

        assert r.status_code == 503
        body = r.json()
        assert body["status"] == "down"
        assert body["checks"]["db"]["error"] == "TimeoutError"
        assert elapsed < 0.5  # nie czekaliśmy na koniec sleep(0.5) w SlowSession

    def test_redis_timeout_200_degraded(self, client, monkeypatch):
        import asyncio

        class HangingRedis:
            async def ping(self):
                await asyncio.sleep(0.5)

        monkeypatch.setattr(health_router, "CHECK_TIMEOUT_S", 0.05)
        app.dependency_overrides[get_redis_client] = lambda: HangingRedis()

        r = client.get("/api/v1/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "degraded"
        assert body["checks"]["redis"]["error"] == "TimeoutError"


# ─── GET /health/live ──────────────────────────────────────────────────────────

class TestHealthLive:

    def test_zawsze_200(self, client):
        r = client.get("/api/v1/health/live")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_200_nawet_gdy_db_i_redis_padly(self, client, monkeypatch):
        """Liveness nie dotyka zależności - fabryka sesji i Redis mogą być martwe."""
        monkeypatch.setattr(health_router, "CHECK_TIMEOUT_S", 0.05)
        app.dependency_overrides[get_session_factory] = lambda: BrokenSession
        app.dependency_overrides[get_redis_client] = lambda: BrokenRedis()

        r = client.get("/api/v1/health/live")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}
