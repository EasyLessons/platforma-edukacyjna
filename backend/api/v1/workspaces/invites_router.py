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
    InviteCreate, InviteResponse, PendingInviteResponse,
    AcceptInviteResponse, InviteStatusResponse, InviteStatusBatchRequest, 
    InviteStatusBatchResponse, MessageResponse, UserSearchResult
)
from .invites_service import InviteService
from .members_service import MemberService

router = APIRouter(tags=["Invites"])

@router.post("/{workspace_id}/invite", response_model=ApiResponse[InviteResponse])
async def create_workspace_invite(workspace_id: int, invite_data: InviteCreate, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = InviteService(db)
    result = await service.create_invite(workspace_id=workspace_id, user_id=current_user.id, invited_user_id=invite_data.invited_user_id)
    return ApiResponse(success=True, data=result)

@router.get("/invites/pending", response_model=ApiResponse[List[PendingInviteResponse]])
async def get_pending_invites(db=Depends(get_db), current_user=Depends(get_current_user)):
    service = InviteService(db)
    return ApiResponse(success=True, data=service.get_user_pending_invites(user_id=current_user.id))

@router.post("/invites/accept/{token}", response_model=ApiResponse[AcceptInviteResponse])
async def accept_workspace_invite(token: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = InviteService(db)
    return ApiResponse(success=True, data=service.accept_invite(invite_token=token, user_id=current_user.id))

@router.delete("/invites/{token}", response_model=ApiResponse[MessageResponse])
async def reject_workspace_invite(token: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = InviteService(db)
    result = service.reject_invite(invite_token=token, user_id=current_user.id)
    return ApiResponse(success=True, data=MessageResponse(**result))

@router.get("/{workspace_id}/members/check/{user_id}", response_model=ApiResponse[InviteStatusResponse])
async def check_user_invite_status(workspace_id: int, user_id: int, db=Depends(get_db)):
    service = InviteService(db)
    return ApiResponse(success=True, data=service.check_invite_status(workspace_id, user_id))

@router.post("/{workspace_id}/members/check-batch", response_model=ApiResponse[InviteStatusBatchResponse])
async def check_users_invite_status_batch(
    workspace_id: int,
    payload: InviteStatusBatchRequest,
    db: Session = Depends(get_db),
):
    service = InviteService(db)
    statuses = service.check_invite_status_batch(workspace_id, payload.user_ids)
    return ApiResponse(success=True, data=InviteStatusBatchResponse(statuses=statuses))

@router.get("/{workspace_id}/members/search", response_model=ApiResponse[List[UserSearchResult]])
async def search_workspace_users_endpoint(
    workspace_id: int,
    query: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    limit: int = Query(10, ge=1, le=50, description="Result limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member_service = MemberService(db)
    result = member_service.search_workspace_users(workspace_id, query, current_user.id, limit)
    return ApiResponse(success=True, data=result)