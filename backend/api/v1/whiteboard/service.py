"""
Logika biznesowa sesji whiteboard.

WhiteboardService obsługuje:
  set_online()          — oznacz usera jako online
  set_offline()         — oznacz usera jako offline
  get_online_users()    — lista online
  get_owner_info()      — info o właścicielu
  get_last_modifier()   — info o ostatnim modyfikatorze
  get_last_opened()     — kiedy user ostatnio otworzył
  save_elements()       — batch save elementów
  load_elements()       — ładowanie wszystkich elementów
  delete_element()      — usuń jeden element
"""
from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from core.exceptions import NotFoundError, AppException, ValidationError
from core.logging import get_logger
from core.models import Board, BoardElement, BoardUsers, User, WorkspaceMember

from .schemas import (
    BoardOwnerInfo, LastModifiedByInfo, LastOpenedInfo,
    OnlineUserInfo, BoardElementWithAuthor, SaveElementsResponse,
)

logger = get_logger(__name__)


class WhiteboardService:

    def __init__(self, db: Session):
        self.db = db

    def _get_board_or_404(self, board_id: int) -> Board:
        board = self.db.query(Board).filter(Board.id == board_id).first()
        if not board:
            raise NotFoundError("Tablica nie znaleziona")
        return board

    def _check_access(self, board: Board, user_id: int) -> None:
        member = self.db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == board.workspace_id,
            WorkspaceMember.user_id == user_id,
        ).first()
        if not member and board.created_by != user_id:
            raise AppException("Brak dostępu do tej tablicy", status_code=403)

    # ── Online presence ────────────────────────────────────────────────────

    def set_online(self, board_id: int, user_id: int) -> bool:
        board = self._get_board_or_404(board_id)
        self._check_access(board, user_id)

        board_user = self.db.query(BoardUsers).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.user_id == user_id,
        ).first()

        if board_user:
            board_user.is_online = True
            board_user.last_opened = datetime.utcnow()
        else:
            self.db.add(BoardUsers(
                board_id=board_id, user_id=user_id,
                is_online=True, is_favourite=False,
                last_opened=datetime.utcnow(),
            ))

        self.db.commit()
        return True

    def set_offline(self, board_id: int, user_id: int) -> bool:
        board_user = self.db.query(BoardUsers).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.user_id == user_id,
        ).first()
        if not board_user:
            return False
        board_user.is_online = False
        self.db.commit()
        return True

    def get_online_users(
        self, board_id: int, limit: int = 50, offset: int = 0
    ) -> List[OnlineUserInfo]:
        from datetime import timedelta, datetime
        active_threshold = datetime.utcnow() - timedelta(minutes=2)

        rows = (
            self.db.query(BoardUsers, User)
            .join(User, User.id == BoardUsers.user_id)
            .filter(
                BoardUsers.board_id == board_id, 
                BoardUsers.is_online == True,
                BoardUsers.last_opened >= active_threshold
            )
            .offset(offset).limit(limit)
            .all()
        )
        return [OnlineUserInfo(user_id=u.id, username=u.username, avatar_url=u.avatar_url) for _, u in rows]

    def get_online_users_batch(self, board_ids: List[int]) -> Dict[int, List[OnlineUserInfo]]:
        unique_board_ids = sorted(set(board_ids))
        if not unique_board_ids:
            return {}

        from datetime import timedelta, datetime
        active_threshold = datetime.utcnow() - timedelta(minutes=2)

        rows = (
            self.db.query(BoardUsers.board_id, User)
            .join(User, User.id == BoardUsers.user_id)
            .filter(
                BoardUsers.board_id.in_(unique_board_ids),
                BoardUsers.is_online == True,
                BoardUsers.last_opened >= active_threshold
            )
            .all()
        )

        by_board: Dict[int, List[OnlineUserInfo]] = {board_id: [] for board_id in unique_board_ids}
        for board_id, user in rows:
            by_board[board_id].append(OnlineUserInfo(user_id=user.id, username=user.username, avatar_url=user.avatar_url))

        return by_board

    # ── Board metadata ─────────────────────────────────────────────────────

    def get_owner_info(self, board_id: int) -> BoardOwnerInfo:
        board = self._get_board_or_404(board_id)
        owner = self.db.query(User).filter(User.id == board.created_by).first()
        if not owner:
            raise NotFoundError("Właściciel tablicy nie znaleziony")
        return BoardOwnerInfo(user_id=owner.id, username=owner.username)

    def get_last_modifier(self, board_id: int) -> LastModifiedByInfo:
        board = self._get_board_or_404(board_id)
        uid = board.last_modified_by or board.created_by
        user = self.db.query(User).filter(User.id == uid).first()
        if not user:
            raise NotFoundError("Ostatni modyfikator nie znaleziony")
        return LastModifiedByInfo(user_id=user.id, username=user.username)

    def get_last_opened(self, board_id: int, user_id: int) -> LastOpenedInfo:
        board_user = self.db.query(BoardUsers).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.user_id == user_id,
        ).first()
        if not board_user or not board_user.last_opened:
            raise NotFoundError("Brak informacji o ostatnim otwarciu")
        user = self.db.query(User).filter(User.id == user_id).first()
        return LastOpenedInfo(
            user_id=user_id,
            username=user.username if user else "Unknown",
            last_opened=board_user.last_opened,
        )

    # ── Elements ───────────────────────────────────────────────────────────

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
        self._check_access(board, user_id)

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
        self._check_access(board, user_id)

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

    def delete_element(
        self, board_id: int, element_id: str, user_id: int
    ) -> dict:
        board = self._get_board_or_404(board_id)
        self._check_access(board, user_id)

        element = self.db.query(BoardElement).filter(
            BoardElement.board_id == board_id,
            BoardElement.element_id == element_id,
        ).first()

        if not element:
            raise NotFoundError("Element nie znaleziony")

        self.db.delete(element)
        self.db.commit()
        return {"success": True, "message": "Element usunięty"}