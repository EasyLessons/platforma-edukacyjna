"""
Invites service — zaproszenia do workspace'ów.
"""
import asyncio
import secrets
from datetime import datetime, timedelta
from typing import List

from sqlalchemy import and_
from sqlalchemy.orm import Session

from core.config import get_settings
from core.exceptions import NotFoundError, ConflictError, AppException
from core.models import User, Workspace, WorkspaceInvite, WorkspaceMember
from api.v1.notifications.service import create_notification
from dashboard.workspaces.realtime import broadcast_notification
from dashboard.workspaces.utils import send_workspace_invite_email
from .schemas import (
    InviteResponse, PendingInviteResponse,
    InviteStatusResponse, AcceptInviteResponse,
)

async def create_invite(
    db: Session,
    workspace_id: int,
    user_id: int,
    invited_user_id: int,
    send_email: bool = True,
    expires_in_days: int = 7,
) -> InviteResponse:
    """Tworzy zaproszenie + powiadomienie + opcjonalnie email."""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise NotFoundError("Workspace nie istnieje")
 
    if not db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first():
        raise AppException("Nie jesteś członkiem workspace'a", status_code=403)
 
    invited_user = db.query(User).filter(User.id == invited_user_id).first()
    if not invited_user:
        raise NotFoundError("Użytkownik nie istnieje")
 
    if db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == invited_user_id,
    ).first():
        raise ConflictError("Użytkownik już jest członkiem")
 
    if db.query(WorkspaceInvite).filter(
        WorkspaceInvite.workspace_id == workspace_id,
        WorkspaceInvite.invited_id == invited_user_id,
        WorkspaceInvite.is_used == False,
        WorkspaceInvite.expires_at > datetime.utcnow(),
    ).first():
        raise ConflictError("Zaproszenie już zostało wysłane")
 
    invite_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
    inviter = db.query(User).filter(User.id == user_id).first()
    inviter_name = inviter.username if inviter else "Nieznany"
 
    try:
        new_invite = WorkspaceInvite(
            workspace_id=workspace_id,
            invited_by=user_id,
            invited_id=invited_user_id,
            invite_token=invite_token,
            expires_at=expires_at,
            is_used=False,
            created_at=datetime.utcnow(),
        )
        db.add(new_invite)
        db.commit()
        db.refresh(new_invite)
 
        create_notification(
            db=db,
            user_id=invited_user_id,
            type="invite",
            payload={
                "workspace_id": workspace.id,
                "workspace_name": workspace.name,
                "workspace_icon": workspace.icon,
                "workspace_bg_color": workspace.bg_color,
                "inviter_name": inviter_name,
                "invite_token": invite_token,
                "expires_at": expires_at.isoformat(),
                "created_at": new_invite.created_at.isoformat(),
            },
        )
 
        try:
            await broadcast_notification(
                user_id=invited_user_id,
                event="new_invite",
                payload={
                    "workspace_id": workspace.id,
                    "workspace_name": workspace.name,
                    "inviter_name": inviter_name,
                    "invite_token": invite_token,
                },
            )
        except Exception:
            pass
 
        settings = get_settings()
        if send_email and settings.resend_api_key and settings.resend_api_key != "SKIP":
            try:
                asyncio.create_task(send_workspace_invite_email(
                    invited_email=invited_user.email,
                    invited_name=invited_user.username,
                    inviter_name=inviter_name,
                    workspace_name=workspace.name,
                    invite_token=invite_token,
                    resend_api_key=settings.resend_api_key,
                    from_email=settings.from_email,
                    frontend_url="https://easylesson.app",
                ))
            except Exception as e:
                print(f"❌ Błąd wysyłania emaila: {e}")
 
        return InviteResponse(
            id=new_invite.id,
            workspace_id=new_invite.workspace_id,
            invited_by=new_invite.invited_by,
            invited_id=new_invite.invited_id,
            invite_token=new_invite.invite_token,
            expires_at=new_invite.expires_at,
            created_at=new_invite.created_at,
        )
    except (NotFoundError, ConflictError, AppException):
        raise
    except Exception as e:
        db.rollback()
        raise AppException(f"Błąd tworzenia zaproszenia: {str(e)}", status_code=500)

