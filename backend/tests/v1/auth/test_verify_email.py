"""
Testy weryfikacji emaila
POST /api/v1/auth/verify-email
"""
import pytest
from datetime import timedelta

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import VerifyEmail, AuthResponse
from api.v1.auth.utils import hash_password
from core.exceptions import NotFoundError, ValidationError
from core.models import User

VALID_CODE = "123456"


async def make_unverified_user(db_session, redis_client, *, code=VALID_CODE, expires_delta=timedelta(minutes=15), **kwargs):
    """Helper — tworzy niezweryfikowanego usera, opcjonalnie z kodem w Redis"""
    user = User(
        username=kwargs.get("username", "unverified"),
        email=kwargs.get("email", "unverified@example.com"),
        hashed_password=hash_password("password"),
        is_active=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    if expires_delta.total_seconds() > 0:
        await redis_client.setex(f"auth:email_verification:{user.id}", int(expires_delta.total_seconds()), code)
    # expires_delta <= 0 → symulujemy wygaśnięcie brakiem klucza w Redis

    return user


class TestVerifyEmailSuccess:

    @pytest.mark.asyncio
    async def test_returns_auth_response(self, db_session, redis_client):
        """Zwraca AuthResponse z tokenem i danymi usera"""
        user = await make_unverified_user(db_session, redis_client)
        result, refresh_token = await AuthService(db_session, redis_client).verify_email(
            VerifyEmail(user_id=user.id, code=VALID_CODE)
        )

        assert isinstance(result, AuthResponse)
        assert result.access_token
        assert result.token_type == "bearer"
        assert result.user.id == user.id
        assert len(refresh_token) == 64

    @pytest.mark.asyncio
    async def test_activates_user(self, db_session, redis_client):
        """Po weryfikacji user.is_active = True"""
        user = await make_unverified_user(db_session, redis_client)
        await AuthService(db_session, redis_client).verify_email(
            VerifyEmail(user_id=user.id, code=VALID_CODE)
        )

        db_session.refresh(user)
        assert user.is_active is True

    @pytest.mark.asyncio
    async def test_clears_verification_code(self, db_session, redis_client):
        """Po weryfikacji kod jest usuwany z Redis"""
        user = await make_unverified_user(db_session, redis_client)
        await AuthService(db_session, redis_client).verify_email(
            VerifyEmail(user_id=user.id, code=VALID_CODE)
        )

        stored = await redis_client.get(f"auth:email_verification:{user.id}")
        assert stored is None

    @pytest.mark.asyncio
    async def test_token_is_valid_jwt(self, db_session, redis_client):
        """Token ma format JWT (3 segmenty oddzielone kropką)"""
        user = await make_unverified_user(db_session, redis_client)
        result, _ = await AuthService(db_session, redis_client).verify_email(
            VerifyEmail(user_id=user.id, code=VALID_CODE)
        )

        parts = result.access_token.split(".")
        assert len(parts) == 3


class TestVerifyEmailErrors:

    @pytest.mark.asyncio
    async def test_user_not_found(self, db_session, redis_client):
        """Nieistniejące user_id → NotFoundError 404"""
        with pytest.raises(NotFoundError) as exc:
            await AuthService(db_session, redis_client).verify_email(
                VerifyEmail(user_id=99999, code=VALID_CODE)
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_already_verified(self, db_session, redis_client, test_user):
        """Już zweryfikowany user → ValidationError 400"""
        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session, redis_client).verify_email(
                VerifyEmail(user_id=test_user.id, code=VALID_CODE)
            )
        assert exc.value.status_code == 400
        assert "zweryfikowane" in exc.value.message

    @pytest.mark.asyncio
    async def test_expired_code(self, db_session, redis_client):
        """Wygasły kod → ValidationError 400"""
        user = await make_unverified_user(db_session, redis_client, expires_delta=-timedelta(minutes=1))

        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session, redis_client).verify_email(
                VerifyEmail(user_id=user.id, code=VALID_CODE)
            )
        assert exc.value.status_code == 400
        assert "wygasł" in exc.value.message

    @pytest.mark.asyncio
    async def test_wrong_code(self, db_session, redis_client):
        """Zły kod → ValidationError 400"""
        user = await make_unverified_user(db_session, redis_client)

        with pytest.raises(ValidationError) as exc:
            await AuthService(db_session, redis_client).verify_email(
                VerifyEmail(user_id=user.id, code="999999")
            )
        assert exc.value.status_code == 400
        assert "Nieprawidłowy kod" in exc.value.message

    @pytest.mark.asyncio
    async def test_wrong_code_does_not_activate(self, db_session, redis_client):
        """Zły kod nie aktywuje konta"""
        user = await make_unverified_user(db_session, redis_client)

        with pytest.raises(ValidationError):
            await AuthService(db_session, redis_client).verify_email(
                VerifyEmail(user_id=user.id, code="000000")
            )

        db_session.refresh(user)
        assert user.is_active is False
