"""
═══════════════════════════════════════════════════════════════════════════
                        DASHBOARD ROUTES
                    Endpointy API dla Workspace'ów
═══════════════════════════════════════════════════════════════════════════
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

# Importy lokalne
from core.database import get_db
from core.models import User
from auth.dependencies import get_current_user  # ← Import wspólnej funkcji autoryzacji

from .schemas import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceListResponse,
    ToggleFavouriteRequest
)
from .service import (
    get_user_workspaces,
    get_workspace_by_id,
    create_workspace,
    update_workspace,
    delete_workspace,
    toggle_workspace_favourite
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
    from core.models import WorkspaceMember
    from fastapi import HTTPException
    
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
