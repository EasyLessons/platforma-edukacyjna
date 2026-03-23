"""
Invites router — /api/v1/workspaces/*
"""
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from core.database import get_db
from core.models import User
from core.responses import ApiResponse

from .schemas import (
    InviteCreate, InviteResponse, PendingInviteResponse,
    AcceptInviteResponse, InviteStatusResponse, MessageResponse,
)
from .invites_service import (
    create_invite, accept_invite, reject_invite,
    get_user_pending_invites, check_invite_status,
)

router = APIRouter(tags=["Invites"])

@router.post("/{workspace_id}/invite", response_model=ApiResponse[InviteResponse])
async def create_workspace_invite(workspace_id: int, invite_data: InviteCreate, db=Depends(get_db), current_user=Depends(get_current_user)):
    result = await create_invite(db=db, workspace_id=workspace_id, user_id=current_user.id, invited_user_id=invite_data.invited_user_id)
    return ApiResponse(success=True, data=result)

@router.get("/invites/pending", response_model=ApiResponse[List[PendingInviteResponse]])
async def get_pending_invites(db=Depends(get_db), current_user=Depends(get_current_user)):
    return ApiResponse(success=True, data=get_user_pending_invites(db=db, user_id=current_user.id))

@router.post("/invites/accept/{token}", response_model=ApiResponse[AcceptInviteResponse])
async def accept_workspace_invite(token: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    return ApiResponse(success=True, data=accept_invite(db=db, invite_token=token, user_id=current_user.id))

@router.delete("/invites/{token}", response_model=ApiResponse[MessageResponse])
async def reject_workspace_invite(token: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    result = reject_invite(db=db, invite_token=token, user_id=current_user.id)
    return ApiResponse(success=True, data=MessageResponse(**result))

@router.get("/{workspace_id}/members/check/{user_id}", response_model=ApiResponse[InviteStatusResponse])
async def check_user_invite_status(workspace_id: int, user_id: int, db=Depends(get_db)):
    return ApiResponse(success=True, data=check_invite_status(db, workspace_id, user_id))