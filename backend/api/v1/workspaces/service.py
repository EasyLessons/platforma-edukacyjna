"""
Workspace service — CRUD workspace'ów.
"""
from datetime import datetime
from typing import List

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, select as sa_select
from api.v1.boards.service import BoardService

from core.exceptions import NotFoundError, AppException
from core.models import Board, User, Workspace, WorkspaceMember
from .schemas import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse,
    UserBasic,
)

def _build_workspace_with_owner(
        db: Session, *, name: str, icon: str, bg_color: str, user_id: int, is_favourite: bool
) -> tuple[Workspace, WorkspaceMember]:
    """Tworzy Workspace + WorkspaceMember (owner). Nie commituje - wołający zarządza transakcją."""
    workspace = Workspace(
        name=name,
        icon=icon,
        bg_color=bg_color,
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    db.add(workspace)
    db.flush()

    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user_id,
        role="owner",
        is_favourite=is_favourite,
        joined_at=datetime.utcnow(),
    )
    db.add(membership)
    return workspace, membership

def _build_workspace_response(
    db: Session, workspace: Workspace, user_id: int, membership: WorkspaceMember
) -> WorkspaceResponse:
    member_count = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace.id)
        .count()
    )
    board_count = (
        db.query(Board)
        .filter(Board.workspace_id == workspace.id)
        .count()
    )
    is_owner = workspace.created_by == user_id
    creator = db.query(User).filter(User.id == workspace.created_by).first()

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        icon=workspace.icon,
        bg_color=workspace.bg_color,
        created_by=workspace.created_by,
        creator=UserBasic(
            id=creator.id,
            username=creator.username,
            email=creator.email,
            full_name=creator.full_name,
        ) if creator else None,
        member_count=member_count,
        board_count=board_count,
        is_owner=is_owner,
        role="owner" if is_owner else membership.role,
        is_favourite=membership.is_favourite,
    )

def create_starter_workspace(db: Session, user_id: int) -> Workspace:
    """Tworzy domyślny workspace dla nowego użytkownika. Nie commituje."""
    workspace, _ = _build_workspace_with_owner(
        db,
        name="Moja przestrzeń",
        icon="Home",
        bg_color="bg-green-500",
        user_id=user_id,
        is_favourite=True,
    )
    return workspace


