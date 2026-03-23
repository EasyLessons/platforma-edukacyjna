"""
Testy wyszukiwania użytkowników
GET /api/v1/auth/users/search
"""
import pytest

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import UserSearchResult
from api.v1.auth.utils import hash_password
from core.models import User


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

    def test_search_by_username(self, db_session, test_user, test_user2):
        """Wyszukuje po fragmencie username"""
        results = AuthService(db_session).search_users("testuser2", test_user.id, limit=10)

        usernames = [r.username for r in results]
        assert "testuser2" in usernames

    def test_search_by_email(self, db_session, test_user, test_user2):
        """Wyszukuje po fragmencie emaila"""
        results = AuthService(db_session).search_users("test2@example", test_user.id, limit=10)

        assert len(results) >= 1
        assert results[0].email == test_user2.email

    def test_search_by_full_name(self, db_session, test_user):
        """Wyszukuje po full_name"""
        add_active_user(db_session, "jankowalski", "jan@example.com", "Jan Kowalski")
        db_session.commit()

        results = AuthService(db_session).search_users("Kowalski", test_user.id, limit=10)

        assert any(r.full_name == "Jan Kowalski" for r in results)

    def test_returns_user_search_result_schema(self, db_session, test_user, test_user2):
        """Zwraca listę UserSearchResult"""
        results = AuthService(db_session).search_users("testuser", test_user.id, limit=10)

        assert all(isinstance(r, UserSearchResult) for r in results)

    def test_case_insensitive(self, db_session, test_user, test_user2):
        """Wyszukiwanie nie rozróżnia wielkości liter"""
        results_lower = AuthService(db_session).search_users("testuser", test_user.id, limit=10)
        results_upper = AuthService(db_session).search_users("TESTUSER", test_user.id, limit=10)

        assert len(results_lower) == len(results_upper)


class TestSearchUsersExclusions:

    def test_excludes_self(self, db_session, test_user, test_user2):
        """Nie zwraca aktualnie zalogowanego usera"""
        results = AuthService(db_session).search_users("testuser", test_user.id, limit=10)

        ids = [r.id for r in results]
        assert test_user.id not in ids

    def test_excludes_inactive_users(self, db_session, test_user):
        """Nie zwraca niezweryfikowanych userów"""
        inactive = User(
            username="inactiveuser",
            email="inactive@example.com",
            hashed_password=hash_password("password"),
            is_active=False,
        )
        db_session.add(inactive)
        db_session.commit()

        results = AuthService(db_session).search_users("inactive", test_user.id, limit=10)

        assert len(results) == 0


class TestSearchUsersEdgeCases:

    def test_query_too_short_returns_empty(self, db_session, test_user):
        """Zapytanie < 2 znaki → pusta lista"""
        results = AuthService(db_session).search_users("a", test_user.id, limit=10)
        assert results == []

    def test_empty_query_returns_empty(self, db_session, test_user):
        """Pusty string → pusta lista"""
        results = AuthService(db_session).search_users("", test_user.id, limit=10)
        assert results == []

    def test_limit_respected(self, db_session, test_user):
        """Wyniki są ograniczone do podanego limitu"""
        for i in range(10):
            add_active_user(db_session, f"searchuser{i}", f"search{i}@example.com")
        db_session.commit()

        results = AuthService(db_session).search_users("search", test_user.id, limit=3)
        assert len(results) <= 3

    def test_no_results_returns_empty_list(self, db_session, test_user):
        """Brak dopasowań → pusta lista, nie wyjątek"""
        results = AuthService(db_session).search_users("xqznonexistent", test_user.id, limit=10)
        assert results == []