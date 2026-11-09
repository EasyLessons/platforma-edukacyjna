"""
REDIS CONNECTION - wspoldzielone polaczenie z Redis + tryb awaryjny

Dwa klienty:
    get_redis_client()           - prawdziwy klient (singleton). Uzywaja go miejsca, ktore MUSZA
                                   wiedziec, ze Redis lezy: /health (status "degraded"),
                                   bezpiecznik rozmow Daily (fail closed - koszty).
    get_resilient_redis_client() - ten sam klient owiniety w ResilientRedis: przy awarii polaczenia
                                   (ConnectionError/TimeoutError) komenda idzie do zapasowego
                                   magazynu W PAMIECI PROCESU (fakeredis - to samo API i te same
                                   TTL-e), a Redis jest omijany przez REDIS_RETRY_SECONDS, zeby
                                   kazde zadanie nie czekalo socket_connect_timeout. Uzywaja go:
                                   rate limit, kody weryfikacyjne (AuthService), awatary, presence,
                                   liczniki plikow tablicy - czyli wszystko, co ma dzialac bez Redis.

Ograniczenia trybu awaryjnego (swiadome):
    - pamiec jednego procesu: liczniki i kody nie sa wspoldzielone miedzy instancjami i znikaja
      przy restarcie (Render: jedna instancja uvicorna, wiec w praktyce dziala);
    - kod wydany w czasie awarii zyje w pamieci - gdy Redis wroci, sprawdzenie kodu idzie juz do
      Redis i uzytkownik moze potrzebowac "wyslij ponownie";
    - gdy Redis wraca, zapasowy magazyn jest kasowany (nie ma synchronizacji).
"""
import time

import fakeredis.aioredis
import redis.asyncio as redis
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError

from core.config import get_settings
from core.logging import get_logger

logger = get_logger(__name__)

REDIS_TIMEOUT_SECONDS = 5
# Po awarii Redis jest omijany przez tyle sekund (potem jedna proba "na zywo").
REDIS_RETRY_SECONDS = 30.0
# Bledy, przy ktorych przelaczamy sie na pamiec. ResponseError (OOM, READONLY, zly typ) NIE -
# to nie jest "Redis lezy", a zapasowy magazyn i tak nie naprawi zlego polecenia.
FALLBACK_ERRORS = (RedisConnectionError, RedisTimeoutError)

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


# === Tryb awaryjny (stan na proces) ============================================

_outage_until: float = 0.0  # time.monotonic(), do kiedy omijamy Redis; 0 = Redis uznany za sprawny
_fallback: fakeredis.aioredis.FakeRedis | None = None


def redis_degraded() -> bool:
    """True = ostatnia proba polaczenia padla i Redis jest chwilowo omijany."""
    return time.monotonic() < _outage_until


def _get_fallback() -> fakeredis.aioredis.FakeRedis:
    global _fallback
    if _fallback is None:
        _fallback = fakeredis.aioredis.FakeRedis(decode_responses=True)
    return _fallback


def _note_failure(exc: BaseException) -> None:
    global _outage_until
    first = not redis_degraded()
    _outage_until = time.monotonic() + REDIS_RETRY_SECONDS
    if first:
        # Tylko typ wyjatku - tresc potrafi zawierac host i haslo z REDIS_URL.
        logger.warning(
            f"Redis niedostepny ({type(exc).__name__}) - tryb awaryjny w pamieci procesu "
            f"na {REDIS_RETRY_SECONDS:.0f} s (rate limit, kody, presence)"
        )


def _note_success() -> None:
    global _outage_until, _fallback
    if _outage_until:
        _outage_until = 0.0
        _fallback = None  # dane z czasu awarii nie sa synchronizowane
        logger.info("Redis znow odpowiada - koniec trybu awaryjnego")


def reset_degradation() -> None:
    """Zeruje stan trybu awaryjnego (testy)."""
    global _outage_until, _fallback
    _outage_until = 0.0
    _fallback = None


class ResilientRedis:
    """
    Proxy na klienta Redis: kazda komenda (np. `await r.incr(k)`) idzie do Redis, a przy
    FALLBACK_ERRORS - albo gdy Redis jest juz omijany - do magazynu w pamieci procesu.
    `pipeline()` nie jest replikowane komenda po komendzie: zwraca pipeline tego klienta,
    ktory jest aktualnie w uzyciu (blad `execute()` na Redis dociera do wolajacego).
    """

    def __init__(self, primary):
        self._primary = primary

    @property
    def primary(self):
        return self._primary

    def pipeline(self, transaction: bool = True, shard_hint=None):
        client = _get_fallback() if redis_degraded() else self._primary
        return client.pipeline(transaction=transaction)

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)

        async def command(*args, **kwargs):
            if not redis_degraded():
                try:
                    result = await getattr(self._primary, name)(*args, **kwargs)
                except FALLBACK_ERRORS as exc:
                    _note_failure(exc)
                else:
                    _note_success()
                    return result
            return await getattr(_get_fallback(), name)(*args, **kwargs)

        return command


def get_resilient_redis_client() -> ResilientRedis:
    """Klient Redis z trybem awaryjnym w pamieci procesu (patrz opis modulu)."""
    return ResilientRedis(get_redis_client())
