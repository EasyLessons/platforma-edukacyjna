"""
Logika biznesowa CRUD tablic.

BoardService obsługuje:
  create_board()      — tworzenie
  get_board()         — pobieranie pojedynczej
  list_boards()       — lista w workspace
  update_board()      — aktualizacja
  delete_board()      — usuwanie
  toggle_favourite()  — ulubione
  update_settings()   — ustawienia tablicy
  get_online_users_by_workspace()  — kto jest online (deleguje do core.presence.PresenceService)
"""
from datetime import datetime
from sqlalchemy.orm import Session, joinedload

from core.exceptions import NotFoundError, AppException
from core.logging import get_logger
from core.models import Board, BoardUsers, User, Workspace, WorkspaceMember
from core.presence import PresenceService

from api.v1.workspaces.authorization import require_membership

from .schemas import (
    CreateBoard, UpdateBoard, ToggleFavourite,
    BoardResponse, BoardListResponse, BoardSettings,
    ToggleFavouriteResponse, UpdateBoardSettings, OnlineUsersResponse
)

logger = get_logger(__name__)


def _build_board_response(
    db: Session, board: Board, user_id: int
) -> BoardResponse:
    """Helper — buduje BoardResponse z ORM obiektu."""
    owner = db.query(User).filter(User.id == board.created_by).first()
    modifier = (
        db.query(User).filter(User.id == board.last_modified_by).first()
        if board.last_modified_by else owner
    )
    board_user = db.query(BoardUsers).filter(
        BoardUsers.board_id == board.id,
        BoardUsers.user_id == user_id,
    ).first()

    return BoardResponse(
        id=board.id,
        name=board.name,
        icon=board.icon,
        bg_color=board.bg_color,
        workspace_id=board.workspace_id,
        owner_id=board.created_by,
        owner_username=owner.username if owner else "Unknown",
        is_favourite=board_user.is_favourite if board_user else False,
        settings=BoardSettings(**(board.settings or {})),
        last_modified=board.last_modified,
        last_modified_by=modifier.username if modifier else None,
        last_opened=board_user.last_opened if board_user else None,
        created_at=board.created_at,
        created_by=owner.username if owner else "Unknown",
    )

def create_starter_board(db: Session, workspace_id: int, user_id: int) -> Board:
    """Tworzy domyślną tablicę dla nowego workspace'a. Nie commituje - wołający zarządza transakcją."""
    board = Board(
        name="Moja pierwsza tablica",
        icon="PenTool",
        bg_color="bg-gray-500",
        workspace_id=workspace_id,
        created_by=user_id,
        created_at=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        last_modified_by=user_id,
    )
    db.add(board)
    db.flush()

    board_user = BoardUsers(
        board_id=board.id,
        user_id=user_id,
        is_favourite=False,
        last_opened=datetime.utcnow(),
    )
    db.add(board_user)
    return board


