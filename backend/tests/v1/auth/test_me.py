"""
Testy pobierania danych zalogowanego użytkownika
GET /api/v1/auth/me
"""
import pytest

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import MeResponse


class TestMeSuccess:

    def test_returns_me_response(self, db_session, test_user):
        """get_me zwraca MeResponse z danymi usera"""
        result = AuthService(db_session).get_me(test_user)

        assert isinstance(result, MeResponse)
        assert result.user.id == test_user.id
        assert result.user.username == test_user.username
        assert result.user.email == test_user.email

    def test_returns_correct_user_data(self, db_session, test_user):
        """get_me zwraca dane aktualnie przekazanego usera"""
        result = AuthService(db_session).get_me(test_user)

        assert result.user.is_active is True
        assert result.user.full_name == test_user.full_name

    def test_different_users_return_different_data(self, db_session, test_user, test_user2):
        """get_me zwraca dane właściwego usera"""
        result1 = AuthService(db_session).get_me(test_user)
        result2 = AuthService(db_session).get_me(test_user2)

        assert result1.user.id != result2.user.id
        assert result1.user.username != result2.user.username
