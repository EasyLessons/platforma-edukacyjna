"""
HEALTH - stan API i jego zależności (etap O1 w docs/architecture/OBSERWOWALNOSC-PLAN.md)

Endpointy:
    GET /api/v1/health       - readiness: pinguje DB (SELECT 1) i Redis (PING), każde
                               z osobnym timeoutem CHECK_TIMEOUT_S (~2 s, żeby health
                               nigdy nie wisiał).
                               DB padła   -> 503, status "down"
                               Redis padł -> 200, status "degraded" (Redis nie jest
                                             krytyczny: kody weryfikacyjne, rate limit,
                                             presence - reszta API działa bez niego)
    GET /api/v1/health/live  - liveness: sam proces odpowiada, bez zależności, zawsze 200.

Kształt odpowiedzi /health (celowo BEZ wrappera ApiResponse - uptime monitory i
orkiestratory oczekują płaskiego JSON-a):
    {
      "status": "ok" | "degraded" | "down",
      "checks": {
        "db":    {"status": "ok" | "error", "latency_ms": 12.3, "error": "OperationalError"},
        "redis": {"status": "ok" | "error", "latency_ms": 1.1}
      },
      "version": "1.2.3"        # APP_VERSION albo krótki SHA (RENDER_GIT_COMMIT), fallback "dev"
    }

Bezpieczeństwo:
    Pole "error" to wyłącznie NAZWA TYPU wyjątku (np. "OperationalError", "TimeoutError"),
    nigdy jego treść - komunikaty psycopg2/redis potrafią zawierać host, użytkownika,
    a nawet hasło z URL-a połączenia. To samo dotyczy logów z tego modułu.

Dlaczego nie Depends(get_db):
    get_db() robi do 3 prób ze sleepami i rzuca PRZED wejściem do endpointu (=> generyczne
    500 zamiast 503 z opisem). Health bierze fabrykę sesji (core.database.get_session_factory,
    podmienialną w testach) i woła core.database.ping_db w wątku z własnym timeoutem.
"""
import asyncio
import logging
import os
import time
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy.orm import sessionmaker

from core.database import get_session_factory, ping_db
from core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])

# Maksymalny czas jednego sprawdzenia (osobno DB, osobno Redis). Moduleowa stała,
# żeby testy mogły ją skrócić przez monkeypatch.
CHECK_TIMEOUT_S = 2.0


def resolve_version() -> str:
    """APP_VERSION z env, inaczej krótki SHA z Render (RENDER_GIT_COMMIT), fallback "dev"."""
    version = os.getenv("APP_VERSION", "").strip()
    if version:
        return version
    sha = os.getenv("RENDER_GIT_COMMIT", "").strip()
    if sha:
        return sha[:7]
    return "dev"


def _elapsed_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 1)


async def _run_check(name: str, start: Callable[[], Awaitable[Any]]) -> dict[str, Any]:
    """
    Uruchamia jedno sprawdzenie z timeoutem.

    `start` to callable zwracające awaitable - wywołujemy je dopiero tutaj, żeby
    wyjątek rzucony synchronicznie (np. przy tworzeniu klienta) też trafił do "error".
    Zwraca {"status": "ok"|"error", "latency_ms": float[, "error": <nazwa typu>]}.
    """
    started = time.perf_counter()
    try:
        await asyncio.wait_for(start(), timeout=CHECK_TIMEOUT_S)
        return {"status": "ok", "latency_ms": _elapsed_ms(started)}
    except Exception as exc:  # health raportuje, nie rzuca; CancelledError to BaseException - przechodzi
        error_type = type(exc).__name__
        logger.warning("health: sprawdzenie %s nieudane (%s)", name, error_type)
        return {"status": "error", "latency_ms": _elapsed_ms(started), "error": error_type}


@router.get(
    "",
    summary="Health check (readiness: DB + Redis)",
    responses={
        200: {"description": "API działa: status ok, albo degraded gdy Redis nie odpowiada"},
        503: {"description": "Baza danych nie odpowiada: status down"},
    },
)
async def health_check(
    session_factory: sessionmaker = Depends(get_session_factory),
    redis: Redis = Depends(get_redis_client),
):
    db_check, redis_check = await asyncio.gather(
        # ping_db jest synchroniczne (SQLAlchemy sync) - w wątku, żeby nie blokować pętli
        _run_check("db", lambda: asyncio.to_thread(ping_db, session_factory)),
        _run_check("redis", lambda: redis.ping()),
    )

    if db_check["status"] != "ok":
        status, http_status = "down", 503
    elif redis_check["status"] != "ok":
        status, http_status = "degraded", 200
    else:
        status, http_status = "ok", 200

    return JSONResponse(
        status_code=http_status,
        content={
            "status": status,
            "checks": {"db": db_check, "redis": redis_check},
            "version": resolve_version(),
        },
        headers={"Cache-Control": "no-store"},
    )


@router.get(
    "/live",
    summary="Liveness (sam proces, bez zależności)",
    responses={200: {"description": "Proces API odpowiada"}},
)
async def health_live():
    return {"status": "ok"}
