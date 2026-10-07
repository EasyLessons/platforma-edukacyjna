"""
AUTH SERVICE - Cała logika autentykacji
"""
from sqlalchemy.orm import Session
from core.logging import get_logger
from core.config import get_settings
from core.redis_client import get_redis_client
from core.exceptions import (
    ConflictError, ValidationError, AuthenticationError,
    NotFoundError, AppException
)
import hashlib
import secrets
import redis.asyncio as redis
from redis.exceptions import ConnectionError, RedisError, TimeoutError
from sqlalchemy.exc import OperationalError, IntegrityError
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from core.models import User
from .schemas import (
    RegisterUser, LoginData, VerifyEmail,
    RequestPasswordReset, VerifyPasswordResetCode, ResetPassword,
    RegisterResponse, AuthResponse, UserResponse, 
    MessageResponse, VerifyResetCodeResponse, MeResponse
)
from .utils import (
    hash_password, verify_password,
    generate_verification_code,
)
from .sessions import SessionService
from api.v1.onboarding.service import OnboardingService
from core.email import send_email
from core.email.templates.auth import verification_email, password_reset_email

logger = get_logger(__name__)

MAX_CODE_ATTEMPTS = 5  # prób kodu weryfikacji/resetu na okno ważności kodu


class AuthService:
    """Serwis zarządzający autentykacją"""

    def __init__(self, db: Session, redis_client: redis.Redis | None = None):
        self.db = db
        self.settings = get_settings()
        self.sessions = SessionService(db, self.settings)
        self.redis = redis_client or get_redis_client()

    def _email_verify_key(self, user_id: int) -> str:
        """Generuje klucz Redis dla kodu weryfikacji emaila"""
        return f"auth:email_verification:{user_id}"

    def _password_reset_key(self, user_id: int) -> str:
        """Generuje klucz Redis dla kodu resetowania hasła"""
        return f"auth:password_reset:{user_id}"

    async def _send_code_email(self, email: str, subject: str, html: str) -> None:
        """Wysyła mail, nie wywracając wywołującego flow przy błędzie."""
        if not self.settings.resend_api_key or self.settings.resend_api_key == "SKIP":
            logger.warning("Email nie został wysłany (brak konfiguracji Resend)")
            return
        try:
            await send_email(email, subject, html, self.settings.resend_api_key, self.settings.from_email)
        except Exception:
            logger.warning(f"Wysyłka emaila nie powiodła się (to={email})")

    async def _store_verification_code(self, key: str, code: str) -> None:
        """Zapisuje kod w Redis z TTL; przy błędzie połączenia rzuca 503."""
        ttl_seconds = self.settings.verification_code_expire_minutes * 60
        try:
            await self.redis.setex(key, ttl_seconds, code)
        except (ConnectionError, TimeoutError):
            logger.exception(f"Błąd zapisu kodu w Redis (key={key})")
            raise AppException("Serwis weryfikacji chwilowo niedostępny", code="REDIS_ERROR", status_code=503)

    async def _check_code(self, key: str, provided: str) -> None:
        """
        Porównuje kod z Redis z podanym; zły/wygasły -> ValidationError, błąd Redis -> 503.

        Liczy próby per klucz kodu (czyli per user.id z bazy) - niezależnie od IP i od
        kształtu body, którymi da się obejść limit z core/rate_limit. Po MAX_CODE_ATTEMPTS
        próbach w oknie ważności kodu kod jest kasowany, a kolejne próby dostają 429 do
        wygaśnięcia licznika. Nowy kod NIE zeruje licznika - inaczej każde "wyślij ponownie"
        dawałoby atakującemu nową pulę prób. Licznik rośnie PRZED porównaniem, więc
        równoległe żądania nie dostaną więcej prób niż limit.
        """
        attempts_key = f"{key}:attempts"
        ttl_seconds = self.settings.verification_code_expire_minutes * 60
        try:
            async with self.redis.pipeline(transaction=True) as pipe:
                pipe.set(attempts_key, 0, ex=ttl_seconds, nx=True)
                pipe.incr(attempts_key)
                _, attempts = await pipe.execute()
            if attempts > MAX_CODE_ATTEMPTS:
                await self.redis.delete(key)
                stored_code = None
            else:
                stored_code = await self.redis.get(key)
        except RedisError:
            logger.exception(f"Błąd Redis przy sprawdzaniu kodu (key={key})")
            raise AppException("Serwis weryfikacji chwilowo niedostępny", code="REDIS_ERROR", status_code=503)

        if attempts > MAX_CODE_ATTEMPTS:
            logger.warning(f"Przekroczono limit prób kodu (key={key})")
            raise AppException(
                "Zbyt wiele błędnych prób. Poproś o nowy kod i spróbuj ponownie później.",
                code="RATE_LIMITED",
                status_code=429,
            )
        if stored_code is None:
            logger.warning(f"Kod wygasł (key={key})")
            raise ValidationError("Kod wygasł")
        if not secrets.compare_digest(stored_code.encode(), provided.encode()):
            logger.warning(f"Zły kod (key={key})")
            raise ValidationError("Nieprawidłowy kod")

    async def _clear_code_attempts(self, key: str) -> None:
        """Po poprawnym kodzie zeruje licznik prób (błąd Redis nie psuje udanej operacji)."""
        try:
            await self.redis.delete(f"{key}:attempts")
        except RedisError:
            logger.warning(f"Nie udało się wyzerować licznika prób (key={key})")

    async def register_user(self, user_data: RegisterUser) -> RegisterResponse:
        """Rejestracja nowego użytkownika"""

        existing_user = self.db.query(User).filter(
            (User.email == user_data.email) | (User.username == user_data.username)
            ).first()

        if existing_user:
            if existing_user.email == user_data.email:
                if not existing_user.is_active:
                    raise ConflictError("Email zajęty", details={"user_id": existing_user.id, "verified": False})
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

            OnboardingService(self.db).setup_new_user(new_user.id)
            
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
        subject, html = verification_email(new_user.username, verification_code)
        await self._send_code_email(new_user.email, subject, html)

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
        
        await self._check_code(self._email_verify_key(user.id), verify_data.code)

        user.is_active = True
        self.db.commit()
        self.db.refresh(user)

        await self.redis.delete(self._email_verify_key(user.id))
        await self._clear_code_attempts(self._email_verify_key(user.id))

        logger.info(f"User zweryfikowany (user_id={user.id})")

        return self.sessions.create(user)

    async def login_user(self, login_data: LoginData) -> AuthResponse:
        """Logowanie"""

        user = self.db.query(User).filter(
            (User.username == login_data.login) | (User.email == login_data.login)
        ).first()

        # Konto założone przez Google nie ma hasła (hashed_password=None) - passlib rzuciłby
        # wyjątek (500). Traktujemy to jak błędne hasło: 401, bez ujawniania typu konta.
        if not user or not user.hashed_password or not verify_password(login_data.password, user.hashed_password):
            if user:
                logger.warning(f"Nieudane logowanie (user_id={user.id})")
            else:
                login_hash = hashlib.sha256(login_data.login.encode()).hexdigest()[:12]
                logger.warning(f"Nieudane logowanie (login_hash={login_hash})")
            raise AuthenticationError("Błędny login lub hasło")

        if not user.is_active:
            raise AppException("Konto nieaktywne", code="AUTH_ERROR", status_code=403, details={"user_id": user.id})

        logger.info(f"User zalogowany (user_id={user.id})")

        return self.sessions.create(user)

    async def resend_code(self, user_id: int) -> MessageResponse:
        """Ponowne wysłanie kodu"""
        logger.info(f"Resend dla user_id={user_id}")

        user = self.db.query(User).filter(User.id == user_id).first()

        if not user:
            raise NotFoundError("User nie znaleziony")
        if user.is_active:
            raise ValidationError("Już zweryfikowane")

        verification_code = generate_verification_code()
        await self._store_verification_code(self._email_verify_key(user.id), verification_code)
        
        subject, html = verification_email(user.username, verification_code)
        await self._send_code_email(user.email, subject, html)

        logger.info(f"Nowy kod wysłany (user_id={user.id})")

        return MessageResponse(message="Nowy kod wysłany")

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

        subject, html = password_reset_email(user.username, reset_code)
        await self._send_code_email(user.email, subject, html)

        return MessageResponse(message="Jeśli email istnieje, kod został wysłany")

    async def verify_reset_code(self, verify_data: VerifyPasswordResetCode) -> VerifyResetCodeResponse:
        """Weryfikuje kod resetowania hasła (bez zmiany hasła)"""

        user = self.db.query(User).filter(User.email == verify_data.email).first()

        if not user:
            raise ValidationError("Nieprawidłowy kod")
        if not user.is_active:
            raise AppException("Konto nieaktywne", code="AUTH_ERROR", status_code=403)
        
        await self._check_code(self._password_reset_key(user.id), verify_data.code)
        await self._clear_code_attempts(self._password_reset_key(user.id))

        logger.info(f"Kod resetu zweryfikowany (user_id={user.id})")

        return VerifyResetCodeResponse(message="Kod poprawny", valid=True)

    async def reset_password(self, reset_data: ResetPassword) -> MessageResponse:
        """Resetuje hasło użytkownika"""

        user = self.db.query(User).filter(User.email == reset_data.email).first()

        if not user:
            raise ValidationError("Nieprawidłowy kod")
        if not user.is_active:
            raise AppException("Konto nieaktywne", code="AUTH_ERROR", status_code=403)
    
        await self._check_code(self._password_reset_key(user.id), reset_data.code)

        user.hashed_password = hash_password(reset_data.password)
        self.db.commit()

        await self.redis.delete(self._password_reset_key(user.id))
        await self._clear_code_attempts(self._password_reset_key(user.id))

        logger.info(f"Hasło zresetowane (user_id={user.id})")

        return MessageResponse(message="Hasło zostało zmienione")
    
    def get_me(self, user: User) -> MeResponse:
        """Zwraca dane aktualnie zalogowanego użytkownika"""
        return MeResponse(user=UserResponse.model_validate(user))

    # === GOOGLE OAUTH ===

    def _verify_google_credential(self, credential: str) -> tuple[str, str, str, str | None]:
        """Weryfikuje ID token z Google Identity Services (podpis, aud, exp). Zwraca (google_id, email, name, picture)."""
        try:
            idinfo = id_token.verify_oauth2_token(credential, google_requests.Request(), self.settings.google_client_id)
        except ValueError:
            logger.warning("Nieprawidłowy token Google ID")
            raise AuthenticationError("Nieprawidłowy token logowania Google")

        google_id = idinfo.get("sub")
        email = idinfo.get("email")
        name = idinfo.get("name", "")
        picture = idinfo.get("picture")

        if not google_id or not email:
            raise AuthenticationError("Google nie zwrócił wymaganych danych konta")
        if not idinfo.get("email_verified", False):
            raise AuthenticationError("Email Google niezweryfikowany")

        return google_id, email, name, picture

    def _find_or_create_google_user(self, google_id: str, email: str, name: str, picture: str | None) -> User:
        """Znajduje istniejącego usera po google_id/email albo tworzy nowego."""
        try:
            user = self.db.query(User).filter(
                (User.google_id == google_id) | (User.email == email)
            ).first()

            if user:
                if not user.google_id:
                    if not user.is_active:
                        # Konto lokalne nigdy nie potwierdziło e-maila, więc hasło mógł ustawić ktoś inny. 
                        # Google potwierdza właściciela, więc stare hasło musi zniknąć (pre-hijacking).
                        user.hashed_password = None
                    user.google_id = google_id
                    user.auth_provider = "google"
                    user.profile_picture = picture
                    user.is_active = True
                    self.db.commit()
                    logger.info(f"Logowanie istniejącego użytkownika (user_id={user.id})")
                return user

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
                hashed_password=None)
            self.db.add(user)
            self.db.flush()
            logger.info(f"Nowy użytkownik Google (ID: {user.id})")

            OnboardingService(self.db).setup_new_user(user.id)
            self.db.commit()
            self.db.refresh(user)
            logger.info(f"Workspace utworzony (user_id={user.id})")
            return user
        
        except OperationalError:
            self.db.rollback()
            logger.exception("Błąd połączenia z bazą podczas Google OAuth")
            raise AppException("Baza danych chwilowo niedostępna", code="DB_ERROR", status_code=503)
        except Exception:
            self.db.rollback()
            logger.exception("Błąd tworzenia użytkownika Google")
            raise AppException("Błąd tworzenia konta", status_code=500)

    async def google_login(self, credential: str) -> tuple[AuthResponse, str]:
        """Logowanie przez Google (ID token z Google Identity Services)."""
        google_id, email, name, picture = self._verify_google_credential(credential)
        user = self._find_or_create_google_user(google_id, email, name, picture)
        logger.info(f"Token wygenerowany (user_id={user.id})")
        return self.sessions.create(user)