"""
Testy dla AuthService
Kompletne testy rejestracji, logowania, weryfikacji
"""
import pytest
from datetime import datetime, timedelta
from fastapi import HTTPException
from unittest.mock import patch, AsyncMock

from auth.service import AuthService
from auth.schemas import RegisterUser, LoginData, VerifyEmail, UserResponse
from auth.utils import hash_password, verify_password
from core.models import User, Workspace, WorkspaceMember


class TestAuthServiceRegister:
    """Testy rejestracji użytkowników"""
    
    @pytest.mark.asyncio
    async def test_register_user_success(self, db_session):
        """Test pomyślnej rejestracji użytkownika"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username="newuser",
            email="newuser@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123",
            full_name="New User"
        )
        
        # Mock wysyłania emaila
        with patch('auth.service.send_verification_email', new_callable=AsyncMock) as mock_email:
            result = await service.register_user(user_data)
        
        # Sprawdź response
        assert "user" in result
        assert "message" in result
        assert result["user"].username == "newuser"
        assert result["user"].email == "newuser@example.com"
        assert result["user"].is_active == False
        
        # Sprawdź czy user w bazie
        user = db_session.query(User).filter(User.email == "newuser@example.com").first()
        assert user is not None
        assert user.username == "newuser"
        assert user.full_name == "New User"
        assert user.verification_code is not None
        assert user.verification_code_expires is not None
        assert len(user.verification_code) == 6
        
        # Sprawdź czy hasło zahashowane
        assert user.hashed_password != "SecurePass123"
        assert verify_password("SecurePass123", user.hashed_password)
    
    @pytest.mark.asyncio
    async def test_register_creates_starter_workspace(self, db_session):
        """Test czy rejestracja tworzy starter workspace"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username="workspaceuser",
            email="workspace@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123"
        )
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock):
            result = await service.register_user(user_data)
        
        user = result["user"]
        
        # Sprawdź czy workspace został utworzony
        workspace = db_session.query(Workspace).filter(
            Workspace.created_by == user.id
        ).first()
        
        assert workspace is not None
        assert workspace.name == "Moja Przestrzeń"
        assert workspace.icon == "Home"
        assert workspace.bg_color == "bg-green-500"
    
    @pytest.mark.asyncio
    async def test_register_creates_workspace_membership(self, db_session):
        """Test czy rejestracja tworzy membership"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username="memberuser",
            email="member@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123"
        )
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock):
            result = await service.register_user(user_data)
        
        user = result["user"]
        
        # Sprawdź membership
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.user_id == user.id
        ).first()
        
        assert membership is not None
        assert membership.role == "owner"
        assert membership.is_favourite == True
    
    @pytest.mark.asyncio
    async def test_register_sets_active_workspace(self, db_session):
        """Test czy rejestracja ustawia active_workspace_id"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username="activeuser",
            email="active@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123"
        )
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock):
            result = await service.register_user(user_data)
        
        user = db_session.query(User).filter(User.id == result["user"].id).first()
        
        assert user.active_workspace_id is not None
        
        # Sprawdź czy active workspace to ten utworzony
        workspace = db_session.query(Workspace).filter(
            Workspace.id == user.active_workspace_id
        ).first()
        assert workspace is not None
        assert workspace.created_by == user.id
    
    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, db_session, test_user):
        """Test rejestracji z zajętym emailem"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username="differentuser",
            email=test_user.email,  # Email już zajęty
            password="SecurePass123",
            password_confirm="SecurePass123"
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await service.register_user(user_data)
        
        assert exc_info.value.status_code == 400
        assert "Email zajęty" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, db_session, test_user):
        """Test rejestracji z zajętą nazwą użytkownika"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username=test_user.username,  # Username już zajęty
            email="newemail@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123"
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await service.register_user(user_data)
        
        assert exc_info.value.status_code == 400
        assert "Nazwa użytkownika zajęta" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_register_generates_verification_code(self, db_session):
        """Test czy generuje się kod weryfikacyjny"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username="codeuser",
            email="code@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123"
        )
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock):
            result = await service.register_user(user_data)
        
        user = db_session.query(User).filter(User.id == result["user"].id).first()
        
        assert user.verification_code is not None
        assert len(user.verification_code) == 6
        assert user.verification_code.isdigit()
        assert user.verification_code_expires is not None
        assert user.verification_code_expires > datetime.utcnow()
    
    @pytest.mark.asyncio
    async def test_register_sends_verification_email(self, db_session):
        """Test czy wysyła się email weryfikacyjny"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username="emailuser",
            email="emailtest@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123"
        )
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock) as mock_email:
            await service.register_user(user_data)
            
            # Sprawdź czy email został wywołany
            mock_email.assert_called_once()
            call_args = mock_email.call_args[0]
            assert call_args[0] == "emailtest@example.com"  # email
            assert call_args[1] == "emailuser"  # username
            assert len(call_args[2]) == 6  # verification code


