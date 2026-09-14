"""
Whiteboard router — /api/v1/whiteboard/{board_id}/*

POST   /{id}/opened                 — zanotuj otwarcie tablicy (last_opened + presence)
GET    /{id}/settings               — ustawienia tablicy
PUT    /{id}/settings               — aktualizacja ustawień tablicy
POST   /{id}/elements/batch         — batch save elementów
GET    /{id}/elements               — załaduj wszystkie elementy
DELETE /{id}/elements/{element_id}  — usuń element
"""
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from core.database import get_db
from core.models import User
from core.responses import ApiResponse

from .schemas import (
    OnlineStatusResponse, BoardElementWithAuthor,
    SaveElementsResponse, DeleteElementResponse, UploadImageResponse,
    BoardSettings, BoardSettingsPatch
)
from .service import WhiteboardService

router = APIRouter(tags=["Whiteboard"])


# Online presence --------------------------------------------------

@router.post("/{board_id}/opened", response_model=ApiResponse[OnlineStatusResponse])
async def mark_opened(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    await service.mark_opened(board_id, current_user.id)
    return ApiResponse(success=True, data=OnlineStatusResponse(
        status="online", board_id=board_id, user_id=current_user.id
    ))

# Settings --------------------------------------------------

@router.get("/{board_id}/settings", response_model=ApiResponse[BoardSettings])
async def get_settings(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    return ApiResponse(success=True, data=service.get_settings(board_id, current_user.id))


@router.put("/{board_id}/settings", response_model=ApiResponse[BoardSettings])
async def update_settings(
    board_id: int,
    patch: BoardSettingsPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    return ApiResponse(success=True, data=service.update_settings(board_id, patch, current_user.id))



# Elements --------------------------------------------------

@router.post(
    "/{board_id}/elements/batch",
    response_model=ApiResponse[SaveElementsResponse],
    status_code=status.HTTP_200_OK,
)
async def save_elements_batch(
    board_id: int,
    elements: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    result = service.save_elements(board_id, elements, current_user.id)
    return ApiResponse(success=True, data=result)


@router.get(
    "/{board_id}/elements",
    response_model=ApiResponse[List[BoardElementWithAuthor]],
)
async def load_elements(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    result = service.load_elements(board_id, current_user.id)
    return ApiResponse(success=True, data=result)


@router.post(
    "/{board_id}/upload-image",
    response_model=ApiResponse[UploadImageResponse],
)
async def upload_image(
    board_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload obrazu tablicy do Supabase Storage (nie przez Realtime Broadcast —
    patrz docs/known-issues.md #2). Frontend wywołuje to PRZED broadcastem
    element-created, żeby wysłać w wiadomości tylko URL, nie base64.
    """
    service = WhiteboardService(db)
    file_bytes = await file.read()
    url = await service.upload_image(
        board_id, current_user.id, file_bytes, file.content_type or "application/octet-stream"
    )
    return ApiResponse(success=True, data=UploadImageResponse(url=url))


@router.delete(
    "/{board_id}/elements/{element_id}",
    response_model=ApiResponse[DeleteElementResponse],
)
async def delete_element(
    board_id: int,
    element_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    result = service.delete_element(board_id, element_id, current_user.id, background_tasks)
    return ApiResponse(success=True, data=DeleteElementResponse(**result))