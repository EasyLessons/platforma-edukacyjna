"""
Testy ponownego wysyłania kodu weryfikacyjnego
POST /api/v1/auth/resend-code
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import ResendCodeResponse
from api.v1.auth.utils import hash_password
from core.exceptions import NotFoundError, ValidationError
from core.models import User

MOCK_EMAIL = "api.v1.auth.service.send_verification_email"


class TestResendCodeSuccess:

    @pytest.mark.asyncio
    async def test_returns_resend_response(self, db_session, unverified_user):
        """Zwraca ResendCodeResponse z potwierdzeniem"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await AuthService(db_session).resend_code(unverified_user.id)

        assert isinstance(result, ResendCodeResponse)
        assert "wysłany" in result.message.lower() or "wysłano" in result.message.lower()

    @pytest.mark.asyncio
    async def test_generates_new_code(self, db_session, unverified_user):
        """Generuje nowy kod i aktualizuje datę wygaśnięcia"""
        old_code = unverified_user.verification_code

        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            await AuthService(db_session).resend_code(unverified_user.id)

        db_session.refresh(unverified_user)
        assert unverified_user.verification_code != old_code
        assert unverified_user.verification_code_expires > datetime.utcnow()

    @pytest.mark.asyncio
    async def test_new_code_is_6_digits(self, db_session, unverified_user):
        """Nowy kod to 6 cyfr"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            await AuthService(db_session).resend_code(unverified_user.id)

        db_session.refresh(unverified_user)
        assert len(unverified_user.verification_code) == 6
        assert unverified_user.verification_code.isdigit()

    @pytest.mark.asyncio
    async def test_sends_email(self, db_session, unverified_user):
        """Wysyła email z nowym kodem"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock) as mock_send:
            await AuthService(db_session).resend_code(unverified_user.id)

        mock_send.assert_called_once()
        call_args = mock_send.call_args[0]
        assert call_args[0] == unverified_user.email


class TestResendCodeErrors:

    @pytest.mark.asyncio
    async def test_user_not_found(self, db_session):
        """Nieistniejące user_id → NotFoundError 404"""
        with pytest.raises(NotFoundError) as exc:
            await AuthService(db_session).resend_code(99999)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_already_verified(self, db_session, test_user):
        """Już zweryfikowany user → ValidationError 400"""
        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session).resend_code(test_user.id)
        assert exc.value.status_code == 400
        assert "zweryfikowane" in exc.value.message