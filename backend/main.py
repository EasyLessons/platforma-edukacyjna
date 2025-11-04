"""
MAIN.PY - Entry point aplikacji
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.logging import setup_logging
from auth.routes import router as auth_router

# Inicjalizuj logging
setup_logging(log_level="INFO")

# Aplikacja
app = FastAPI(title="Education Platform API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "https://platforma-edukacyjna-one.vercel.app",
        "https://*lesson.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Zarejestruj routery
app.include_router(auth_router)

@app.get("/")
async def root():
    return {"message": "Education Platform API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)