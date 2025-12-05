"""
Testy dla systemu zaproszeń do workspace'ów
"""
import pytest
from datetime import datetime, timedelta
from fastapi import HTTPException
from unittest.mock import patch, AsyncMock

from dashboard.workspaces.service import (
    create_invite,
    get_user_pending_invites,
    accept_invite,
    reject_invite
)
from dashboard.workspaces.schemas import InviteResponse, PendingInviteResponse
from core.models import WorkspaceInvite, WorkspaceMember, Workspace


class TestCreateInvite:
    """Testy tworzenia zaproszeń"""
    
    def test_create_invite_success(self, db_session, test_workspace, test_user, test_user2):
        """Test pomyślnego utworzenia zaproszenia"""
        
        # Mock wysyłania emaila
        with patch('dashboard.workspaces.service.send_workspace_invite_email', 
                   new_callable=AsyncMock) as mock_email:
            result = create_invite(
                db_session,
                workspace_id=test_workspace.id,
                user_id=test_user.id,
                invited_user_id=test_user2.id,
                send_email=True
            )
        
        assert isinstance(result, InviteResponse)
        assert result.workspace_id == test_workspace.id
        assert result.invited_by == test_user.id
        assert result.invited_id == test_user2.id
        assert result.invite_token is not None
        assert len(result.invite_token) > 30  # Token powinien być długi
        assert result.expires_at > datetime.utcnow()
        
        # Sprawdź czy zaproszenie w bazie
        invite = db_session.query(WorkspaceInvite).filter(
            WorkspaceInvite.invited_id == test_user2.id
        ).first()
        assert invite is not None
        assert invite.is_used == False
    
    def test_create_invite_without_email(self, db_session, test_workspace, test_user, test_user2):
        """Test tworzenia zaproszenia bez wysyłania emaila"""
        
        result = create_invite(
            db_session,
            workspace_id=test_workspace.id,
            user_id=test_user.id,
            invited_user_id=test_user2.id,
            send_email=False  # Bez emaila
        )
        
        assert isinstance(result, InviteResponse)
        assert result.invited_id == test_user2.id
    
    def test_create_invite_workspace_not_exists(self, db_session, test_user, test_user2):
        """Test tworzenia zaproszenia do nieistniejącego workspace'a"""
        
        with pytest.raises(HTTPException) as exc:
            create_invite(
                db_session,
                workspace_id=99999,  # Nieistniejące
                user_id=test_user.id,
                invited_user_id=test_user2.id
            )
        
        assert exc.value.status_code == 404
        assert "Workspace nie istnieje" in str(exc.value.detail)
    
    def test_create_invite_not_a_member(self, db_session, test_workspace, test_user2, test_user3):
        """Test czy tylko członkowie mogą zapraszać"""
        
        with pytest.raises(HTTPException) as exc:
            create_invite(
                db_session,
                workspace_id=test_workspace.id,
                user_id=test_user2.id,  # test_user2 nie jest członkiem
                invited_user_id=test_user3.id
            )
        
        assert exc.value.status_code == 403
        assert "Nie jesteś członkiem" in str(exc.value.detail)
    
    def test_create_invite_user_not_exists(self, db_session, test_workspace, test_user):
        """Test zapraszania nieistniejącego użytkownika"""
        
        with pytest.raises(HTTPException) as exc:
            create_invite(
                db_session,
                workspace_id=test_workspace.id,
                user_id=test_user.id,
                invited_user_id=99999  # Nieistniejący użytkownik
            )
        
        assert exc.value.status_code == 404
        assert "Użytkownik nie istnieje" in str(exc.value.detail)
    
    def test_create_invite_already_member(self, db_session, test_workspace, test_user, test_user2):
        """Test zapraszania użytkownika który już jest członkiem"""
        
        # Dodaj test_user2 jako członka
        membership = WorkspaceMember(
            workspace_id=test_workspace.id,
            user_id=test_user2.id,
            role="member",
            is_favourite=False,
            joined_at=datetime.utcnow()
        )
        db_session.add(membership)
        db_session.commit()
        
        with pytest.raises(HTTPException) as exc:
            create_invite(
                db_session,
                workspace_id=test_workspace.id,
                user_id=test_user.id,
                invited_user_id=test_user2.id
            )
        
        assert exc.value.status_code == 409
        assert "już jest członkiem" in str(exc.value.detail)
    
    def test_create_invite_duplicate_active(self, db_session, test_workspace, test_user, test_user2):
        """Test tworzenia duplikatu aktywnego zaproszenia"""
        
        # Utwórz pierwsze zaproszenie
        create_invite(
            db_session,
            workspace_id=test_workspace.id,
            user_id=test_user.id,
            invited_user_id=test_user2.id,
            send_email=False
        )
        
        # Próba utworzenia drugiego
        with pytest.raises(HTTPException) as exc:
            create_invite(
                db_session,
                workspace_id=test_workspace.id,
                user_id=test_user.id,
                invited_user_id=test_user2.id,
                send_email=False
            )
        
        assert exc.value.status_code == 409
        assert "Aktywne zaproszenie już istnieje" in str(exc.value.detail)
    
    def test_create_invite_token_uniqueness(self, db_session, test_workspace, test_user, test_user2, test_user3):
        """Test czy tokeny są unikalne"""
        
        invite1 = create_invite(
            db_session,
            workspace_id=test_workspace.id,
            user_id=test_user.id,
            invited_user_id=test_user2.id,
            send_email=False
        )
        
        invite2 = create_invite(
            db_session,
            workspace_id=test_workspace.id,
            user_id=test_user.id,
            invited_user_id=test_user3.id,
            send_email=False
        )
        
        assert invite1.invite_token != invite2.invite_token


