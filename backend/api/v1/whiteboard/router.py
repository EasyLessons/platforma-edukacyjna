"""
Whiteboard router — /api/v1/whiteboard/{board_id}/*

POST   /{id}/online                 — oznacz jako online
DELETE /{id}/online                 — oznacz jako offline
GET    /{id}/online-users           — lista online
GET    /{id}/owner                  — info o właścicielu
GET    /{id}/last-modified-by       — ostatni modyfikator
GET    /{id}/last-opened            — ostatnie otwarcie (dla aktualnego usera)
POST   /{id}/elements/batch         — batch save elementów
GET    /{id}/elements               — załaduj wszystkie elementy
DELETE /{id}/elements/{element_id}  — usuń element
"""
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from core.database import get_db
from core.exceptions import NotFoundError
from core.models import User
from core.responses import ApiResponse

from .schemas import (
    BoardOwnerInfo, LastModifiedByInfo, LastOpenedInfo,
    OnlineUserInfo, OnlineStatusResponse, OnlineUsersBatchRequest, OnlineUsersBatchResponse,
    BoardElement, BoardElementWithAuthor,
    SaveElementsResponse, DeleteElementResponse, UploadImageResponse,
)
from .service import WhiteboardService

router = APIRouter(tags=["Whiteboard"])


# ── Online presence ────────────────────────────────────────────────────────

@router.post("/{board_id}/online", response_model=ApiResponse[OnlineStatusResponse])
async def mark_online(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    service.set_online(board_id, current_user.id)
    return ApiResponse(success=True, data=OnlineStatusResponse(
        status="online", board_id=board_id, user_id=current_user.id
    ))


@router.delete("/{board_id}/online", response_model=ApiResponse[OnlineStatusResponse])
async def mark_offline(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    if not service.set_offline(board_id, current_user.id):
        raise NotFoundError("Tablica nie znaleziona lub brak dostępu")
    return ApiResponse(success=True, data=OnlineStatusResponse(
        status="offline", board_id=board_id, user_id=current_user.id
    ))


@router.get("/{board_id}/online-users", response_model=ApiResponse[List[OnlineUserInfo]])
async def get_online_users(
    board_id: int,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    service = WhiteboardService(db)
    result = service.get_online_users(board_id, limit, offset)
    return ApiResponse(success=True, data=result)


@router.post("/online-users/batch", response_model=ApiResponse[OnlineUsersBatchResponse])
async def get_online_users_batch(
    payload: OnlineUsersBatchRequest,
    db: Session = Depends(get_db),
):
    service = WhiteboardService(db)
    result = service.get_online_users_batch(payload.board_ids)
    return ApiResponse(success=True, data=OnlineUsersBatchResponse(online_users_by_board=result))


# ── Board metadata ─────────────────────────────────────────────────────────

@router.get("/{board_id}/owner", response_model=ApiResponse[BoardOwnerInfo])
async def get_owner(board_id: int, db: Session = Depends(get_db)):
    service = WhiteboardService(db)
    return ApiResponse(success=True, data=service.get_owner_info(board_id))


@router.get("/{board_id}/last-modified-by", response_model=ApiResponse[LastModifiedByInfo])
async def get_last_modified_by(board_id: int, db: Session = Depends(get_db)):
    service = WhiteboardService(db)
    return ApiResponse(success=True, data=service.get_last_modifier(board_id))


@router.get("/{board_id}/last-opened", response_model=ApiResponse[LastOpenedInfo])
async def get_last_opened(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    return ApiResponse(success=True, data=service.get_last_opened(board_id, current_user.id))


# ── Elements ───────────────────────────────────────────────────────────────

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