"""
REDIS CONNECTION - Współdzielone połączenie z Redis

Cel:
    Instancja klienta Redis dla całej aplikacji.

Użycie w AuthService:
    self.redis = redis_client or get_redis_client()
    await self.redis.setex(key, ttl_seconds, code)
    await self.redis.get(key)
    await self.redis.delete(key)
"""

import redis.asyncio as redis
from core.config import get_settings

REDIS_TIMEOUT_SECONDS = 5

_redis_client: redis.Redis | None = None

def get_redis_client() -> redis.Redis:
    """
    Pobiera instancję klienta Redis (singleton)
    """
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        # Timeouty: zawieszony Redis ma dać szybki błąd (rate limit fail-open / 503),
        # a nie wieszać żądania w nieskończoność. Nie używamy komend blokujących.
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=REDIS_TIMEOUT_SECONDS,
            socket_timeout=REDIS_TIMEOUT_SECONDS,
        )
    return _redis_client
