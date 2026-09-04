"""
Wspólna logika autoryzacji dla modułu workspaces - membership/ownership checks.
Używane przez WorkspaceService, InviteService i MemeberService.
"""
from sqlalchemy.orm import Session

from core.exceptions import NotFoundError, AppException
from core.models import Board, Workspace, WorkspaceMember


def get_workspace_or_404(db: Session, workspace_id: int) -> Workspace:
    """Zwraca Workspace albo rzuca NotFoundError"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise NotFoundError("Workspace nie został znaleziony")
    return workspace

def require_membership(db: Session, workspace_id: int, user_id: int) -> tuple[Workspace, WorkspaceMember]:
    """Sprawdza czy workspace istnieje i user jest jego członkiem. Zwraca (workspace, membership) albo rzuca NotFoundError."""
    workspace = get_workspace_or_404(db, workspace_id)
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()
    if not membership:
        raise NotFoundError("Nie masz dostępu do tego workspace'a")
    return workspace, membership

def require_owner(
    db: Session, 
    workspace_id: int, 
    user_id: int, 
    message: str = "Tylko właściciel może wykonać tę operację"
) -> Workspace:
    """Sprawdza czy workspace istnieje i user jest jego właścicielem. 
    Zwraca Workspace albo rzuca NotFoundError/AppException."""
    workspace = get_workspace_or_404(db, workspace_id)
    if workspace.created_by != user_id:
        raise AppException(message, status_code=403)
    return workspace

def require_editor_or_owner(
    db: Session,
    workspace_id: int,
    user_id: int,
    message: str = "Musisz być właścicielem lub edytorem, aby wykonać tę operację"
) -> tuple[Workspace, WorkspaceMember]:
    """Sprawdza czy workspace istnieje i user ma rolę 'editor' lub 'owner'.
    Zwraca (workspace, membership) albo rzuca NotFoundError/AppException."""
    workspace, membership = require_membership(db, workspace_id, user_id)
    if membership.role not in ("owner", "editor"):
        raise AppException(message, status_code=403)
    return workspace, membership

def require_board_owner(
    db: Session,
    board: Board,
    user_id: int, 
    message: str = "Tylko właściciel tablicy może wykonać tę oprerację"
) -> None:
    """Sprawdza czy user jest twórcą tablicy."""
    require_membership(db, board.workspace_id, user_id)
    if board.created_by != user_id:
        raise AppException(message, status_code=403)