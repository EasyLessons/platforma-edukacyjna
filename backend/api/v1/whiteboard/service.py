"""
Logika biznesowa sesji whiteboard.

WhiteboardService obsługuje:
  mark_opened()         — zanotuj otwarcie tablicy (last_opened + presence)
  save_elements()       — batch save elementów
  load_elements()       — ładowanie wszystkich elementów
  delete_element()      — usuń jeden element
"""
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.exceptions import NotFoundError, ValidationError
from core.logging import get_logger
from core.models import Board, BoardElement, BoardUsers, User

from .schemas import (
    BoardElementWithAuthor, SaveElementsResponse,
    BoardSettings, BoardSettingsPatch
)
from .storage import upload_board_image, delete_board_image
from core.presence import PresenceService
from api.v1.workspaces.authorization import require_membership, require_board_owner

logger = get_logger(__name__)

IMAGE_DELETE_GRACE_PERIOD_SECONDS = 90.0


async def _cleanup_image_after_delay(src: str, delay_seconds: float = IMAGE_DELETE_GRACE_PERIOD_SECONDS) -> None:
    """
    Wołane w tle (FastAPI BackgroundTasks) po usunięciu elementu-obrazu.
    Czeka `delay_seconds` (margines na undo), otwiera WŁASNĄ, krótkotrwałą
    sesję bazy (nie tę z requestu — ta jest już zamknięta/zamyka się zaraz
    po odpowiedzi, a trzymanie jej otwartej przez 90s tylko po to żeby
    „poczekać” marnowałoby połączenie do Neon), sprawdza czy w międzyczasie
    ten sam URL nie wrócił na tablicę (undo), i dopiero wtedy kasuje plik.
    """
    await asyncio.sleep(delay_seconds)

    db = SessionLocal()
    try:
        still_used = db.query(BoardElement).filter(
            BoardElement.data["src"].astext == src
        ).first()
    finally:
        db.close()

    if still_used:
        logger.info(f"Obraz {src} nadal używany (prawdopodobnie undo) — pomijam kasowanie ze Storage")
        return

    await delete_board_image(src)


class WhiteboardService:

    def __init__(self, db: Session, presence: PresenceService | None = None):
        self.db = db
        self.presence = presence or PresenceService(db)

    def _get_board_or_404(self, board_id: int) -> Board:
        board = self.db.query(Board).filter(Board.id == board_id).first()
        if not board:
            raise NotFoundError("Tablica nie znaleziona")
        return board

    # Online presence --------------------------------------------------

    async def mark_opened(self, board_id: int, user_id: int) -> bool:
        """Notuje otwarcie tablicy: last_opened w Postgresie + presence w Redisie."""
        board = self._get_board_or_404(board_id)
        require_membership(self.db, board.workspace_id, user_id)

        board_user = self.db.query(BoardUsers).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.user_id == user_id,
        ).first()

        if board_user:
            board_user.last_opened = datetime.utcnow()
        else:
            self.db.add(BoardUsers(
                board_id=board_id,
                user_id=user_id,
                is_favourite=False,
                last_opened=datetime.utcnow(),
            ))

        self.db.commit()
        await self.presence.mark_online(board_id, user_id)
        return True

    # Settings --------------------------------------------------

    def get_settings(self, board_id: int, user_id: int) -> BoardSettings:
        board = self._get_board_or_404(board_id)
        require_membership(self.db, board.workspace_id, user_id)
        return BoardSettings(**(board.settings or {}))

    def update_settings(self, board_id: int, patch: BoardSettingsPatch, user_id: int) -> BoardSettings:
        board = self._get_board_or_404(board_id)
        require_board_owner(self.db, board, user_id, message="Tylko właściciel tablicy może zmienić jej ustawienia")

        effective = BoardSettings(**(board.settings or {})).model_dump()
        board.settings = {**effective, **patch.model_dump(exclude_unset=True)}
        self.db.commit()
        self.db.refresh(board)
        return BoardSettings(**board.settings)

    # Elements --------------------------------------------------

    def save_elements(
        self,
        board_id: int,
        elements: List[Dict[str, Any]],
        user_id: int,
    ) -> SaveElementsResponse:
        if not elements:
            raise ValidationError("Lista elementów jest pusta")
        if len(elements) > 100:
            raise ValidationError("Zbyt wiele elementów (maksymalnie 100)")

        board = self._get_board_or_404(board_id)
        require_membership(self.db, board.workspace_id, user_id)

        saved = 0
        for el in elements:
            element_id = el.get("element_id")
            if not element_id:
                continue

            existing = self.db.query(BoardElement).filter(
                BoardElement.board_id == board_id,
                BoardElement.element_id == element_id,
            ).first()

            if existing:
                existing.type = el.get("type", existing.type)
                existing.data = el.get("data", existing.data)
            else:
                self.db.add(BoardElement(
                    board_id=board_id,
                    element_id=element_id,
                    type=el.get("type", "unknown"),
                    data=el.get("data", {}),
                    created_by=user_id,
                    created_at=datetime.utcnow(),
                ))
            saved += 1

        # Aktualizuj last_modified na tablicy
        board.last_modified = datetime.utcnow()
        board.last_modified_by = user_id
        self.db.commit()

        return SaveElementsResponse(success=True, saved=saved)

    def load_elements(
        self, board_id: int, user_id: int
    ) -> List[BoardElementWithAuthor]:
        board = self._get_board_or_404(board_id)
        require_membership(self.db, board.workspace_id, user_id)

        elements = self.db.query(BoardElement).filter(
            BoardElement.board_id == board_id
        ).all()

        # Pobierz wszystkich twórców jednym zapytaniem
        creator_ids = {el.created_by for el in elements if el.created_by}
        creators = {
            u.id: u for u in
            self.db.query(User).filter(User.id.in_(creator_ids)).all()
        } if creator_ids else {}

        return [
        BoardElementWithAuthor(
            element_id=el.element_id,
            type=el.type,
            data=el.data,
            created_by_id=el.created_by,
            created_by_username=creators.get(el.created_by).username if el.created_by and el.created_by in creators else None,
            created_at=el.created_at,
        )
        for el in elements
    ]

    async def upload_image(
        self,
        board_id: int,
        user_id: int,
        file_bytes: bytes,
        content_type: str,
    ) -> str:
        """
        Sprawdza dostęp do tablicy, uploaduje obraz do Supabase Storage
        (storage.py), zwraca publiczny URL do wpisania w element.src.

        Patrz docs/known-issues.md #2 — obraz nie jedzie już przez
        Realtime Broadcast, żeby nie łamać limitu 256 KB na wiadomość.
        """
        board = self._get_board_or_404(board_id)
        require_membership(self.db, board.workspace_id, user_id)
        return await upload_board_image(board_id, file_bytes, content_type)

    def delete_element(
        self,
        board_id: int,
        element_id: str,
        user_id: int,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> dict:
        board = self._get_board_or_404(board_id)
        require_membership(self.db, board.workspace_id, user_id)

        element = self.db.query(BoardElement).filter(
            BoardElement.board_id == board_id,
            BoardElement.element_id == element_id,
        ).first()

        if not element:
            raise NotFoundError("Element nie znaleziony")

        if element.type == "image" and background_tasks is not None:
            src = (element.data or {}).get("src")
            if isinstance(src, str) and src:
                background_tasks.add_task(_cleanup_image_after_delay, src)

        self.db.delete(element)
        self.db.commit()
        return {"success": True, "message": "Element usunięty"}