"""
Testy CRUD workspace'ów
api/v1/workspaces/service.py
"""
import pytest
from datetime import datetime

from api.v1.workspaces.service import WorkspaceService
from api.v1.workspaces.schemas import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse
from core.exceptions import NotFoundError, AppException
from core.models import Workspace, WorkspaceMember, Board


class TestCreateWorkspace:

    def test_returns_workspace_response(self, db_session, test_user):
        service = WorkspaceService(db_session)
        result = service.create_workspace(WorkspaceCreate(name="Test"), test_user.id)
        assert isinstance(result, WorkspaceResponse)
        assert result.name == "Test"

    def test_sets_default_icon_and_color(self, db_session, test_user):
        service = WorkspaceService(db_session)
        result = service.create_workspace(WorkspaceCreate(name="X"), test_user.id)
        assert result.icon == "Home"
        assert result.bg_color == "bg-green-500"

    def test_creator_is_owner(self, db_session, test_user):
        service = WorkspaceService(db_session)
        result = service.create_workspace(WorkspaceCreate(name="X"), test_user.id)
        assert result.is_owner is True

    def test_creates_membership_in_db(self, db_session, test_user):
        service = WorkspaceService(db_session)
        result = service.create_workspace(WorkspaceCreate(name="X"), test_user.id)
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == result.id,
            WorkspaceMember.user_id == test_user.id,
        ).first()
        assert membership is not None
        assert membership.role == "owner"

    def test_custom_icon_and_color(self, db_session, test_user):
        service = WorkspaceService(db_session)
        result = service.create_workspace(
            WorkspaceCreate(name="X", icon="Star", bg_color="bg-red-500"),
            test_user.id,
        )
        assert result.icon == "Star"
        assert result.bg_color == "bg-red-500"


class TestGetWorkspaces:

    def test_returns_empty_for_new_user(self, db_session, test_user):
        service = WorkspaceService(db_session)
        result = service.get_user_workspaces(test_user.id)
        assert result == []

    def test_returns_own_workspaces(self, db_session, test_user):
        service = WorkspaceService(db_session)
        service.create_workspace(WorkspaceCreate(name="WS1"), test_user.id)
        service.create_workspace(WorkspaceCreate(name="WS2"), test_user.id)
        result = service.get_user_workspaces(test_user.id)
        assert len(result) == 2

    def test_returns_workspaces_where_member(self, db_session, test_user, test_workspace, test_user2):
        """User zwraca workspace'y w których jest członkiem (nie tylko owner)"""
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        service = WorkspaceService(db_session)
        result = service.get_user_workspaces(test_user2.id)
        assert len(result) == 1
        assert result[0].is_owner is False

    def test_does_not_return_other_users_workspaces(self, db_session, test_user, test_user2):
        service = WorkspaceService(db_session)
        service.create_workspace(WorkspaceCreate(name="Private"), test_user.id)
        result = service.get_user_workspaces(test_user2.id)
        assert result == []


class TestGetWorkspaceWithBoards:

    @pytest.mark.asyncio
    async def test_returns_workspace(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        result = await service.get_workspace_with_boards(test_workspace.id, test_user.id)
        assert result.id == test_workspace.id

    @pytest.mark.asyncio
    async def test_returns_empty_boards_list(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        result = await service.get_workspace_with_boards(test_workspace.id, test_user.id)
        assert result.boards.boards == []
        assert result.boards.total == 0

    @pytest.mark.asyncio
    async def test_nonexistent_raises_not_found(self, db_session, test_user):
        service = WorkspaceService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_workspace_with_boards(99999, test_user.id)

    @pytest.mark.asyncio
    async def test_no_access_raises_not_found(self, db_session, test_workspace, test_user2):
        service = WorkspaceService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_workspace_with_boards(test_workspace.id, test_user2.id)

class TestUpdateWorkspace:

    def test_updates_name(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        result = service.update_workspace(
            test_workspace.id, WorkspaceUpdate(name="New Name"), test_user.id
        )
        assert result.name == "New Name"

    def test_partial_update(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        original_icon = test_workspace.icon
        result = service.update_workspace(
            test_workspace.id, WorkspaceUpdate(name="Only Name"), test_user.id
        )
        assert result.name == "Only Name"
        assert result.icon == original_icon

    def test_non_owner_raises_403(self, db_session, test_workspace, test_user2):
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        service = WorkspaceService(db_session)
        with pytest.raises(AppException) as exc:
            service.update_workspace(
                test_workspace.id, WorkspaceUpdate(name="X"), test_user2.id
            )
        assert exc.value.status_code == 403


class TestDeleteWorkspace:

    def test_deletes_workspace(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        ws_id = test_workspace.id
        service.delete_workspace(ws_id, test_user.id)
        assert db_session.query(Workspace).filter(Workspace.id == ws_id).first() is None

    def test_returns_message(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        result = service.delete_workspace(test_workspace.id, test_user.id)
        assert "usunięty" in result["message"]

    def test_non_owner_raises_403(self, db_session, test_workspace, test_user2):
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        service = WorkspaceService(db_session)
        with pytest.raises(AppException) as exc:
            service.delete_workspace(test_workspace.id, test_user2.id)
        assert exc.value.status_code == 403

    def test_nonexistent_raises_not_found(self, db_session, test_user):
        service = WorkspaceService(db_session)
        with pytest.raises(NotFoundError):
            service.delete_workspace(99999, test_user.id)


class TestToggleFavourite:

    def test_sets_favourite(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        service.toggle_workspace_favourite(test_workspace.id, test_user.id, True)
        result = service.get_user_workspaces(test_user.id)
        assert result[0].is_favourite is True

    def test_unsets_favourite(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        service.toggle_workspace_favourite(test_workspace.id, test_user.id, True)
        service.toggle_workspace_favourite(test_workspace.id, test_user.id, False)
        result = service.get_user_workspaces(test_user.id)
        assert result[0].is_favourite is False

    def test_non_member_raises_not_found(self, db_session, test_workspace, test_user2):
        service = WorkspaceService(db_session)
        with pytest.raises(NotFoundError):
            service.toggle_workspace_favourite(test_workspace.id, test_user2.id, True)


class TestLeaveWorkspace:

    def test_member_can_leave(self, db_session, test_user, test_workspace, test_user2):
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace.id, user_id=test_user2.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()

        service = WorkspaceService(db_session)
        service.leave_workspace(test_workspace.id, test_user2.id)

        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        assert membership is None

    def test_owner_cannot_leave(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        with pytest.raises(AppException) as exc:
            service.leave_workspace(test_workspace.id, test_user.id)
        assert exc.value.status_code == 403

    def test_non_member_raises_not_found(self, db_session, test_workspace, test_user2):
        service = WorkspaceService(db_session)
        with pytest.raises(NotFoundError):
            service.leave_workspace(test_workspace.id, test_user2.id)