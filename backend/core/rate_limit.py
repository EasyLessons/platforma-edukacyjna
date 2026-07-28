from fastapi import Request

from core.exceptions import AppException
from redis.exceptions import ConnectionError, TimeoutError
from core.redis_client import get_redis_client

from core.logging import get_logger

logger = get_logger(__name__)

def rate_limit(scope: str, limit: int, window_seconds: int, identifier_field: str | None = None):
    """
    Zwraca FastAPI Depends() wymuszający limit `limit` requestów / `window_seconds`
    dla danego `scope`, liczony osobno per IP i (opcjonalnie) per pole `identifier_field`
    z JSON body requestu.
    """
    async def dependency(request: Request):
        redis_client = get_redis_client()
        ip = request.client.host if request.client else "unknown"
        keys = [f"ratelimit:{scope}:ip:{ip}"]

        if identifier_field:
            body = await request.json()
            value = body.get(identifier_field)
            if value:
                keys.append(f"ratelimit:{scope}:id:{str(value).lower()}")

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
            raise AppException(
                "Serwis chwilowo niedostępny",
                code="REDIS_ERROR",
                status_code=503,
            )
    return dependency