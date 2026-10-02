from fastapi import Request

from core.config import get_settings
from core.exceptions import AppException
from redis.exceptions import ConnectionError, TimeoutError
from core.redis_client import get_redis_client

from core.logging import get_logger

logger = get_logger(__name__)


def get_client_ip(request: Request) -> str:
    """
    IP klienta do kluczy rate limitu.

    Domyślnie `request.client.host` - za proxy poprawia go ProxyHeadersMiddleware
    (main.py) na podstawie X-Forwarded-For. Gdy ustawiono CLIENT_IP_HEADER (np.
    CF-Connecting-IP, nadpisywany przez brzeg sieci) i nagłówek jest w żądaniu,
    ma on pierwszeństwo - pierwszy wpis X-Forwarded-For klient może sfałszować.
    """
    header_name = get_settings().client_ip_header.strip()
    if header_name:
        value = (request.headers.get(header_name) or "").strip()
        if value:
            return value[:64]
    return request.client.host if request.client else "unknown"


async def _identifier_from_body(request: Request, field: str) -> str | None:
    """
    Wartość pola `field` z JSON body albo None.

    Niepoprawny JSON, body nie-obiekt lub wartość nie-skalarna -> None (SEC-21):
    limit per-identyfikator jest pomijany, a 422 zwraca walidacja FastAPI/Pydantic,
    zamiast 500 z tej zależności.
    """
    try:
        body = await request.json()
    except ValueError:  # JSONDecodeError i UnicodeDecodeError dziedziczą po ValueError
        return None
    if not isinstance(body, dict):
        return None
    value = body.get(field)
    if isinstance(value, bool) or not isinstance(value, (str, int)) or value == "":
        return None
    return str(value).lower()[:256]


def rate_limit(
    scope: str,
    limit: int,
    window_seconds: int,
    identifier_field: str | None = None,
    fail_open: bool = False,
):
    """
    Zwraca FastAPI Depends() wymuszający limit `limit` requestów / `window_seconds`
    dla danego `scope`, liczony osobno per IP i (opcjonalnie) per pole `identifier_field`
    z JSON body requestu.

    `fail_open=False` (domyślnie, endpointy logowania/rejestracji): awaria Redis -> 503.
    `fail_open=True` (np. /refresh, /logout): awaria Redis -> żądanie przechodzi bez limitu,
    żeby padnięcie Redis nie odcinało zalogowanych użytkowników od odświeżania sesji.
    """
    async def dependency(request: Request):
        redis_client = get_redis_client()
        keys = [f"ratelimit:{scope}:ip:{get_client_ip(request)}"]

        if identifier_field:
            identifier = await _identifier_from_body(request, identifier_field)
            if identifier:
                keys.append(f"ratelimit:{scope}:id:{identifier}")

        try:
            for key in keys:
                current = await redis_client.incr(key)
                if current == 1:
                    await redis_client.expire(key, window_seconds)
                if current > limit:
                    raise AppException(
                        "Zbyt wiele prób, spróbuj ponownie później.",
                        code="RATE_LIMITED",
                        status_code=429,
                    )
        except (ConnectionError, TimeoutError):
            logger.exception(f"Błąd Redis przy rate limitingu (scope={scope})")
            if fail_open:
                return
            raise AppException(
                "Serwis chwilowo niedostępny",
                code="REDIS_ERROR",
                status_code=503,
            )
    return dependency
