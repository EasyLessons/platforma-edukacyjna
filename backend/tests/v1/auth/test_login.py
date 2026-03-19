"""
Testy logowania
POST /api/v1/auth/login
"""
import pytest

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import LoginData, AuthResponse
from core.exceptions import AuthenticationError, AppException

class TestLoginSuccess:

    @pytest.mark.asyncio
    async def test_login_with_username(self, db_session, test_user):
        """Logowanie przez username zwraca AuthResponse"""
        result = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        assert isinstance(result, AuthResponse)
        assert result.user.username == test_user.username
        assert result.token_type == "bearer"

    @pytest.mark.asyncio
    async def test_login_with_email(self, db_session, test_user):
        """Logowanie przez email działa tak samo jak przez username"""
        result = await AuthService(db_session).login_user(
            LoginData(login=test_user.email, password="testpassword")
        )

        assert result.user.email == test_user.email

    @pytest.mark.asyncio
    async def test_returns_valid_jwt(self, db_session, test_user):
        """Token ma format JWT (3 segmenty)"""
        result = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        assert len(result.access_token.split(".")) == 3

    @pytest.mark.asyncio
    async def test_response_contains_user_data(self, db_session, test_user):
        """Response zawiera pełne dane usera"""
        result = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        assert result.user.id == test_user.id
        assert result.user.email == test_user.email
        assert result.user.is_active is True


class TestLoginErrors:

    @pytest.mark.asyncio
    async def test_wrong_password(self, db_session, test_user):
        """Złe hasło → AuthenticationError 401"""
        with pytest.raises(AuthenticationError) as exc:
            await AuthService(db_session).login_user(
                LoginData(login=test_user.username, password="wrongpassword")
            )
        assert exc.value.status_code == 401
        assert "Błędny login lub hasło" in exc.value.message

    @pytest.mark.asyncio
    async def test_nonexistent_user(self, db_session):
        """Nieistniejący login → AuthenticationError 401 (nie ujawniamy czy user istnieje)"""
        with pytest.raises(AuthenticationError) as exc:
            await AuthService(db_session).login_user(
                LoginData(login="ghost@nowhere.com", password="password")
            )
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_unverified_user(self, db_session, unverified_user):
        """Niezweryfikowane konto → AppException 403"""
        with pytest.raises(AppException) as exc:
            await AuthService(db_session).login_user(
                LoginData(login=unverified_user.username, password="testpassword")
            )
        assert exc.value.status_code == 403
        assert "niezweryfikowane" in exc.value.message.lower()

    @pytest.mark.asyncio
    async def test_wrong_password_same_error_as_missing_user(self, db_session, test_user):
        """Złe hasło i nieistniejący user dają ten sam błąd (security)"""
        exc_wrong_pass = None
        exc_no_user = None

        with pytest.raises(AuthenticationError) as exc:
            await AuthService(db_session).login_user(
                LoginData(login=test_user.username, password="wrong")
            )
        exc_wrong_pass = exc.value.status_code

        with pytest.raises(AuthenticationError) as exc:
            await AuthService(db_session).login_user(
                LoginData(login="nobody", password="wrong")
            )
        exc_no_user = exc.value.status_code

        assert exc_wrong_pass == exc_no_user == 401