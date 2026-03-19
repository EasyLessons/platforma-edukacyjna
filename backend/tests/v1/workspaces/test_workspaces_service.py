"""
Testy CRUD workspace'ów
api/v1/workspaces/service.py
"""
import pytest
from datetime import datetime

from api.v1.workspaces.service import (
    get_user_workspaces,
    get_workspace_by_id,
    create_workspace,
    update_workspace,
    delete_workspace,
    toggle_workspace_favourite,
    leave_workspace,
    set_active_workspace,
)
from api.v1.workspaces.schemas import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse
from core.exceptions import NotFoundError, AppException
from core.models import Workspace, WorkspaceMember, Board


class TestCreateWorkspace:

    def test_returns_workspace_response(self, db_session, test_user):
        result = create_workspace(db_session, WorkspaceCreate(name="Test"), test_user.id)
        assert isinstance(result, WorkspaceResponse)
        assert result.name == "Test"

    def test_sets_default_icon_and_color(self, db_session, test_user):
        result = create_workspace(db_session, WorkspaceCreate(name="X"), test_user.id)
        assert result.icon == "Home"
        assert result.bg_color == "bg-green-500"

    def test_creator_is_owner(self, db_session, test_user):
        result = create_workspace(db_session, WorkspaceCreate(name="X"), test_user.id)
        assert result.is_owner is True
        assert result.role == "owner"

    def test_initial_counts(self, db_session, test_user):
        result = create_workspace(db_session, WorkspaceCreate(name="X"), test_user.id)
        assert result.member_count == 1
        assert result.board_count == 0

    def test_creates_membership_in_db(self, db_session, test_user):
        result = create_workspace(db_session, WorkspaceCreate(name="X"), test_user.id)
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == result.id,
            WorkspaceMember.user_id == test_user.id,
        ).first()
        assert membership is not None
        assert membership.role == "owner"

    def test_custom_icon_and_color(self, db_session, test_user):
        result = create_workspace(
            db_session,
            WorkspaceCreate(name="X", icon="Star", bg_color="bg-red-500"),
            test_user.id,
        )
        assert result.icon == "Star"
        assert result.bg_color == "bg-red-500"


class TestGetWorkspaces:

    def test_returns_empty_for_new_user(self, db_session, test_user):
        result = get_user_workspaces(db_session, test_user.id)
        assert result == []

    def test_returns_own_workspaces(self, db_session, test_user):
        create_workspace(db_session, WorkspaceCreate(name="WS1"), test_user.id)
        create_workspace(db_session, WorkspaceCreate(name="WS2"), test_user.id)
        result = get_user_workspaces(db_session, test_user.id)
        assert len(result) == 2

    def test_returns_workspaces_where_member(self, db_session, test_user, test_workspace, test_user2):
        """User zwraca workspace'y w których jest członkiem (nie tylko owner)"""
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        result = get_user_workspaces(db_session, test_user2.id)
        assert len(result) == 1
        assert result[0].is_owner is False
        assert result[0].role == "editor"

    def test_does_not_return_other_users_workspaces(self, db_session, test_user, test_user2):
        create_workspace(db_session, WorkspaceCreate(name="Private"), test_user.id)
        result = get_user_workspaces(db_session, test_user2.id)
        assert result == []

    def test_correct_member_and_board_counts(self, db_session, test_user, test_user2):
        ws = create_workspace(db_session, WorkspaceCreate(name="X"), test_user.id)
        db_session.add(WorkspaceMember(
            workspace_id=ws.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.add(Board(
            name="B1", workspace_id=ws.id, created_by=test_user.id,
            created_at=datetime.utcnow(), last_modified=datetime.utcnow(),
        ))
        db_session.commit()

        result = get_user_workspaces(db_session, test_user.id)
        assert result[0].member_count == 2
        assert result[0].board_count == 1


class TestGetWorkspaceById:

    def test_returns_workspace(self, db_session, test_user, test_workspace):
        result = get_workspace_by_id(db_session, test_workspace.id, test_user.id)
        assert result.id == test_workspace.id

    def test_nonexistent_raises_not_found(self, db_session, test_user):
        with pytest.raises(NotFoundError):
            get_workspace_by_id(db_session, 99999, test_user.id)

    def test_no_access_raises_not_found(self, db_session, test_workspace, test_user2):
        with pytest.raises(NotFoundError):
            get_workspace_by_id(db_session, test_workspace.id, test_user2.id)


class TestUpdateWorkspace:

    def test_updates_name(self, db_session, test_user, test_workspace):
        result = update_workspace(
            db_session, test_workspace.id, WorkspaceUpdate(name="New Name"), test_user.id
        )
        assert result.name == "New Name"

    def test_partial_update(self, db_session, test_user, test_workspace):
        original_icon = test_workspace.icon
        result = update_workspace(
            db_session, test_workspace.id, WorkspaceUpdate(name="Only Name"), test_user.id
        )
        assert result.name == "Only Name"
        assert result.icon == original_icon

    def test_non_owner_raises_403(self, db_session, test_workspace, test_user2):
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        with pytest.raises(AppException) as exc:
            update_workspace(
                db_session, test_workspace.id, WorkspaceUpdate(name="X"), test_user2.id
            )
        assert exc.value.status_code == 403


class TestDeleteWorkspace:

    def test_deletes_workspace(self, db_session, test_user, test_workspace):
        ws_id = test_workspace.id
        delete_workspace(db_session, ws_id, test_user.id)
        assert db_session.query(Workspace).filter(Workspace.id == ws_id).first() is None

    def test_returns_message(self, db_session, test_user, test_workspace):
        result = delete_workspace(db_session, test_workspace.id, test_user.id)
        assert "usunięty" in result["message"]

    def test_non_owner_raises_403(self, db_session, test_workspace, test_user2):
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        with pytest.raises(AppException) as exc:
            delete_workspace(db_session, test_workspace.id, test_user2.id)
        assert exc.value.status_code == 403

    def test_nonexistent_raises_not_found(self, db_session, test_user):
        with pytest.raises(NotFoundError):
            delete_workspace(db_session, 99999, test_user.id)


class TestToggleFavourite:

    def test_sets_favourite(self, db_session, test_user, test_workspace):
        toggle_workspace_favourite(db_session, test_workspace.id, test_user.id, True)
        result = get_user_workspaces(db_session, test_user.id)
        assert result[0].is_favourite is True

    def test_unsets_favourite(self, db_session, test_user, test_workspace):
        toggle_workspace_favourite(db_session, test_workspace.id, test_user.id, True)
        toggle_workspace_favourite(db_session, test_workspace.id, test_user.id, False)
        result = get_user_workspaces(db_session, test_user.id)
        assert result[0].is_favourite is False

    def test_non_member_raises_not_found(self, db_session, test_workspace, test_user2):
        with pytest.raises(NotFoundError):
            toggle_workspace_favourite(db_session, test_workspace.id, test_user2.id, True)


class TestLeaveWorkspace:

    def test_member_can_leave(self, db_session, test_user, test_workspace, test_user2):
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        leave_workspace(db_session, test_workspace.id, test_user2.id)

        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        assert membership is None

    def test_owner_cannot_leave(self, db_session, test_user, test_workspace):
        with pytest.raises(AppException) as exc:
            leave_workspace(db_session, test_workspace.id, test_user.id)
        assert exc.value.status_code == 403

    def test_non_member_raises_not_found(self, db_session, test_workspace, test_user2):
        with pytest.raises(NotFoundError):
            leave_workspace(db_session, test_workspace.id, test_user2.id)