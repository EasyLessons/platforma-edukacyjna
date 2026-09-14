"""
Workspace CRUD router — /api/v1/workspaces/*
"""
from fastapi import APIRouter, Depends, status

from ..auth.dependencies import get_current_user
from core.database import get_db
from core.responses import ApiResponse

from .schemas import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse, WorkspaceListResponse, 
    ToggleFavouriteRequest, ToggleFavouriteResponse, MessageResponse,
)
from .service import WorkspaceService

router = APIRouter(tags=["Workspaces"])

@router.get("", response_model=ApiResponse[WorkspaceListResponse])
async def get_workspaces(db=Depends(get_db), current_user=Depends(get_current_user)):
    service = WorkspaceService(db)
    workspaces = service.get_user_workspaces(current_user.id)
    return ApiResponse(success=True, data=WorkspaceListResponse(workspaces=workspaces, total=len(workspaces)))

@router.get("/{workspace_id}", response_model=ApiResponse[WorkspaceResponse])
async def get_workspace(
    workspace_id: int, 
    db=Depends(get_db), 
    current_user=Depends(get_current_user),

):
    service = WorkspaceService(db)
    result = service.get_workspace(workspace_id, current_user.id)
    return ApiResponse(success=True, data=result)

@router.post("", response_model=ApiResponse[WorkspaceResponse], status_code=status.HTTP_201_CREATED)
async def create_new_workspace(workspace_data: WorkspaceCreate, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = WorkspaceService(db)
    return ApiResponse(success=True, data=service.create_workspace(workspace_data, current_user.id))

@router.put("/{workspace_id}", response_model=ApiResponse[WorkspaceResponse])
async def update_existing_workspace(workspace_id: int, workspace_data: WorkspaceUpdate, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = WorkspaceService(db)
    return ApiResponse(success=True, data=service.update_workspace(workspace_id, workspace_data, current_user.id))

@router.delete("/{workspace_id}", response_model=ApiResponse[MessageResponse])
async def delete_existing_workspace(workspace_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = WorkspaceService(db)
    result = service.delete_workspace(workspace_id, current_user.id)
    return ApiResponse(success=True, data=MessageResponse(**result))

@router.delete("/{workspace_id}/leave", response_model=ApiResponse[MessageResponse])
async def leave_existing_workspace(workspace_id: int, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = WorkspaceService(db)
    result = service.leave_workspace(workspace_id, current_user.id)
    return ApiResponse(success=True, data=MessageResponse(**result))

@router.patch("/{workspace_id}/favourite", response_model=ApiResponse[ToggleFavouriteResponse])
async def toggle_favourite(workspace_id: int, request: ToggleFavouriteRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = WorkspaceService(db)
    result = service.toggle_workspace_favourite(workspace_id, current_user.id, request.is_favourite)
    return ApiResponse(success=True, data=result)