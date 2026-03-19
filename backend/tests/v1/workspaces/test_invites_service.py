"""
Testy systemu zaproszeń
api/v1/workspaces/invites_service.py
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

from api.v1.workspaces.invites_service import (
    create_invite,
    accept_invite,
    reject_invite,
    get_user_pending_invites,
    check_invite_status,
)
from api.v1.workspaces.schemas import (
    InviteResponse,
    AcceptInviteResponse,
    InviteStatusResponse,
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
        with patch(MOCK_NOTIFICATION), patch(MOCK_BROADCAST, new_callable=AsyncMock), patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await create_invite(db_session, test_workspace.id, test_user.id, test_user2.id, send_email=False)
        assert isinstance(result, InviteResponse)
        assert result.invited_id == test_user2.id
 
    @pytest.mark.asyncio
    async def test_stores_invite_in_db(self, db_session, test_workspace, test_user, test_user2):
        with patch(MOCK_NOTIFICATION), patch(MOCK_BROADCAST, new_callable=AsyncMock):
            result = await create_invite(db_session, test_workspace.id, test_user.id, test_user2.id, send_email=False)
        invite = db_session.query(WorkspaceInvite).filter(WorkspaceInvite.id == result.id).first()
        assert invite is not None
        assert invite.is_used is False
 
    @pytest.mark.asyncio
    async def test_token_is_generated(self, db_session, test_workspace, test_user, test_user2):
        with patch(MOCK_NOTIFICATION), patch(MOCK_BROADCAST, new_callable=AsyncMock):
            result = await create_invite(db_session, test_workspace.id, test_user.id, test_user2.id, send_email=False)
        assert len(result.invite_token) > 20
 
    @pytest.mark.asyncio
    async def test_creates_notification(self, db_session, test_workspace, test_user, test_user2):
        with patch(MOCK_NOTIFICATION) as mock_notif, patch(MOCK_BROADCAST, new_callable=AsyncMock):
            await create_invite(db_session, test_workspace.id, test_user.id, test_user2.id, send_email=False)
        mock_notif.assert_called_once()
 
    @pytest.mark.asyncio
    async def test_nonexistent_workspace_raises_not_found(self, db_session, test_user, test_user2):
        with pytest.raises(NotFoundError):
            await create_invite(db_session, 99999, test_user.id, test_user2.id, send_email=False)
 
    @pytest.mark.asyncio
    async def test_non_member_cannot_invite(self, db_session, test_workspace, test_user2, test_user3):
        with pytest.raises(AppException) as exc:
            await create_invite(db_session, test_workspace.id, test_user2.id, test_user3.id, send_email=False)
        assert exc.value.status_code == 403
 
    @pytest.mark.asyncio
    async def test_already_member_raises_conflict(self, db_session, test_workspace, test_user, test_user2):
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()
 
        with pytest.raises(ConflictError):
            await create_invite(db_session, test_workspace.id, test_user.id, test_user2.id, send_email=False)
 
    @pytest.mark.asyncio
    async def test_duplicate_invite_raises_conflict(self, db_session, test_workspace, test_user, test_user2):
        with patch(MOCK_NOTIFICATION), patch(MOCK_BROADCAST, new_callable=AsyncMock):
            await create_invite(db_session, test_workspace.id, test_user.id, test_user2.id, send_email=False)
 
        with pytest.raises(ConflictError):
            await create_invite(db_session, test_workspace.id, test_user.id, test_user2.id, send_email=False)

class TestAcceptInvite:

    def test_returns_accept_response(self, db_session, test_invite, test_user2):
        result = accept_invite(db_session, test_invite.invite_token, test_user2.id)
        assert isinstance(result, AcceptInviteResponse)
        assert result.role == "editor"

    def test_creates_membership(self, db_session, test_invite, test_user2):
        accept_invite(db_session, test_invite.invite_token, test_user2.id)
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_invite.workspace_id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        assert membership is not None
        assert membership.role == "editor"

    def test_deletes_invite_after_accept(self, db_session, test_invite, test_user2):
        token = test_invite.invite_token
        accept_invite(db_session, token, test_user2.id)
        invite = db_session.query(WorkspaceInvite).filter(
            WorkspaceInvite.invite_token == token
        ).first()
        assert invite is None

    def test_nonexistent_token_raises_not_found(self, db_session, test_user2):
        with pytest.raises(NotFoundError):
            accept_invite(db_session, "fake-token", test_user2.id)

    def test_wrong_user_raises_403(self, db_session, test_invite, test_user3):
        with pytest.raises(AppException) as exc:
            accept_invite(db_session, test_invite.invite_token, test_user3.id)
        assert exc.value.status_code == 403

    def test_expired_invite_raises_410(self, db_session, test_workspace, test_user, test_user2):
        invite = make_invite(db_session, test_workspace.id, test_user.id, test_user2.id, expired=True)
        with pytest.raises(AppException) as exc:
            accept_invite(db_session, invite.invite_token, test_user2.id)
        assert exc.value.status_code == 410

    def test_used_invite_raises_conflict(self, db_session, test_workspace, test_user, test_user2):
        invite = make_invite(db_session, test_workspace.id, test_user.id, test_user2.id, used=True)
        with pytest.raises(ConflictError):
            accept_invite(db_session, invite.invite_token, test_user2.id)

class TestRejectInvite:

    def test_deletes_invite(self, db_session, test_invite, test_user2):
        token = test_invite.invite_token
        reject_invite(db_session, token, test_user2.id)
        invite = db_session.query(WorkspaceInvite).filter(
            WorkspaceInvite.invite_token == token
        ).first()
        assert invite is None

    def test_does_not_create_membership(self, db_session, test_invite, test_user2):
        reject_invite(db_session, test_invite.invite_token, test_user2.id)
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_invite.workspace_id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        assert membership is None

    def test_nonexistent_token_raises_not_found(self, db_session, test_user2):
        with pytest.raises(NotFoundError):
            reject_invite(db_session, "fake-token", test_user2.id)

    def test_wrong_user_raises_403(self, db_session, test_invite, test_user3):
        with pytest.raises(AppException) as exc:
            reject_invite(db_session, test_invite.invite_token, test_user3.id)
        assert exc.value.status_code == 403

    def test_used_invite_raises_conflict(self, db_session, test_workspace, test_user, test_user2):
        invite = make_invite(db_session, test_workspace.id, test_user.id, test_user2.id, used=True)
        with pytest.raises(ConflictError):
            reject_invite(db_session, invite.invite_token, test_user2.id)

class TestGetPendingInvites:

    def test_returns_pending_invites(self, db_session, test_invite, test_user2):
        result = get_user_pending_invites(db_session, test_user2.id)
        assert len(result) == 1
        assert result[0].invite_token == test_invite.invite_token

    def test_empty_for_no_invites(self, db_session, test_user2):
        result = get_user_pending_invites(db_session, test_user2.id)
        assert result == []

    def test_excludes_expired(self, db_session, test_workspace, test_user, test_user2):
        make_invite(db_session, test_workspace.id, test_user.id, test_user2.id, expired=True)
        result = get_user_pending_invites(db_session, test_user2.id)
        assert result == []

    def test_excludes_used(self, db_session, test_workspace, test_user, test_user2):
        make_invite(db_session, test_workspace.id, test_user.id, test_user2.id, used=True)
        result = get_user_pending_invites(db_session, test_user2.id)
        assert result == []

    def test_includes_workspace_info(self, db_session, test_invite, test_user2):
        result = get_user_pending_invites(db_session, test_user2.id)
        assert result[0].workspace_name is not None
        assert result[0].inviter_name is not None

class TestCheckInviteStatus:

    def test_can_invite_new_user(self, db_session, test_workspace, test_user2):
        result = check_invite_status(db_session, test_workspace.id, test_user2.id)
        assert isinstance(result, InviteStatusResponse)
        assert result.is_member is False
        assert result.has_pending_invite is False
        assert result.can_invite is True

    def test_cannot_invite_existing_member(self, db_session, test_workspace, test_user):
        result = check_invite_status(db_session, test_workspace.id, test_user.id)
        assert result.is_member is True
        assert result.can_invite is False

    def test_cannot_invite_with_pending_invite(self, db_session, test_invite, test_user2):
        result = check_invite_status(db_session, test_invite.workspace_id, test_user2.id)
        assert result.has_pending_invite is True
        assert result.can_invite is False