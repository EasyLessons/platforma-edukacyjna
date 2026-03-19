"""
Testy rejestracji użytkowników
POST /api/v1/auth/register
"""
import pytest
from datetime import datetime
from unittest.mock import patch, AsyncMock

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import RegisterUser, RegisterResponse
from api.v1.auth.utils import verify_password
from core.exceptions import ConflictError
from core.models import User, Workspace, WorkspaceMember

MOCK_EMAIL = "api.v1.auth.service.send_verification_email"

VALID_DATA = dict(
    username="newuser",
    email="newuser@example.com",
    password="SecurePass123",
    password_confirm="SecurePass123",
    full_name="New User",
)


def make_user_data(**overrides) -> RegisterUser:
    return RegisterUser(**{**VALID_DATA, **overrides})


class TestRegisterSuccess:

    @pytest.mark.asyncio
    async def test_returns_register_response(self, db_session):
        """Zwraca RegisterResponse z user i message"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await AuthService(db_session).register_user(make_user_data())

        assert isinstance(result, RegisterResponse)
        assert result.user.username == "newuser"
        assert result.user.email == "newuser@example.com"
        assert result.message == "Użytkownik zarejestrowany. Sprawdź email."

    @pytest.mark.asyncio
    async def test_user_created_inactive(self, db_session):
        """Nowy user jest nieaktywny — wymaga weryfikacji emaila"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await AuthService(db_session).register_user(make_user_data())

        assert result.user.is_active is False

    @pytest.mark.asyncio
    async def test_password_is_hashed(self, db_session):
        """Hasło w bazie jest zahashowane, nie plain-text"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await AuthService(db_session).register_user(make_user_data())

        db_user = db_session.query(User).filter(User.id == result.user.id).first()
        assert db_user.hashed_password != "SecurePass123"
        assert verify_password("SecurePass123", db_user.hashed_password)

    @pytest.mark.asyncio
    async def test_verification_code_generated(self, db_session):
        """Generuje 6-cyfrowy kod weryfikacyjny z datą wygaśnięcia"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await AuthService(db_session).register_user(make_user_data())

        db_user = db_session.query(User).filter(User.id == result.user.id).first()
        assert db_user.verification_code is not None
        assert len(db_user.verification_code) == 6
        assert db_user.verification_code.isdigit()
        assert db_user.verification_code_expires > datetime.utcnow()

    @pytest.mark.asyncio
    async def test_creates_starter_workspace(self, db_session):
        """Tworzy starter workspace i ustawia go jako aktywny"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await AuthService(db_session).register_user(make_user_data())

        db_user = db_session.query(User).filter(User.id == result.user.id).first()

        workspace = db_session.query(Workspace).filter(
            Workspace.created_by == db_user.id
        ).first()
        assert workspace is not None
        assert workspace.name == "Moja Przestrzeń"
        assert db_user.active_workspace_id == workspace.id

    @pytest.mark.asyncio
    async def test_creates_owner_membership(self, db_session):
        """Tworzy membership z rolą owner i is_favourite=True"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await AuthService(db_session).register_user(make_user_data())

        workspace = db_session.query(Workspace).filter(
            Workspace.created_by == result.user.id
        ).first()

        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.user_id == result.user.id,
            WorkspaceMember.workspace_id == workspace.id,
        ).first()
        assert membership is not None
        assert membership.role == "owner"
        assert membership.is_favourite is True

    @pytest.mark.asyncio
    async def test_sends_verification_email(self, db_session):
        """Wywołuje send_verification_email z poprawnymi argumentami"""
        with patch(MOCK_EMAIL, new_callable=AsyncMock) as mock_send:
            await AuthService(db_session).register_user(make_user_data())

        mock_send.assert_called_once()
        call_args = mock_send.call_args[0]
        assert call_args[0] == "newuser@example.com"
        assert call_args[1] == "newuser"

    @pytest.mark.asyncio
    async def test_skips_email_when_resend_skip(self, db_session):
        """Nie wysyła emaila gdy RESEND_API_KEY=SKIP"""
        service = AuthService(db_session)
        service.settings.resend_api_key = "SKIP"
 
        with patch(MOCK_EMAIL, new_callable=AsyncMock) as mock_send:
            await service.register_user(make_user_data())
 
        mock_send.assert_not_called()


class TestRegisterConflicts:

    @pytest.mark.asyncio
    async def test_duplicate_email_raises_conflict(self, db_session, test_user):
        """Email już zajęty → ConflictError 409"""
        with pytest.raises(ConflictError) as exc:
            await AuthService(db_session).register_user(
                make_user_data(username="other", email=test_user.email)
            )
        assert exc.value.status_code == 409
        assert "Email zajęty" in exc.value.message

    @pytest.mark.asyncio
    async def test_duplicate_username_raises_conflict(self, db_session, test_user):
        """Username już zajęty → ConflictError 409"""
        with pytest.raises(ConflictError) as exc:
            await AuthService(db_session).register_user(
                make_user_data(username=test_user.username, email="other@example.com")
            )
        assert exc.value.status_code == 409
        assert "Nazwa użytkownika zajęta" in exc.value.message

    @pytest.mark.asyncio
    async def test_duplicate_email_does_not_create_user(self, db_session, test_user):
        """Przy konflikcie emaila baza pozostaje niezmieniona"""
        count_before = db_session.query(User).count()

        with pytest.raises(ConflictError):
            await AuthService(db_session).register_user(
                make_user_data(username="other", email=test_user.email)
            )

        assert db_session.query(User).count() == count_before