class TestGetPendingInvites:
    """Testy pobierania oczekujących zaproszeń"""
    
    def test_get_pending_invites_success(self, db_session, test_invite, test_user2):
        """Test pobierania oczekujących zaproszeń"""
        
        result = get_user_pending_invites(db_session, test_user2.id)
        
        assert isinstance(result, list)
        assert len(result) == 1
        assert isinstance(result[0], PendingInviteResponse)
        assert result[0].invited_id == test_user2.id
        assert result[0].workspace_name == "Test Workspace"
        assert result[0].inviter_name == "testuser"
    
    def test_get_pending_invites_empty(self, db_session, test_user3):
        """Test gdy użytkownik nie ma zaproszeń"""
        
        result = get_user_pending_invites(db_session, test_user3.id)
        
        assert isinstance(result, list)
        assert len(result) == 0
    
    def test_get_pending_invites_excludes_expired(self, db_session, expired_invite, test_user2):
        """Test czy wygasłe zaproszenia są pomijane"""
        
        result = get_user_pending_invites(db_session, test_user2.id)
        
        assert len(result) == 0
    
    def test_get_pending_invites_excludes_used(self, db_session, used_invite, test_user2):
        """Test czy użyte zaproszenia są pomijane"""
        
        result = get_user_pending_invites(db_session, test_user2.id)
        
        assert len(result) == 0
    
    def test_get_pending_invites_multiple(self, db_session, test_user, test_user2, test_workspace):
        """Test pobierania wielu zaproszeń"""
        
        # Utwórz drugie workspace i zaproszenie
        workspace2 = Workspace(
            name="Second Workspace",
            icon="Star",
            bg_color="bg-blue-500",
            created_by=test_user.id,
            created_at=datetime.utcnow()
        )
        db_session.add(workspace2)
        db_session.flush()
        
        # Dodaj membership dla test_user w workspace2
        membership = WorkspaceMember(
            workspace_id=workspace2.id,
            user_id=test_user.id,
            role="owner",
            is_favourite=False,
            joined_at=datetime.utcnow()
        )
        db_session.add(membership)
        db_session.commit()
        
        # Utwórz zaproszenia
        create_invite(db_session, test_workspace.id, test_user.id, test_user2.id, send_email=False)
        create_invite(db_session, workspace2.id, test_user.id, test_user2.id, send_email=False)
        
        result = get_user_pending_invites(db_session, test_user2.id)
        
        assert len(result) == 2
        workspace_names = [inv.workspace_name for inv in result]
        assert "Test Workspace" in workspace_names
        assert "Second Workspace" in workspace_names


