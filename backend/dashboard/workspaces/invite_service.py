"""
invite_service.py
 
Logika biznesowa zaproszeń do workspace'ów.
 
Wydzielona z service.py dla czytelności — zaproszenia to odrębna
odpowiedzialność wewnątrz modułu workspace.
 
Funkcje:
  create_invite()             — tworzy zaproszenie, wysyła email + broadcast
  accept_invite()             — akceptuje zaproszenie, dodaje usera do workspace
  reject_invite()             — odrzuca zaproszenie
  get_user_pending_invites()  — pobiera aktywne zaproszenia dla usera
"""

import asyncio
import secrets
from datetime import datetime, timedelta
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from core.config import get_settings
from core.models import User, Workspace, WorkspaceInvite, WorkspaceMember
from notifications.service import create_notification
from dashboard.workspaces.realtime import broadcast_notification
from dashboard.workspaces.schemas import InviteResponse, PendingInviteResponse
from dashboard.workspaces.utils import send_workspace_invite_email

def create_invite(
    db: Session,
    workspace_id: int,
    user_id: int,
    invited_user_id: int,
    send_email: bool = True,
    expires_in_days: int  = 7,
) -> InviteResponse:
    """
    Tworzy zaproszenie do workspace'a.
 
    Waliduje:
      - czy workspace istnieje
      - czy zapraszający jest członkiem
      - czy zapraszany istnieje
      - czy zapraszany nie jest już członkiem
      - czy nie ma aktywnego zaproszenia
 
    Po utworzeniu:
      - zapisuje powiadomienie w bazie (create_notification)
      - broadcastuje event przez Supabase (broadcast_notification)
      - opcjonalnie wysyła email (send_workspace_invite_email)
    """
    # Walidacja workspace
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace nie istnieje")
    
    # Walidacja membership zapraszającego
    membership = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Nie jesteś członkiem workspace'a")
    
    # Walidacja zapraszanego
    invited_user = db.query(User).filter(User.id == invited_user_id).first()
    if not invited_user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    
    # Sprawdź czy już nie jest członkiem
    existing_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == invited_user_id,
    ).first()
    if existing_member:
        raise HTTPException(status_code=409, detail="Użytkownik już jest członkiem")
    
    # Sprawdź czy nie ma aktywnego zaproszenia
    existing_invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.workspace_id == workspace_id,
        WorkspaceInvite.invited_id == invited_user_id,
        WorkspaceInvite.is_used == False,
        WorkspaceInvite.expires_at > datetime.utcnow(),
    ).first()
    if existing_invite:
        raise HTTPException(status_code=409, detail="Aktywne zaproszenie już istnieje")
    
    # Pobierz zapraszającego
    inviter = db.query(User).filter(User.id == user_id).first()
    inviter_name = inviter.username if inviter else "Nieznany"

    # Generuj unikalny token
    invite_token = None
    for _ in range(5):
        token = secrets.token_urlsafe(32)
        if not db.query(WorkspaceInvite).filter(
            WorkspaceInvite.invite_token == token
        ).first():
            invite_token = token
            break

    if not invite_token:
        raise HTTPException(status_code=500, detail="Błąd generowania tokenu")
    
    try:
        new_invite = WorkspaceInvite(
            workspace_id=workspace_id,
            invited_by=user_id,
            invited_id=invited_user_id,
            invite_token=invite_token,
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days),
            is_used=False,
            created_at=datetime.utcnow(),
        )
        db.add(new_invite)
        db.commit()
        db.refresh(new_invite)

        # Payload wspólny dla notification i broadcast
        notification_payload = {
            "id":                 new_invite.id,
            "workspace_id":       workspace.id,
            "workspace_name":     workspace.name,
            "workspace_icon":     workspace.icon,
            "workspace_bg_color": workspace.bg_color,
            "inviter_name":       inviter_name,
            "invite_token":       new_invite.invite_token,
            "expires_at":         new_invite.expires_at.isoformat(),
            "created_at":         new_invite.created_at.isoformat(),
        }

        # Zapisz powiadomienie w bazie
        create_notification(
            db=db,
            user_id=invited_user_id,
            type="invite",
            payload=notification_payload,
        )

        # Broadcast realtime
        try:
            asyncio.create_task(
                broadcast_notification(
                    user_id=invited_user_id,
                    event="new_invite",
                    payload=notification_payload,
                )
            )
        except RuntimeError:
            import asyncio as _asyncio
            _asyncio.run(
                broadcast_notification(
                    user_id=invited_user_id,
                    event="new_invite",
                    payload=notification_payload,
                )
            )

        # Email
        if send_email:
            try:
                settings = get_settings()
                if settings.resend_api_key and settings.resend_api_key != "SKIP":
                    asyncio.create_task(
                        send_workspace_invite_email(
                            invited_email=invited_user.email,
                            invited_name=invited_user.username,
                            inviter_name=inviter_name,
                            workspace_name=workspace.name,
                            invite_token=invite_token,
                            resend_api_key=settings.resend_api_key,
                            from_email=settings.from_email,
                            frontend_url="https://easylesson.app",
                        )
                    )
                    print(f"📧 Email wysłany do {invited_user.email}")
                else:
                    print("⚠️ Email NIE wysłany (RESEND_API_KEY=SKIP)")
            except Exception as email_error:
                print(f"❌ Błąd wysyłania emaila: {email_error}")
 
        return InviteResponse(
            id=new_invite.id,
            workspace_id=new_invite.workspace_id,
            invited_by=new_invite.invited_by,
            invited_id=new_invite.invited_id,
            invite_token=new_invite.invite_token,
            expires_at=new_invite.expires_at,
            created_at=new_invite.created_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd tworzenia zaproszenia: {str(e)}")

def accept_invite(db: Session, invite_token: str, user_id: int) -> dict:
    """
    Akceptuje zaproszenie i dodaje usera do workspace'a.
 
    Waliduje token, właściciela, wygaśnięcie i istniejące membership.
    Po akceptacji oznacza zaproszenie jako użyte i tworzy WorkspaceMember.
    """
    invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.invite_token == invite_token
    ).first()

    if not invite:
        raise HTTPException(status_code=404, detail="Zaproszenie nie istnieje")
    
    if invite.invited_id != user_id:
        raise HTTPException(status_code=403, detail="To zaproszenie nie jest dla Ciebie")
    
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="Użytkownik nie istnieje")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Zaproszenie wygasło")
    if invite.is_used:
        raise HTTPException(status_code=409, detail="Zaproszenie już użyte")
    
    workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()

    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace nie istnieje")
    
    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == invite.workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Już jesteś członkiem tego workspace'a")
    
    try:
        new_member = WorkspaceMember(
            workspace_id=invite.workspace_id,
            user_id=user_id,
            role="editor",
            is_favourite=False,
            joined_at=datetime.utcnow(),
        )
        db.add(new_member)
        db.delete(invite)
        db.commit()

        return {
            "message": f"Pomyślnie dołączono do workspace'a '{workspace.name}'",
            "workspace_id": workspace.id,
            "workspace_name": workspace.name,
            "role": "editor",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd dodawania: {str(e)}")
 
def reject_invite(db: Session, invite_token: str, user_id: int) -> dict:
    """
    Odrzuca zaproszenie — usuwa je z bazy.
 
    Waliduje token, właściciela i wygaśnięcie.
    Po odrzuceniu usuwa zaproszenie z bazy.
    """
    invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.invite_token == invite_token
    ).first()

    if not invite:
        raise HTTPException(status_code=404, detail="Zaproszenie nie istnieje")
    if invite.invited_id != user_id:
        raise HTTPException(status_code=403, detail="To zaproszenie nie jest dla Ciebie")
    if invite.is_used:
        raise HTTPException(status_code=409, detail="Zaproszenie już użyte")
    
    try:
        db.delete(invite)
        db.commit()
        return {"message": "Zaproszenie odrzucone"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Błąd odrzucania: {str(e)}")
    
def get_user_pending_invites(db: Session, user_id: int) -> List[PendingInviteResponse]:
    """
    Pobiera aktywne zaproszenia dla usera.
 
    Zwraca listę zaproszeń, które nie są użyte i nie wygasły.
    """
    invites = (
        db.query(WorkspaceInvite)
        .filter(
            and_(
                WorkspaceInvite.invited_id == user_id,
                WorkspaceInvite.is_used == False,
                WorkspaceInvite.expires_at > datetime.utcnow(),
            )
        )
        .order_by(WorkspaceInvite.created_at.desc())
        .all()
    )

    result = []
    for invite in invites:
        workspace = db.query(Workspace).filter(
            Workspace.id == invite.workspace_id
        ).first()
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
