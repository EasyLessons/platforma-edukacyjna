"""
Testy systemu zaproszeń
api/v1/workspaces/invites_service.py
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

from api.v1.workspaces.invites_service import InviteService
from api.v1.workspaces.schemas import (
    InviteResponse,
    AcceptInviteResponse,
)
from core.exceptions import NotFoundError, ConflictError, AppException
from core.models import WorkspaceInvite, WorkspaceMember

MOCK_EMAIL = "api.v1.workspaces.invites_service.send_workspace_invite_email"
MOCK_BROADCAST = "api.v1.workspaces.invites_service.broadcast_notification"
MOCK_NOTIFICATION = "api.v1.workspaces.invites_service.create_notification"


def make_invite(db, workspace_id, invited_by, invited_id, *, expired=False, used=False):
    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        invited_by=invited_by,
        invited_id=invited_id,
        invite_token=f"token-{invited_id}-{datetime.utcnow().timestamp()}",
        expires_at=datetime.utcnow() + (timedelta(days=-1) if expired else timedelta(days=7)),
        is_used=used,
        created_at=datetime.utcnow(),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite

class TestCreateInvite:

    @pytest.mark.asyncio
    async def test_returns_invite_response(self, db_session, test_workspace, test_user, test_user2):
        service = InviteService(db_session)
        with patch(MOCK_NOTIFICATION), patch(MOCK_BROADCAST, new_callable=AsyncMock), patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await service.create_invite(test_workspace.id, test_user.id, test_user2.id, send_email=False)
        assert isinstance(result, InviteResponse)
        assert result.invited_id == test_user2.id

    @pytest.mark.asyncio
    async def test_stores_invite_in_db(self, db_session, test_workspace, test_user, test_user2):
        service = InviteService(db_session)
        with patch(MOCK_NOTIFICATION), patch(MOCK_BROADCAST, new_callable=AsyncMock):
            result = await service.create_invite(test_workspace.id, test_user.id, test_user2.id, send_email=False)
        invite = db_session.query(WorkspaceInvite).filter(WorkspaceInvite.id == result.id).first()
        assert invite is not None
        assert invite.is_used is False

    @pytest.mark.asyncio
    async def test_token_is_generated(self, db_session, test_workspace, test_user, test_user2):
        service = InviteService(db_session)
        with patch(MOCK_NOTIFICATION), patch(MOCK_BROADCAST, new_callable=AsyncMock):
            result = await service.create_invite(test_workspace.id, test_user.id, test_user2.id, send_email=False)
        assert len(result.invite_token) > 20

    @pytest.mark.asyncio
    async def test_creates_notification(self, db_session, test_workspace, test_user, test_user2):
        service = InviteService(db_session)
        with patch(MOCK_NOTIFICATION) as mock_notif, patch(MOCK_BROADCAST, new_callable=AsyncMock):
            await service.create_invite(test_workspace.id, test_user.id, test_user2.id, send_email=False)
        mock_notif.assert_called_once()

    @pytest.mark.asyncio
    async def test_nonexistent_workspace_raises_not_found(self, db_session, test_user, test_user2):
        service = InviteService(db_session)
        with pytest.raises(NotFoundError):
            await service.create_invite(99999, test_user.id, test_user2.id, send_email=False)

    @pytest.mark.asyncio
    async def test_non_member_cannot_invite(self, db_session, test_workspace, test_user2, test_user3):
        service = InviteService(db_session)
        with pytest.raises(NotFoundError):
            await service.create_invite(test_workspace.id, test_user2.id, test_user3.id, send_email=False)

    @pytest.mark.asyncio
    async def test_already_member_raises_conflict(self, db_session, test_workspace, test_user, test_user2):
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        service = InviteService(db_session)
        with pytest.raises(ConflictError):
            await service.create_invite(test_workspace.id, test_user.id, test_user2.id, send_email=False)

    @pytest.mark.asyncio
    async def test_duplicate_invite_raises_conflict(self, db_session, test_workspace, test_user, test_user2):
        service = InviteService(db_session)
        with patch(MOCK_NOTIFICATION), patch(MOCK_BROADCAST, new_callable=AsyncMock):
            await service.create_invite(test_workspace.id, test_user.id, test_user2.id, send_email=False)

        with pytest.raises(ConflictError):
            await service.create_invite(test_workspace.id, test_user.id, test_user2.id, send_email=False)

class TestAcceptInvite:

    def test_returns_accept_response(self, db_session, test_invite, test_user2):
        service = InviteService(db_session)
        result = service.accept_invite(test_invite.invite_token, test_user2.id)
        assert isinstance(result, AcceptInviteResponse)
        assert result.role == "editor"

    def test_creates_membership(self, db_session, test_invite, test_user2):
        service = InviteService(db_session)
        service.accept_invite(test_invite.invite_token, test_user2.id)
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_invite.workspace_id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        assert membership is not None
        assert membership.role == "editor"

    def test_deletes_invite_after_accept(self, db_session, test_invite, test_user2):
        service = InviteService(db_session)
        token = test_invite.invite_token
        service.accept_invite(token, test_user2.id)
        invite = db_session.query(WorkspaceInvite).filter(
            WorkspaceInvite.invite_token == token
        ).first()
        assert invite is None

    def test_nonexistent_token_raises_not_found(self, db_session, test_user2):
        service = InviteService(db_session)
        with pytest.raises(NotFoundError):
            service.accept_invite("fake-token", test_user2.id)

    def test_wrong_user_raises_403(self, db_session, test_invite, test_user3):
        service = InviteService(db_session)
        with pytest.raises(AppException) as exc:
            service.accept_invite(test_invite.invite_token, test_user3.id)
        assert exc.value.status_code == 403

    def test_expired_invite_raises_410(self, db_session, test_workspace, test_user, test_user2):
        invite = make_invite(db_session, test_workspace.id, test_user.id, test_user2.id, expired=True)
        service = InviteService(db_session)
        with pytest.raises(AppException) as exc:
            service.accept_invite(invite.invite_token, test_user2.id)
        assert exc.value.status_code == 410

    def test_used_invite_raises_conflict(self, db_session, test_workspace, test_user, test_user2):
        invite = make_invite(db_session, test_workspace.id, test_user.id, test_user2.id, used=True)
        service = InviteService(db_session)
        with pytest.raises(ConflictError):
            service.accept_invite(invite.invite_token, test_user2.id)

class TestRejectInvite:

    def test_deletes_invite(self, db_session, test_invite, test_user2):
        service = InviteService(db_session)
        token = test_invite.invite_token
        service.reject_invite(token, test_user2.id)
        invite = db_session.query(WorkspaceInvite).filter(
            WorkspaceInvite.invite_token == token
        ).first()
        assert invite is None

    def test_does_not_create_membership(self, db_session, test_invite, test_user2):
        service = InviteService(db_session)
        service.reject_invite(test_invite.invite_token, test_user2.id)
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_invite.workspace_id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        assert membership is None

    def test_nonexistent_token_raises_not_found(self, db_session, test_user2):
        service = InviteService(db_session)
        with pytest.raises(NotFoundError):
            service.reject_invite("fake-token", test_user2.id)

    def test_wrong_user_raises_403(self, db_session, test_invite, test_user3):
        service = InviteService(db_session)
        with pytest.raises(AppException) as exc:
            service.reject_invite(test_invite.invite_token, test_user3.id)
        assert exc.value.status_code == 403

    def test_used_invite_raises_conflict(self, db_session, test_workspace, test_user, test_user2):
        invite = make_invite(db_session, test_workspace.id, test_user.id, test_user2.id, used=True)
        service = InviteService(db_session)
        with pytest.raises(ConflictError):
            service.reject_invite(invite.invite_token, test_user2.id)