"""
Testy ShareLinkService
api/v1.workspaces/share_links/service.py
"""
import secrets
from datetime import datetime, timedelta

import pytest

from api.v1.workspaces.share_links.service import ShareLinkService
from api.v1.workspaces.share_links.schemas import ShareLinkResponse, ShareLinkPreview, JoinShareLinkResponse
from core.exceptions import NotFoundError, AppException
from core.models import Board, WorkspaceMember, WorkspaceShareLink

def make_viewer(db_session, workspace_id, user_id):
    member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=user_id,
        role="viewer", 
        is_favourite=False,
        joined_at=datetime.utcnow(),
    )
    db_session.add(member)
    db_session.commit()
    return member

def make_link(db_session, workspace_id, board_id=None, *, expired=False, revoked=False):
    link = WorkspaceShareLink(
        workspace_id=workspace_id,
        board_id=board_id,
        token=secrets.token_urlsafe(16),
        expires_at=datetime.utcnow() - timedelta(days=1) if expired else datetime.utcnow() + timedelta(days=90),
        revoked_at=datetime.utcnow() if revoked else None,
    )
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)
    return link


class TestCreateLink:

    def test_editor_can_create(self, db_session, shared_workspace, test_user2):
        service = ShareLinkService(db_session)
        result = service.get_or_create_link(shared_workspace.id, None, test_user2.id)
        assert isinstance(result, ShareLinkResponse)
        assert result.workspace_id == shared_workspace.id
        assert result.board_id is None

    def test_owner_can_create(self, db_session, test_workspace, test_user):
        service = ShareLinkService(db_session)
        result = service.get_or_create_link(test_workspace.id, None, test_user.id)
        assert isinstance(result, ShareLinkResponse)

    def test_viewer_forbidden(self, db_session, test_workspace, test_user3):
        make_viewer(db_session, test_workspace.id, test_user3.id)
        service = ShareLinkService(db_session)
        with pytest.raises(AppException) as exc_info:
            service.get_or_create_link(test_workspace.id, None, test_user3.id)
        assert exc_info.value.status_code == 403

    def test_nonexistent_workspace_raises_not_found(self, db_session, test_user):
        service = ShareLinkService(db_session)
        with pytest.raises(NotFoundError):
            service.get_or_create_link(99999, None, test_user.id)

    def test_board_from_other_workspace_rejected(self, db_session, test_workspace, test_user, test_workspace2, test_user2):
        other_board = Board(
            name="Other board",
            icon="PenTool",
            workspace_id=test_workspace2.id,
            created_by=test_user2.id,
            created_at=datetime.utcnow(),
            last_modified_by=test_user2.id,
        )
        db_session.add(other_board)
        db_session.commit()
        db_session.refresh(other_board)

        service = ShareLinkService(db_session)
        with pytest.raises(AppException) as exc_info:
            service.get_or_create_link(test_workspace.id, other_board.id, test_user.id)
        assert exc_info.value.status_code == 400

    def test_reuses_existing_active_link(self, db_session, test_workspace, test_user):
        service = ShareLinkService(db_session)
        first = service.get_or_create_link(test_workspace.id, None, test_user.id)
        second = service.get_or_create_link(test_workspace.id, None, test_user.id)
        assert first.token == second.token

    def test_different_board_id_gets_different_token(self, db_session, test_workspace, test_user, test_board):
        service = ShareLinkService(db_session)
        workspace_link = service.get_or_create_link(test_workspace.id, None, test_user.id)
        board_link = service.get_or_create_link(test_workspace.id, test_board.id, test_user.id)
        assert workspace_link.token != board_link.token

        
class TestRevokeLink:

    def test_revoke_blocks_future_preview(self, db_session, test_workspace, test_user):
        link = make_link(db_session, test_workspace.id)
        service = ShareLinkService(db_session)
        service.revoke_link(test_workspace.id, link.token, test_user.id)

        with pytest.raises(AppException) as exc_info:
            service.preview_link(link.token, test_user.id)
        assert exc_info.value.status_code == 410

    def test_viewer_forbidden(self, db_session, test_workspace, test_user3):
        link = make_link(db_session, test_workspace.id)
        make_viewer(db_session, test_workspace.id, test_user3.id)
        service = ShareLinkService(db_session)
        with pytest.raises(AppException) as exc_info:
            service.revoke_link(test_workspace.id, link.token, test_user3.id)
        assert exc_info.value.status_code == 403

    def test_unknown_token_raises_not_found(self, db_session, test_workspace, test_user):
        service = ShareLinkService(db_session)
        with pytest.raises(NotFoundError):
            service.revoke_link(test_workspace.id, "does-not-exist", test_user.id)


