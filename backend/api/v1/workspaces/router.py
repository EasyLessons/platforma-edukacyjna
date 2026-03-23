"""
Workspace CRUD router — /api/v1/workspaces/*
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from core.database import get_db
from core.models import User
from core.responses import ApiResponse

from .schemas import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse,
    WorkspaceListResponse, ToggleFavouriteRequest,
    SetActiveResponse, MessageResponse,
)
from .service import (
    get_user_workspaces, get_workspace_by_id, create_workspace,
    update_workspace, delete_workspace, toggle_workspace_favourite,
    leave_workspace, set_active_workspace,
)

router = APIRouter(tags=["Workspaces"])

@router.get("", response_model=ApiResponse[WorkspaceListResponse])
async def get_workspaces(db=Depends(get_db), current_user=Depends(get_current_user)):
    workspaces = get_user_workspaces(db, current_user.id)
    return ApiResponse(success=True, data=WorkspaceListResponse(workspaces=workspaces, total=len(workspaces)))

@router.get("/{workspace_id}", response_model=ApiResponse[WorkspaceResponse])
async def get_workspace(workspace_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    return ApiResponse(success=True, data=get_workspace_by_id(db, workspace_id, current_user.id))

@router.post("", response_model=ApiResponse[WorkspaceResponse], status_code=status.HTTP_201_CREATED)
async def create_new_workspace(workspace_data: WorkspaceCreate, db=Depends(get_db), current_user=Depends(get_current_user)):
    return ApiResponse(success=True, data=create_workspace(db, workspace_data, current_user.id))

@router.put("/{workspace_id}", response_model=ApiResponse[WorkspaceResponse])
async def update_existing_workspace(workspace_id: int, workspace_data: WorkspaceUpdate, db=Depends(get_db), current_user=Depends(get_current_user)):
    return ApiResponse(success=True, data=update_workspace(db, workspace_id, workspace_data, current_user.id))

@router.delete("/{workspace_id}", response_model=ApiResponse[MessageResponse])
async def delete_existing_workspace(workspace_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    result = delete_workspace(db, workspace_id, current_user.id)
    return ApiResponse(success=True, data=MessageResponse(**result))

@router.delete("/{workspace_id}/leave", response_model=ApiResponse[MessageResponse])
async def leave_existing_workspace(workspace_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    result = leave_workspace(db, workspace_id, current_user.id)
    return ApiResponse(success=True, data=MessageResponse(**result))

@router.patch("/{workspace_id}/favourite", response_model=ApiResponse[MessageResponse])
async def toggle_favourite(workspace_id: int, request: ToggleFavouriteRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    result = toggle_workspace_favourite(db, workspace_id, current_user.id, request.is_favourite)
    return ApiResponse(success=True, data=MessageResponse(message=result["message"]))

@router.patch("/{workspace_id}/set-active", response_model=ApiResponse[SetActiveResponse])
async def set_active(workspace_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    result = set_active_workspace(db, workspace_id, current_user)
    return ApiResponse(success=True, data=SetActiveResponse(**result))