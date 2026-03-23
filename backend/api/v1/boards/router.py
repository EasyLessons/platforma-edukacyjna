"""
Boards router — /api/v1/boards/*

POST   /                        — utwórz tablicę
GET    /                        — lista tablic w workspace
GET    /{id}                    — pobierz tablicę
PUT    /{id}                    — zaktualizuj
DELETE /{id}                    — usuń
POST   /{id}/toggle-favourite   — ulubione
GET    /{id}/members            — członkowie (z workspace)
PUT    /{id}/settings           — ustawienia (tylko owner)
POST   /{id}/join               — dołączenie przez link
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from core.database import get_db
from core.models import User, WorkspaceMember, Board
from core.responses import ApiResponse

from .schemas import (
    CreateBoard, UpdateBoard, ToggleFavourite,
    BoardResponse, BoardListResponse,
    ToggleFavouriteResponse, BoardMembersResponse,
    UpdateBoardSettings, DeleteBoardResponse,
    JoinBoardResponse,
)
from .service import BoardService

router = APIRouter(tags=["Boards"])


@router.post(
    "", response_model=ApiResponse[BoardResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_board(
    board_data: CreateBoard,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BoardService(db)
    result = await service.create_board(board_data, current_user.id)
    return ApiResponse(success=True, data=result)


@router.get("", response_model=ApiResponse[BoardListResponse])
async def list_boards(
    workspace_id: int,
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BoardService(db)
    result = await service.list_boards(workspace_id, current_user.id, limit, offset)
    return ApiResponse(success=True, data=result)


@router.get("/{board_id}", response_model=ApiResponse[BoardResponse])
async def get_board(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BoardService(db)
    result = await service.get_board(board_id, current_user.id)
    return ApiResponse(success=True, data=result)


@router.put("/{board_id}", response_model=ApiResponse[BoardResponse])
async def update_board(
    board_id: int,
    board_data: UpdateBoard,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BoardService(db)
    result = await service.update_board(board_id, board_data, current_user.id)
    return ApiResponse(success=True, data=result)


@router.delete("/{board_id}", response_model=ApiResponse[DeleteBoardResponse])
async def delete_board(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BoardService(db)
    result = await service.delete_board(board_id, current_user.id)
    return ApiResponse(success=True, data=DeleteBoardResponse(**result))


@router.post("/{board_id}/toggle-favourite", response_model=ApiResponse[ToggleFavouriteResponse])
async def toggle_favourite(
    board_id: int,
    toggle_data: ToggleFavourite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BoardService(db)
    result = await service.toggle_favourite(board_id, toggle_data, current_user.id)
    return ApiResponse(success=True, data=result)


@router.get("/{board_id}/members", response_model=ApiResponse[BoardMembersResponse])
async def get_members(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BoardService(db)
    result = await service.get_members(board_id, current_user.id)
    return ApiResponse(success=True, data=result)


@router.put("/{board_id}/settings", response_model=ApiResponse[dict])
async def update_settings(
    board_id: int,
    body: UpdateBoardSettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = BoardService(db)
    result = await service.update_settings(board_id, body, current_user.id)
    return ApiResponse(success=True, data=result)

@router.post("/{board_id}/join", response_model=ApiResponse[JoinBoardResponse])
async def join_board(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dołącza użytkownika do workspace powiązanego z tablicą."""
    service = BoardService(db)
    result = await service.join_board_workspace(board_id, current_user.id)
    return ApiResponse(success=True, data=result)