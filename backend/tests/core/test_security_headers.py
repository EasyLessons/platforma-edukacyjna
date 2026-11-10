"""
Testy naglowkow bezpieczenstwa API (core/security_headers.py, wpiecie w main.py) - SEC-16.
"""
import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from core.security_headers import SecurityHeadersMiddleware, is_no_store_path
from main import app as real_app


@pytest.fixture
def client():
    # Bez bazy: /health/live nie tyka DB, /auth/me pada na braku tokenu przed sesja.
    from core.database import get_db

    def _no_db():
        yield None

    real_app.dependency_overrides[get_db] = _no_db
    with TestClient(real_app, raise_server_exceptions=False) as c:
        yield c
    real_app.dependency_overrides.pop(get_db, None)


class TestNoStorePath:
    def test_auth_i_podsciezki(self):
        assert is_no_store_path("/api/v1/auth")
        assert is_no_store_path("/api/v1/auth/login")
        assert is_no_store_path("/api/v1/auth/users/me/avatar")

    def test_reszta_api_bez_no_store(self):
        assert not is_no_store_path("/api/v1/authx")
        assert not is_no_store_path("/api/v1/boards")
        assert not is_no_store_path("/health")


class TestRealApp:
    def test_kazda_odpowiedz_ma_nosniff_referrer_i_frame_options(self, client):
        res = client.get("/api/v1/health/live")
        assert res.status_code == 200
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert res.headers["Referrer-Policy"] == "no-referrer"
        assert res.headers["X-Frame-Options"] == "DENY"
        assert "Cache-Control" not in res.headers

    def test_auth_ma_cache_control_no_store_takze_na_bledzie(self, client):
        res = client.get("/api/v1/auth/me")
        assert res.status_code in (401, 403)
        assert res.headers["Cache-Control"] == "no-store"
        assert res.headers["X-Content-Type-Options"] == "nosniff"

    def test_preflight_cors_tez_dostaje_naglowki(self, client):
        res = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert res.headers["Cache-Control"] == "no-store"

    def test_swagger_nie_w_ramce(self, client):
        res = client.get("/api/v1/docs")
        assert res.status_code == 200
        assert res.headers["X-Frame-Options"] == "DENY"


class TestMiddlewareSamodzielnie:
    def test_endpoint_moze_nadpisac_naglowek(self):
        app = FastAPI()
        app.add_middleware(SecurityHeadersMiddleware)

        @app.get("/api/v1/auth/x")
        async def _x():
            return JSONResponse({"ok": True}, headers={"Cache-Control": "private, max-age=5"})

        with TestClient(app) as c:
            res = c.get("/api/v1/auth/x")
        # setdefault: wlasny Cache-Control endpointu zostaje, reszta dochodzi
        assert res.headers["Cache-Control"] == "private, max-age=5"
        assert res.headers["X-Content-Type-Options"] == "nosniff"
