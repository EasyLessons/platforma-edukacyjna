"""
Testy logowania przez Google OAuth
GET  /api/v1/auth/google
GET  /api/v1/auth/google/callback
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import AuthResponse
from api.v1.auth.utils import hash_password
from core.exceptions import AuthenticationError
from core.models import User, Workspace, WorkspaceMember

GOOGLE_USER_INFO = {
    "id": "google-123",
    "email": "google@example.com",
    "name": "Google User",
    "picture": "https://example.com/pic.jpg",
}


def mock_httpx_success(user_info=None):
    """Mockuje udane odpowiedzi Google API"""
    if user_info is None:
        user_info = GOOGLE_USER_INFO

    token_response = MagicMock()
    token_response.status_code = 200
    token_response.json.return_value = {"access_token": "google-access-token"}

    userinfo_response = MagicMock()
    userinfo_response.status_code = 200
    userinfo_response.json.return_value = user_info

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post.return_value = token_response
    mock_client.get.return_value = userinfo_response

    return mock_client


class TestGoogleLoginNewUser:

    @pytest.mark.asyncio
    async def test_creates_new_user(self, db_session):
        """Nowy user Google zostaje utworzony w bazie"""
        with patch("api.v1.auth.service.httpx.AsyncClient", return_value=mock_httpx_success()):
            await AuthService(db_session).google_login("auth-code")

        user = db_session.query(User).filter(User.email == "google@example.com").first()
        assert user is not None
        assert user.google_id == "google-123"
        assert user.is_active is True

    @pytest.mark.asyncio
    async def test_returns_auth_response(self, db_session):
        """Zwraca AuthResponse z tokenem"""
        with patch("api.v1.auth.service.httpx.AsyncClient", return_value=mock_httpx_success()):
            result = await AuthService(db_session).google_login("auth-code")

        assert isinstance(result, AuthResponse)
        assert result.access_token
        assert result.user.email == "google@example.com"

    @pytest.mark.asyncio
    async def test_creates_starter_workspace(self, db_session):
        """Nowy user Google dostaje starter workspace"""
        with patch("api.v1.auth.service.httpx.AsyncClient", return_value=mock_httpx_success()):
            await AuthService(db_session).google_login("auth-code")

        user = db_session.query(User).filter(User.email == "google@example.com").first()
        workspace = db_session.query(Workspace).filter(
            Workspace.created_by == user.id
        ).first()

        assert workspace is not None
        assert user.active_workspace_id == workspace.id

    @pytest.mark.asyncio
    async def test_username_conflict_resolved(self, db_session):
        """Jeśli username z emaila jest zajęty, dodaje licznik"""
        existing = User(
            username="google",
            email="other@example.com",
            hashed_password=hash_password("pass"),
            is_active=True,
        )
        db_session.add(existing)
        db_session.commit()

        info = {**GOOGLE_USER_INFO, "email": "google@gmail.com"}
        with patch("api.v1.auth.service.httpx.AsyncClient", return_value=mock_httpx_success(info)):
            result = await AuthService(db_session).google_login("auth-code")

        assert result.user.username != "google"
        assert result.user.username.startswith("google")


class TestGoogleLoginExistingUser:

    @pytest.mark.asyncio
    async def test_existing_user_gets_token(self, db_session, test_user):
        """Istniejący user przez Google OAuth dostaje token"""
        test_user.google_id = "google-123"
        db_session.commit()

        with patch("api.v1.auth.service.httpx.AsyncClient", return_value=mock_httpx_success(
            {**GOOGLE_USER_INFO, "email": test_user.email}
        )):
            result = await AuthService(db_session).google_login("auth-code")

        assert isinstance(result, AuthResponse)
        assert result.user.id == test_user.id

    @pytest.mark.asyncio
    async def test_links_google_id_to_existing_email(self, db_session, test_user):
        """User z tym samym emailem dostaje przypisane google_id"""
        with patch("api.v1.auth.service.httpx.AsyncClient", return_value=mock_httpx_success(
            {**GOOGLE_USER_INFO, "email": test_user.email}
        )):
            await AuthService(db_session).google_login("auth-code")

        db_session.refresh(test_user)
        assert test_user.google_id == "google-123"


class TestGoogleLoginErrors:

    @pytest.mark.asyncio
    async def test_token_exchange_failure(self, db_session):
        """Błąd wymiany kodu → AuthenticationError"""
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        bad_response = MagicMock()
        bad_response.status_code = 400
        bad_response.text = "invalid_code"
        mock_client.post.return_value = bad_response

        with patch("api.v1.auth.service.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(AuthenticationError) as exc:
                await AuthService(db_session).google_login("bad-code")

        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_userinfo_failure(self, db_session):
        """Błąd pobierania danych usera → AuthenticationError"""
        token_response = MagicMock()
        token_response.status_code = 200
        token_response.json.return_value = {"access_token": "token"}

        bad_userinfo = MagicMock()
        bad_userinfo.status_code = 403
        bad_userinfo.text = "forbidden"

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post.return_value = token_response
        mock_client.get.return_value = bad_userinfo

        with patch("api.v1.auth.service.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(AuthenticationError):
                await AuthService(db_session).google_login("auth-code")