"""
Workspace service — CRUD workspace'ów.
"""
from datetime import datetime
from typing import List

from sqlalchemy.orm import Session
from api.v1.boards.service import BoardService

from core.exceptions import AppException
from core.models import Workspace, WorkspaceMember
from .authorization import require_membership, require_owner
from .schemas import (
    WorkspaceCreate, WorkspaceUpdate, 
    WorkspaceResponse, WorkspaceWithBoardsResponse,
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
        rows = (
            db.query(WorkspaceMember, Workspace)
            .join(Workspace, WorkspaceMember.workspace_id == Workspace.id)
            .filter(WorkspaceMember.user_id == user_id)
            .all()
        )

        workspaces_data = []
        for membership, workspace in rows:
            is_owner = (workspace.created_by == user_id)
            workspaces_data.append(WorkspaceResponse(
                id=workspace.id,
                name=workspace.name,
                icon=workspace.icon,
                bg_color=workspace.bg_color,
                is_owner=is_owner,
                is_favourite=membership.is_favourite,
            ))

        return workspaces_data

    async def get_workspace_with_boards(self, workspace_id: int, user_id: int, boards_limit: int = 50, boards_offset: int = 0) -> WorkspaceWithBoardsResponse:
        """Pobiera workspace wraz z listą boardów. Sprawdza, czy użytkownik jest członkiem workspace'a."""
        db = self.db
        workspace, membership = require_membership(db, workspace_id, user_id)

        workspace_response = WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            icon=workspace.icon,
            bg_color=workspace.bg_color,
            is_owner=workspace.created_by == user_id,
            is_favourite=membership.is_favourite,
        )
        boards = await BoardService(db).list_boards(
            workspace_id=workspace_id,
            user_id=user_id,
            limit=boards_limit,
            offset=boards_offset
        )

        return WorkspaceWithBoardsResponse(**workspace_response.model_dump(), boards=boards)

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

        return WorkspaceResponse(
            id=new_ws.id,
            name=new_ws.name,
            icon=new_ws.icon,
            bg_color=new_ws.bg_color,
            is_owner=True,
            is_favourite=False,
        )

    def update_workspace(
        self, workspace_id: int, data: WorkspaceUpdate, user_id: int
    ) -> WorkspaceResponse:
        """Aktualizuje workspace — tylko owner."""
        db = self.db
        workspace = require_owner(db, workspace_id, user_id, "Tylko właściciel może edytować workspace")

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

        return WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            icon=workspace.icon,
            bg_color=workspace.bg_color,
            is_owner=workspace.created_by == user_id,
            is_favourite=membership.is_favourite,
        )

    def delete_workspace(self, workspace_id: int, user_id: int) -> dict:
        """Usuwa workspace — tylko owner."""
        db = self.db
        workspace = require_owner(db, workspace_id, user_id, "Tylko właściciel może usunąć workspace")

        db.delete(workspace)
        db.commit()
        return {"message": "Workspace został usunięty"}

    def toggle_workspace_favourite(
        self, workspace_id: int, user_id: int, is_favourite: bool
    ) -> dict:
        """Zmienia status ulubionego dla workspace'a."""
        db = self.db
        _, membership = require_membership(db, workspace_id, user_id)

        membership.is_favourite = is_favourite
        db.commit()
        return {"message": "Status ulubionego został zmieniony", "is_favourite": is_favourite}

    def leave_workspace(self, workspace_id: int, user_id: int) -> dict:
        """Opuszczenie workspace'a — owner nie może opuścić."""
        db = self.db
        workspace, membership = require_membership(db, workspace_id, user_id)

        if workspace.created_by == user_id:
            raise AppException(
                "Właściciel nie może opuścić workspace'a. Musisz go usunąć.",
                status_code=403,
            )

        db.delete(membership)
        db.commit()
        return {"message": "Opuściłeś workspace"}