class TestAcceptInvite:
    """Testy akceptowania zaproszeń"""
    
    def test_accept_invite_success(self, db_session, test_invite, test_user2):
        """Test pomyślnej akceptacji zaproszenia"""
        
        result = accept_invite(db_session, test_invite.invite_token, test_user2.id)
        
        assert "message" in result
        assert "workspace_id" in result
        assert "workspace_name" in result
        assert result["workspace_id"] == test_invite.workspace_id
        assert result["role"] == "member"
        
        # Sprawdź czy użytkownik został dodany do workspace
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_invite.workspace_id,
            WorkspaceMember.user_id == test_user2.id
        ).first()
        assert membership is not None
        assert membership.role == "member"
        
        # Sprawdź czy zaproszenie oznaczone jako użyte
        db_session.refresh(test_invite)
        assert test_invite.is_used == True
        assert test_invite.accepted_at is not None
    
    def test_accept_invite_not_exists(self, db_session, test_user2):
        """Test akceptacji nieistniejącego zaproszenia"""
        
        with pytest.raises(HTTPException) as exc:
            accept_invite(db_session, "fake-token-123", test_user2.id)
        
        assert exc.value.status_code == 404
        assert "Zaproszenie nie istnieje" in str(exc.value.detail)
    
    def test_accept_invite_wrong_user(self, db_session, test_invite, test_user3):
        """Test akceptacji zaproszenia przez niewłaściwego użytkownika"""
        
        with pytest.raises(HTTPException) as exc:
            accept_invite(db_session, test_invite.invite_token, test_user3.id)
        
        assert exc.value.status_code == 403
        assert "nie jest dla Ciebie" in str(exc.value.detail)
    
    def test_accept_invite_expired(self, db_session, expired_invite, test_user2):
        """Test akceptacji wygasłego zaproszenia"""
        
        with pytest.raises(HTTPException) as exc:
            accept_invite(db_session, expired_invite.invite_token, test_user2.id)
        
        assert exc.value.status_code == 410
        assert "wygasło" in str(exc.value.detail)
    
    def test_accept_invite_already_used(self, db_session, used_invite, test_user2):
        """Test akceptacji już użytego zaproszenia"""
        
        with pytest.raises(HTTPException) as exc:
            accept_invite(db_session, used_invite.invite_token, test_user2.id)
        
        assert exc.value.status_code == 409
        assert "już użyte" in str(exc.value.detail)
    
    def test_accept_invite_already_member(self, db_session, test_invite, test_user2):
        """Test akceptacji gdy użytkownik już jest członkiem"""
        
        # Dodaj użytkownika do workspace
        membership = WorkspaceMember(
            workspace_id=test_invite.workspace_id,
            user_id=test_user2.id,
            role="member",
            is_favourite=False,
            joined_at=datetime.utcnow()
        )
        db_session.add(membership)
        db_session.commit()
        
        with pytest.raises(HTTPException) as exc:
            accept_invite(db_session, test_invite.invite_token, test_user2.id)
        
        assert exc.value.status_code == 409
        assert "Już jesteś członkiem" in str(exc.value.detail)


class TestRejectInvite:
    """Testy odrzucania zaproszeń"""
    
    def test_reject_invite_success(self, db_session, test_invite, test_user2):
        """Test pomyślnego odrzucenia zaproszenia"""
        
        result = reject_invite(db_session, test_invite.invite_token, test_user2.id)
        
        assert "message" in result
        assert "odrzucone" in result["message"].lower()
        
        # Sprawdź czy zaproszenie oznaczone jako użyte
        db_session.refresh(test_invite)
        assert test_invite.is_used == True
        assert test_invite.accepted_at is not None
        
        # Sprawdź że użytkownik NIE został dodany
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_invite.workspace_id,
            WorkspaceMember.user_id == test_user2.id
        ).first()
        assert membership is None
    
    def test_reject_invite_not_exists(self, db_session, test_user2):
        """Test odrzucenia nieistniejącego zaproszenia"""
        
        with pytest.raises(HTTPException) as exc:
            reject_invite(db_session, "fake-token-123", test_user2.id)
        
        assert exc.value.status_code == 404
    
    def test_reject_invite_wrong_user(self, db_session, test_invite, test_user3):
        """Test odrzucenia zaproszenia przez niewłaściwego użytkownika"""
        
        with pytest.raises(HTTPException) as exc:
            reject_invite(db_session, test_invite.invite_token, test_user3.id)
        
        assert exc.value.status_code == 403
    
    def test_reject_invite_already_used(self, db_session, used_invite, test_user2):
        """Test odrzucenia już użytego zaproszenia"""
        
        with pytest.raises(HTTPException) as exc:
            reject_invite(db_session, used_invite.invite_token, test_user2.id)
        
        assert exc.value.status_code == 409


