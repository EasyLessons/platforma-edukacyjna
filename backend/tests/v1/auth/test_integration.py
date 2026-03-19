"""
Testy integracyjne — pełne scenariusze przepływu
Testują współdziałanie wszystkich metod AuthService
"""
import pytest
from unittest.mock import patch, AsyncMock

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import RegisterUser, LoginData, VerifyEmail, ResetPassword, RequestPasswordReset
from api.v1.auth.utils import verify_password
from core.models import User, Workspace, WorkspaceMember

MOCK_EMAIL = "api.v1.auth.service.send_verification_email"
MOCK_RESET = "api.v1.auth.service.send_password_reset_email"


class TestRegistrationToLoginFlow:

    @pytest.mark.asyncio
    async def test_full_register_verify_login(self, db_session):
        """Rejestracja → weryfikacja emaila → logowanie"""
        service = AuthService(db_session)

        # 1. Rejestracja
        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            register_result = await service.register_user(RegisterUser(
                username="flowuser",
                email="flow@example.com",
                password="SecurePass1",
                password_confirm="SecurePass1",
            ))

        assert register_result.user.is_active is False

        # 2. Pobierz kod z bazy (w produkcji byłby w emailu)
        db_user = db_session.query(User).filter(User.id == register_result.user.id).first()
        code = db_user.verification_code

        # 3. Weryfikacja
        verify_result = await service.verify_email(
            VerifyEmail(user_id=db_user.id, code=code)
        )
        assert verify_result.access_token

        db_session.refresh(db_user)
        assert db_user.is_active is True

        # 4. Logowanie
        login_result = await service.login_user(
            LoginData(login="flowuser", password="SecurePass1")
        )
        assert login_result.user.username == "flowuser"
        assert login_result.access_token

    @pytest.mark.asyncio
    async def test_register_creates_complete_workspace_setup(self, db_session):
        """Rejestracja tworzy user + workspace + membership + active_workspace"""
        service = AuthService(db_session)

        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await service.register_user(RegisterUser(
                username="setupuser",
                email="setup@example.com",
                password="SecurePass1",
                password_confirm="SecurePass1",
            ))

        db_user = db_session.query(User).filter(User.id == result.user.id).first()

        workspace = db_session.query(Workspace).filter(
            Workspace.created_by == db_user.id
        ).first()
        assert workspace is not None

        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.user_id == db_user.id,
            WorkspaceMember.workspace_id == workspace.id,
        ).first()
        assert membership is not None
        assert membership.role == "owner"
        assert membership.is_favourite is True

        assert db_user.active_workspace_id == workspace.id


class TestPasswordResetFlow:

    @pytest.mark.asyncio
    async def test_full_reset_flow(self, db_session, test_user):
        """Żądanie resetu → weryfikacja kodu → zmiana hasła → logowanie nowym hasłem"""
        service = AuthService(db_session)

        # 1. Żądanie resetu
        with patch(MOCK_RESET, new_callable=AsyncMock):
            await service.request_password_reset(
                RequestPasswordReset(email=test_user.email)
            )

        db_session.refresh(test_user)
        code = test_user.verification_code
        assert code is not None

        # 2. Weryfikacja kodu
        from api.v1.auth.schemas import VerifyPasswordResetCode
        verify_result = await service.verify_reset_code(
            VerifyPasswordResetCode(email=test_user.email, code=code)
        )
        assert verify_result.valid is True

        # 3. Reset hasła
        await service.reset_password(ResetPassword(
            email=test_user.email,
            code=code,
            password="BrandNewPass1",
            password_confirm="BrandNewPass1",
        ))

        # 4. Logowanie nowym hasłem
        login_result = await service.login_user(
            LoginData(login=test_user.username, password="BrandNewPass1")
        )
        assert login_result.user.id == test_user.id

    @pytest.mark.asyncio
    async def test_old_password_invalid_after_reset(self, db_session, test_user):
        """Stare hasło nie działa po resecie"""
        service = AuthService(db_session)

        with patch(MOCK_RESET, new_callable=AsyncMock):
            await service.request_password_reset(
                RequestPasswordReset(email=test_user.email)
            )

        db_session.refresh(test_user)
        code = test_user.verification_code

        await service.reset_password(ResetPassword(
            email=test_user.email,
            code=code,
            password="BrandNewPass1",
            password_confirm="BrandNewPass1",
        ))

        from core.exceptions import AuthenticationError
        with pytest.raises(AuthenticationError):
            await service.login_user(
                LoginData(login=test_user.username, password="testpassword")
            )


class TestCodeExpiry:

    @pytest.mark.asyncio
    async def test_code_usable_only_once(self, db_session):
        """Kod weryfikacyjny można użyć tylko raz"""
        service = AuthService(db_session)

        with patch(MOCK_EMAIL, new_callable=AsyncMock):
            result = await service.register_user(RegisterUser(
                username="onceuser",
                email="once@example.com",
                password="SecurePass1",
                password_confirm="SecurePass1",
            ))

        db_user = db_session.query(User).filter(User.id == result.user.id).first()
        code = db_user.verification_code

        # Pierwsze użycie — OK
        await service.verify_email(VerifyEmail(user_id=db_user.id, code=code))

        # Drugie użycie — powinno rzucić wyjątek (user już aktywny)
        from core.exceptions import ValidationError
        with pytest.raises(ValidationError):
            await service.verify_email(VerifyEmail(user_id=db_user.id, code=code))