class BoardService:

    def __init__(self, db: Session):
        self.db = db

    def _get_board_or_404(self, board_id: int) -> Board:
        board = self.db.query(Board).filter(Board.id == board_id).first()
        if not board:
            raise NotFoundError("Tablica nie znaleziona")
        return board

    def _check_access(self, board: Board, user_id: int) -> None:
        """Rzuca 403 jeśli user nie ma dostępu do tablicy."""
        member = self.db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == board.workspace_id,
            WorkspaceMember.user_id == user_id,
        ).first()
        if not member and board.created_by != user_id:
            raise AppException("Brak dostępu do tej tablicy", status_code=403)

    async def create_board(self, board_data: CreateBoard, user_id: int) -> BoardResponse:
        workspace = self.db.query(Workspace).filter(
            Workspace.id == board_data.workspace_id
        ).first()
        if not workspace:
            raise NotFoundError("Workspace nie znaleziony")

        board = Board(
            name=board_data.name,
            icon=board_data.icon or "PenTool",
            bg_color=board_data.bg_color or "bg-gray-500",
            workspace_id=board_data.workspace_id,
            created_by=user_id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow(),
            last_modified_by=user_id,
        )
        self.db.add(board)
        self.db.flush()

        board_user = BoardUsers(
            board_id=board.id,
            user_id=user_id,
            is_favourite=False,
            last_opened=datetime.utcnow(),
        )
        self.db.add(board_user)
        self.db.commit()
        self.db.refresh(board)
        
        logger.info(f"Tablica utworzona: {board.id} przez {user_id}")
        return _build_board_response(self.db, board, user_id)

    async def get_board(self, board_id: int, user_id: int) -> BoardResponse:
        board = self._get_board_or_404(board_id)
        self._check_access(board, user_id)
        return _build_board_response(self.db, board, user_id)

    async def list_boards(
        self, workspace_id: int, user_id: int, limit: int = 10, offset: int = 0
    ) -> BoardListResponse:
        base_query = self.db.query(Board).filter(Board.workspace_id == workspace_id)
        total = base_query.count()

        boards_data = (
            self.db.query(Board, BoardUsers.is_favourite, BoardUsers.last_opened)
            .outerjoin(BoardUsers, (Board.id == BoardUsers.board_id) & (BoardUsers.user_id == user_id))
            .options(
                joinedload(Board.creator),
                joinedload(Board.last_modifier)
            )
            .filter(Board.workspace_id == workspace_id)
            .order_by(Board.last_modified.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
    
        responses = []
        for board, is_favourite, last_opened in boards_data:
            try:
                owner = board.creator
                modifier = board.last_modifier or owner
                
                responses.append(BoardResponse(
                    id=board.id,
                    name=board.name,
                    icon=board.icon,
                    bg_color=board.bg_color,
                    workspace_id=board.workspace_id,
                    owner_id=board.created_by,
                    owner_username=owner.username if owner else "Unknown",
                    is_favourite=is_favourite or False,
                    settings=BoardSettings(**(board.settings or {})),
                    last_modified=board.last_modified,
                    last_modified_by=modifier.username if modifier else None,
                    last_opened=last_opened,
                    created_at=board.created_at,
                    created_by=owner.username if owner else "Unknown",
                ))
            except Exception as e:
                logger.error(f"Błąd budowania BoardResponse dla {board.id}: {e}")
                continue

        return BoardListResponse(
            boards=responses, total=total, limit=limit, offset=offset
        )

    async def update_board(self, board_id: int, data: UpdateBoard, user_id: int) -> BoardResponse:
        board = self._get_board_or_404(board_id)
        self._check_access(board, user_id)

        if data.name is not None:
            board.name = data.name
        if data.icon is not None:
            board.icon = data.icon
        if data.bg_color is not None:
            board.bg_color = data.bg_color

        board.last_modified = datetime.utcnow()
        board.last_modified_by = user_id
        self.db.commit()
        self.db.refresh(board)

        logger.info(f"Tablica zaktualizowana: {board_id}")
        return _build_board_response(self.db, board, user_id)

    async def delete_board(self, board_id: int, user_id: int) -> dict:
        board = self._get_board_or_404(board_id)
        if board.created_by != user_id:
            raise AppException("Tylko właściciel może usunąć tablicę", status_code=403)

        self.db.delete(board)
        self.db.commit()

        # 🛠️ Sprzątanie Storage — patrz docs/known-issues.md #2, pytanie usera
        # o "zapychanie się" Storage. Bez tego obrazy skasowanej tablicy
        # zostałyby tam na zawsze (sieroty). Best-effort, PO commicie do bazy
        # (usunięcie tablicy z bazy jest tym co naprawdę musi się udać;
        # nieudane sprzątnięcie plików to dużo mniejszy problem).
        from api.v1.whiteboard.storage import delete_board_folder
        await delete_board_folder(board_id)

        logger.info(f"✅ Tablica usunięta: {board_id}")
        return {"success": True, "message": "Tablica została pomyślnie usunięta."}

    async def toggle_favourite(
        self, board_id: int, toggle_data: ToggleFavourite, user_id: int
    ) -> ToggleFavouriteResponse:
        board_user = self.db.query(BoardUsers).filter(
            BoardUsers.board_id == board_id,
            BoardUsers.user_id == user_id,
        ).first()

        if not board_user:
            self._get_board_or_404(board_id)
            board_user = BoardUsers(
                board_id=board_id, 
                user_id=user_id,
                is_favourite=toggle_data.is_favourite,
                last_opened=None,
            )
            self.db.add(board_user)
        else:
            board_user.is_favourite = toggle_data.is_favourite

        self.db.commit()
        self.db.refresh(board_user)
        return ToggleFavouriteResponse(
            is_favourite=board_user.is_favourite,
            message="Ulubiona tablica zaktualizowana.",
        )

    async def update_settings(
        self, board_id: int, body: UpdateBoardSettings, user_id: int
    ) -> dict:
        board = self._get_board_or_404(board_id)
        if board.created_by != user_id:
            raise AppException("Tylko właściciel może zmieniać ustawienia", status_code=403)

        board.settings = body.settings.model_dump()
        self.db.commit()
        self.db.refresh(board)
        return {"success": True, "settings": board.settings}

    async def get_online_users_by_workspace(self, workspace_id: int, user_id: int) -> OnlineUsersResponse:
        """Kto jest online na podanych tablicach workspace'u."""
        require_membership(self.db, workspace_id, user_id)

        board_ids = [
            b.id for b in self.db.query(Board.id)
                .filter(Board.workspace_id == workspace_id).all()
        ]

        presence = PresenceService(self.db)
        result = await presence.get_online_users(board_ids)
        return OnlineUsersResponse(online_users_by_board=result)