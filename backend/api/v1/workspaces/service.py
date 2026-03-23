"""
Workspace service — CRUD workspace'ów.
"""
from datetime import datetime
from typing import List
 
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
 
from core.exceptions import NotFoundError, AppException
from core.models import Board, User, Workspace, WorkspaceMember
from .schemas import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse,
    WorkspaceListResponse, UserBasic,
)

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

def get_user_workspaces(db: Session, user_id: int) -> List[WorkspaceResponse]:
    """Pobiera wszystkie workspace'y do których user ma dostęp."""
    memberships = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.user_id == user_id)
        .options(joinedload(WorkspaceMember.workspace).joinedload(Workspace.creator))
        .all()
    )
    return [_build_workspace_response(db, m.workspace, user_id, m) for m in memberships]

def get_workspace_by_id(db: Session, workspace_id: int, user_id: int) -> WorkspaceResponse:
    """Pobiera jeden workspace — tylko jeśli user jest członkiem."""
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

def create_workspace(db: Session, data: WorkspaceCreate, user_id: int) -> WorkspaceResponse:
    """Tworzy nowy workspace z membership ownerem."""
    new_ws = Workspace(
        name=data.name,
        icon=data.icon or "Home",
        bg_color=data.bg_color or "bg-green-500",
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    db.add(new_ws)
    db.flush()
 
    membership = WorkspaceMember(
        workspace_id=new_ws.id,
        user_id=user_id,
        role="owner",
        is_favourite=False,
        joined_at=datetime.utcnow(),
    )
    db.add(membership)
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
    db: Session, workspace_id: int, data: WorkspaceUpdate, user_id: int
) -> WorkspaceResponse:
    """Aktualizuje workspace — tylko owner."""
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

def delete_workspace(db: Session, workspace_id: int, user_id: int) -> dict:
    """Usuwa workspace — tylko owner."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise NotFoundError("Workspace nie został znaleziony")
    if workspace.created_by != user_id:
        raise AppException("Tylko właściciel może usunąć workspace", status_code=403)
 
    db.delete(workspace)
    db.commit()
    return {"message": "Workspace został usunięty"}

def toggle_workspace_favourite(
    db: Session, workspace_id: int, user_id: int, is_favourite: bool
) -> dict:
    """Zmienia status ulubionego dla workspace'a."""
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()
    if not membership:
        raise NotFoundError("Nie jesteś członkiem tego workspace'a")
 
    membership.is_favourite = is_favourite
    db.commit()
    return {"message": "Status ulubionego został zmieniony", "is_favourite": is_favourite}

def leave_workspace(db: Session, workspace_id: int, user_id: int) -> dict:
    """Opuszczenie workspace'a — owner nie może opuścić."""
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

def set_active_workspace(db: Session, workspace_id: int, user: object) -> dict:
    """Ustawia workspace jako aktywny dla usera."""
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user.id,
    ).first()
    if not membership:
        raise NotFoundError("Nie masz dostępu do tego workspace'a")
 
    user.active_workspace_id = workspace_id
    db.commit()
    return {"message": "Aktywny workspace został zmieniony", "active_workspace_id": workspace_id}