def accept_invite(db: Session, invite_token: str, user_id: int) -> AcceptInviteResponse:
    """Akceptuje zaproszenie — dodaje usera do workspace'a jako editor."""
    invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.invite_token == invite_token
    ).first()
    if not invite:
        raise NotFoundError("Zaproszenie nie istnieje")
    if invite.invited_id != user_id:
        raise AppException("To zaproszenie nie jest dla Ciebie", status_code=403)
    if invite.expires_at < datetime.utcnow():
        raise AppException("Zaproszenie wygasło", status_code=410)
    if invite.is_used:
        raise ConflictError("Zaproszenie już użyte")
 
    workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()
    if not workspace:
        raise NotFoundError("Workspace nie istnieje")
 
    if db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == invite.workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first():
        raise ConflictError("Już jesteś członkiem tego workspace'a")
 
    try:
        db.add(WorkspaceMember(
            workspace_id=invite.workspace_id,
            user_id=user_id,
            role="editor",
            is_favourite=False,
            joined_at=datetime.utcnow(),
        ))
        db.delete(invite)
        db.commit()
        return AcceptInviteResponse(
            message=f"Pomyślnie dołączono do workspace'a '{workspace.name}'",
            workspace_id=workspace.id,
            workspace_name=workspace.name,
            role="editor",
        )
    except (NotFoundError, ConflictError, AppException):
        raise
    except Exception as e:
        db.rollback()
        raise AppException(f"Błąd dodawania: {str(e)}", status_code=500)

def reject_invite(db: Session, invite_token: str, user_id: int) -> dict:
    """Odrzuca zaproszenie — usuwa je z bazy."""
    invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.invite_token == invite_token
    ).first()
    if not invite:
        raise NotFoundError("Zaproszenie nie istnieje")
    if invite.invited_id != user_id:
        raise AppException("To zaproszenie nie jest dla Ciebie", status_code=403)
    if invite.is_used:
        raise ConflictError("Zaproszenie już użyte")
 
    try:
        db.delete(invite)
        db.commit()
        return {"message": "Zaproszenie odrzucone"}
    except Exception as e:
        db.rollback()
        raise AppException(f"Błąd odrzucania: {str(e)}", status_code=500)

def get_user_pending_invites(db: Session, user_id: int) -> List[PendingInviteResponse]:
    """Pobiera aktywne (niewygasłe, nieużyte) zaproszenia usera."""
    invites = (
        db.query(WorkspaceInvite)
        .filter(and_(
            WorkspaceInvite.invited_id == user_id,
            WorkspaceInvite.is_used == False,
            WorkspaceInvite.expires_at > datetime.utcnow(),
        ))
        .order_by(WorkspaceInvite.created_at.desc())
        .all()
    )
 
    result = []
    for invite in invites:
        workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()
        if not workspace:
            continue
        inviter = db.query(User).filter(User.id == invite.invited_by).first()
        invited_user = db.query(User).filter(User.id == invite.invited_id).first()
        result.append(PendingInviteResponse(
            id=invite.id,
            workspace_id=invite.workspace_id,
            workspace_name=workspace.name,
            workspace_icon=workspace.icon,
            workspace_bg_color=workspace.bg_color,
            invited_by=invite.invited_by,
            inviter_name=inviter.username if inviter else "Nieznany",
            invited_id=invite.invited_id,
            invited_user_name=invited_user.username if invited_user else "Nieznany",
            invite_token=invite.invite_token,
            expires_at=invite.expires_at,
            created_at=invite.created_at,
        ))
    return result

def check_invite_status(
    db: Session, workspace_id: int, user_id: int
) -> InviteStatusResponse:
    """Sprawdza czy user jest członkiem lub ma aktywne zaproszenie."""
    is_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first() is not None
 
    has_pending = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.workspace_id == workspace_id,
        WorkspaceInvite.invited_id == user_id,
        WorkspaceInvite.expires_at > datetime.utcnow(),
        WorkspaceInvite.is_used == False,
    ).first() is not None
 
    return InviteStatusResponse(
        is_member=is_member,
        has_pending_invite=has_pending,
        can_invite=not is_member and not has_pending,
    )
