"""
Share links service - wielorazowe, tokenowe linki dołączające do workspace'a.

ShareLinkService obsługuje:
    get_or_create_link() - generowanie linku (reużywa istniejący aktywny, jeśli jest)
    revoke_link() - ręczne unieważnienie linku
    refresh_link() - unieważnia stary + tworzy nowy, atomowo
    preview_link() - podgląd przed dołączeniem (bez zapisu do bazy)
    join_via_link() - faktyczne dołączenie do workspace'a
"""
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from core.exceptions import NotFoundError, AppException
from core.logging import get_logger
from core.models import Board, Workspace, WorkspaceMember, WorkspaceShareLink

from ..authorization import require_editor_or_owner
from .schemas import ShareLinkResponse, ShareLinkPreview, JoinShareLinkResponse

logger = get_logger(__name__)

SHARE_LINK_BACKSTOP_TTL_DAYS = 90


class ShareLinkService:
    def __init__(self, db: Session):
        self.db = db

    def _find_active_link(self, workspace_id: int, board_id: int | None) -> WorkspaceShareLink | None:
        """Szuka jeszcze ważnego (nieuchylonego i niewygasłego) linku dla danej pary workspace/board."""
        query = self.db.query(WorkspaceShareLink).filter(
            WorkspaceShareLink.workspace_id == workspace_id,
            WorkspaceShareLink.revoked_at.is_(None),
            WorkspaceShareLink.expires_at > datetime.utcnow(),
        )
        if board_id is None:
            query = query.filter(WorkspaceShareLink.board_id.is_(None))
        else:
            query = query.filter(WorkspaceShareLink.board_id == board_id)
        return query.first()

    def _validate_board(self, workspace_id: int, board_id: int) -> None:
        board = self.db.query(Board).filter(Board.id == board_id).first()
        if not board:
            raise NotFoundError("Tablica nie znaleziona")
        if board.workspace_id != workspace_id:
            raise AppException("Tablica nie należy do tego workspace'a", status_code=400)

    def get_or_create_link(self, workspace_id: int, board_id: int | None, user_id: int) -> ShareLinkResponse:
        require_editor_or_owner(self.db, workspace_id, user_id)
        if board_id is not None:
            self._validate_board(workspace_id, board_id)

        existing = self._find_active_link(workspace_id, board_id)
        if existing:
            return ShareLinkResponse.model_validate(existing)

        link = WorkspaceShareLink(
            workspace_id=workspace_id,
            board_id=board_id,
            token=secrets.token_urlsafe(32),
            expires_at=datetime.utcnow() + timedelta(days=SHARE_LINK_BACKSTOP_TTL_DAYS),
        )
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        logger.info(f"Share link utworzony dla workspace {workspace_id} (board_id={board_id})")
        return ShareLinkResponse.model_validate(link)

    def revoke_link(self, workspace_id: int, token: str, user_id: int) -> dict:
        require_editor_or_owner(self.db, workspace_id, user_id)

        link = self.db.query(WorkspaceShareLink).filter(
            WorkspaceShareLink.workspace_id == workspace_id,
            WorkspaceShareLink.token == token,
        ).first()
        if not link:
            raise NotFoundError("Link nie znaleziony")

        link.revoked_at = datetime.utcnow()
        self.db.commit()
        logger.info(f"Share link unieważniony dla workspace {workspace_id}")
        return {"message": "Link został unieważniony"}

    def refresh_link(self, workspace_id: int, board_id: int | None, user_id: int) -> ShareLinkResponse:
        require_editor_or_owner(self.db, workspace_id, user_id)
        if board_id is not None:
            self._validate_board(workspace_id, board_id)

        existing = self._find_active_link(workspace_id, board_id)
        if existing:
            existing.revoked_at = datetime.utcnow()

        new_link = WorkspaceShareLink(
            workspace_id=workspace_id,
            board_id=board_id,
            token=secrets.token_urlsafe(32),
            expires_at=datetime.utcnow() + timedelta(days=SHARE_LINK_BACKSTOP_TTL_DAYS),
        )
        self.db.add(new_link)
        self.db.commit()
        self.db.refresh(new_link)
        logger.info(f"Share link odświeżony dla workspace {workspace_id} (board_id={board_id})")
        return ShareLinkResponse.model_validate(new_link)

    def preview_link(self, token: str, user_id: int) -> ShareLinkPreview:
        link = self.db.query(WorkspaceShareLink).filter(WorkspaceShareLink.token == token).first()
        if not link:
            raise NotFoundError("Link nie istnieje")
        if link.revoked_at is not None:
            raise AppException("Link został unieważniony", status_code=410)
        if link.expires_at < datetime.utcnow():
            raise AppException("Link wygasł", status_code=410)

        workspace = self.db.query(Workspace).filter(Workspace.id == link.workspace_id).first()
        if not workspace:
            raise NotFoundError("Workspace nie znaleziony")

        already_member = self.db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == link.workspace_id,
            WorkspaceMember.user_id == user_id,
        ).first() is not None

        board_name = None
        if link.board_id is not None:
            board = self.db.query(Board).filter(Board.id == link.board_id).first()
            board_name = board.name if board else None

        return ShareLinkPreview(
            workspace_id=workspace.id,
            workspace_name=workspace.name,
            workspace_icon=workspace.icon,
            board_id=link.board_id,
            board_name=board_name,
            already_member=already_member,
        )

    def join_via_link(self, token: str, user_id: int) -> JoinShareLinkResponse:
        link = self.db.query(WorkspaceShareLink).filter(WorkspaceShareLink.token == token).first()
        if not link:
            raise NotFoundError("Link nie istnieje")
        if link.revoked_at is not None:
            raise AppException("Link został unieważniony", status_code=410)
        if link.expires_at < datetime.utcnow():
            raise AppException("Link wygasł", status_code=410)

        workspace = self.db.query(Workspace).filter(Workspace.id == link.workspace_id).first()
        if not workspace:
            raise NotFoundError("Workspace nie znaleziony")

        existing_member = self.db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == link.workspace_id, 
            WorkspaceMember.user_id == user_id
        ).first()

        if existing_member:
            return JoinShareLinkResponse(
                message="Już jesteś członkiem tego workspace'a",
                workspace_id=workspace.id,
                workspace_name=workspace.name,
                board_id=link.board_id,
                role=existing_member.role,
                already_member=True
            )

        new_member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user_id,
            role="editor",
            is_favourite=False,
            joined_at=datetime.utcnow()
        )
        self.db.add(new_member)
        self.db.commit()
        logger.info(f"User {user_id} dołączył do workspace {workspace.id} poprzez share link")

        return JoinShareLinkResponse(
            message=f"Dołączono do workspace'a '{workspace.name}'",
            workspace_id=workspace.id,
            workspace_name=workspace.name,
            board_id=link.board_id,
            role="editor",
            already_member=False
        )
        