class TestRefreshLink:

    def test_old_token_revoked_new_token_active(self, db_session, test_workspace, test_user):
        service = ShareLinkService(db_session)
        original = service.get_or_create_link(test_workspace.id, None, test_user.id)

        refreshed = service.refresh_link(test_workspace.id, None, test_user.id)
        assert refreshed.token != original.token

        old_link = db_session.query(WorkspaceShareLink).filter(WorkspaceShareLink.token == original.token).first()
        assert old_link.revoked_at is not None

        with pytest.raises(AppException) as exc_info:
            service.preview_link(original.token, test_user.id)
        assert exc_info.value.status_code == 410

    def test_refresh_without_existing_link_just_creates(self, db_session, test_workspace, test_user):
        service = ShareLinkService(db_session)
        refreshed = service.refresh_link(test_workspace.id, None, test_user.id)
        assert isinstance(refreshed, ShareLinkResponse)

class TestPreviewLink:

    def test_unknown_token_raises_not_found(self, db_session, test_user):
        service = ShareLinkService(db_session)
        with pytest.raises(NotFoundError):
            service.preview_link("does-not-exist", test_user.id)

    def test_revoked_token_raises_410(self, db_session, test_workspace, test_user):
        link = make_link(db_session, test_workspace.id, revoked=True)
        service = ShareLinkService(db_session)
        with pytest.raises(AppException) as exc_info:
            service.preview_link(link.token, test_user.id)
        assert exc_info.value.status_code == 410
        assert "unieważniony" in exc_info.value.message

    def test_expired_token_raises_410(self, db_session, test_workspace, test_user):
        link = make_link(db_session, test_workspace.id, expired=True)
        service = ShareLinkService(db_session)
        with pytest.raises(AppException) as exc_info:
            service.preview_link(link.token, test_user.id)
        assert exc_info.value.status_code == 410
        assert "wygasł" in exc_info.value.message

    def test_valid_token_returns_preview(self, db_session, test_workspace, test_user3):
        link = make_link(db_session, test_workspace.id)
        service = ShareLinkService(db_session)
        result = service.preview_link(link.token, test_user3.id)
        assert isinstance(result, ShareLinkPreview)
        assert result.workspace_id == test_workspace.id
        assert result.already_member is False

    def test_already_member_flag(self, db_session, test_workspace, test_user):
        link = make_link(db_session, test_workspace.id)
        service = ShareLinkService(db_session)
        result = service.preview_link(link.token, test_user.id)
        assert result.already_member is True

    def test_board_name_included_when_board_set(self, db_session, test_workspace, test_user, test_board):
        link = make_link(db_session, test_workspace.id, board_id=test_board.id)
        service = ShareLinkService(db_session)
        result = service.preview_link(link.token, test_user.id)
        assert result.board_id == test_board.id
        assert result.board_name == test_board.name


class TestJoinLink:

    def test_new_user_becomes_editor(self, db_session, test_workspace, test_user3):
        link = make_link(db_session, test_workspace.id)
        service = ShareLinkService(db_session)
        result = service.join_via_link(link.token, test_user3.id)

        assert isinstance(result, JoinShareLinkResponse)
        assert result.already_member is False
        assert result.role == "editor"

        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user3.id,
        ).first()
        assert membership is not None
        assert membership.role == "editor"

    def test_already_member_keeps_existing_role(self, db_session, test_workspace, test_user):
        link = make_link(db_session, test_workspace.id)
        service = ShareLinkService(db_session)
        result = service.join_via_link(link.token, test_user.id)

        assert result.already_member is True
        assert result.role == "owner"

    def test_revoked_token_raises_410(self, db_session, test_workspace, test_user3):
        link = make_link(db_session, test_workspace.id, revoked=True)
        service = ShareLinkService(db_session)
        with pytest.raises(AppException) as exc_info:
            service.join_via_link(link.token, test_user3.id)
        assert exc_info.value.status_code == 410

    def test_expired_token_raises_410(self, db_session, test_workspace, test_user3):
        link = make_link(db_session, test_workspace.id, expired=True)
        service = ShareLinkService(db_session)
        with pytest.raises(AppException) as exc_info:
            service.join_via_link(link.token, test_user3.id)
        assert exc_info.value.status_code == 410

    def test_board_id_passthrough_for_redirect(self, db_session, test_workspace, test_user3, test_board):
        link = make_link(db_session, test_workspace.id, board_id=test_board.id)
        service = ShareLinkService(db_session)
        result = service.join_via_link(link.token, test_user3.id)
        assert result.board_id == test_board.id
    