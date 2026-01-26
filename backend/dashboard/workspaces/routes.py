"""
═══════════════════════════════════════════════════════════════════════════
                        DASHBOARD ROUTES
                    Endpointy API dla Workspace'ów
═══════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List

# Importy lokalne
from core.database import get_db
from core.models import User, WorkspaceMember
from auth.dependencies import get_current_user  # ← Import wspólnej funkcji autoryzacji

from .schemas import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceListResponse,
    ToggleFavouriteRequest,
    InviteResponse,
    InviteCreate,
    PendingInviteResponse,
    WorkspaceMembersListResponse,
    UpdateMemberRoleRequest,
)
from .service import (
    get_user_workspaces,
    get_workspace_by_id,
    create_workspace,
    update_workspace,
    delete_workspace,
    toggle_workspace_favourite,
    leave_workspace,
    get_user_pending_invites,
    accept_invite,
    reject_invite,
    get_workspace_members,
    remove_workspace_member,
    update_member_role,
    get_user_role_in_workspace,
)

# ═══════════════════════════════════════════════════════════════════════════
# 🔧 KONFIGURACJA ROUTERA
# ═══════════════════════════════════════════════════════════════════════════

router = APIRouter(
    prefix="/api/workspaces",
    tags=["Workspaces"]
)


# ═══════════════════════════════════════════════════════════════════════════
# 📋 ENDPOINTY
# ═══════════════════════════════════════════════════════════════════════════

@router.get("", response_model=WorkspaceListResponse)
async def get_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pobiera WSZYSTKIE workspace'y użytkownika"""
    workspaces = get_user_workspaces(db, current_user.id)
    return WorkspaceListResponse(
        workspaces=workspaces,
        total=len(workspaces)
    )


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pobiera JEDEN konkretny workspace"""
    return get_workspace_by_id(db, workspace_id, current_user.id)


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_new_workspace(
    workspace_data: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tworzy NOWY workspace"""
    return create_workspace(db, workspace_data, current_user.id)


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_existing_workspace(
    workspace_id: int,
    workspace_data: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Aktualizuje workspace"""
    return update_workspace(db, workspace_id, workspace_data, current_user.id)


@router.delete("/{workspace_id}", status_code=status.HTTP_200_OK)
async def delete_existing_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Usuwa workspace"""
    return delete_workspace(db, workspace_id, current_user.id)


@router.delete("/{workspace_id}/leave", status_code=status.HTTP_200_OK)
async def leave_existing_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Opuszcza workspace (usuwa członkostwo użytkownika, nie cały workspace)"""
    return leave_workspace(db, workspace_id, current_user.id)


@router.patch("/{workspace_id}/favourite", status_code=status.HTTP_200_OK)
async def toggle_favourite(
    workspace_id: int,
    request: ToggleFavouriteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Zmienia status ulubionego dla workspace'a"""
    return toggle_workspace_favourite(db, workspace_id, current_user.id, request.is_favourite)


@router.patch("/{workspace_id}/set-active", status_code=status.HTTP_200_OK)
async def set_active_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ustaw workspace jako aktywny dla użytkownika"""
    
    # Sprawdź czy user ma dostęp do workspace
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id
        )
        .first()
    )
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie masz dostępu do tego workspace'a"
        )
    
    # Ustaw jako aktywny
    current_user.active_workspace_id = workspace_id
    db.commit()
    
    return {
        "message": "Aktywny workspace został zmieniony",
        "active_workspace_id": workspace_id
    }


@router.post("/{workspace_id}/invite", response_model=InviteResponse)
async def create_workspace_invite(
    workspace_id: int,
    invite_data: InviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tworzy zaproszenie do workspace'a"""
    from .service import create_invite
    return create_invite(
        db, 
        workspace_id, 
        current_user.id, 
        invite_data.invited_user_id
    )


@router.get("/invites/pending", response_model=List[PendingInviteResponse])
async def get_pending_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pobiera zaproszenia oczekujące dla zalogowanego użytkownika"""
    return get_user_pending_invites(db, current_user.id)


@router.post("/invites/accept/{token}")
async def accept_workspace_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Akceptuje zaproszenie"""
    return accept_invite(db, token, current_user.id)


@router.delete("/invites/{token}")
async def reject_workspace_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Odrzuca zaproszenie"""
    return reject_invite(db, token, current_user.id)


@router.get("/{workspace_id}/members/check/{user_id}")
async def check_user_membership(
    workspace_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    """
    Sprawdza czy użytkownik jest już członkiem workspace'a
    lub ma aktywne zaproszenie
    """
    from core.models import WorkspaceMember, WorkspaceInvite
    from datetime import datetime
    
    # Sprawdź członkostwo
    is_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id
    ).first() is not None
    
    # Sprawdź aktywne zaproszenie
    has_pending_invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.workspace_id == workspace_id,
        WorkspaceInvite.invited_id == user_id,
        WorkspaceInvite.is_used == False,
        WorkspaceInvite.expires_at > datetime.utcnow()
    ).first() is not None
    
    return {
        "is_member": is_member,
        "has_pending_invite": has_pending_invite,
        "can_invite": not is_member and not has_pending_invite
    }


# ═══════════════════════════════════════════════════════════════════════════
# 👥 ENDPOINTY CZŁONKÓW WORKSPACE'A
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{workspace_id}/members", response_model=WorkspaceMembersListResponse)
async def get_members(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Pobiera listę wszystkich członków workspace'a
    
    DOSTĘP:
    - Każdy członek workspace'a może zobaczyć listę członków
    
    ZWRACA:
    Lista członków z ich rolami i datą dołączenia
    """
    return get_workspace_members(db, workspace_id, current_user.id)


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_member(
    workspace_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Usuwa członka z workspace'a
    
    DOSTĘP:
    - Tylko WŁAŚCICIEL workspace'a może usuwać członków
    - Właściciel NIE może usunąć samego siebie
    
    PARAMETRY:
    - workspace_id: ID workspace'a
    - user_id: ID użytkownika do usunięcia
    """
    return remove_workspace_member(db, workspace_id, user_id, current_user.id)


@router.patch("/{workspace_id}/members/{user_id}/role", status_code=status.HTTP_200_OK)
async def update_member_role_endpoint(
    workspace_id: int,
    user_id: int,
    role_data: UpdateMemberRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Zmienia rolę członka workspace'a
    
    DOSTĘP:
    - Tylko WŁAŚCICIEL workspace'a może zmieniać role
    - Właściciel NIE może zmienić własnej roli
    
    PARAMETRY:
    - workspace_id: ID workspace'a
    - user_id: ID użytkownika którego rolę zmieniamy
    - role_data: {"role": "owner" | "editor" | "viewer"}
    
    ROLE:
    - owner: Pełne uprawnienia (twórca)
    - editor: Może edytować tablice (rysować, dodawać elementy)
    - viewer: Tylko przeglądanie (nie może rysować, toolbar zablokowany)
    """
    return update_member_role(db, workspace_id, user_id, role_data.role, current_user.id)


@router.get("/{workspace_id}/my-role", status_code=status.HTTP_200_OK)
async def get_my_role_in_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Pobiera własną rolę w workspace'ie
    
    ZWRACA:
    {
      "role": "editor",
      "is_owner": false,
      "workspace_id": 123
    }
    
    UŻYWANE DO:
    - Sprawdzenie uprawnień przed pokazaniem tablicy
    - Blokada toolbara dla "viewer"
    """
    return get_user_role_in_workspace(db, workspace_id, current_user.id)