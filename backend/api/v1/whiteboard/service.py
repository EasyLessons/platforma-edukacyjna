"""
Logika biznesowa sesji whiteboard.

WhiteboardService obsługuje:
- presence, 
- ustawienia tablicy, 
- upload obrazów, 
- snapshot dokumentu Yjs,
- sprawdzanie dostępu.
"""
import base64
import binascii
from datetime import datetime
from sqlalchemy.orm import Session
from core.exceptions import NotFoundError, ValidationError
from core.models import Board, BoardDocument, BoardUsers, User, WorkspaceMember
from .schemas import (
    BoardSettings, BoardSettingsPatch,
    DocumentResponse, AccessCheckResponse,
)
from .storage import upload_board_image
from core.presence import PresenceService
from api.v1.workspaces.authorization import require_membership, require_board_owner


class WhiteboardService:

    def __init__(self, db: Session, presence: PresenceService | None = None):
        self.db = db
        self.presence = presence or PresenceService(db)

    def _get_board_or_404(self, board_id: int) -> Board:
        board = self.db.query(Board).filter(Board.id == board_id).first()
        if not board:
            raise NotFoundError("Tablica nie znaleziona")
        return board

    def _get_board_for_member(self, board_id: int, user_id: int) -> Board:
        """Tablica, jeśli user jest członkiem workspace'a."""
        board = (
            self.db.query(Board)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Board.workspace_id)
            .filter(Board.id == board_id, WorkspaceMember.user_id == user_id)
            .first()
        )
        if board:
            return board
        # Rozróżnienie braku tablicy od braku dostępu
        self._get_board_or_404(board_id)
        raise NotFoundError("Nie masz dostępu do tej tablicy (nie jesteś członkiem workspace'a)")

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

    # Image upload --------------------------------------------------

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
        """
        board = self._get_board_or_404(board_id)
        require_membership(self.db, board.workspace_id, user_id)
        return await upload_board_image(board_id, file_bytes, content_type)

    # Document (Yjs snapshot) --------------------------------------------------

    def save_document(self, board_id: int, snapshot_base64: str, user_id: int) -> None:
        self._get_board_for_member(board_id, user_id)

        try:
            snapshot = base64.b64decode(snapshot_base64, validate=True)
        except (binascii.Error, ValueError):
            raise ValidationError("Niepoprawny base64 snapshot")
        if not snapshot:
            raise ValidationError("Pusty snapshot")

        existing = self.db.query(BoardDocument).filter(
            BoardDocument.board_id == board_id
        ).first()

        if existing:
            existing.snapshot = snapshot
            existing.updated_at = datetime.utcnow()
        else:
            self.db.add(BoardDocument(
                board_id=board_id,
                snapshot=snapshot,
                updated_at=datetime.utcnow(),
            ))
        self.db.commit()

    def load_document(self, board_id: int, user_id: int) -> DocumentResponse:
        self._get_board_for_member(board_id, user_id)

        doc = self.db.query(BoardDocument).filter(
            BoardDocument.board_id == board_id
        ).first()
        if not doc:
            return DocumentResponse(snapshot=None, updated_at=None)

        return DocumentResponse(
            snapshot=base64.b64encode(doc.snapshot).decode("ascii"),
            updated_at=doc.updated_at,
        )

    # Access check --------------------------------------------------

    def check_access(self, board_id: int, user: User) -> AccessCheckResponse:
        """Sprawdza czy użytkownik ma dostęp do tablicy i zwraca info o nim."""
        self._get_board_for_member(board_id, user.id)

        return AccessCheckResponse(
            has_access=True,
            user_id=user.id,
            username=user.username,
        )
