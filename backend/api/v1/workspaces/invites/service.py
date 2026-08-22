"""
Invites service — zaproszenia do workspace'ów.
"""
import asyncio
import secrets
from datetime import datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from core.config import get_settings
from core.exceptions import NotFoundError, ConflictError, AppException
from core.models import User, WorkspaceInvite, WorkspaceMember
from core.logging import get_logger
from api.v1.notifications.service import create_notification
from api.v1.notifications.realtime import broadcast_notification
from ..authorization import get_workspace_or_404, require_membership
from .utils import send_workspace_invite_email
from .schemas import (
    InviteResponse, UserSearchResult, AcceptInviteResponse,
)

logger = get_logger(__name__)

def _log_invite_email_failure(task: asyncio.Task) -> None:
    """Loguje błąd wysyłki maila zaproszenia z fire-and-forget taska."""
    exc = task.exception()
    if exc:
        logger.error(f"Błąd wysyłania emaila zaproszenia: {exc}", exc_info=exc)


class InviteService:
    def __init__(self, db: Session):
        self.db = db

    async def create_invite(
        self,
        workspace_id: int,
        user_id: int,
        invited_user_id: int,
        send_email: bool = True,
        expires_in_days: int = 7,
    ) -> InviteResponse:
        """Tworzy zaproszenie + powiadomienie + opcjonalnie email."""
        db = self.db
        workspace, _ = require_membership(db, workspace_id, user_id)
        
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

            notification = create_notification(
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
                        "notification_id": notification.id,
                    },
                )
            except Exception:
                pass

            settings = get_settings()
            if send_email and settings.resend_api_key and settings.resend_api_key != "SKIP":
                task = asyncio.create_task(send_workspace_invite_email(
                        invited_email=invited_user.email,
                        invited_name=invited_user.username,
                        inviter_name=inviter_name,
                        workspace_name=workspace.name,
                        invite_token=invite_token,
                        resend_api_key=settings.resend_api_key,
                        from_email=settings.from_email,
                        frontend_url="https://easylesson.app",
                    ))
                task.add_done_callback(_log_invite_email_failure)

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

    def search_invitable_users(
        self,
        workspace_id: int,
        query: str,
        current_user_id: int,
        limit: int = 10
    ) -> List[UserSearchResult]:
        """Wyszukuje użytkowników do zaproszenia - 
        wyklucza siebie i obecnych członków, oznacza już zaproszonych."""
        db = self.db
        require_membership(db, workspace_id, current_user_id)

        query = query.strip().lower()
        if len(query) < 2:
            return []

        members_ids_subquery = (
            db.query(WorkspaceMember.user_id)
            .filter(WorkspaceMember.workspace_id == workspace_id)
        )

        users = (
            db.query(User)
            .filter(
                (User.username.ilike(f"%{query}%")) |
                (User.email.ilike(f"%{query}%")) |
                (User.full_name.ilike(f"%{query}%"))
            )
            .filter(User.id != current_user_id)
            .filter(User.id.notin_(members_ids_subquery))
            .filter(User.is_active == True)
            .limit(limit)
            .all()
        )

        if not users:
            return []

        user_ids = [u.id for u in users]
        pending_ids = {
            row[0]
            for row in db.query(WorkspaceInvite.invited_id)
            .filter(
                WorkspaceInvite.workspace_id == workspace_id,
                WorkspaceInvite.invited_id.in_(user_ids),
                WorkspaceInvite.expires_at > datetime.utcnow(),
                WorkspaceInvite.is_used == False
            )
            .all()
        }

        return [
            UserSearchResult(
                id=u.id,
                username=u.username,
                email=u.email,
                full_name=u.full_name,
                has_pending_invite=u.id in pending_ids,
            )
            for u in users
        ]
        
    def accept_invite(self, invite_token: str, user_id: int) -> AcceptInviteResponse:
        """Akceptuje zaproszenie — dodaje usera do workspace'a jako editor."""
        db = self.db
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

        workspace = get_workspace_or_404(db, invite.workspace_id)

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

    def reject_invite(self, invite_token: str, user_id: int) -> dict:
        """Odrzuca zaproszenie — usuwa je z bazy."""
        db = self.db
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