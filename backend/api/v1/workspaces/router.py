"""
Workspace CRUD router — /api/v1/workspaces/*
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from core.database import get_db
from core.models import User
from core.responses import ApiResponse

from .schemas import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse,
    WorkspaceWithBoardsResponse, WorkspaceListResponse, 
    ToggleFavouriteRequest, MessageResponse,
)
from .service import WorkspaceService

router = APIRouter(tags=["Workspaces"])

@router.get("", response_model=ApiResponse[WorkspaceListResponse])
async def get_workspaces(db=Depends(get_db), current_user=Depends(get_current_user)):
    service = WorkspaceService(db)
    workspaces = service.get_user_workspaces(current_user.id)
    return ApiResponse(success=True, data=WorkspaceListResponse(workspaces=workspaces, total=len(workspaces)))

@router.get("/{workspace_id}", response_model=ApiResponse[WorkspaceWithBoardsResponse])
async def get_workspace(
    workspace_id: int, 
    boards_limit: int = Query(50, ge=1, le=100),
    boards_offset: int = Query(0, ge=0),
    db=Depends(get_db), 
    current_user=Depends(get_current_user),

):
    service = WorkspaceService(db)
    result = await service.get_workspace_with_boards(workspace_id, current_user.id, boards_limit, boards_offset)
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

@router.patch("/{workspace_id}/favourite", response_model=ApiResponse[MessageResponse])
async def toggle_favourite(workspace_id: int, request: ToggleFavouriteRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    service = WorkspaceService(db)
    result = service.toggle_workspace_favourite(workspace_id, current_user.id, request.is_favourite)
    return ApiResponse(success=True, data=MessageResponse(message=result["message"]))