"""
Testy wylogowania
POST /api/v1/auth/logout
"""
import pytest

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import LoginData
from api.v1.auth.utils import hash_refresh_token
from core.exceptions import AuthenticationError
from core.models import RefreshToken


class TestLogoutSuccess:

    @pytest.mark.asyncio
    async def test_logout_revokes_refresh_token(self, db_session, test_user):
        """Wylogowanie unieważnia refresh token"""
        _, refresh_token = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        await AuthService(db_session).logout_session(refresh_token)

        token_hash = hash_refresh_token(refresh_token)
        db_token = db_session.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash
        ).first()

        assert db_token.revoked is True

    @pytest.mark.asyncio
    async def test_logout_prevents_refresh(self, db_session, test_user):
        """Po wylogowaniu refresh token nie może odświeżyć sesji"""
        _, refresh_token = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        await AuthService(db_session).logout_session(refresh_token)

        with pytest.raises(AuthenticationError):
            await AuthService(db_session).refresh_session(refresh_token)

    @pytest.mark.asyncio
    async def test_double_logout_is_safe(self, db_session, test_user):
        """Podwójne wylogowanie nie rzuca błędu"""
        _, refresh_token = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        await AuthService(db_session).logout_session(refresh_token)
        await AuthService(db_session).logout_session(refresh_token)  # nie powinno rzucić

    @pytest.mark.asyncio
    async def test_logout_with_invalid_token_is_safe(self, db_session):
        """Wylogowanie z nieistniejącym tokenem nie rzuca błędu"""
        await AuthService(db_session).logout_session("nieistniejacytokenxyz")

    @pytest.mark.asyncio
    async def test_logout_only_revokes_own_token(self, db_session, test_user, test_user2):
        """Wylogowanie unieważnia tylko token bieżącej sesji, nie innych"""
        _, token_user1 = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )
        _, token_user2 = await AuthService(db_session).login_user(
            LoginData(login=test_user2.username, password="testpassword2")
        )

        await AuthService(db_session).logout_session(token_user1)

        # Token user2 nadal ważny
        result, _ = await AuthService(db_session).refresh_session(token_user2)
        assert result.user.id == test_user2.id
