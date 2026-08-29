"""
Share links router - /api/v1/workspaces/*
"""
from typing import Optional
from fastapi import APIRouter, Depends

from ...auth.dependencies import get_current_user
from core.database import get_db
from core.responses import ApiResponse

from .schemas import ShareLinkResponse, ShareLinkPreview, JoinShareLinkResponse, MessageResponse
from .service import ShareLinkService

router = APIRouter(tags=["ShareLinks"])


@router.post("/{workspace_id}/share-link", response_model=ApiResponse[ShareLinkResponse])
async def create_share_link(
    workspace_id: int,
    board_id: Optional[int] = None,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = ShareLinkService(db)
    result = service.get_or_create_link(workspace_id, board_id, current_user.id)
    return ApiResponse(success=True, data=result)


@router.post("/{workspace_id}/share-link/refresh", response_model=ApiResponse[ShareLinkResponse])
async def refresh_share_link(
    workspace_id: int,
    board_id: Optional[int] = None,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = ShareLinkService(db)
    result = service.refresh_link(workspace_id, board_id, current_user.id)
    return ApiResponse(success=True, data=result)


@router.delete("/{workspace_id}/share-link/{token}", response_model=ApiResponse[MessageResponse])
async def revoke_share_link(
    workspace_id: int,
    token: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = ShareLinkService(db)
    result = service.revoke_link(workspace_id, token, current_user.id)
    return ApiResponse(success=True, data=MessageResponse(**result))


@router.get("/share-link/{token}", response_model=ApiResponse[ShareLinkPreview])
async def preview_share_link(
    token: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = ShareLinkService(db)
    result = service.preview_link(token, current_user.id)
    return ApiResponse(success=True, data=result)


@router.post("/share-link/{token}/join", response_model=ApiResponse[JoinShareLinkResponse])
async def join_share_link(
    token: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = ShareLinkService(db)
    result = service.join_via_link(token, current_user.id)
    return ApiResponse(success=True, data=result)