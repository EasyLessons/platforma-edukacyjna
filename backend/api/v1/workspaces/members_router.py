"""
Members router — /api/v1/workspaces/{id}/members/*
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from core.database import get_db
from core.models import User
from core.responses import ApiResponse

from .schemas import (
    WorkspaceMembersListResponse, UpdateMemberRoleRequest,
    MyRoleResponse, RemoveMemberResponse, MessageResponse,
)
from .members_service import (
    get_workspace_members, remove_workspace_member,
    update_member_role, get_user_role,
)

router = APIRouter(tags=["Members"])

@router.get("/{workspace_id}/members", response_model=ApiResponse[WorkspaceMembersListResponse])
async def get_members(workspace_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    return ApiResponse(success=True, data=get_workspace_members(db, workspace_id, current_user.id))

@router.delete("/{workspace_id}/members/{user_id}", response_model=ApiResponse[RemoveMemberResponse])
async def remove_member(workspace_id: int, user_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    result = remove_workspace_member(db, workspace_id, user_id, current_user.id)
    return ApiResponse(success=True, data=RemoveMemberResponse(**result))

@router.patch("/{workspace_id}/members/{user_id}/role", response_model=ApiResponse[MessageResponse])
async def update_role(workspace_id: int, user_id: int, role_data: UpdateMemberRoleRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    result = update_member_role(db, workspace_id, user_id, role_data.role, current_user.id)
    return ApiResponse(success=True, data=MessageResponse(message=result["message"]))

@router.get("/{workspace_id}/my-role", response_model=ApiResponse[MyRoleResponse])
async def get_my_role(workspace_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    return ApiResponse(success=True, data=get_user_role(db, workspace_id, current_user.id))