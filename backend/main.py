"""
MAIN.PY - Entry point aplikacji
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from core.logging import setup_logging
from auth.routes import router as auth_router
from dashboard.workspaces.routes import router as workspaces_router
from dashboard.boards.routes import router as boards_router
from fastapi import HTTPException
from datetime import datetime

# Inicjalizuj logging PRZED utworzeniem app
setup_logging(log_level="DEBUG")  # DEBUG żeby widzieć wszystko

# Pobierz logger
logger = logging.getLogger(__name__)

# Aplikacja
app = FastAPI(title="Education Platform API")

@app.on_event("startup")
async def startup_event():
    """Event wywoływany przy starcie aplikacji"""
    logger.info("🚀 Aplikacja Education Platform uruchomiona!")
    logger.debug("📊 Tryb: Development (uvicorn --reload)")

@app.on_event("shutdown")
async def shutdown_event():
    """Event wywoływany przy zamknięciu aplikacji"""
    logger.info("🛑 Aplikacja Education Platform zatrzymana!")

# CORS - ZAKTUALIZOWANE DLA TWOICH DOMEN
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Development (localhost)
        "http://localhost:3000",
        "http://localhost:8000",
        
        # Production - Vercel domains
        "https://platforma-edukacyjna-five.vercel.app",  # ← TWOJA GŁÓWNA DOMENA VERCEL
        "https://platforma-edukacyjna-one.vercel.app",   # ← Stara/dodatkowa (możesz usunąć jeśli nie używasz)
        
        # Production - Custom domain
        "https://easylesson.app",                         # ← TWOJA CUSTOM DOMAIN
        "https://www.easylesson.app",                     # ← Z www (dla pewności)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Zarejestruj routery
app.include_router(auth_router)
app.include_router(workspaces_router)
app.include_router(boards_router)

@app.get("/health")
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
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_config=None,  # ← KLUCZ! Nie nadpisuj naszej konfiguracji
        log_level="debug"  # poziom dla uvicorn
    )