class WorkspaceService:
    def __init__(self, db: Session):
        self.db = db

    def get_user_workspaces(self, user_id: int) -> List[WorkspaceResponse]:
        """Pobiera wszystkie workspace'y w 1 zapytaniu SQL."""
        db = self.db
        member_count_sq = (
            sa_select(func.count(WorkspaceMember.id))
            .where(WorkspaceMember.workspace_id == Workspace.id)
            .correlate(Workspace)
            .scalar_subquery()
        )

        board_count_sq = (
            sa_select(func.count(Board.id))
            .where(Board.workspace_id == Workspace.id)
            .correlate(Workspace)
            .scalar_subquery()
        )

        rows = (
            db.query(
                WorkspaceMember,
                Workspace,
                User,
                member_count_sq.label("member_count"),
                board_count_sq.label("board_count"),
            )
            .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
            .join(User, Workspace.created_by == User.id)
            .filter(WorkspaceMember.user_id == user_id)
            .all()
        )

        workspaces_data = []
        for membership, workspace, creator, member_count, board_count in rows:
            is_owner = (workspace.created_by == user_id)
            workspaces_data.append(WorkspaceResponse(
                id=workspace.id,
                name=workspace.name,
                icon=workspace.icon,
                bg_color=workspace.bg_color,
                created_by=workspace.created_by,
                creator=UserBasic(
                    id=creator.id,
                    username=creator.username,
                    email=creator.email,
                    full_name=creator.full_name,
                ),
                member_count=member_count,
                board_count=board_count,
                is_owner=is_owner,
                role="owner" if is_owner else membership.role,
                is_favourite=membership.is_favourite,
            ))

        return workspaces_data

    async def get_dashboard_init_data(self, user_id: int) -> dict:
        """Bootstrap endpoint - wszystko w jednym requeście"""
        db = self.db
        # 1. Fetch workspaces in one go
        workspaces = self.get_user_workspaces(user_id)

        user = db.query(User).filter(User.id == user_id).first()
        active_workspace_id = user.active_workspace_id if user else None

        # If active workspace is null or not in user's workspaces, default to the first one
        user_workspace_ids = [ws.id for ws in workspaces]
        if active_workspace_id not in user_workspace_ids:
            active_workspace_id = workspaces[0].id if workspaces else None

        active_workspace_boards = []
        if active_workspace_id:
            board_service = BoardService(db)
            board_list_resp = await board_service.list_boards(workspace_id=active_workspace_id, user_id=user_id, limit=50)
            active_workspace_boards = board_list_resp.boards

        return {
            "workspaces": workspaces,
            "active_workspace_boards": active_workspace_boards,
            "active_workspace_id": active_workspace_id,
        }

    def get_workspace_by_id(self, workspace_id: int, user_id: int) -> WorkspaceResponse:
        """Pobiera jeden workspace — tylko jeśli user jest członkiem."""
        db = self.db
        workspace = (
            db.query(Workspace)
            .options(joinedload(Workspace.creator))
            .filter(Workspace.id == workspace_id)
            .first()
        )
        if not workspace:
            raise NotFoundError("Workspace nie został znaleziony")

        membership = (
            db.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
            .first()
        )
        if not membership:
            raise NotFoundError("Nie masz dostępu do tego workspace'a")

        return _build_workspace_response(db, workspace, user_id, membership)

    def create_workspace(self, data: WorkspaceCreate, user_id: int) -> WorkspaceResponse:
        """Tworzy nowy workspace z membership ownerem."""
        db = self.db
        new_ws, membership = _build_workspace_with_owner(
            db, name=data.name,
            icon=data.icon or "Home",
            bg_color=data.bg_color or "bg-green-500",
            user_id=user_id,
            is_favourite=False
        )
        db.commit()
        db.refresh(new_ws)
        db.refresh(membership)

        creator = db.query(User).filter(User.id == user_id).first()
        return WorkspaceResponse(
            id=new_ws.id,
            name=new_ws.name,
            icon=new_ws.icon,
            bg_color=new_ws.bg_color,
            created_by=new_ws.created_by,
            creator=UserBasic(
                id=creator.id, username=creator.username,
                email=creator.email, full_name=creator.full_name,
            ) if creator else None,
            member_count=1,
            board_count=0,
            is_owner=True,
            role="owner",
            is_favourite=False,
        )

    def update_workspace(
        self, workspace_id: int, data: WorkspaceUpdate, user_id: int
    ) -> WorkspaceResponse:
        """Aktualizuje workspace — tylko owner."""
        db = self.db
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            raise NotFoundError("Workspace nie został znaleziony")
        if workspace.created_by != user_id:
            raise AppException("Tylko właściciel może edytować workspace", status_code=403)

        if data.name is not None:
            workspace.name = data.name
        if data.icon is not None:
            workspace.icon = data.icon
        if data.bg_color is not None:
            workspace.bg_color = data.bg_color
        db.commit()
        db.refresh(workspace)

        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        ).first()
        return _build_workspace_response(db, workspace, user_id, membership)

    def delete_workspace(self, workspace_id: int, user_id: int) -> dict:
        """Usuwa workspace — tylko owner."""
        db = self.db
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if not workspace:
            raise NotFoundError("Workspace nie został znaleziony")
        if workspace.created_by != user_id:
            raise AppException("Tylko właściciel może usunąć workspace", status_code=403)

        db.delete(workspace)
        db.commit()
        return {"message": "Workspace został usunięty"}

    def toggle_workspace_favourite(
        self, workspace_id: int, user_id: int, is_favourite: bool
    ) -> dict:
        """Zmienia status ulubionego dla workspace'a."""
        db = self.db
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        ).first()
        if not membership:
            raise NotFoundError("Nie jesteś członkiem tego workspace'a")

        membership.is_favourite = is_favourite
        db.commit()
        return {"message": "Status ulubionego został zmieniony", "is_favourite": is_favourite}

    def leave_workspace(self, workspace_id: int, user_id: int) -> dict:
        """Opuszczenie workspace'a — owner nie może opuścić."""
        db = self.db
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        ).first()
        if not membership:
            raise NotFoundError("Nie jesteś członkiem tego workspace'a")

        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        if workspace and workspace.created_by == user_id:
            raise AppException(
                "Właściciel nie może opuścić workspace'a. Musisz go usunąć.",
                status_code=403,
            )

        db.delete(membership)
        db.commit()
        return {"message": "Opuściłeś workspace"}

    def set_active_workspace(self, workspace_id: int, user: User) -> dict:
        """Ustawia workspace jako aktywny dla usera."""
        db = self.db
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        ).first()
        if not membership:
            raise NotFoundError("Nie masz dostępu do tego workspace'a")

        user.active_workspace_id = workspace_id
        db.commit()
        return {"message": "Aktywny workspace został zmieniony", "active_workspace_id": workspace_id}