class TestAuthServiceVerifyEmail:
    """Testy weryfikacji emaila"""
    
    @pytest.mark.asyncio
    async def test_verify_email_success(self, db_session):
        """Test pomyślnej weryfikacji emaila"""
        # Utwórz niezweryfikowanego usera
        user = User(
            username="unverified",
            email="unverified@example.com",
            hashed_password=hash_password("password"),
            is_active=False,
            verification_code="123456",
            verification_code_expires=datetime.utcnow() + timedelta(minutes=15)
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        service = AuthService(db_session)
        verify_data = VerifyEmail(user_id=user.id, code="123456")
        
        result = await service.verify_email(verify_data)
        
        # Sprawdź response
        assert "access_token" in result
        assert "token_type" in result
        assert result["token_type"] == "bearer"
        assert "user" in result
        
        # Sprawdź czy user został aktywowany
        db_session.refresh(user)
        assert user.is_active == True
        assert user.verification_code is None
    
    @pytest.mark.asyncio
    async def test_verify_email_user_not_found(self, db_session):
        """Test weryfikacji dla nieistniejącego użytkownika"""
        service = AuthService(db_session)
        verify_data = VerifyEmail(user_id=99999, code="123456")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.verify_email(verify_data)
        
        assert exc_info.value.status_code == 404
        assert "nie znaleziony" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_verify_email_already_verified(self, db_session, test_user):
        """Test weryfikacji już zweryfikowanego użytkownika"""
        service = AuthService(db_session)
        verify_data = VerifyEmail(user_id=test_user.id, code="123456")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.verify_email(verify_data)
        
        assert exc_info.value.status_code == 400
        assert "zweryfikowane" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_verify_email_expired_code(self, db_session):
        """Test weryfikacji z wygasłym kodem"""
        user = User(
            username="expired",
            email="expired@example.com",
            hashed_password=hash_password("password"),
            is_active=False,
            verification_code="123456",
            verification_code_expires=datetime.utcnow() - timedelta(minutes=1)  # Wygasły
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        service = AuthService(db_session)
        verify_data = VerifyEmail(user_id=user.id, code="123456")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.verify_email(verify_data)
        
        assert exc_info.value.status_code == 400
        assert "wygasł" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_verify_email_wrong_code(self, db_session):
        """Test weryfikacji ze złym kodem"""
        user = User(
            username="wrongcode",
            email="wrong@example.com",
            hashed_password=hash_password("password"),
            is_active=False,
            verification_code="123456",
            verification_code_expires=datetime.utcnow() + timedelta(minutes=15)
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        service = AuthService(db_session)
        verify_data = VerifyEmail(user_id=user.id, code="999999")  # Zły kod
        
        with pytest.raises(HTTPException) as exc_info:
            await service.verify_email(verify_data)
        
        assert exc_info.value.status_code == 400
        assert "Zły kod" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_verify_email_returns_token(self, db_session):
        """Test czy weryfikacja zwraca token JWT"""
        user = User(
            username="tokentest",
            email="token@example.com",
            hashed_password=hash_password("password"),
            is_active=False,
            verification_code="123456",
            verification_code_expires=datetime.utcnow() + timedelta(minutes=15)
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        service = AuthService(db_session)
        verify_data = VerifyEmail(user_id=user.id, code="123456")
        
        result = await service.verify_email(verify_data)
        
        assert "access_token" in result
        assert isinstance(result["access_token"], str)
        assert len(result["access_token"]) > 0


class TestAuthServiceLogin:
    """Testy logowania"""
    
    @pytest.mark.asyncio
    async def test_login_with_username_success(self, db_session, test_user):
        """Test pomyślnego logowania za pomocą username"""
        service = AuthService(db_session)
        login_data = LoginData(login=test_user.username, password="testpassword")
        
        result = await service.login_user(login_data)
        
        assert "access_token" in result
        assert "token_type" in result
        assert result["token_type"] == "bearer"
        assert "user" in result
        assert result["user"].username == test_user.username
    
    @pytest.mark.asyncio
    async def test_login_with_email_success(self, db_session, test_user):
        """Test pomyślnego logowania za pomocą email"""
        service = AuthService(db_session)
        login_data = LoginData(login=test_user.email, password="testpassword")
        
        result = await service.login_user(login_data)
        
        assert "access_token" in result
        assert result["user"].email == test_user.email
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, db_session, test_user):
        """Test logowania ze złym hasłem"""
        service = AuthService(db_session)
        login_data = LoginData(login=test_user.username, password="wrongpassword")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.login_user(login_data)
        
        assert exc_info.value.status_code == 401
        assert "Błędny login lub hasło" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_login_user_not_found(self, db_session):
        """Test logowania nieistniejącego użytkownika"""
        service = AuthService(db_session)
        login_data = LoginData(login="nonexistent", password="password")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.login_user(login_data)
        
        assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    async def test_login_unverified_user(self, db_session):
        """Test logowania niezweryfikowanego użytkownika"""
        user = User(
            username="unverified",
            email="unverified@example.com",
            hashed_password=hash_password("password"),
            is_active=False  # Niezweryfikowany
        )
        db_session.add(user)
        db_session.commit()
        
        service = AuthService(db_session)
        login_data = LoginData(login="unverified", password="password")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.login_user(login_data)
        
        assert exc_info.value.status_code == 403
        assert "niezweryfikowane" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_login_returns_valid_token(self, db_session, test_user):
        """Test czy logowanie zwraca poprawny token"""
        service = AuthService(db_session)
        login_data = LoginData(login=test_user.username, password="testpassword")
        
        result = await service.login_user(login_data)
        
        assert "access_token" in result
        assert isinstance(result["access_token"], str)
        assert len(result["access_token"]) > 20  # JWT jest długi


class TestAuthServiceResendCode:
    """Testy ponownego wysyłania kodu"""
    
    @pytest.mark.asyncio
    async def test_resend_code_success(self, db_session):
        """Test pomyślnego ponownego wysłania kodu"""
        user = User(
            username="resenduser",
            email="resend@example.com",
            hashed_password=hash_password("password"),
            is_active=False,
            verification_code="111111",
            verification_code_expires=datetime.utcnow() + timedelta(minutes=5)
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        old_code = user.verification_code
        
        service = AuthService(db_session)
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock) as mock_email:
            result = await service.resend_code(user.id)
        
        assert "message" in result
        
        # Sprawdź czy kod się zmienił
        db_session.refresh(user)
        assert user.verification_code != old_code
        assert len(user.verification_code) == 6
        
        # Sprawdź czy email został wysłany
        mock_email.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_resend_code_user_not_found(self, db_session):
        """Test resend dla nieistniejącego użytkownika"""
        service = AuthService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.resend_code(99999)
        
        assert exc_info.value.status_code == 404
    
    @pytest.mark.asyncio
    async def test_resend_code_already_verified(self, db_session, test_user):
        """Test resend dla już zweryfikowanego użytkownika"""
        service = AuthService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.resend_code(test_user.id)
        
        assert exc_info.value.status_code == 400
        assert "zweryfikowane" in str(exc_info.value.detail)


class TestAuthServiceCheckUser:
    """Testy sprawdzania czy user istnieje"""
    
    @pytest.mark.asyncio
    async def test_check_user_not_exists(self, db_session):
        """Test sprawdzania nieistniejącego użytkownika"""
        service = AuthService(db_session)
        
        result = await service.check_user("nonexistent@example.com")
        
        assert result["exists"] == False
        assert result["verified"] == False
    
    @pytest.mark.asyncio
    async def test_check_user_exists_verified(self, db_session, test_user):
        """Test sprawdzania istniejącego i zweryfikowanego użytkownika"""
        service = AuthService(db_session)
        
        result = await service.check_user(test_user.email)
        
        assert result["exists"] == True
        assert result["verified"] == True
    
    @pytest.mark.asyncio
    async def test_check_user_exists_unverified(self, db_session):
        """Test sprawdzania istniejącego ale niezweryfikowanego użytkownika"""
        user = User(
            username="unverified",
            email="unverified@example.com",
            hashed_password=hash_password("password"),
            is_active=False
        )
        db_session.add(user)
        db_session.commit()
        
        service = AuthService(db_session)
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock):
            result = await service.check_user(user.email)
        
        assert result["exists"] == True
        assert result["verified"] == False
        assert "user_id" in result
        assert "message" in result
    
    @pytest.mark.asyncio
    async def test_check_user_sends_new_code_if_unverified(self, db_session):
        """Test czy check_user wysyła nowy kod dla niezweryfikowanego"""
        user = User(
            username="unverified2",
            email="unverified2@example.com",
            hashed_password=hash_password("password"),
            is_active=False
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        service = AuthService(db_session)
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock) as mock_email:
            await service.check_user(user.email)
            
            # Sprawdź czy email został wysłany
            mock_email.assert_called_once()
        
        # Sprawdź czy kod został wygenerowany
        db_session.refresh(user)
        assert user.verification_code is not None
        assert user.verification_code_expires is not None


class TestAuthServiceIntegration:
    """Testy integracyjne - pełne scenariusze"""
    
    @pytest.mark.asyncio
    async def test_full_registration_flow(self, db_session):
        """Test pełnego procesu rejestracji"""
        service = AuthService(db_session)
        
        # 1. Rejestracja
        user_data = RegisterUser(
            username="fullflow",
            email="fullflow@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123",
            full_name="Full Flow User"
        )
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock):
            register_result = await service.register_user(user_data)
        
        user = register_result["user"]
        assert user.is_active == False
        
        # 2. Pobierz kod z bazy (w rzeczywistości byłby w emailu)
        db_user = db_session.query(User).filter(User.id == user.id).first()
        code = db_user.verification_code
        
        # 3. Weryfikacja
        verify_data = VerifyEmail(user_id=user.id, code=code)
        verify_result = await service.verify_email(verify_data)
        
        assert "access_token" in verify_result
        
        # 4. Sprawdź czy user aktywny
        db_session.refresh(db_user)
        assert db_user.is_active == True
        
        # 5. Logowanie
        login_data = LoginData(login="fullflow", password="SecurePass123")
        login_result = await service.login_user(login_data)
        
        assert "access_token" in login_result
        assert login_result["user"].username == "fullflow"
    
    @pytest.mark.asyncio
    async def test_registration_creates_complete_workspace_setup(self, db_session):
        """Test czy rejestracja tworzy kompletny setup workspace"""
        service = AuthService(db_session)
        
        user_data = RegisterUser(
            username="setupuser",
            email="setup@example.com",
            password="SecurePass123",
            password_confirm="SecurePass123"
        )
        
        with patch('auth.service.send_verification_email', new_callable=AsyncMock):
            result = await service.register_user(user_data)
        
        user = result["user"]
        
        # Sprawdź workspace
        workspace = db_session.query(Workspace).filter(
            Workspace.created_by == user.id
        ).first()
        assert workspace is not None
        
        # Sprawdź membership
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.workspace_id == workspace.id
        ).first()
        assert membership is not None
        assert membership.role == "owner"
        assert membership.is_favourite == True
        
        # Sprawdź active workspace
        db_user = db_session.query(User).filter(User.id == user.id).first()
        assert db_user.active_workspace_id == workspace.id