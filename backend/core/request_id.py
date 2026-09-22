"""
Middleware ASGI: X-Request-ID na kazde zadanie.

- czyta naglowek od klienta (frontend generuje uuid w apiClient), waliduje go;
  brak/niepoprawny -> nowy uuid,
- wystawia go w contextvar (logi, odpowiedzi bledow, Sentry w przyszlosci),
- zwraca w naglowku odpowiedzi,
- loguje jedna linie `http.request` (metoda, sciezka bez query, status, czas).

Czyste ASGI (nie BaseHTTPMiddleware) - nie buforuje body i nie psuje streamingu.
Wyjatki z ServerErrorMiddleware (500) nie przechodza przez `send` tego middleware,
dlatego global_exception_handler w main.py dopisuje naglowek sam.
"""
import logging
import time

from core.request_context import (
    REQUEST_ID_HEADER,
    sanitize_request_id,
    set_request_id,
    set_user_id,
)

logger = logging.getLogger("http")
_HEADER_BYTES = REQUEST_ID_HEADER.lower().encode()


class RequestIdMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = None
        for name, value in scope.get("headers", []):
            if name == _HEADER_BYTES:
                incoming = value.decode("latin-1")
                break
        request_id = sanitize_request_id(incoming)
        set_request_id(request_id)
        set_user_id(None)

        started = time.perf_counter()
        status_holder = {"status": None}

        async def send_with_header(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                headers = list(message.get("headers", []))
                headers.append((_HEADER_BYTES, request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_header)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            logger.info(
                "http.request",
                extra={
                    "method": scope.get("method"),
                    "path": scope.get("path"),  # bez query stringa (moze niesc tokeny)
                    "status": status_holder["status"],
                    "duration_ms": duration_ms,
                },
            )
