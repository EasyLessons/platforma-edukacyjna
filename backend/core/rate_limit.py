import ipaddress

from fastapi import Request

from core.config import get_settings
from core.exceptions import AppException
from redis.exceptions import RedisError
from core.redis_client import get_redis_client

from core.logging import get_logger

logger = get_logger(__name__)


def _valid_ip(value: str | None) -> str | None:
    """Kanoniczny zapis adresu IP albo None (śmieci, nazwy hostów, za długie wartości)."""
    if not value or len(value) > 64:
        return None
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def get_client_ip(request: Request) -> str:
    """
    IP klienta do kluczy rate limitu. Wynik to zawsze poprawny adres IP albo "unknown"
    (wspólny kubełek) - nigdy surowy tekst z nagłówka, więc nie da się nim mnożyć kluczy.

    Kolejność:
    1. Nagłówek NADPISYWANY przez brzeg sieci (`effective_client_ip_header`, na Render
       domyślnie CF-Connecting-IP) - klient nie może go podrobić.
    2. Za zaufanym proxy ("*"): wpis X-Forwarded-For liczony OD PRAWEJ (`TRUSTED_PROXY_HOPS`,
       domyślnie ostatni = dopisany przez nasze proxy). Lewe wpisy wysyła klient, więc ich
       nie używamy - a właśnie pierwszy z lewej bierze ProxyHeadersMiddleware uvicorna.
    3. Bez zaufanego proxy: adres połączenia (`request.client.host`).
    """
    settings = get_settings()

    header_name = settings.effective_client_ip_header
    if header_name:
        ip = _valid_ip(request.headers.get(header_name))
        if ip:
            return ip

    if settings.trusted_proxy_hosts == "*":
        forwarded = ",".join(request.headers.getlist("x-forwarded-for"))
        if forwarded.strip():
            entries = [entry.strip() for entry in forwarded.split(",")]
            hops = max(1, settings.trusted_proxy_hops)
            return _valid_ip(entries[max(0, len(entries) - hops)]) or "unknown"

    return _valid_ip(request.client.host if request.client else None) or "unknown"


def normalize_identifier(value) -> str | None:
    """
    Sprowadza wartość z body do postaci, w jakiej zobaczy ją serwis po walidacji Pydantic,
    żeby warianty zapisu tej samej wartości (" a@b.pl ", "01", 1.0, true) trafiały do
    JEDNEGO kubełka. Wartości nie-skalarne i puste -> None (422 zwróci walidacja).
    """
    if isinstance(value, bool):
        value = int(value)
    if isinstance(value, float):
        if not value.is_integer():
            return None
        value = int(value)
    if isinstance(value, int):
        return str(value)[:256]
    if not isinstance(value, str):
        return None

    text = value.strip().lower()
    if not text:
        return None
    if len(text) <= 32:
        # Pydantic przyjmuje dla pól int także "01", "+1", " 1" i "1.0".
        try:
            return str(int(text))
        except ValueError:
            pass
        try:
            number = float(text)
            if number.is_integer():
                return str(int(number))
        except (ValueError, OverflowError):
            pass
    return text[:256]


async def _identifier_from_body(request: Request, field: str) -> str | None:
    """
    Znormalizowana wartość pola `field` z JSON body albo None.

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
    return normalize_identifier(body.get(field))


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
        except RedisError:  # także ResponseError (OOM, READONLY, AUTH), nie tylko brak połączenia
            logger.exception(f"Błąd Redis przy rate limitingu (scope={scope})")
            if fail_open:
                return
            raise AppException(
                "Serwis chwilowo niedostępny",
                code="REDIS_ERROR",
                status_code=503,
            )
    return dependency
