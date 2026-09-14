"""
Testy wyszukiwania kandydatów do zaproszenia
GET /api/v1/workspaces/{workspace_id}/invite/users
"""

import pytest
from datetime import datetime, timedelta

from api.v1.workspaces.invites.service import InviteService
from api.v1.workspaces.invites.schemas import UserSearchResult
from api.v1.auth.utils import hash_password
from core.exceptions import NotFoundError
from core.models import User, WorkspaceInvite


def add_active_user(db_session, username, email, full_name=None):
    user = User(
        username=username,
        email=email,
        full_name=full_name,
        hashed_password=hash_password("password"),
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


class TestSearchUsersSuccess:

    def test_search_by_username(self, db_session, test_workspace, test_user, test_user2):
        """Wyszukuje po fragmencie username"""
        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "testuser2", test_user.id, limit=10)

        usernames = [r.username for r in results]
        assert "testuser2" in usernames

    def test_search_by_email(self, db_session, test_workspace, test_user, test_user2):
        """Wyszukuje po fragmencie emaila"""
        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "test2@example", test_user.id, limit=10)

        assert len(results) >= 1
        assert results[0].email == test_user2.email

    def test_search_by_full_name(self, db_session, test_workspace, test_user):
        """Wyszukuje po full_name"""
        add_active_user(db_session, "jankowalski", "jan@example.com", "Jan Kowalski")
        db_session.commit()

        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "Kowalski", test_user.id, limit=10)

        assert any(r.full_name == "Jan Kowalski" for r in results)

    def test_returns_user_search_result_schema(self, db_session, test_workspace, test_user, test_user2):
        """Zwraca listę UserSearchResult"""
        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "testuser", test_user.id, limit=10)

        assert all(isinstance(r, UserSearchResult) for r in results)

    def test_case_insensitive(self, db_session, test_workspace, test_user, test_user2):
        """Wyszukiwanie nie rozróżnia wielkości liter"""
        service = InviteService(db_session)
        results_lower = service.search_invitable_users(test_workspace.id, "testuser", test_user.id, limit=10)
        results_upper = service.search_invitable_users(test_workspace.id, "TESTUSER", test_user.id, limit=10)

        assert len(results_lower) == len(results_upper)


class TestSearchUsersExclusions:

    def test_excludes_self(self, db_session, test_workspace, test_user, test_user2):
        """Nie zwraca aktualnie zalogowanego usera"""
        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "testuser", test_user.id, limit=10)

        ids = [r.id for r in results]
        assert test_user.id not in ids

    def test_excludes_inactive_users(self, db_session, test_workspace, test_user):
        """Nie zwraca niezweryfikowanych userów"""
        inactive = User(
            username="inactiveuser",
            email="inactive@example.com",
            hashed_password=hash_password("password"),
            is_active=False,
        )
        db_session.add(inactive)
        db_session.commit()

        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "inactive", test_user.id, limit=10)

        assert len(results) == 0

    def test_excludes_existing_workspace_members(self, db_session, shared_workspace, test_user, test_user2):
        """Nie zwraca userów, którzy już są członkami workspace'a"""
        service = InviteService(db_session)
        results = service.search_invitable_users(shared_workspace.id, "testuser2", test_user.id, limit=10)

        ids = [r.id for r in results]
        assert test_user2.id not in ids


class TestSearchUsersEdgeCases:

    def test_query_too_short_returns_empty(self, db_session, test_workspace, test_user):
        """Zapytanie < 2 znaki → pusta lista"""
        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "a", test_user.id, limit=10)
        assert results == []

    def test_empty_query_returns_empty(self, db_session, test_workspace, test_user):
        """Pusty string → pusta lista"""
        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "", test_user.id, limit=10)
        assert results == []

    def test_limit_respected(self, db_session, test_workspace, test_user):
        """Wyniki są ograniczone do podanego limitu"""
        for i in range(10):
            add_active_user(db_session, f"searchuser{i}", f"search{i}@example.com")
        db_session.commit()

        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "search", test_user.id, limit=3)
        assert len(results) <= 3

    def test_no_results_returns_empty_list(self, db_session, test_workspace, test_user):
        """Brak dopasowań → pusta lista, nie wyjątek"""
        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "xqznonexistent", test_user.id, limit=10)
        assert results == []


class TestSearchUsersAuthorization:

    def test_non_member_caller_raises_not_found(self, db_session, test_workspace, test_user3):
        """Caller niebędący członkiem workspace'a nie może przeszukiwać jego userów"""
        service = InviteService(db_session)
        with pytest.raises(NotFoundError):
            service.search_invitable_users(test_workspace.id, "testuser", test_user3.id, limit=10)

    def test_nonexistent_workspace_raises_not_found(self, db_session, test_user):
        service = InviteService(db_session)
        with pytest.raises(NotFoundError):
            service.search_invitable_users(99999, "testuser", test_user.id, limit=10)


class TestSearchUsersPendingStatus:

    def test_candidate_with_pending_invite_is_flagged(self, db_session, test_workspace, test_user, test_user2):
        """Kandydat z aktywnym zaproszeniem ma has_pending_invite=True"""
        db_session.add(WorkspaceInvite(
            workspace_id=test_workspace.id,
            invited_by=test_user.id,
            invited_id=test_user2.id,
            invite_token="pending-token-123",
            expires_at=datetime.utcnow() + timedelta(days=7),
            is_used=False,
            created_at=datetime.utcnow(),
        ))
        db_session.commit()

        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "testuser2", test_user.id, limit=10)

        assert len(results) == 1
        assert results[0].has_pending_invite is True

    def test_candidate_without_pending_invite_is_not_flagged(self, db_session, test_workspace, test_user, test_user2):
        service = InviteService(db_session)
        results = service.search_invitable_users(test_workspace.id, "testuser2", test_user.id, limit=10)

        assert len(results) == 1
        assert results[0].has_pending_invite is False