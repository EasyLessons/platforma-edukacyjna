"""
Members service — zarządzanie członkami workspace'a.
"""
from sqlalchemy.orm import Session, joinedload
 
from core.exceptions import NotFoundError, AppException
from core.models import User, Workspace, WorkspaceMember
from .schemas import (
    WorkspaceMemberResponse, WorkspaceMembersListResponse,
    MyRoleResponse, RemoveMemberResponse,
)

def get_workspace_members(
    db: Session, workspace_id: int, user_id: int
) -> WorkspaceMembersListResponse:
    """Pobiera listę członków — dostępna dla każdego członka workspace'a."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise NotFoundError("Workspace nie został znaleziony")
 
    caller_membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()
    if not caller_membership:
        raise NotFoundError("Nie masz dostępu do tego workspace'a")
 
    memberships = (
        db.query(WorkspaceMember)
        .options(joinedload(WorkspaceMember.user))
        .filter(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.joined_at.asc())
        .all()
    )
 
    members = []
    for m in memberships:
        is_owner = workspace.created_by == m.user_id
        members.append(WorkspaceMemberResponse(
            id=m.id,
            user_id=m.user.id,
            username=m.user.username,
            email=m.user.email,
            full_name=m.user.full_name,
            role="owner" if is_owner else m.role,
            joined_at=m.joined_at,
            is_owner=is_owner,
        ))
 
    return WorkspaceMembersListResponse(members=members, total=len(members))

def remove_workspace_member(
    db: Session, workspace_id: int, member_user_id: int, current_user_id: int
) -> RemoveMemberResponse:
    """Usuwa członka — tylko owner, nie może usunąć siebie."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise NotFoundError("Workspace nie został znaleziony")
    if workspace.created_by != current_user_id:
        raise AppException("Tylko właściciel może usuwać członków", status_code=403)
    if member_user_id == current_user_id:
        raise AppException(
            "Nie możesz usunąć siebie. Użyj opcji 'Opuść workspace'.",
            status_code=400,
        )
 
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == member_user_id,
    ).first()
    if not membership:
        raise NotFoundError("Użytkownik nie jest członkiem tego workspace'a")
    
    user = db.query(User).filter(User.id == member_user_id).first()
    username = user.username if user else "Użytkownik"
 
    db.delete(membership)
    db.commit()
    return RemoveMemberResponse(
        message=f"Użytkownik {username} został usunięty z workspace'a"
    )

def update_member_role(
    db: Session,
    workspace_id: int,
    member_user_id: int,
    new_role: str,
    current_user_id: int,
) -> dict:
    """Zmienia rolę członka — tylko owner, nie może zmienić własnej roli."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise NotFoundError("Workspace nie został znaleziony")
    if workspace.created_by != current_user_id:
        raise AppException("Tylko właściciel może zmieniać role", status_code=403)
    if member_user_id == current_user_id:
        raise AppException("Nie możesz zmienić własnej roli", status_code=400)
 
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == member_user_id,
    ).first()
    if not membership:
        raise NotFoundError("Użytkownik nie jest członkiem tego workspace'a")
 
    user = db.query(User).filter(User.id == member_user_id).first()
    username = user.username if user else "Użytkownik"
    old_role = membership.role
 
    membership.role = new_role
    db.commit()
    return {
        "message": f"Zmieniono rolę użytkownika {username} z '{old_role}' na '{new_role}'",
        "new_role": new_role,
        "user_id": member_user_id,
    }

def get_user_role(
    db: Session, workspace_id: int, user_id: int
) -> MyRoleResponse:
    """Pobiera rolę zalogowanego usera w danym workspace'ie."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise NotFoundError("Workspace nie został znaleziony")
 
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()
    if not membership:
        raise NotFoundError("Nie jesteś członkiem tego workspace'a")
 
    is_owner = workspace.created_by == user_id
    return MyRoleResponse(
        role="owner" if is_owner else membership.role,
        is_owner=is_owner,
        workspace_id=workspace_id,
    )
