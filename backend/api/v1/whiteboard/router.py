"""
Whiteboard router — /api/v1/whiteboard/{board_id}/*

POST   /{id}/opened                 — zanotuj otwarcie tablicy (last_opened + presence)
GET    /{id}/settings               — ustawienia tablicy
PUT    /{id}/settings               — aktualizacja ustawień tablicy
POST   /{id}/doc                    — zapisz snapshot Y.Doc
GET    /{id}/doc                    — wczytaj snapshot Y.Doc
GET    /{id}/access                 — sprawdź dostęp do tablicy
"""
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from core.database import get_db
from core.models import User
from core.responses import ApiResponse

from .schemas import (
    OnlineStatusResponse, UploadImageResponse,
    BoardSettings, BoardSettingsPatch,
    SaveDocumentRequest, SaveDocumentResponse, DocumentResponse,
    AccessCheckResponse,
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
def get_settings(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    return ApiResponse(success=True, data=service.get_settings(board_id, current_user.id))


@router.put("/{board_id}/settings", response_model=ApiResponse[BoardSettings])
def update_settings(
    board_id: int,
    patch: BoardSettingsPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    return ApiResponse(success=True, data=service.update_settings(board_id, patch, current_user.id))

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

# Document (Yjs snapshot) --------------------------------------------------

@router.post(
    "/{board_id}/doc",
    response_model=ApiResponse[SaveDocumentResponse],
)
def save_document(
    board_id: int,
    request: SaveDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    service.save_document(board_id, request.snapshot, current_user.id)
    return ApiResponse(success=True, data=SaveDocumentResponse(success=True))

@router.get(
    "/{board_id}/doc",
    response_model=ApiResponse[DocumentResponse],
)
def get_document(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    result = service.load_document(board_id, current_user.id)
    return ApiResponse(success=True, data=result)

# Access check --------------------------------------------------

@router.get(
    "/{board_id}/access",
    response_model=ApiResponse[AccessCheckResponse],
)
def check_access(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = WhiteboardService(db)
    result = service.check_access(board_id, current_user.id)
    return ApiResponse(success=True, data=result)
