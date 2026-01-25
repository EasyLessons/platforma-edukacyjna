"""
BOARDS ROUTES - Endpointy zarządzania tablicami w dashboardzie
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime, timezone

from core.database import get_db
from core.models import BoardElement, Board, WorkspaceMember, User
from dashboard.boards.schemas import (
    CreateBoard, BoardResponse,
    BoardListResponse, UpdateBoard,
    ToggleFavourite, ToggleFavouriteResponse,
    OnlineUserInfo, BoardOwnerInfo, 
    LastModifiedByInfo, LastOpenedInfo
)
from dashboard.boards.service import BoardService
from dashboard.boards.utils import get_current_user_id
from dashboard.boards.online import set_user_online, set_user_offline

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

@router.post("/{board_id}/online")
async def mark_user_online(
    board_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Oznacz użytkownika jako online na tablicy"""
    success = set_user_online(db, board_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tablica nie znaleziona lub brak dostępu"
        )
    
    return {"status": "online", "board_id": board_id, "user_id": user_id}

@router.delete("/{board_id}/online")
async def mark_user_offline(
    board_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Oznacz użytkownika jako offline na tablicy"""
    success = set_user_offline(db, board_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tablica nie znaleziona lub brak dostępu"
        )
    
    return {"status": "offline", "board_id": board_id, "user_id": user_id}

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


# ═══════════════════════════════════════════════════════════════════════════
# BOARD ELEMENTS - Zapisywanie i ładowanie elementów tablicy
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/{board_id}/elements/batch")
async def save_elements_batch(
    board_id: int,
    elements: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """
    Zapisz wiele elementów naraz (batch)
    
    Parametry:
    - board_id: ID tablicy
    - elements: Lista elementów w formacie:
      [
        {
          "element_id": "uuid-123",
          "type": "path",
          "data": { cały obiekt elementu }
        }
      ]
    
    Zwraca:
    {
      "success": true,
      "saved": 5
    }
    """
    
    # Walidacja: Lista nie może być pusta
    if not elements or len(elements) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lista elementów jest pusta"
        )
    
    # Walidacja: Maksymalnie 100 elementów
    if len(elements) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zbyt wiele elementów (maksymalnie 100)"
        )
    
    # Sprawdź czy tablica istnieje
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tablica nie znaleziona"
        )
    
    # Sprawdź czy użytkownik ma dostęp (jest członkiem workspace)
    workspace_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == board.workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()
    
    if not workspace_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak dostępu do tej tablicy"
        )
    
    saved_count = 0
    
    for elem in elements:
        # Sprawdź czy element już istnieje
        existing = db.query(BoardElement).filter(
            BoardElement.board_id == board_id,
            BoardElement.element_id == elem["element_id"]
        ).first()
        
        if existing:
            # AKTUALIZUJ istniejący
            existing.data = elem["data"]
            existing.updated_at = datetime.now(timezone.utc)
        else:
            # UTWÓRZ nowy
            new_element = BoardElement(
                board_id=board_id,
                element_id=elem["element_id"],
                type=elem["type"],
                data=elem["data"],
                created_by=user_id,
                is_deleted=False
            )
            db.add(new_element)
        
        saved_count += 1
    
    db.commit()
    
    return {
        "success": True,
        "saved": saved_count
    }


@router.get("/{board_id}/elements")
async def get_board_elements(
    board_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """
    Pobierz wszystkie elementy tablicy
    
    Parametry:
    - board_id: ID tablicy
    
    Zwraca:
    {
      "elements": [
        {
          "element_id": "uuid-123",
          "type": "path",
          "data": { cały obiekt }
        }
      ]
    }
    """
    
    # Sprawdź czy tablica istnieje
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tablica nie znaleziona"
        )
    
    # Sprawdź czy użytkownik ma dostęp
    workspace_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == board.workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()
    
    if not workspace_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak dostępu do tej tablicy"
        )
    
    # Pobierz tylko nie usunięte elementy z informacją o autorze
    elements = db.query(BoardElement, User).outerjoin(
        User, BoardElement.created_by == User.id
    ).filter(
        BoardElement.board_id == board_id,
        BoardElement.is_deleted == False
    ).order_by(BoardElement.created_at.asc()).all()
    
    return {
        "elements": [
            {
                "element_id": e.BoardElement.element_id,
                "type": e.BoardElement.type,
                "data": e.BoardElement.data,
                "created_by_id": e.BoardElement.created_by,
                "created_by_username": e.User.username if e.User else None,
                "created_at": e.BoardElement.created_at.isoformat() if e.BoardElement.created_at else None
            }
            for e in elements
        ]
    }


@router.delete("/{board_id}/elements/{element_id}")
async def delete_element(
    board_id: int,
    element_id: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """
    Usuń element (soft delete)
    
    Parametry:
    - board_id: ID tablicy
    - element_id: UUID elementu
    
    Zwraca:
    {
      "success": true
    }
    """
    
    # Sprawdź czy tablica istnieje
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tablica nie znaleziona"
        )
    
    # Sprawdź czy użytkownik ma dostęp
    workspace_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == board.workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()
    
    if not workspace_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brak dostępu do tej tablicy"
        )
    
    # Znajdź element
    element = db.query(BoardElement).filter(
        BoardElement.board_id == board_id,
        BoardElement.element_id == element_id
    ).first()
    
    if not element:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Element nie znaleziony"
        )
    
    # Soft delete (nie usuwamy fizycznie)
    element.is_deleted = True
    element.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    return {"success": True}


@router.post("/{board_id}/join")
async def join_board_workspace(
    board_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """
    Automatyczne dołączenie do workspace przez link do tablicy.
    Jeśli użytkownik nie jest członkiem workspace - dodajemy go jako member.
    """
    # Sprawdź czy tablica istnieje
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tablica nie znaleziona"
        )
    
    # Sprawdź czy użytkownik już jest członkiem workspace
    existing_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == board.workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()
    
    if existing_member:
        # Już jest członkiem - zwróć sukces
        return {
            "success": True,
            "already_member": True,
            "workspace_id": board.workspace_id,
            "board_id": board_id
        }
    
    # Dodaj jako member workspace
    new_member = WorkspaceMember(
        workspace_id=board.workspace_id,
        user_id=user_id,
        role="member"
    )
    db.add(new_member)
    db.commit()
    
    return {
        "success": True,
        "already_member": False,
        "workspace_id": board.workspace_id,
        "board_id": board_id,
        "message": "Dołączono do workspace"
    }