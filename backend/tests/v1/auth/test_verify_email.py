"""
Testy weryfikacji emaila
POST /api/v1/auth/verify-email
"""
import pytest
from datetime import datetime, timedelta

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import VerifyEmail, AuthResponse
from api.v1.auth.utils import hash_password
from core.exceptions import NotFoundError, ValidationError
from core.models import User

VALID_CODE = "123456"


def make_unverified_user(db_session, *, code=VALID_CODE, expires_delta=timedelta(minutes=15), **kwargs):
    """Helper — tworzy niezweryfikowanego usera z kodem"""
    user = User(
        username=kwargs.get("username", "unverified"),
        email=kwargs.get("email", "unverified@example.com"),
        hashed_password=hash_password("password"),
        is_active=False,
        verification_code=code,
        verification_code_expires=datetime.utcnow() + expires_delta,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


class TestVerifyEmailSuccess:

    @pytest.mark.asyncio
    async def test_returns_auth_response(self, db_session):
        """Zwraca AuthResponse z tokenem i danymi usera"""
        user = make_unverified_user(db_session)
        result = await AuthService(db_session).verify_email(
            VerifyEmail(user_id=user.id, code=VALID_CODE)
        )

        assert isinstance(result, AuthResponse)
        assert result.access_token
        assert result.token_type == "bearer"
        assert result.user.id == user.id

    @pytest.mark.asyncio
    async def test_activates_user(self, db_session):
        """Po weryfikacji user.is_active = True"""
        user = make_unverified_user(db_session)
        await AuthService(db_session).verify_email(
            VerifyEmail(user_id=user.id, code=VALID_CODE)
        )

        db_session.refresh(user)
        assert user.is_active is True

    @pytest.mark.asyncio
    async def test_clears_verification_code(self, db_session):
        """Po weryfikacji kod jest czyszczony z bazy"""
        user = make_unverified_user(db_session)
        await AuthService(db_session).verify_email(
            VerifyEmail(user_id=user.id, code=VALID_CODE)
        )

        db_session.refresh(user)
        assert user.verification_code is None

    @pytest.mark.asyncio
    async def test_token_is_valid_jwt(self, db_session):
        """Token ma format JWT (3 segmenty oddzielone kropką)"""
        user = make_unverified_user(db_session)
        result = await AuthService(db_session).verify_email(
            VerifyEmail(user_id=user.id, code=VALID_CODE)
        )

        parts = result.access_token.split(".")
        assert len(parts) == 3


class TestVerifyEmailErrors:

    @pytest.mark.asyncio
    async def test_user_not_found(self, db_session):
        """Nieistniejące user_id → NotFoundError 404"""
        with pytest.raises(NotFoundError) as exc:
            await AuthService(db_session).verify_email(
                VerifyEmail(user_id=99999, code=VALID_CODE)
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_already_verified(self, db_session, test_user):
        """Już zweryfikowany user → ValidationError 400"""
        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session).verify_email(
                VerifyEmail(user_id=test_user.id, code=VALID_CODE)
            )
        assert exc.value.status_code == 400
        assert "zweryfikowane" in exc.value.message

    @pytest.mark.asyncio
    async def test_expired_code(self, db_session):
        """Wygasły kod → ValidationError 400"""
        user = make_unverified_user(db_session, expires_delta=-timedelta(minutes=1))

        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session).verify_email(
                VerifyEmail(user_id=user.id, code=VALID_CODE)
            )
        assert exc.value.status_code == 400
        assert "wygasł" in exc.value.message

    @pytest.mark.asyncio
    async def test_wrong_code(self, db_session):
        """Zły kod → ValidationError 400"""
        user = make_unverified_user(db_session)

        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session).verify_email(
                VerifyEmail(user_id=user.id, code="999999")
            )
        assert exc.value.status_code == 400
        assert "Zły kod" in exc.value.message

    @pytest.mark.asyncio
    async def test_wrong_code_does_not_activate(self, db_session):
        """Zły kod nie aktywuje konta"""
        user = make_unverified_user(db_session)

        with pytest.raises(ValidationError):
            await AuthService(db_session).verify_email(
                VerifyEmail(user_id=user.id, code="000000")
            )

        db_session.refresh(user)
        assert user.is_active is False