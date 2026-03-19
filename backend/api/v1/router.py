"""
API v1 router - wszystkie v1 endpointy w jednym miejscu
"""
from fastapi import APIRouter
from core.responses import ApiResponse

from .auth.router import router as auth_router
from .notifications.router import router as notifications_router
from .workspaces.router import router as workspaces_router
from .workspaces.members_router import router as members_router
from .workspaces.invites_router import router as invites_router

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
    router.include_router(notifications_router, prefix="/notifications")
    router.include_router(workspaces_router, prefix="/workspaces")
    router.include_router(members_router, prefix="/workspaces")
    router.include_router(invites_router, prefix="/workspaces")

    return router
