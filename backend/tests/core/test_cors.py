"""
Testy CORS (SEC-04) i IP klienta za proxy (SEC-06).
core/cors.py, core/config.py, wpięcie w main.py
"""
import pytest
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from core.config import Settings, get_settings
from core.cors import CorsPolicy
from core.rate_limit import get_client_ip
from main import app

PROD_ORIGINS = ["https://easylesson.app", "https://www.easylesson.app"]
# Realne nazwy preview projektu na Vercel (z GitHub Deployments) - mimo to NIE są dopuszczone
# domyślnie, bo wolną subdomenę *.vercel.app o takim kształcie może przypisać sobie każdy.
PREVIEW_ORIGIN = "https://platforma-edukacyjna-ohzt6iw5i-easylessons-projects.vercel.app"
ATTACKER_ORIGINS = [
    "https://evil.vercel.app",
    "https://platforma-edukacyjna-evil.vercel.app",
    "https://platforma-edukacyjna-one.vercel.app",  # była na liście, a domena jest wolna (404)
    PREVIEW_ORIGIN,
    "https://easylesson.app.evil.com",
    "https://evil-easylesson.app",
    "http://easylesson.app",
    "null",
]


def make_settings(**overrides) -> Settings:
    """Settings bez czytania .env; wymagane pola biorą się z env testowego."""
    return Settings(_env_file=None, **overrides)


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


class TestDefaultPolicy:
    """Domyślna konfiguracja = to, co działa na produkcji bez ustawiania env."""

    @pytest.mark.parametrize("origin", PROD_ORIGINS + ["http://localhost:3000"])
    def test_production_and_dev_origins_allowed(self, origin):
        assert CorsPolicy(make_settings()).is_allowed_origin(origin)

    @pytest.mark.parametrize("origin", ATTACKER_ORIGINS + ["", None])
    def test_foreign_origins_rejected(self, origin):
        assert not CorsPolicy(make_settings()).is_allowed_origin(origin)

    def test_regex_disabled_by_default(self):
        assert CorsPolicy(make_settings()).middleware_kwargs()["allow_origin_regex"] is None


class TestConfiguredPolicy:
    def test_origins_from_env_are_trimmed(self):
        policy = CorsPolicy(make_settings(allowed_origins=" https://a.example/ , https://b.example ,"))
        assert policy.origins == ["https://a.example", "https://b.example"]

    def test_wildcard_origin_is_dropped(self):
        policy = CorsPolicy(make_settings(allowed_origins="*,https://*.vercel.app,https://a.example"))
        assert policy.origins == ["https://a.example"]
        assert not policy.is_allowed_origin("https://evil.vercel.app")

    def test_regex_uses_fullmatch(self):
        policy = CorsPolicy(make_settings(
            allowed_origin_regex=r"https://platforma-edukacyjna-[a-z0-9]+-easylessons-projects\.vercel\.app"
        ))
        assert policy.is_allowed_origin(PREVIEW_ORIGIN)
        assert not policy.is_allowed_origin(PREVIEW_ORIGIN + ".evil.com")
        assert not policy.is_allowed_origin("https://evil.com/?" + PREVIEW_ORIGIN)

    def test_invalid_regex_disables_regex_instead_of_crashing(self):
        policy = CorsPolicy(make_settings(allowed_origin_regex="(["))
        assert policy.middleware_kwargs()["allow_origin_regex"] is None
        assert not policy.is_allowed_origin(PREVIEW_ORIGIN)


