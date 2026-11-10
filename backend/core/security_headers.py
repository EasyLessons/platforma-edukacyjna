"""
Middleware ASGI: naglowki bezpieczenstwa na kazdej odpowiedzi API (SEC-16).

- X-Content-Type-Options: nosniff - przegladarka nie zgaduje typu (JSON/obrazy z API),
- Referrer-Policy: no-referrer - API nie potrzebuje referera, a adresy moga niesc id,
- X-Frame-Options: DENY - odpowiedzi API (w tym Swagger) nie sa osadzane w ramkach,
- Cache-Control: no-store na /api/v1/auth/* - tokeny i dane konta nie laduja w cache
  przegladarki ani proxy.

Czyste ASGI (jak core/request_id.py): nie buforuje body. `setdefault` - endpoint, ktory
ustawil wlasny naglowek (np. /health z Cache-Control), wygrywa. CSP nie dotyczy API
(brak HTML poza Swaggerem, ktory laduje swoje skrypty z CDN). W requirements nie ma
gotowca (`secure` na PyPI robi to samo w ~10 liniach) - wlasny middleware jest tanszy
niz nowa zaleznosc.
"""
from starlette.datastructures import MutableHeaders

NO_STORE_PREFIXES = ("/api/v1/auth",)

DEFAULT_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
}


def is_no_store_path(path: str) -> bool:
    """Sciezki, ktorych odpowiedzi nie wolno cache'owac (sesja, dane konta)."""
    return any(path == prefix or path.startswith(prefix + "/") for prefix in NO_STORE_PREFIXES)


class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        no_store = is_no_store_path(scope.get("path", ""))

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in DEFAULT_HEADERS.items():
                    headers.setdefault(name, value)
                if no_store:
                    headers.setdefault("Cache-Control", "no-store")
            await send(message)

        await self.app(scope, receive, send_with_headers)
