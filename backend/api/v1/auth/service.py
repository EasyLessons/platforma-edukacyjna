"""
AUTH SERVICE - Cała logika autentykacji
"""
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from core.logging import get_logger
from core.config import get_settings
from core.redis_client import get_redis_client
from core.exceptions import (
    ConflictError, ValidationError, AuthenticationError,
    NotFoundError, AppException
)
from typing import List
import httpx
import hashlib
import redis.asyncio as redis
from redis.exceptions import ConnectionError, TimeoutError
from sqlalchemy.exc import OperationalError, IntegrityError

from core.models import User, Workspace, WorkspaceMember, RefreshToken
from .schemas import (
    RegisterUser, LoginData, VerifyEmail, UserSearchResult,
    RequestPasswordReset, VerifyPasswordResetCode, ResetPassword,
    RegisterResponse, AuthResponse, UserResponse,
    ResendCodeResponse, CheckUserResponse, MessageResponse, VerifyResetCodeResponse,
    RefreshResponse, MeResponse
)
from .utils import (
    hash_password, verify_password, create_access_token,
    generate_verification_code, send_verification_email,
    send_password_reset_email,
    generate_refresh_token, hash_refresh_token
)

logger = get_logger(__name__)


class AuthService:
    """Serwis zarządzający autentykacją"""

    def __init__(self, db: Session, redis_client: redis.Redis | None = None):
        self.db = db
        self.settings = get_settings()
        self.redis = redis_client or get_redis_client()

    def _email_verify_key(self, user_id: int) -> str:
        """Generuje klucz Redis dla kodu weryfikacji emaila"""
        return f"auth:email_verification:{user_id}"

    def _password_reset_key(self, user_id: int) -> str:
        """Generuje klucz Redis dla kodu resetowania hasła"""
        return f"auth:password_reset:{user_id}"

    async def _store_verification_code(self, key: str, code: str) -> None:
        """Zapisuje kod w Redis z TTL; przy błędzie połączenia rzuca 503."""
        ttl_seconds = self.settings.verification_code_expire_minutes * 60
        try:
            await self.redis.setex(key, ttl_seconds, code)
        except (ConnectionError, TimeoutError):
            logger.exception(f"Błąd zapisu kodu w Redis (key={key})")
            raise AppException("Serwis weryfikacji chwilowo niedostępny", code="REDIS_ERROR", status_code=503)

    async def _read_verification_code(self, key: str) -> str | None:
        """Odczytuje kod z Redis; przy błędzie połączenia rzuca 503."""
        try:
            return await self.redis.get(key)
        except (ConnectionError, TimeoutError):
            logger.exception(f"Błąd odczytu kodu w Redis (key={key})")
            raise AppException("Serwis weryfikacji chwilowo niedostępny", code="REDIS_ERROR", status_code=503)

    def _create_session(self, user: User) -> tuple[AuthResponse, str]:
        """
        Tworzy sesję (access + refresh token) dla użytkownika
        
        Returns:
            tuple[AuthResponse, str]: AuthResponse z access tokenem i plaintext refresh token
        """
        access_token = create_access_token(
            data={"sub": str(user.id)},
            secret_key=self.settings.secret_key,
            algorithm=self.settings.algorithm,
            expires_delta=timedelta(minutes=self.settings.access_token_expire_minutes)
        )

        refresh_token_plain = generate_refresh_token()
        refresh_token_hash = hash_refresh_token(refresh_token_plain)
        expires_at = datetime.utcnow() + timedelta(days=self.settings.refresh_token_expire_days)

        db_refresh = RefreshToken(
            user_id=user.id,
            token_hash=refresh_token_hash,
            expires_at=expires_at,
        )
        self.db.add(db_refresh)
        self.db.commit()

        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        ), refresh_token_plain

    async def register_user(self, user_data: RegisterUser) -> RegisterResponse:
        """Rejestracja nowego użytkownika"""

        existing_user = self.db.query(User).filter(
            (User.email == user_data.email) | (User.username == user_data.username)
            ).first()

        if existing_user:
            if existing_user.email == user_data.email:
                raise ConflictError("Email zajęty")
            raise ConflictError("Nazwa użytkownika zajęta")

        hashed_password = hash_password(user_data.password)
        verification_code = generate_verification_code()

        new_user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            is_active=False,
        )

        try:
            self.db.add(new_user)
            self.db.flush()
            logger.info(f"User utworzony (ID: {new_user.id})")

            starter_workspace = Workspace(
                name="Moja Przestrzeń",
                icon="Home",
                bg_color="bg-green-500",
                created_by=new_user.id,
                created_at=datetime.utcnow()
            )
            self.db.add(starter_workspace)
            self.db.flush()

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
            self.db.refresh(new_user)

        except (ConflictError, ValidationError):
            self.db.rollback()
            raise
        except IntegrityError:
            self.db.rollback()
            raise ConflictError("Email lub nazwa użytkownika zajęta")
        except Exception:
            self.db.rollback()
            logger.exception("Błąd zapisu do bazy podczas rejestracji")
            raise AppException("Błąd serwera", status_code=500)

        await self._store_verification_code(self._email_verify_key(new_user.id), verification_code)

        if self.settings.resend_api_key and self.settings.resend_api_key != "SKIP":
            try:
                await send_verification_email(
                    new_user.email,
                    new_user.username,
                    verification_code,
                    self.settings.resend_api_key,
                    self.settings.from_email
                )
                logger.info(f"Email wysłany (user_id={new_user.id})")
            except Exception:
                logger.exception(f"Błąd wysyłania emaila (user_id={new_user.id})")

        return RegisterResponse(
            user=UserResponse.model_validate(new_user),
            message="Użytkownik zarejestrowany. Sprawdź email."
        )

    async def verify_email(self, verify_data: VerifyEmail) -> AuthResponse:
        """Weryfikacja emaila"""

        user = self.db.query(User).filter(User.id == verify_data.user_id).first()

        if not user:
            raise NotFoundError("User nie znaleziony")
        if user.is_active:
            raise ValidationError("Już zweryfikowane")
        
        stored_code = await self._read_verification_code(self._email_verify_key(user.id))
        
        if stored_code is None:
            raise ValidationError("Kod wygasł")
        if stored_code != verify_data.code:
            raise ValidationError("Nieprawidłowy kod")
        
        user.is_active = True
        self.db.commit()
        self.db.refresh(user)

        await self.redis.delete(self._email_verify_key(user.id))

        logger.info(f"User zweryfikowany (user_id={user.id})")

        return self._create_session(user)

    async def login_user(self, login_data: LoginData) -> AuthResponse:
        """Logowanie"""

        user = self.db.query(User).filter(
            (User.username == login_data.login) | (User.email == login_data.login)
        ).first()

        if not user or not verify_password(login_data.password, user.hashed_password):
            if user:
                logger.warning(f"Nieudane logowanie (user_id={user.id})")
            else:
                login_hash = hashlib.sha256(login_data.login.encode()).hexdigest()[:12]
                logger.warning(f"Nieudane logowanie (login_hash={login_hash})")
            raise AuthenticationError("Błędny login lub hasło")

        if not user.is_active:
            raise AppException("Konto niezaktywne", code="AUTH_ERROR", status_code=403)

        logger.info(f"User zalogowany (user_id={user.id})")

        return self._create_session(user)

    async def resend_code(self, user_id: int) -> ResendCodeResponse:
        """Ponowne wysłanie kodu"""
        logger.info(f"Resend dla user_id={user_id}")

        user = self.db.query(User).filter(User.id == user_id).first()

        if not user:
            raise NotFoundError("User nie znaleziony")
        if user.is_active:
            raise ValidationError("Już zweryfikowane")

        verification_code = generate_verification_code()
        await self._store_verification_code(self._email_verify_key(user.id), verification_code)

        await send_verification_email(
            user.email,
            user.username,
            verification_code,
            self.settings.resend_api_key,
            self.settings.from_email
        )

        logger.info(f"Nowy kod wysłany (user_id={user.id})")

        return ResendCodeResponse(message="Nowy kod wysłany")

    async def check_user(self, email: str) -> CheckUserResponse:
        """Sprawdza czy user istnieje"""

        user = self.db.query(User).filter(User.email == email).first()

        if not user:
            return CheckUserResponse(exists=False, verified=False)
        if user.is_active:
            return CheckUserResponse(exists=True, verified=True)
        
        verification_code = generate_verification_code()
        await self._store_verification_code(self._email_verify_key(user.id), verification_code)

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

        user = self.db.query(User).filter(User.email == reset_data.email).first()

        if not user:
            return MessageResponse(message="Jeśli email istnieje, kod został wysłany")
        if not user.is_active:
            raise AppException("Konto nieaktywne.", code="AUTH_ERROR", status_code=403)

        reset_code = generate_verification_code()
        await self._store_verification_code(self._password_reset_key(user.id), reset_code)

        if self.settings.resend_api_key and self.settings.resend_api_key != "SKIP":
            try:
                await send_password_reset_email(
                    user.email,
                    user.username,
                    reset_code,
                    self.settings.resend_api_key,
                    self.settings.from_email
                )
                logger.info(f"Email z kodem resetu wysłany (user_id={user.id})")
            except Exception:
                logger.exception(f"Błąd wysyłania emaila (user_id={user.id})")
        else:
            logger.warning(f"Email NIE wysłany (RESEND_API_KEY=SKIP), user_id={user.id}")

        return MessageResponse(message="Jeśli email istnieje, kod został wysłany")

    async def verify_reset_code(self, verify_data: VerifyPasswordResetCode) -> VerifyResetCodeResponse:
        """Weryfikuje kod resetowania hasła (bez zmiany hasła)"""

        user = self.db.query(User).filter(User.email == verify_data.email).first()

        if not user:
            raise ValidationError("Nieprawidłowy kod")
        if not user.is_active:
            raise AppException("Konto nieaktywne", code="AUTH_ERROR", status_code=403)
        
        stored_code = await self._read_verification_code(self._password_reset_key(user.id))

        if stored_code is None:
            logger.warning(f"Kod resetu wygasł (user_id={user.id})")
            raise ValidationError("Kod wygasł")
        if stored_code != verify_data.code:
            logger.warning(f"Zły kod resetu (user_id={user.id})")
            raise ValidationError("Nieprawidłowy kod")
        
        logger.info(f"Kod resetu zweryfikowany (user_id={user.id})")

        return VerifyResetCodeResponse(message="Kod poprawny", valid=True)

    async def reset_password(self, reset_data: ResetPassword) -> MessageResponse:
        """Resetuje hasło użytkownika"""

        user = self.db.query(User).filter(User.email == reset_data.email).first()

        if not user:
            raise ValidationError("Nieprawidłowy kod")
        if not user.is_active:
            raise AppException("Konto nieaktywne", code="AUTH_ERROR", status_code=403)
    
        stored_code = await self._read_verification_code(self._password_reset_key(user.id))
        if stored_code is None:
            logger.warning(f"Kod resetu wygasł (user_id={user.id})")
            raise ValidationError("Kod wygasł")
        if stored_code != reset_data.code:
            logger.warning(f"Zły kod resetu (user_id={user.id})")
            raise ValidationError("Nieprawidłowy kod")

        user.hashed_password = hash_password(reset_data.password)
        self.db.commit()

        await self.redis.delete(self._password_reset_key(user.id))

        logger.info(f"Hasło zresetowane (user_id={user.id})")

        return MessageResponse(message="Hasło zostało zmienione")
    
    # === SESJA / REFRESH ===

    async def refresh_session(self, refresh_token_plain: str) -> tuple[AuthResponse, str]:
        """Rotuje refresh token i zwraca nową parę tokenów"""
        token_hash = hash_refresh_token(refresh_token_plain)

        db_token = self.db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,    
        ).first()

        if not db_token:
            raise AuthenticationError("Nieprawidłowy refresh token")
        
        if datetime.utcnow() > db_token.expires_at:
            raise AuthenticationError("Refresh token wygasł")
        
        # Unieważnij stary token
        db_token.revoked = True
        self.db.commit()

        user = self.db.query(User).filter(User.id == db_token.user_id).first()
        if not user or not user.is_active:
            raise AuthenticationError("Użytkownik nieaktywny")

        logger.info(f"Refresh sesji (user_id={user.id})")
        return self._create_session(user)
    
    def get_me(self, user: User) -> MeResponse:
        """Zwraca dane aktualnie zalogowanego użytkownika"""
        return MeResponse(user=UserResponse.model_validate(user))
    
    async def logout_session(self, refresh_token_plain: str) -> None:
        token_hash = hash_refresh_token(refresh_token_plain)

        db_token = self.db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        ).first()

        if db_token:
            db_token.revoked = True
            self.db.commit()

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
                logger.error(f"Błąd wymiany kodu Google (status={token_response.status_code})")
                raise AuthenticationError("Błąd autoryzacji Google")

            tokens = token_response.json()
            access_token = tokens.get("access_token")

            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            userinfo_response = await client.get(userinfo_url, headers=headers)

            if userinfo_response.status_code != 200:
                logger.error(f"Błąd pobierania danych Google (status={userinfo_response.status_code})")
                raise AuthenticationError("Błąd pobierania danych użytkownika")

            user_info = userinfo_response.json()

        google_id = user_info.get("id")
        email = user_info.get("email")
        name = user_info.get("name", "")
        picture = user_info.get("picture")

        if not google_id or not email:
            logger.error(
                "Brak wymaganych danych z Google userinfo (has_id=%s, has_email=%s)",
                bool(google_id), bool(email),
            )
            raise AuthenticationError("Google nie zwrócił wymaganych danych konta")

        logger.info(f"Dane Google (google_id={google_id})")

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
                    logger.info(f"Zaktualizowano użytkownika (user_id={user.id})")
                logger.info(f"Logowanie istniejącego użytkownika (user_id={user.id})")
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
                    logger.info(f"Nowy użytkownik Google (ID: {user.id})")

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
                    logger.info(f"Workspace utworzony (user_id={user.id})")

                except Exception:
                    self.db.rollback()
                    logger.exception("Błąd tworzenia użytkownika Google")
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

        logger.info(f"Token wygenerowany (user_id={user.id})")

        return self._create_session(user)