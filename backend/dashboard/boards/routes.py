"""
BOARDS ROUTES - Endpointy zarządzania tablicami w dashboardzie
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from core.database import get_db
from dashboard.boards.schemas import (
    CreateBoard, BoardResponse,
    BoardListResponse, UpdateBoard,
    ToggleFavourite, ToggleFavouriteResponse,
    OnlineUserInfo, BoardOwnerInfo, 
    LastModifiedByInfo, LastOpenedInfo
)
from dashboard.boards.service import BoardService
from dashboard.boards.utils import get_current_user_id

router = APIRouter(prefix="/api/boards", tags=["dashboard", "boards"])

@router.post("", response_model=BoardResponse)
async def create_board(
    board_data: CreateBoard, 
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Tworzenie nowej tablicy"""
    service = BoardService(db)
    return await service.create_board(board_data, user_id)

@router.get("", response_model=BoardListResponse)
async def list_boards(
    workspace_id: int,
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Pobieranie listy tablic w workspace"""
    service = BoardService(db)
    return await service.list_boards(workspace_id, user_id, limit, offset)

@router.put("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: int, 
    board_data: UpdateBoard, 
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Aktualizacja tablicy"""
    service = BoardService(db)
    return await service.update_board(board_id, board_data, user_id)

@router.post("/{board_id}/toggle-favourite", response_model=ToggleFavouriteResponse)
async def toggle_favourite(
    board_id: int, 
    toggle_data: ToggleFavourite, 
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Toggleowanie ulubionej tablicy"""
    service = BoardService(db)
    return await service.toggle_favourite(board_id, toggle_data, user_id)

@router.get("/{board_id}/online-users", response_model=List[OnlineUserInfo])
async def get_online_users(
    board_id: int, 
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Pobieranie użytkowników online na tablicy"""
    service = BoardService(db)
    return await service.get_online_users(board_id, limit, offset)

@router.delete("/{board_id}")
async def delete_board(
    board_id: int, 
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Usuwanie tablicy"""
    service = BoardService(db)
    return await service.delete_board(board_id, user_id)

@router.get("/{board_id}/owner", response_model=BoardOwnerInfo)
async def get_board_owner(board_id: int, db: Session = Depends(get_db)):
    """Pobieranie informacji o właścicielu tablicy"""
    service = BoardService(db)
    return await service.get_board_owner_info(board_id)

@router.get("/{board_id}/last-modified-by", response_model=LastModifiedByInfo)
async def get_last_modified_by(board_id: int, db: Session = Depends(get_db)):
    """Pobieranie informacji o ostatnim modyfikatorze tablicy"""
    service = BoardService(db)
    return await service.get_last_modifier_info(board_id)

@router.get("/{board_id}/last-opened", response_model=LastOpenedInfo)
async def get_last_opened(
    board_id: int, 
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Pobieranie informacji o ostatnim otwarciu tablicy"""
    service = BoardService(db)
    return await service.get_last_opened_info(board_id, user_id)