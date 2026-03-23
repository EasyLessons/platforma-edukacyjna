"""
AUTH SERVICE - Cała logika autentykacji
"""
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from core.logging import get_logger
from core.config import get_settings
from core.exceptions import (
    ConflictError, ValidationError, AuthenticationError,
    NotFoundError, AppException
)
from typing import List
import httpx
from sqlalchemy.exc import OperationalError

from core.models import User, Workspace, WorkspaceMember
from .schemas import (
    RegisterUser, LoginData, VerifyEmail, UserSearchResult,
    RequestPasswordReset, VerifyPasswordResetCode, ResetPassword,
    RegisterResponse, AuthResponse, UserResponse,
    ResendCodeResponse, CheckUserResponse, MessageResponse, VerifyResetCodeResponse
)
from .utils import (
    hash_password, verify_password, create_access_token,
    generate_verification_code, send_verification_email,
    send_password_reset_email
)

logger = get_logger(__name__)


class AuthService:
    """Serwis zarządzający autentykacją"""

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    async def register_user(self, user_data: RegisterUser) -> RegisterResponse:
        """Rejestracja nowego użytkownika"""
        logger.info(f"🆕 Próba rejestracji: {user_data.email}")

        if self.db.query(User).filter(User.email == user_data.email).first():
            logger.warning(f"⚠️ Email zajęty: {user_data.email}")
            raise ConflictError("Email zajęty")

        if self.db.query(User).filter(User.username == user_data.username).first():
            logger.warning(f"⚠️ Username zajęty: {user_data.username}")
            raise ConflictError("Nazwa użytkownika zajęta")

        hashed_password = hash_password(user_data.password)
        verification_code = generate_verification_code()
        code_expires = datetime.utcnow() + timedelta(minutes=15)

        logger.debug(f"🔐 Wygenerowano kod dla {user_data.email}")

        new_user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            is_active=False,
            verification_code=verification_code,
            verification_code_expires=code_expires
        )

        try:
            self.db.add(new_user)
            self.db.flush()
            logger.info(f"✅ User utworzony: {new_user.username} (ID: {new_user.id})")

            starter_workspace = Workspace(
                name="Moja Przestrzeń",
                icon="Home",
                bg_color="bg-green-500",
                created_by=new_user.id,
                created_at=datetime.utcnow()
            )
            self.db.add(starter_workspace)
            self.db.flush()
            logger.info(f"🏢 Workspace utworzony: '{starter_workspace.name}' (ID: {starter_workspace.id})")

            membership = WorkspaceMember(
                workspace_id=starter_workspace.id,
                user_id=new_user.id,
                role="owner",
                is_favourite=True,
                joined_at=datetime.utcnow()
            )
            self.db.add(membership)

            new_user.active_workspace_id = starter_workspace.id

            self.db.commit()
            logger.info(f"✅ Membership utworzony: user {new_user.id} → workspace {starter_workspace.id}")
            logger.info(f"⭐ Aktywny workspace ustawiony: workspace {starter_workspace.id}")

            self.db.refresh(new_user)

        except (ConflictError, ValidationError):
            self.db.rollback()
            raise
        except Exception as e:
            logger.exception(f"❌ Błąd zapisu do bazy: {e}")
            self.db.rollback()
            raise AppException("Błąd serwera", status_code=500)

        if self.settings.resend_api_key and self.settings.resend_api_key != "SKIP":
            try:
                await send_verification_email(
                    new_user.email,
                    new_user.username,
                    verification_code,
                    self.settings.resend_api_key,
                    self.settings.from_email
                )
                logger.info(f"📧 Email wysłany do {new_user.email}")
            except Exception as e:
                logger.exception(f"❌ Błąd wysyłania emaila: {e}")
        else:
            logger.warning(f"⚠️ Email NIE wysłany (RESEND_API_KEY=SKIP) - KOD: {verification_code}")

        return RegisterResponse(
            user=UserResponse.model_validate(new_user),
            message="Użytkownik zarejestrowany. Sprawdź email."
        )

    async def verify_email(self, verify_data: VerifyEmail) -> AuthResponse:
        """Weryfikacja emaila"""
        logger.info(f"🔍 Weryfikacja dla user_id: {verify_data.user_id}")

        user = self.db.query(User).filter(User.id == verify_data.user_id).first()

        if not user:
            logger.warning(f"⚠️ User nie znaleziony: {verify_data.user_id}")
            raise NotFoundError("User nie znaleziony")

        if user.is_active:
            logger.info(f"ℹ️ User już zweryfikowany: {user.username}")
            raise ValidationError("Już zweryfikowane")

        if datetime.utcnow() > user.verification_code_expires:
            logger.warning(f"⏰ Kod wygasł: {user.username}")
            raise ValidationError("Kod wygasł")

        if user.verification_code != verify_data.code:
            logger.warning(f"❌ Zły kod: {user.username}")
            raise ValidationError("Zły kod")

        user.is_active = True
        user.verification_code = None
        self.db.commit()
        self.db.refresh(user)

        logger.info(f"✅ User zweryfikowany: {user.username}")

        access_token = create_access_token(
            data={"sub": str(user.id)},
            secret_key=self.settings.secret_key,
            algorithm=self.settings.algorithm,
            expires_delta=timedelta(minutes=self.settings.access_token_expire_minutes)
        )

        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )

    async def login_user(self, login_data: LoginData) -> AuthResponse:
        """Logowanie"""
        logger.info(f"🔐 Próba logowania: {login_data.login}")

        user = self.db.query(User).filter(
            (User.username == login_data.login) | (User.email == login_data.login)
        ).first()

        if not user or not verify_password(login_data.password, user.hashed_password):
            logger.warning(f"❌ Nieudane logowanie: {login_data.login}")
            raise AuthenticationError("Błędny login lub hasło")

        if not user.is_active:
            logger.warning(f"⚠️ Niezweryfikowane konto: {user.username}")
            raise AppException("Konto niezweryfikowane", code="AUTH_ERROR", status_code=403)

        access_token = create_access_token(
            data={"sub": str(user.id)},
            secret_key=self.settings.secret_key,
            algorithm=self.settings.algorithm,
            expires_delta=timedelta(minutes=self.settings.access_token_expire_minutes)
        )

        logger.info(f"✅ User zalogowany: {user.username}")

        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )

    async def resend_code(self, user_id: int) -> ResendCodeResponse:
        """Ponowne wysłanie kodu"""
        logger.info(f"🔄 Resend dla user_id: {user_id}")

        user = self.db.query(User).filter(User.id == user_id).first()

        if not user:
            raise NotFoundError("User nie znaleziony")
        if user.is_active:
            raise ValidationError("Już zweryfikowane")

        verification_code = generate_verification_code()
        code_expires = datetime.utcnow() + timedelta(minutes=15)

        user.verification_code = verification_code
        user.verification_code_expires = code_expires
        self.db.commit()

        await send_verification_email(
            user.email,
            user.username,
            verification_code,
            self.settings.resend_api_key,
            self.settings.from_email
        )

        logger.info(f"📧 Nowy kod wysłany: {user.email}")

        return ResendCodeResponse(message="Nowy kod wysłany")

    async def check_user(self, email: str) -> CheckUserResponse:
        """Sprawdza czy user istnieje"""
        logger.info(f"🔍 Check user: {email}")

        user = self.db.query(User).filter(User.email == email).first()

        if not user:
            return CheckUserResponse(exists=False, verified=False)

        if user.is_active:
            return CheckUserResponse(exists=True, verified=True)

        verification_code = generate_verification_code()
        code_expires = datetime.utcnow() + timedelta(minutes=15)

        user.verification_code = verification_code
        user.verification_code_expires = code_expires
        self.db.commit()

        await send_verification_email(
            user.email,
            user.username,
            verification_code,
            self.settings.resend_api_key,
            self.settings.from_email
        )

        return CheckUserResponse(
            exists=True,
            verified=False,
            user_id=user.id,
            message="Nowy kod wysłany"
        )

    def search_users(self, query: str, current_user_id: int, limit: int = 10) -> List[UserSearchResult]:
        """Wyszukuje użytkowników po username lub email"""
        logger.info(f"🔍 Query: {query}")
        query = query.strip().lower()
        if len(query) < 2:
            return []

        users = (
            self.db.query(User)
            .filter(
                (User.username.ilike(f"%{query}%")) |
                (User.email.ilike(f"%{query}%")) |
                (User.full_name.ilike(f"%{query}%"))
            )
            .filter(User.id != current_user_id)
            .filter(User.is_active == True)
            .limit(limit)
            .all()
        )

        return [UserSearchResult.model_validate(u) for u in users]

    # === PASSWORD RESET ===

    async def request_password_reset(self, reset_data: RequestPasswordReset) -> MessageResponse:
        """Wysyła kod resetowania hasła na email"""
        logger.info(f"🔐 Żądanie resetu hasła dla: {reset_data.email}")

        user = self.db.query(User).filter(User.email == reset_data.email).first()

        if not user:
            logger.warning(f"⚠️ Reset dla nieistniejącego emaila: {reset_data.email}")
            return MessageResponse(message="Jeśli email istnieje, kod został wysłany")

        if not user.is_active:
            logger.warning(f"⚠️ Reset dla niezweryfikowanego konta: {reset_data.email}")
            raise AppException(
                "Konto niezweryfikowane. Najpierw zweryfikuj email.",
                code="AUTH_ERROR",
                status_code=403
            )

        reset_code = generate_verification_code()
        code_expires = datetime.utcnow() + timedelta(minutes=15)

        user.verification_code = reset_code
        user.verification_code_expires = code_expires
        self.db.commit()

        logger.debug(f"🔐 Wygenerowano kod resetu dla {user.email}")

        if self.settings.resend_api_key and self.settings.resend_api_key != "SKIP":
            try:
                await send_password_reset_email(
                    user.email,
                    user.username,
                    reset_code,
                    self.settings.resend_api_key,
                    self.settings.from_email
                )
                logger.info(f"📧 Email z kodem resetu wysłany do {user.email}")
            except Exception as e:
                logger.exception(f"❌ Błąd wysyłania emaila: {e}")
        else:
            logger.warning(f"⚠️ Email NIE wysłany (RESEND_API_KEY=SKIP) - KOD: {reset_code}")

        return MessageResponse(message="Jeśli email istnieje, kod został wysłany")

    async def verify_reset_code(self, verify_data: VerifyPasswordResetCode) -> VerifyResetCodeResponse:
        """Weryfikuje kod resetowania hasła (bez zmiany hasła)"""
        logger.info(f"🔍 Weryfikacja kodu resetu dla: {verify_data.email}")

        user = self.db.query(User).filter(User.email == verify_data.email).first()

        if not user:
            logger.warning(f"⚠️ User nie znaleziony: {verify_data.email}")
            raise ValidationError("Nieprawidłowy kod")

        if not user.is_active:
            raise AppException("Konto niezweryfikowane", code="AUTH_ERROR", status_code=403)

        if not user.verification_code:
            logger.warning(f"⚠️ Brak kodu resetu: {verify_data.email}")
            raise ValidationError("Nieprawidłowy kod")

        if datetime.utcnow() > user.verification_code_expires:
            logger.warning(f"⏰ Kod wygasł: {verify_data.email}")
            raise ValidationError("Kod wygasł")

        if user.verification_code != verify_data.code:
            logger.warning(f"❌ Zły kod resetu: {verify_data.email}")
            raise ValidationError("Nieprawidłowy kod")

        logger.info(f"✅ Kod resetu zweryfikowany: {verify_data.email}")

        return VerifyResetCodeResponse(message="Kod poprawny", valid=True)

    async def reset_password(self, reset_data: ResetPassword) -> MessageResponse:
        """Resetuje hasło użytkownika"""
        logger.info(f"🔐 Reset hasła dla: {reset_data.email}")

        if reset_data.password != reset_data.password_confirm:
            raise ValidationError("Hasła nie są identyczne")

        user = self.db.query(User).filter(User.email == reset_data.email).first()

        if not user:
            logger.warning(f"⚠️ User nie znaleziony: {reset_data.email}")
            raise ValidationError("Nieprawidłowy kod")

        if not user.is_active:
            raise AppException("Konto niezweryfikowane", code="AUTH_ERROR", status_code=403)

        if not user.verification_code:
            logger.warning(f"⚠️ Brak kodu resetu: {reset_data.email}")
            raise ValidationError("Nieprawidłowy kod")

        if datetime.utcnow() > user.verification_code_expires:
            logger.warning(f"⏰ Kod wygasł: {reset_data.email}")
            raise ValidationError("Kod wygasł")

        if user.verification_code != reset_data.code:
            logger.warning(f"❌ Zły kod resetu: {reset_data.email}")
            raise ValidationError("Nieprawidłowy kod")

        user.hashed_password = hash_password(reset_data.password)
        user.verification_code = None
        user.verification_code_expires = None
        self.db.commit()

        logger.info(f"✅ Hasło zresetowane: {user.username}")

        return MessageResponse(message="Hasło zostało zmienione")

    # === GOOGLE OAUTH ===

    async def get_google_auth_url(self) -> str:
        """Generuje URL do autoryzacji Google OAuth"""
        auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={self.settings.google_client_id}&"
            f"redirect_uri={self.settings.google_redirect_uri}&"
            f"response_type=code&"
            f"scope=openid%20email%20profile&"
            f"access_type=offline"
        )
        logger.info("🔗 Wygenerowano URL autoryzacji Google")
        return auth_url

    async def google_login(self, code: str) -> AuthResponse:
        """Logowanie przez Google OAuth"""
        logger.info("🔐 Rozpoczęto logowanie przez Google")

        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": self.settings.google_client_id,
            "client_secret": self.settings.google_client_secret,
            "redirect_uri": self.settings.google_redirect_uri,
            "grant_type": "authorization_code"
        }

        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)

            if token_response.status_code != 200:
                logger.error(f"❌ Błąd wymiany kodu: {token_response.text}")
                raise AuthenticationError("Błąd autoryzacji Google")

            tokens = token_response.json()
            access_token = tokens.get("access_token")

            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            userinfo_response = await client.get(userinfo_url, headers=headers)

            if userinfo_response.status_code != 200:
                logger.error(f"❌ Błąd pobierania danych: {userinfo_response.text}")
                raise AuthenticationError("Błąd pobierania danych użytkownika")

            user_info = userinfo_response.json()

        google_id = user_info.get("id")
        email = user_info.get("email")
        name = user_info.get("name", "")
        picture = user_info.get("picture")

        if not google_id or not email:
            logger.error(
                "❌ Brak wymaganych danych z Google userinfo (id/email): %s",
                user_info,
            )
            raise AuthenticationError("Google nie zwrócił wymaganych danych konta")

        logger.info(f"📧 Dane Google: {email}")

        try:
            user = self.db.query(User).filter(
                (User.google_id == google_id) | (User.email == email)
            ).first()

            if user:
                if not user.google_id:
                    user.google_id = google_id
                    user.auth_provider = "google"
                    user.profile_picture = picture
                    user.is_active = True
                    self.db.commit()
                    logger.info(f"🔄 Zaktualizowano użytkownika: {user.username}")
                logger.info(f"✅ Logowanie istniejącego użytkownika: {user.username}")
            else:
                username = email.split("@")[0]
                counter = 1
                original_username = username
                while self.db.query(User).filter(User.username == username).first():
                    username = f"{original_username}{counter}"
                    counter += 1

                user = User(
                    username=username,
                    email=email,
                    full_name=name,
                    google_id=google_id,
                    auth_provider="google",
                    profile_picture=picture,
                    is_active=True,
                    hashed_password=None
                )

                try:
                    self.db.add(user)
                    self.db.flush()
                    logger.info(f"✅ Nowy użytkownik Google: {user.username} (ID: {user.id})")

                    starter_workspace = Workspace(
                        name="Moja Przestrzeń",
                        icon="Home",
                        bg_color="bg-green-500",
                        created_by=user.id,
                        created_at=datetime.utcnow()
                    )
                    self.db.add(starter_workspace)
                    self.db.flush()

                    membership = WorkspaceMember(
                        workspace_id=starter_workspace.id,
                        user_id=user.id,
                        role="owner",
                        is_favourite=True,
                        joined_at=datetime.utcnow()
                    )
                    self.db.add(membership)

                    user.active_workspace_id = starter_workspace.id

                    self.db.commit()
                    logger.info(f"🏢 Workspace utworzony dla {user.username}")

                except Exception as e:
                    self.db.rollback()
                    logger.error(f"❌ Błąd tworzenia użytkownika Google: {str(e)}")
                    raise AppException("Błąd tworzenia konta", status_code=500)

            self.db.refresh(user)
        except OperationalError:
            self.db.rollback()
            logger.exception("❌ Błąd połączenia z bazą podczas Google OAuth")
            raise AppException(
                "Baza danych chwilowo niedostępna. Spróbuj ponownie za moment.",
                code="DB_ERROR",
                status_code=503,
            )

        jwt_token = create_access_token(
            data={"sub": str(user.id)},
            secret_key=self.settings.secret_key,
            algorithm=self.settings.algorithm,
            expires_delta=timedelta(minutes=self.settings.access_token_expire_minutes)
        )

        logger.info(f"🎟️ Token wygenerowany dla {user.username}")

        return AuthResponse(
            access_token=jwt_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )