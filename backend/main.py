"""
MAIN.PY - Entry point aplikacji
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.logging import setup_logging
from auth.routes import router as auth_router
from dashboard.routes import router as dashboard_router


# Inicjalizuj logging
setup_logging(log_level="INFO")

# Aplikacja
app = FastAPI(title="Education Platform API")

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
app.include_router(dashboard_router)

@app.get("/")
async def root():
    return {"message": "Education Platform API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)