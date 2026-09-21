"""
Testy X-Request-ID (core/request_id.py) i logow JSON z kontekstem (core/logging.py).
"""
import json
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.exceptions import NotFoundError
from core.logging import JsonFormatter, RequestContextFilter
from core.request_context import (
    REQUEST_ID_HEADER,
    get_request_id,
    sanitize_request_id,
    set_request_id,
    set_user_id,
)
from core.request_id import RequestIdMiddleware
from main import app as real_app


@pytest.fixture
def client():
    # Bez prawdziwej bazy: endpointy uzyte w testach albo jej nie tykaja (/health),
    # albo padaja na braku tokenu zanim siegna po sesje (/auth/me).
    from core.database import get_db

    def _no_db():
        yield None

    real_app.dependency_overrides[get_db] = _no_db
    with TestClient(real_app, raise_server_exceptions=False) as c:
        yield c
    real_app.dependency_overrides.pop(get_db, None)


class TestSanitize:
    def test_akceptuje_uuid_i_proste_id(self):
        assert sanitize_request_id("3f2a9c1e4b5d4f6a8b9c0d1e2f3a4b5c") == "3f2a9c1e4b5d4f6a8b9c0d1e2f3a4b5c"
        assert sanitize_request_id("req-1.2_3") == "req-1.2_3"

    def test_odrzuca_smieci_i_generuje_nowy(self):
        for bad in [None, "", "a b", "x" * 65, "<script>", "ąę"]:
            generated = sanitize_request_id(bad)
            assert generated != bad
            assert len(generated) == 32


class TestMiddleware:
    def test_echo_naglowka_od_klienta(self, client):
        res = client.get("/api/v1/health", headers={REQUEST_ID_HEADER: "abc-123"})
        assert res.status_code == 200
        assert res.headers[REQUEST_ID_HEADER] == "abc-123"

    def test_generuje_id_gdy_brak_naglowka(self, client):
        res = client.get("/api/v1/health")
        rid = res.headers[REQUEST_ID_HEADER]
        assert len(rid) == 32
        # kazde zadanie dostaje swoje
        assert client.get("/api/v1/health").headers[REQUEST_ID_HEADER] != rid

    def test_niepoprawny_naglowek_zastapiony(self, client):
        res = client.get("/api/v1/health", headers={REQUEST_ID_HEADER: "zle id ze spacja"})
        assert res.headers[REQUEST_ID_HEADER] != "zle id ze spacja"

    def test_blad_ma_request_id_w_ciele_i_naglowku(self, client):
        # 401 z handlera AuthenticationError (endpoint wymaga tokenu)
        res = client.get("/api/v1/auth/me", headers={REQUEST_ID_HEADER: "err-42"})
        assert res.status_code in (401, 403)
        assert res.headers[REQUEST_ID_HEADER] == "err-42"
        assert res.json()["request_id"] == "err-42"
        assert res.json()["success"] is False

    def test_500_ma_request_id_mimo_server_error_middleware(self):
        boom = FastAPI()
        boom.add_middleware(RequestIdMiddleware)

        @boom.get("/boom")
        async def _boom():
            raise RuntimeError("kaboom")

        @boom.exception_handler(Exception)
        async def _handler(request, exc):
            from fastapi.responses import JSONResponse

            response = JSONResponse(status_code=500, content={"request_id": get_request_id()})
            response.headers[REQUEST_ID_HEADER] = get_request_id() or ""
            return response

        with TestClient(boom, raise_server_exceptions=False) as c:
            res = c.get("/boom", headers={REQUEST_ID_HEADER: "boom-1"})
        assert res.status_code == 500
        assert res.json()["request_id"] == "boom-1"
        assert res.headers[REQUEST_ID_HEADER] == "boom-1"

    def test_loguje_http_request_bez_query_stringa(self, client, caplog):
        with caplog.at_level(logging.INFO, logger="http"):
            client.get("/api/v1/health?token=SEKRET", headers={REQUEST_ID_HEADER: "log-1"})
        records = [r for r in caplog.records if r.getMessage() == "http.request"]
        assert records, "brak logu http.request"
        rec = records[-1]
        assert rec.path == "/api/v1/health"
        assert "SEKRET" not in rec.path
        assert rec.status == 200
        assert rec.method == "GET"
        assert rec.duration_ms >= 0


class TestJsonLogs:
    def _format(self, record: logging.LogRecord) -> dict:
        RequestContextFilter().filter(record)
        return json.loads(JsonFormatter().format(record))

    def test_rekord_ma_kontekst_i_pola_extra(self):
        set_request_id("ctx-1")
        set_user_id(7)
        record = logging.LogRecord("auth", logging.INFO, __file__, 1, "login.ok", None, None)
        record.attempt = 2
        out = self._format(record)
        assert out["request_id"] == "ctx-1"
        assert out["user_id"] == 7
        assert out["msg"] == "login.ok"
        assert out["level"] == "INFO"
        assert out["logger"] == "auth"
        assert out["attempt"] == 2
        assert out["ts"].endswith("+00:00")

    def test_wyjatek_trafia_do_json(self):
        try:
            raise NotFoundError("nie ma")
        except NotFoundError:
            import sys

            record = logging.LogRecord("core", logging.ERROR, __file__, 1, "boom", None, sys.exc_info())
        out = self._format(record)
        assert out["exc_type"] == "NotFoundError"
        assert "nie ma" in out["exc"]

    def test_json_jest_jedna_linia(self):
        record = logging.LogRecord("core", logging.INFO, __file__, 1, "wielo\nlinijkowy", None, None)
        line = JsonFormatter().format(record)
        assert "\n" not in line
        assert json.loads(line)["msg"] == "wielo\nlinijkowy"
