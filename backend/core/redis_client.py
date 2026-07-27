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

_redis_client: redis.Redis | None = None

def get_redis_client() -> redis.Redis:
    """
    Pobiera instancję klienta Redis (singleton)
    """
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client
