"""
Testy logowania przez Google OAuth (ID token z Google Identity Services)
POST /api/v1/auth/google: tu przez OAuthService z podmienioną weryfikacją tokena.
Reguły łączenia kont: test_oauth_linking.py.
"""
import pytest
from unittest.mock import patch

from api.v1.auth.oauth import OAuthService
from api.v1.auth.service import AuthService
from api.v1.auth.schemas import AuthResponse, LoginData
from api.v1.auth.utils import hash_password
from core.exceptions import AppException, AuthenticationError, NotFoundError
from core.models import User, UserIdentity, Workspace

GOOGLE_IDINFO = {
    "sub": "google-123",
    "email": "google@example.com",
    "name": "Google User",
    "picture": "https://example.com/pic.jpg",
    "email_verified": True,
}

VERIFY_PATH = "api.v1.auth.oauth.google.id_token.verify_oauth2_token"


async def google_login(db_session, credential: str = "fake-credential"):
    return await OAuthService(db_session).login("google", credential)


def add_identity(db_session, user, subject: str = "google-123") -> UserIdentity:
    identity = UserIdentity(
        user_id=user.id, provider="google", provider_user_id=subject,
        email=user.email, email_verified=True,
    )
    db_session.add(identity)
    db_session.commit()
    return identity


class TestGoogleLoginNewUser:

    @pytest.mark.asyncio
    async def test_creates_new_user_with_identity(self, db_session):
        with patch(VERIFY_PATH, return_value=GOOGLE_IDINFO):
            await google_login(db_session)

        user = db_session.query(User).filter(User.email == "google@example.com").first()
        assert user is not None
        assert user.is_active is True
        assert user.hashed_password is None
        assert len(user.identities) == 1
        identity = user.identities[0]
        assert identity.provider == "google"
        assert identity.provider_user_id == "google-123"
        assert identity.email_verified is True
        assert identity.picture_url == "https://example.com/pic.jpg"

    @pytest.mark.asyncio
    async def test_returns_auth_response(self, db_session):
        with patch(VERIFY_PATH, return_value=GOOGLE_IDINFO):
            result, refresh_token = await google_login(db_session)

        assert isinstance(result, AuthResponse)
        assert result.access_token
        assert result.user.email == "google@example.com"
        assert len(refresh_token) == 64

    @pytest.mark.asyncio
    async def test_creates_starter_workspace(self, db_session):
        with patch(VERIFY_PATH, return_value=GOOGLE_IDINFO):
            await google_login(db_session)

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
            result, _ = await google_login(db_session)

        assert result.user.username != "google"
        assert result.user.username.startswith("google")


class TestGoogleLoginExistingUser:

    @pytest.mark.asyncio
    async def test_existing_identity_gets_token(self, db_session, test_user):
        add_identity(db_session, test_user)

        idinfo = {**GOOGLE_IDINFO, "email": test_user.email}
        with patch(VERIFY_PATH, return_value=idinfo):
            result, _ = await google_login(db_session)

        assert isinstance(result, AuthResponse)
        assert result.user.id == test_user.id
        assert db_session.query(UserIdentity).count() == 1

    @pytest.mark.asyncio
    async def test_identity_is_matched_by_subject_not_email(self, db_session, test_user):
        """Zmiana adresu e-mail w Google nie odcina użytkownika od konta"""
        add_identity(db_session, test_user)

        idinfo = {**GOOGLE_IDINFO, "email": "renamed@example.com"}
        with patch(VERIFY_PATH, return_value=idinfo):
            result, _ = await google_login(db_session)

        assert result.user.id == test_user.id
        assert db_session.query(User).count() == 1

    @pytest.mark.asyncio
    async def test_links_identity_to_existing_email(self, db_session, test_user):
        idinfo = {**GOOGLE_IDINFO, "email": test_user.email}
        with patch(VERIFY_PATH, return_value=idinfo):
            await google_login(db_session)

        db_session.refresh(test_user)
        assert [i.provider_user_id for i in test_user.identities] == ["google-123"]

    @pytest.mark.asyncio
    async def test_linking_unverified_account_clears_password(self, db_session, unverified_user):
        """Pre-hijacking: hasło ustawione na niezweryfikowanym koncie nie przeżywa połączenia z Google"""
        idinfo = {**GOOGLE_IDINFO, "email": unverified_user.email}
        with patch(VERIFY_PATH, return_value=idinfo):
            result, _ = await google_login(db_session)

        db_session.refresh(unverified_user)
        assert result.user.id == unverified_user.id
        assert unverified_user.is_active is True
        assert [i.provider_user_id for i in unverified_user.identities] == ["google-123"]
        assert unverified_user.hashed_password is None

    @pytest.mark.asyncio
    async def test_linking_unverified_account_blocks_password_login(self, db_session, unverified_user, redis_client):
        """Po połączeniu z Google stare hasło nie pozwala się zalogować"""
        idinfo = {**GOOGLE_IDINFO, "email": unverified_user.email}
        with patch(VERIFY_PATH, return_value=idinfo):
            await google_login(db_session)

        with pytest.raises(AuthenticationError):
            await AuthService(db_session, redis_client).login_user(
                LoginData(login=unverified_user.email, password="testpassword")
            )

    @pytest.mark.asyncio
    async def test_linking_verified_account_keeps_password(self, db_session, test_user):
        """Zweryfikowane konto zachowuje hasło po połączeniu z Google"""
        idinfo = {**GOOGLE_IDINFO, "email": test_user.email}
        with patch(VERIFY_PATH, return_value=idinfo):
            await google_login(db_session)

        db_session.refresh(test_user)
        assert test_user.hashed_password is not None

    @pytest.mark.asyncio
    async def test_different_google_account_with_same_email_is_rejected(self, db_session, test_user):
        """Regresja: inne konto Google z tym samym e-mailem nie wchodzi do cudzego konta"""
        add_identity(db_session, test_user, subject="google-OLD")

        idinfo = {**GOOGLE_IDINFO, "sub": "google-NEW", "email": test_user.email}
        with patch(VERIFY_PATH, return_value=idinfo):
            with pytest.raises(AppException) as exc:
                await google_login(db_session)

        assert exc.value.status_code == 409
        assert exc.value.code == "IDENTITY_CONFLICT"
        subjects = [i.provider_user_id for i in db_session.query(UserIdentity).all()]
        assert subjects == ["google-OLD"]


class TestGoogleLoginErrors:

    @pytest.mark.asyncio
    async def test_invalid_token_raises(self, db_session):
        """Błąd weryfikacji podpisu/aud → AuthenticationError"""
        with patch(VERIFY_PATH, side_effect=ValueError("Wrong audience")):
            with pytest.raises(AuthenticationError) as exc:
                await google_login(db_session, "bad-credential")

        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_unverified_email_raises(self, db_session):
        """email_verified=False → AuthenticationError"""
        idinfo = {**GOOGLE_IDINFO, "email_verified": False}
        with patch(VERIFY_PATH, return_value=idinfo):
            with pytest.raises(AuthenticationError):
                await google_login(db_session)

        assert db_session.query(User).count() == 0

    @pytest.mark.asyncio
    async def test_missing_subject_raises(self, db_session):
        idinfo = {k: v for k, v in GOOGLE_IDINFO.items() if k != "sub"}
        with patch(VERIFY_PATH, return_value=idinfo):
            with pytest.raises(AuthenticationError):
                await google_login(db_session)

    @pytest.mark.asyncio
    async def test_unknown_provider_raises(self, db_session):
        with pytest.raises(NotFoundError):
            await OAuthService(db_session).login("facebook", "fake-credential")