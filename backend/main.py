"""
MAIN.PY - Entry point aplikacji
"""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from core.logging import setup_logging
from auth.routes import router as auth_router
from dashboard.workspaces.routes import router as workspaces_router
from dashboard.boards.routes import router as boards_router
from fastapi import HTTPException
from datetime import datetime

# Inicjalizuj logging PRZED utworzeniem app
# W produkcji używaj INFO, w development DEBUG
log_level = "DEBUG" if os.getenv("ENV", "production") == "development" else "INFO"
setup_logging(log_level=log_level)

# Pobierz logger
logger = logging.getLogger(__name__)

# Aplikacja
app = FastAPI(title="Education Platform API")

# Lista dozwolonych origindów (zsynchronizowana z CORSMiddleware poniżej)
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://platforma-edukacyjna-five.vercel.app",
    "https://platforma-edukacyjna-one.vercel.app",
    "https://easylesson.app",
    "https://www.easylesson.app",
]
ALLOWED_ORIGIN_REGEX = r"https://(www\.)?easylesson\.app|https://.*\.vercel\.app"

import re as _re

def _cors_origin_for(request: Request) -> str | None:
    """Zwróć origin jeśli znajduje się na liście dozwolonych."""
    origin = request.headers.get("origin")
    if not origin:
        return None
    if origin in ALLOWED_ORIGINS:
        return origin
    if _re.match(ALLOWED_ORIGIN_REGEX, origin):
        return origin
    return None

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Globalny handler dla nieobsłużonych wyjątków (500).
    Zawsze dodaje nagłówki CORS — bez tego przeglądarka blokuje odpowiedź
    zanim JavaScript zdąży przeczytać kod błędu.
    """
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}", exc_info=True)
    origin = _cors_origin_for(request)
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers,
    )

@app.on_event("startup")
async def startup_event():
    """Event wywoływany przy starcie aplikacji"""
    logger.info("🚀 Aplikacja Education Platform uruchomiona!")
    logger.debug("📊 Tryb: Development (uvicorn --reload)")

@app.on_event("shutdown")
async def shutdown_event():
    """Event wywoływany przy zamknięciu aplikacji"""
    logger.info("🛑 Aplikacja Education Platform zatrzymana!")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Zarejestruj routery
app.include_router(auth_router)
app.include_router(workspaces_router)
app.include_router(boards_router)

@app.get("/health")
@app.head("/health")
async def health_check():
    """Health check endpoint - dla UptimeRobot i monitoringu"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/")
async def root():
    """Root endpoint - testowy"""
    logger.info("🏠 Root endpoint wywołany")
    return {"message": "Education Platform API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    
    # Konfiguracja uvicorn z poprawnym logowaniem
    logger.info("🔧 Uruchamianie serwera uvicorn...")
    
    uvicorn_log_level = "debug" if os.getenv("ENV", "production") == "development" else "info"
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_config=None,  # ← KLUCZ! Nie nadpisuj naszej konfiguracji
        log_level=uvicorn_log_level
    )