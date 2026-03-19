"""
API v1 router - wszystkie v1 endpointy w jednym miejscu
"""
from fastapi import APIRouter
from core.responses import ApiResponse

from .auth.router import router as auth_router

def get_v1_router():
    """Funkcja tworząca v1 router"""
    router = APIRouter(prefix="/api/v1")

    # === TEST ENDPOINT ===
    @router.get(
        "/health",
        response_model=ApiResponse,
        tags=["Health"],
        summary="Health check",
        responses={200: {"description": "API is healthy"}}
    )
    async def health_check():
        """Sprawdza czy API działa"""
        return ApiResponse(success=True, data={"status": "ok"})

    # === INCLUDE FEATURE ROUTERS ===
    router.include_router(auth_router, prefix="/auth")

    return router
