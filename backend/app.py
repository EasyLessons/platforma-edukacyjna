"""
Entry point - API v1
Zamiast main.py, ale trzymamy main.py dla backward compat
"""
"""
MAIN.PY - Entry point aplikacji
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from core.logging import setup_logging
from core.config import get_settings
from core.exceptions import AppException, ValidationError, AuthenticationError, NotFoundError
from core.responses import ApiResponse

from api.v1.router import get_v1_router

# Logging setup
log_level = "DEBUG" if os.getenv("ENV", "production") == "development" else "INFO"
setup_logging(log_level=log_level)
logger = logging.getLogger(__name__)

# App
app = FastAPI(
    title="Education Platform API",
    version="1.0.0",
    description="Collaborative education platform",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc"
)

# CORS
settings = get_settings()
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://platforma-edukacyjna-five.vercel.app",
    "https://platforma-edukacyjna-one.vercel.app",
    "https://easylesson.app",
    "https://www.easylesson.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Events
@app.on_event("startup")
async def startup_event():
    logger.info("Education Platform API started ...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("... Education Platform API stopped")

# Exception handlers
@app.exception_handler(ValidationError)
async def validation_error_handler(request, exc: ValidationError):
    """Handle validation errors"""
    logger.warning(f"Validation error: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiResponse(
            success=False,
            error=exc.message,
            code=exc.code
        ).model_dump(mode='json')
    )

@app.exception_handler(AuthenticationError)
async def auth_error_handler(request, exc: AuthenticationError):
    """Handle auth errors"""
    logger.warning(f"Auth error: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiResponse(
            success=False,
            error=exc.message,
            code=exc.code
        ).model_dump(mode='json')
    )

@app.exception_handler(NotFoundError)
async def not_found_handler(request, exc: NotFoundError):
    """Handle not found errors"""
    logger.info(f"Resource not found: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiResponse(
            success=False,
            error=exc.message,
            code=exc.code
        ).model_dump(mode='json')
    )

@app.exception_handler(AppException)
async def app_exception_handler(request, exc: AppException):
    """Handle generic app exceptions"""
    logger.error(f"App exception ({exc.code}): {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiResponse(
            success=False,
            error=exc.message,
            code=exc.code
        ).model_dump(mode='json')
    )

@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Handle unhandled exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ApiResponse(
            success=False,
            error="Internal server error",
            code="APP_ERROR"
        ).model_dump(mode='json')
    )

# Include routers
app.include_router(get_v1_router())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
