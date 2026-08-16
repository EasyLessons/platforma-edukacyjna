"""
Testy logowania przez Google OAuth (ID token z Google Identity Services)
POST /api/v1/auth/google
"""
import pytest
from unittest.mock import patch

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import AuthResponse
from api.v1.auth.utils import hash_password
from core.exceptions import AuthenticationError
from core.models import User, Workspace

GOOGLE_IDINFO = {
    "sub": "google-123",
    "email": "google@example.com",
    "name": "Google User",
    "picture": "https://example.com/pic.jpg",
    "email_verified": True,
}

VERIFY_PATH = "api.v1.auth.service.id_token.verify_oauth2_token"


class TestGoogleLoginNewUser:

    @pytest.mark.asyncio
    async def test_creates_new_user(self, db_session):
        with patch(VERIFY_PATH, return_value=GOOGLE_IDINFO):
            await AuthService(db_session).google_login("fake-credential")

        user = db_session.query(User).filter(User.email == "google@example.com").first()
        assert user is not None
        assert user.google_id == "google-123"
        assert user.is_active is True

    @pytest.mark.asyncio
    async def test_returns_auth_response(self, db_session):
        with patch(VERIFY_PATH, return_value=GOOGLE_IDINFO):
            result, refresh_token = await AuthService(db_session).google_login("fake-credential")

        assert isinstance(result, AuthResponse)
        assert result.access_token
        assert result.user.email == "google@example.com"
        assert len(refresh_token) == 64

    @pytest.mark.asyncio
    async def test_creates_starter_workspace(self, db_session):
        with patch(VERIFY_PATH, return_value=GOOGLE_IDINFO):
            await AuthService(db_session).google_login("fake-credential")

        user = db_session.query(User).filter(User.email == "google@example.com").first()
        workspace = db_session.query(Workspace).filter(Workspace.created_by == user.id).first()

        assert workspace is not None

    @pytest.mark.asyncio
    async def test_username_conflict_resolved(self, db_session):
        existing = User(
            username="google", email="other@example.com",
            hashed_password=hash_password("pass"), is_active=True,
        )
        db_session.add(existing)
        db_session.commit()

        idinfo = {**GOOGLE_IDINFO, "email": "google@gmail.com"}
        with patch(VERIFY_PATH, return_value=idinfo):
            result, _ = await AuthService(db_session).google_login("fake-credential")

        assert result.user.username != "google"
        assert result.user.username.startswith("google")


class TestGoogleLoginExistingUser:

    @pytest.mark.asyncio
    async def test_existing_user_gets_token(self, db_session, test_user):
        test_user.google_id = "google-123"
        db_session.commit()

        idinfo = {**GOOGLE_IDINFO, "email": test_user.email}
        with patch(VERIFY_PATH, return_value=idinfo):
            result, _ = await AuthService(db_session).google_login("fake-credential")

        assert isinstance(result, AuthResponse)
        assert result.user.id == test_user.id

    @pytest.mark.asyncio
    async def test_links_google_id_to_existing_email(self, db_session, test_user):
        idinfo = {**GOOGLE_IDINFO, "email": test_user.email}
        with patch(VERIFY_PATH, return_value=idinfo):
            await AuthService(db_session).google_login("fake-credential")

        db_session.refresh(test_user)
        assert test_user.google_id == "google-123"


class TestGoogleLoginErrors:

    @pytest.mark.asyncio
    async def test_invalid_token_raises(self, db_session):
        """Błąd weryfikacji podpisu/aud → AuthenticationError"""
        with patch(VERIFY_PATH, side_effect=ValueError("Wrong audience")):
            with pytest.raises(AuthenticationError) as exc:
                await AuthService(db_session).google_login("bad-credential")

        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_unverified_email_raises(self, db_session):
        """email_verified=False → AuthenticationError"""
        idinfo = {**GOOGLE_IDINFO, "email_verified": False}
        with patch(VERIFY_PATH, return_value=idinfo):
            with pytest.raises(AuthenticationError):
                await AuthService(db_session).google_login("fake-credential")