class TestInviteEdgeCases:
    """Testy przypadków brzegowych"""
    
    def test_invite_expiration_boundary(self, db_session, test_workspace, test_user, test_user2):
        """Test granicy wygasania zaproszenia"""
        
        # Utwórz zaproszenie wygasające za 1 sekundę
        invite = WorkspaceInvite(
            workspace_id=test_workspace.id,
            invited_by=test_user.id,
            invited_id=test_user2.id,
            invite_token="test-boundary-token",
            expires_at=datetime.utcnow() + timedelta(seconds=1),
            is_used=False,
            created_at=datetime.utcnow()
        )
        db_session.add(invite)
        db_session.commit()
        
        # Akceptacja powinna działać
        result = accept_invite(db_session, "test-boundary-token", test_user2.id)
        assert "message" in result
    
    def test_multiple_invites_different_workspaces(self, db_session, test_user, test_user2):
        """Test wielu zaproszeń do różnych workspace'ów dla tego samego użytkownika"""
        
        # Utwórz 3 workspace'y
        workspaces = []
        for i in range(3):
            ws = Workspace(
                name=f"Workspace {i}",
                icon="Home",
                bg_color="bg-green-500",
                created_by=test_user.id,
                created_at=datetime.utcnow()
            )
            db_session.add(ws)
            db_session.flush()
            
            # Membership dla test_user
            membership = WorkspaceMember(
                workspace_id=ws.id,
                user_id=test_user.id,
                role="owner",
                is_favourite=False,
                joined_at=datetime.utcnow()
            )
            db_session.add(membership)
            workspaces.append(ws)
        
        db_session.commit()
        
        # Utwórz zaproszenia
        for ws in workspaces:
            create_invite(db_session, ws.id, test_user.id, test_user2.id, send_email=False)
        
        # Pobierz zaproszenia
        invites = get_user_pending_invites(db_session, test_user2.id)
        assert len(invites) == 3
        
        # Akceptuj jedno
        accept_invite(db_session, invites[0].invite_token, test_user2.id)
        
        # Sprawdź że pozostały 2
        remaining = get_user_pending_invites(db_session, test_user2.id)
        assert len(remaining) == 2


class TestInviteIntegration:
    """Testy integracyjne - kompletne scenariusze"""
    
    def test_full_invitation_workflow(self, db_session, test_workspace, test_user, test_user2):
        """Test pełnego przepływu zaproszenia"""
        
        # 1. Utwórz zaproszenie
        with patch('dashboard.workspaces.service.send_workspace_invite_email', 
                   new_callable=AsyncMock) as mock_email:
            invite = create_invite(
                db_session,
                workspace_id=test_workspace.id,
                user_id=test_user.id,
                invited_user_id=test_user2.id,
                send_email=True
            )
        
        # Sprawdź czy email został wywołany
        mock_email.assert_called_once()
        
        # 2. Pobierz zaproszenia
        pending = get_user_pending_invites(db_session, test_user2.id)
        assert len(pending) == 1
        assert pending[0].workspace_id == test_workspace.id
        
        # 3. Akceptuj zaproszenie
        result = accept_invite(db_session, invite.invite_token, test_user2.id)
        assert result["workspace_id"] == test_workspace.id
        
        # 4. Sprawdź że zaproszenie zniknęło z listy oczekujących
        pending_after = get_user_pending_invites(db_session, test_user2.id)
        assert len(pending_after) == 0
        
        # 5. Sprawdź członkostwo
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user2.id
        ).first()
        assert membership is not None
        assert membership.role == "member"