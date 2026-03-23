"""
Testy resetowania hasła — 3 kroki:
  POST /api/v1/auth/request-password-reset
  POST /api/v1/auth/verify-reset-code
  POST /api/v1/auth/reset-password
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import (
    RequestPasswordReset,
    VerifyPasswordResetCode,
    ResetPassword,
    MessageResponse,
    VerifyResetCodeResponse,
)
from api.v1.auth.utils import hash_password, verify_password
from core.exceptions import ValidationError, AppException
from core.models import User

MOCK_RESET_EMAIL = "api.v1.auth.service.send_password_reset_email"
VALID_CODE = "654321"


def make_user_with_reset_code(db_session, *, expires_delta=timedelta(minutes=15)):
    user = User(
        username="resetuser",
        email="reset@example.com",
        hashed_password=hash_password("OldPassword1"),
        is_active=True,
        verification_code=VALID_CODE,
        verification_code_expires=datetime.utcnow() + expires_delta,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ── Request reset ──────────────────────────────────────────────────────────

class TestRequestPasswordReset:

    @pytest.mark.asyncio
    async def test_sends_code_for_existing_user(self, db_session, test_user):
        """Dla istniejącego usera wysyła email i zwraca MessageResponse"""
        with patch(MOCK_RESET_EMAIL, new_callable=AsyncMock) as mock_send:
            result = await AuthService(db_session).request_password_reset(
                RequestPasswordReset(email=test_user.email)
            )

        assert isinstance(result, MessageResponse)
        mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_silent_for_nonexistent_email(self, db_session):
        """Nieistniejący email — nie ujawniamy tego, zwraca MessageResponse"""
        with patch(MOCK_RESET_EMAIL, new_callable=AsyncMock) as mock_send:
            result = await AuthService(db_session).request_password_reset(
                RequestPasswordReset(email="ghost@nowhere.com")
            )

        assert isinstance(result, MessageResponse)
        mock_send.assert_not_called()

    @pytest.mark.asyncio
    async def test_stores_reset_code_in_db(self, db_session, test_user):
        """Kod jest zapisany w bazie z datą wygaśnięcia"""
        with patch(MOCK_RESET_EMAIL, new_callable=AsyncMock):
            await AuthService(db_session).request_password_reset(
                RequestPasswordReset(email=test_user.email)
            )

        db_session.refresh(test_user)
        assert test_user.verification_code is not None
        assert test_user.verification_code_expires > datetime.utcnow()

    @pytest.mark.asyncio
    async def test_unverified_user_raises_403(self, db_session, unverified_user):
        """Niezweryfikowane konto → AppException 403"""
        with pytest.raises(AppException) as exc:
            await AuthService(db_session).request_password_reset(
                RequestPasswordReset(email=unverified_user.email)
            )
        assert exc.value.status_code == 403


# ── Verify reset code ──────────────────────────────────────────────────────

class TestVerifyResetCode:

    @pytest.mark.asyncio
    async def test_valid_code_returns_response(self, db_session):
        """Poprawny kod → VerifyResetCodeResponse z valid=True"""
        user = make_user_with_reset_code(db_session)
        result = await AuthService(db_session).verify_reset_code(
            VerifyPasswordResetCode(email=user.email, code=VALID_CODE)
        )

        assert isinstance(result, VerifyResetCodeResponse)
        assert result.valid is True

    @pytest.mark.asyncio
    async def test_wrong_code(self, db_session):
        """Zły kod → ValidationError 400"""
        user = make_user_with_reset_code(db_session)
        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session).verify_reset_code(
                VerifyPasswordResetCode(email=user.email, code="000000")
            )
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_expired_code(self, db_session):
        """Wygasły kod → ValidationError 400"""
        user = make_user_with_reset_code(db_session, expires_delta=-timedelta(minutes=1))
        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session).verify_reset_code(
                VerifyPasswordResetCode(email=user.email, code=VALID_CODE)
            )
        assert "wygasł" in exc.value.message

    @pytest.mark.asyncio
    async def test_nonexistent_email(self, db_session):
        """Nieistniejący email → ValidationError (nie ujawniamy szczegółów)"""
        with pytest.raises(ValidationError):
            await AuthService(db_session).verify_reset_code(
                VerifyPasswordResetCode(email="ghost@nowhere.com", code=VALID_CODE)
            )


# ── Reset password ─────────────────────────────────────────────────────────

class TestResetPassword:

    @pytest.mark.asyncio
    async def test_changes_password(self, db_session):
        """Zmienia hasło na nowe"""
        user = make_user_with_reset_code(db_session)
        await AuthService(db_session).reset_password(
            ResetPassword(
                email=user.email,
                code=VALID_CODE,
                password="NewPassword1",
                password_confirm="NewPassword1",
            )
        )

        db_session.refresh(user)
        assert verify_password("NewPassword1", user.hashed_password)
        assert not verify_password("OldPassword1", user.hashed_password)

    @pytest.mark.asyncio
    async def test_clears_reset_code(self, db_session):
        """Po zmianie hasła kod jest czyszczony"""
        user = make_user_with_reset_code(db_session)
        await AuthService(db_session).reset_password(
            ResetPassword(
                email=user.email,
                code=VALID_CODE,
                password="NewPassword1",
                password_confirm="NewPassword1",
            )
        )

        db_session.refresh(user)
        assert user.verification_code is None
        assert user.verification_code_expires is None

    @pytest.mark.asyncio
    async def test_returns_message_response(self, db_session):
        user = make_user_with_reset_code(db_session)
        result = await AuthService(db_session).reset_password(
            ResetPassword(
                email=user.email,
                code=VALID_CODE,
                password="NewPassword1",
                password_confirm="NewPassword1",
            )
        )
        assert isinstance(result, MessageResponse)

    @pytest.mark.asyncio
    async def test_passwords_mismatch(self, db_session):
        """Niezgodne hasła → ValidationError 400"""
        user = make_user_with_reset_code(db_session)
        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session).reset_password(
                ResetPassword(
                    email=user.email,
                    code=VALID_CODE,
                    password="NewPassword1",
                    password_confirm="DifferentPassword1",
                )
            )
        assert exc.value.status_code == 400
        assert "identyczne" in exc.value.message

    @pytest.mark.asyncio
    async def test_wrong_code(self, db_session):
        """Zły kod → ValidationError"""
        user = make_user_with_reset_code(db_session)
        with pytest.raises(ValidationError):
            await AuthService(db_session).reset_password(
                ResetPassword(
                    email=user.email,
                    code="000000",
                    password="NewPassword1",
                    password_confirm="NewPassword1",
                )
            )

    @pytest.mark.asyncio
    async def test_expired_code(self, db_session):
        """Wygasły kod → ValidationError"""
        user = make_user_with_reset_code(db_session, expires_delta=-timedelta(minutes=1))
        with pytest.raises(ValidationError):
            await AuthService(db_session).reset_password(
                ResetPassword(
                    email=user.email,
                    code=VALID_CODE,
                    password="NewPassword1",
                    password_confirm="NewPassword1",
                )
            )

    @pytest.mark.asyncio
    async def test_wrong_code_does_not_change_password(self, db_session):
        """Zły kod nie zmienia hasła"""
        user = make_user_with_reset_code(db_session)
        old_hash = user.hashed_password

        with pytest.raises(ValidationError):
            await AuthService(db_session).reset_password(
                ResetPassword(
                    email=user.email,
                    code="000000",
                    password="NewPassword1",
                    password_confirm="NewPassword1",
                )
            )

        db_session.refresh(user)
        assert user.hashed_password == old_hash