"""
Testy zarządzania członkami workspace'ów
api/v1/workspaces/members_service.py
"""
import pytest
from datetime import datetime

from api.v1.workspaces.members_service import MemberService
from api.v1.workspaces.schemas import WorkspaceMembersListResponse, MyRoleResponse
from core.exceptions import NotFoundError, AppException
from core.models import WorkspaceMember


def add_member(db, workspace_id, user_id, role="editor"):
    m = WorkspaceMember(
        workspace_id=workspace_id, user_id=user_id,
        role=role, is_favourite=False, joined_at=datetime.utcnow(),
    )
    db.add(m)
    db.commit()
    return m


class TestGetWorkspaceMembers:

    def test_returns_members_list(self, db_session, test_user, test_workspace):
        service = MemberService(db_session)
        result = service.get_workspace_members(test_workspace.id, test_user.id)
        assert isinstance(result, WorkspaceMembersListResponse)
        assert result.total == 1

    def test_owner_has_is_owner_true(self, db_session, test_user, test_workspace):
        service = MemberService(db_session)
        result = service.get_workspace_members(test_workspace.id, test_user.id)
        owner = result.members[0]
        assert owner.is_owner is True
        assert owner.role == "owner"

    def test_includes_all_members(self, db_session, test_user, test_workspace, test_user2):
        add_member(db_session, test_workspace.id, test_user2.id)
        service = MemberService(db_session)
        result = service.get_workspace_members(test_workspace.id, test_user.id)
        assert result.total == 2

    def test_non_member_cannot_see_members(self, db_session, test_workspace, test_user2):
        service = MemberService(db_session)
        with pytest.raises(NotFoundError):
            service.get_workspace_members(test_workspace.id, test_user2.id)

    def test_nonexistent_workspace_raises_not_found(self, db_session, test_user):
        service = MemberService(db_session)
        with pytest.raises(NotFoundError):
            service.get_workspace_members(99999, test_user.id)

    def test_member_role_correct(self, db_session, test_user, test_workspace, test_user2):
        add_member(db_session, test_workspace.id, test_user2.id, role="viewer")
        service = MemberService(db_session)
        result = service.get_workspace_members(test_workspace.id, test_user.id)
        viewer = next(m for m in result.members if m.user_id == test_user2.id)
        assert viewer.role == "viewer"
        assert viewer.is_owner is False


class TestRemoveWorkspaceMember:

    def test_owner_can_remove_member(self, db_session, test_user, test_workspace, test_user2):
        add_member(db_session, test_workspace.id, test_user2.id)
        service = MemberService(db_session)
        service.remove_workspace_member(test_workspace.id, test_user2.id, test_user.id)

        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        assert membership is None

    def test_returns_message(self, db_session, test_user, test_workspace, test_user2):
        add_member(db_session, test_workspace.id, test_user2.id)
        service = MemberService(db_session)
        result = service.remove_workspace_member(test_workspace.id, test_user2.id, test_user.id)
        assert result.message

    def test_non_owner_cannot_remove(self, db_session, test_user, test_workspace, test_user2, test_user3):
        add_member(db_session, test_workspace.id, test_user2.id)
        add_member(db_session, test_workspace.id, test_user3.id)

        service = MemberService(db_session)
        with pytest.raises(AppException) as exc:
            service.remove_workspace_member(test_workspace.id, test_user3.id, test_user2.id)
        assert exc.value.status_code == 403

    def test_cannot_remove_self(self, db_session, test_user, test_workspace):
        service = MemberService(db_session)
        with pytest.raises(AppException) as exc:
            service.remove_workspace_member(test_workspace.id, test_user.id, test_user.id)
        assert exc.value.status_code == 400

    def test_nonexistent_member_raises_not_found(self, db_session, test_user, test_workspace, test_user2):
        service = MemberService(db_session)
        with pytest.raises(NotFoundError):
            service.remove_workspace_member(test_workspace.id, test_user2.id, test_user.id)


class TestUpdateMemberRole:

    def test_owner_can_change_role(self, db_session, test_user, test_workspace, test_user2):
        add_member(db_session, test_workspace.id, test_user2.id, role="viewer")
        service = MemberService(db_session)
        result = service.update_member_role(
            test_workspace.id, test_user2.id, "editor", test_user.id
        )
        assert result.new_role == "editor"

        db_session.expire_all()
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        assert membership.role == "editor"

    def test_non_owner_cannot_change_role(self, db_session, test_user, test_workspace, test_user2, test_user3):
        add_member(db_session, test_workspace.id, test_user2.id)
        add_member(db_session, test_workspace.id, test_user3.id)

        service = MemberService(db_session)
        with pytest.raises(AppException) as exc:
            service.update_member_role(test_workspace.id, test_user3.id, "viewer", test_user2.id)
        assert exc.value.status_code == 403

    def test_cannot_change_own_role(self, db_session, test_user, test_workspace):
        service = MemberService(db_session)
        with pytest.raises(AppException) as exc:
            service.update_member_role(test_workspace.id, test_user.id, "editor", test_user.id)
        assert exc.value.status_code == 400

    def test_nonexistent_member_raises_not_found(self, db_session, test_user, test_workspace, test_user2):
        service = MemberService(db_session)
        with pytest.raises(NotFoundError):
            service.update_member_role(test_workspace.id, test_user2.id, "editor", test_user.id)

    def test_cannot_set_role_to_owner(self, db_session, test_user, test_workspace, test_user2):
        add_member(db_session, test_workspace.id, test_user2.id, role="viewer")
        service = MemberService(db_session)
        with pytest.raises(AppException) as exc:
            service.update_member_role(test_workspace.id, test_user2.id, "owner", test_user.id)
        assert exc.value.status_code == 400


class TestGetUserRole:

    def test_owner_role(self, db_session, test_user, test_workspace):
        service = MemberService(db_session)
        result = service.get_user_role(test_workspace.id, test_user.id)
        assert isinstance(result, MyRoleResponse)
        assert result.role == "owner"
        assert result.is_owner is True

    def test_member_role(self, db_session, test_user, test_workspace, test_user2):
        add_member(db_session, test_workspace.id, test_user2.id, role="viewer")
        service = MemberService(db_session)
        result = service.get_user_role(test_workspace.id, test_user2.id)
        assert result.role == "viewer"
        assert result.is_owner is False

    def test_non_member_raises_not_found(self, db_session, test_workspace, test_user2):
        service = MemberService(db_session)
        with pytest.raises(NotFoundError):
            service.get_user_role(test_workspace.id, test_user2.id)