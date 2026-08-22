"""
Invites router — /api/v1/workspaces/*
"""
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from core.database import get_db
from core.models import User
from core.responses import ApiResponse

from .schemas import (
    InviteCreate, InviteResponse,
    AcceptInviteResponse, MessageResponse, UserSearchResult
)
from .invites_service import InviteService

router = APIRouter(tags=["Invites"])

@router.post("/{workspace_id}/invite", response_model=ApiResponse[InviteResponse])
async def create_workspace_invite(workspace_id: int, invite_data: InviteCreate, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = InviteService(db)
    result = await service.create_invite(workspace_id=workspace_id, user_id=current_user.id, invited_user_id=invite_data.invited_user_id)
    return ApiResponse(success=True, data=result)

@router.post("/invites/accept/{token}", response_model=ApiResponse[AcceptInviteResponse])
async def accept_workspace_invite(token: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = InviteService(db)
    return ApiResponse(success=True, data=service.accept_invite(invite_token=token, user_id=current_user.id))

@router.delete("/invites/{token}", response_model=ApiResponse[MessageResponse])
async def reject_workspace_invite(token: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = InviteService(db)
    result = service.reject_invite(invite_token=token, user_id=current_user.id)
    return ApiResponse(success=True, data=MessageResponse(**result))

@router.get("/{workspace_id}/invite/users", response_model=ApiResponse[List[UserSearchResult]])
async def search_invitable_users(
    workspace_id: int,
    query: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    limit: int = Query(10, ge=1, le=50, description="Result limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = InviteService(db)
    result = service.search_invitable_users(workspace_id, query, current_user.id, limit)
    return ApiResponse(success=True, data=result)