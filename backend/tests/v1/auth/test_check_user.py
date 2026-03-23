"""
Testy sprawdzania czy użytkownik istnieje
POST /api/v1/auth/check-user
"""
import pytest
from unittest.mock import patch, AsyncMock

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import CheckUserResponse
from api.v1.auth.utils import hash_password
from core.models import User

MOCK_EMAIL = "api.v1.auth.service.send_verification_email"


class TestCheckUser:

    @pytest.mark.asyncio
    async def test_user_not_exists(self, db_session):
        """Nieistniejący email → exists=False, verified=False"""
        result = await AuthService(db_session).check_user("ghost@nowhere.com")

        assert isinstance(result, CheckUserResponse)
        assert result.exists is False
        assert result.verified is False

    @pytest.mark.asyncio
    async def test_user_exists_and_verified(self, db_session, test_user):
        """Zweryfikowany user → exists=True, verified=True"""
        result = await AuthService(db_session).check_user(test_user.email)

        assert result.exists is True
        assert result.verified is True
        assert result.user_id is None  # nie ujawniamy ID zweryfikowanym

    @pytest.mark.asyncio
    async def test_user_exists_unverified(self, db_session, unverified_user):
        """Niezweryfikowany user → exists=True, verified=False, user_id zwrócony"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await AuthService(db_session).check_user(unverified_user.email)

        assert result.exists is True
        assert result.verified is False
        assert result.user_id == unverified_user.id

    @pytest.mark.asyncio
    async def test_unverified_triggers_new_code(self, db_session, unverified_user):
        """Dla niezweryfikowanego wysyła nowy kod"""
        old_code = unverified_user.verification_code

        with patch(MOCK_EMAIL, new_callable=AsyncMock) as mock_send:
            await AuthService(db_session).check_user(unverified_user.email)

        mock_send.assert_called_once()
        db_session.refresh(unverified_user)
        assert unverified_user.verification_code != old_code

    @pytest.mark.asyncio
    async def test_verified_does_not_send_email(self, db_session, test_user):
        """Dla zweryfikowanego NIE wysyła kodu"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock) as mock_send:
            await AuthService(db_session).check_user(test_user.email)

        mock_send.assert_not_called()