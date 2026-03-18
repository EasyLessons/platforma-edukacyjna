"""
invite_routes.py
 
Endpointy zaproszeń do workspace'ów.
 
Wydzielone z routes.py dla czytelności.
Wszystkie endpointy zachowują prefiks /api/workspaces — semantycznie
zaproszenia są operacją na workspace'ie.
 
Endpointy:
  POST   /api/workspaces/{workspace_id}/invite         — wyślij zaproszenie
  GET    /api/workspaces/invites/pending               — moje zaproszenia
  POST   /api/workspaces/invites/accept/{token}        — akceptuj
  DELETE /api/workspaces/invites/{token}               — odrzuć
  GET    /api/workspaces/{workspace_id}/members/check/{user_id} — sprawdź status
"""

from datetime import datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from core.database import get_db
from core.models import User, WorkspaceInvite, WorkspaceMember
from typing import List

from .schemas import InviteCreate, InviteResponse, PendingInviteResponse
from .invite_service import (
    accept_invite,
    create_invite,
    get_user_pending_invites,
    reject_invite,
)

router = APIRouter(
    prefix="/api/workspaces",
    tags=["Invites"],
)

@router.post("/{workspace_id}/invite", response_model=InviteResponse)
async def create_workspace_invite(
    workspace_id: int,
    invite_data: InviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Wysyła zaproszenie do workspace'a."""
    return create_invite(
        db=db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        invited_user_id=invite_data.invited_user_id,
    )

@router.get("/invites/pending", response_model=List[PendingInviteResponse])
async def get_pending_invites(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Pobiera aktywne zaproszenia zalogowanego usera."""
    return get_user_pending_invites(db=db, user_id=current_user.id)

@router.post("/invites/accept/{token}")
async def accept_workspace_invite(
    token:        str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Akceptuje zaproszenie i dodaje usera do workspace'a."""
    return accept_invite(db=db, invite_token=token, user_id=current_user.id)

@router.delete("/invites/{token}", status_code=status.HTTP_200_OK)
async def reject_workspace_invite(
    token:        str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Odrzuca zaproszenie."""
    return reject_invite(db=db, invite_token=token, user_id=current_user.id)

@router.get("/{workspace_id}/members/check/{user_id}")
async def check_user_invite_status(
    workspace_id: int,
    user_id:      int,
    db:           Session = Depends(get_db),
):
    """
    Sprawdza czy user jest już członkiem lub ma aktywne zaproszenie.
    Używane przez workspace-invite-modal przed wysłaniem zaproszenia.
    """
    is_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first() is not None
 
    has_pending_invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.workspace_id == workspace_id,
        WorkspaceInvite.invited_id == user_id,
        WorkspaceInvite.expires_at > datetime.utcnow(),
    ).first() is not None
 
    return {
        "is_member":          is_member,
        "has_pending_invite": has_pending_invite,
        "can_invite":         not is_member and not has_pending_invite,
    }