class TestCorsMiddlewareIntegration:
    @pytest.mark.parametrize("origin", PROD_ORIGINS)
    def test_simple_request_from_production(self, client, origin):
        response = client.get("/", headers={"Origin": origin})
        assert response.headers["access-control-allow-origin"] == origin
        assert response.headers["access-control-allow-credentials"] == "true"
        assert "x-request-id" in response.headers["access-control-expose-headers"].lower()

    @pytest.mark.parametrize("origin", ATTACKER_ORIGINS)
    def test_simple_request_from_foreign_origin_gets_no_cors_headers(self, client, origin):
        response = client.get("/", headers={"Origin": origin})
        assert "access-control-allow-origin" not in response.headers

    @pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE"])
    def test_preflight_with_headers_sent_by_frontend(self, client, method):
        """Preflight dokładnie taki, jaki wysyła przeglądarka dla apiClient (axios)."""
        response = client.options(
            "/api/v1/auth/me",
            headers={
                "Origin": "https://easylesson.app",
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "authorization,content-type,x-request-id",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "https://easylesson.app"
        assert method in response.headers["access-control-allow-methods"]

    def test_preflight_with_unknown_header_is_rejected(self, client):
        response = client.options(
            "/api/v1/auth/me",
            headers={
                "Origin": "https://easylesson.app",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "x-evil-header",
            },
        )
        assert response.status_code == 400

    def test_preflight_from_foreign_origin_is_rejected(self, client):
        response = client.options(
            "/api/v1/auth/refresh",
            headers={
                "Origin": "https://evil.vercel.app",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 400
        assert "access-control-allow-origin" not in response.headers


class TestUnhandled500Cors:
    """Handler 500 dokleja CORS ręcznie - ma używać tej samej polityki co middleware."""

    @pytest.fixture
    def boom_client(self):
        async def boom():
            raise RuntimeError("boom")

        app.add_api_route("/__test_boom", boom, methods=["GET"])
        try:
            with TestClient(app, raise_server_exceptions=False) as c:
                yield c
        finally:
            app.router.routes[:] = [r for r in app.router.routes if getattr(r, "path", None) != "/__test_boom"]

    def test_allowed_origin_gets_cors_on_500(self, boom_client):
        response = boom_client.get("/__test_boom", headers={"Origin": "https://easylesson.app"})
        assert response.status_code == 500
        assert response.headers["access-control-allow-origin"] == "https://easylesson.app"

    def test_foreign_origin_gets_no_cors_on_500(self, boom_client):
        response = boom_client.get("/__test_boom", headers={"Origin": "https://evil.vercel.app"})
        assert response.status_code == 500
        assert "access-control-allow-origin" not in response.headers


class TestTrustedProxyHosts:
    def test_default_outside_render_trusts_only_localhost(self, monkeypatch):
        monkeypatch.delenv("RENDER", raising=False)
        assert make_settings().trusted_proxy_hosts == "127.0.0.1"

    def test_default_on_render_trusts_proxy(self, monkeypatch):
        monkeypatch.setenv("RENDER", "true")
        assert make_settings().trusted_proxy_hosts == "*"

    def test_explicit_value_wins(self, monkeypatch):
        monkeypatch.setenv("RENDER", "true")
        assert make_settings(forwarded_allow_ips="10.0.0.1").trusted_proxy_hosts == "10.0.0.1"

    def test_proxy_headers_middleware_is_installed(self):
        assert any(m.cls is ProxyHeadersMiddleware for m in app.user_middleware)


class TestClientIpBehindProxy:
    """Za zaufanym proxy rate limit ma widzieć IP klienta, nie adres proxy."""

    @staticmethod
    async def _client_host_seen_by_app(trusted_hosts: str, headers: list[tuple[bytes, bytes]]) -> str:
        seen = {}

        async def inner(scope, receive, send):
            seen["host"] = scope["client"][0]

        scope = {"type": "http", "client": ("10.0.0.5", 1234), "scheme": "http", "headers": headers}
        await ProxyHeadersMiddleware(inner, trusted_hosts=trusted_hosts)(scope, None, None)
        return seen["host"]

    @pytest.mark.asyncio
    async def test_trusted_proxy_yields_client_ip(self):
        host = await self._client_host_seen_by_app("*", [(b"x-forwarded-for", b"203.0.113.7, 10.0.0.1")])
        assert host == "203.0.113.7"

    @pytest.mark.asyncio
    async def test_untrusted_peer_cannot_spoof_ip(self):
        host = await self._client_host_seen_by_app("127.0.0.1", [(b"x-forwarded-for", b"203.0.113.7")])
        assert host == "10.0.0.5"


class TestGetClientIp:
    @staticmethod
    def _request(headers: dict, host: str = "10.0.0.5"):
        from starlette.requests import Request

        raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
        return Request({"type": "http", "client": (host, 0), "headers": raw})

    def test_defaults_to_connection_address(self):
        request = self._request({"CF-Connecting-IP": "203.0.113.7"})
        assert get_client_ip(request) == "10.0.0.5"

    def test_configured_header_takes_precedence(self, monkeypatch):
        monkeypatch.setattr(get_settings(), "client_ip_header", "CF-Connecting-IP")
        request = self._request({"CF-Connecting-IP": "203.0.113.7"})
        assert get_client_ip(request) == "203.0.113.7"

    def test_configured_header_missing_falls_back(self, monkeypatch):
        monkeypatch.setattr(get_settings(), "client_ip_header", "CF-Connecting-IP")
        assert get_client_ip(self._request({})) == "10.0.0.5"
