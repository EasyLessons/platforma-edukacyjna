from datetime import timedelta

from sqlalchemy.orm import Session

from core.config import Settings, get_settings
from core.exceptions import AuthenticationError
from core.logging import get_logger
from core.models import RefreshToken, User
from core.time import utcnow
from .schemas import AuthResponse, UserResponse
from .utils import create_access_token, generate_refresh_token, hash_refresh_token

logger = get_logger(__name__)

class SessionService:
    """Tworzenie, odświeżanie i unieważnianie sesji użytkownika."""

    def __init__(self, db: Session, settings: Settings | None = None):
        self.db = db
        self.settings = settings or get_settings()

    def create(self, user: User) -> tuple[AuthResponse, str]:
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
        expires_at = utcnow() + timedelta(days=self.settings.refresh_token_expire_days)
    
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

    async def refresh(self, refresh_token_plain: str) -> tuple[AuthResponse, str]:
        """Rotuje refresh token i zwraca nową parę tokenów"""
        token_hash = hash_refresh_token(refresh_token_plain)
    
        db_token = self.db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,    
        ).first()
    
        if not db_token:
            raise AuthenticationError("Nieprawidłowy refresh token")
            
        if utcnow() > db_token.expires_at:
            raise AuthenticationError("Refresh token wygasł")
            
        # Unieważnij stary token
        db_token.revoked = True
        self.db.commit()
    
        user = self.db.query(User).filter(User.id == db_token.user_id).first()
        if not user or not user.is_active:
            raise AuthenticationError("Użytkownik nieaktywny")
    
        logger.info(f"Refresh sesji (user_id={user.id})")
        return self.create(user)
    
    async def logout(self, refresh_token_plain: str) -> None:
        """Wyloguj użytkownika przez unieważnienie refresh tokena"""
        token_hash = hash_refresh_token(refresh_token_plain)
    
        db_token = self.db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        ).first()
    
        if db_token:
            db_token.revoked = True
            self.db.commit()