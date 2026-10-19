"""Logowanie przez zewnętrznych providerów: verify -> linking -> sesja."""
from sqlalchemy.orm import Session

from core.config import Settings, get_settings
from core.exceptions import NotFoundError
from core.logging import get_logger
from ..schemas import AuthResponse
from ..sessions import SessionService
from .base import OAuthProvider
from .google import GoogleProvider
from .linking import resolve_user

logger = get_logger(__name__)


def build_providers(settings: Settings) -> dict[str, OAuthProvider]:
    return {"google": GoogleProvider(settings.google_client_id)}


class OAuthService:

    def __init__(
            self,
            db: Session,
            settings: Settings | None = None,
            providers: dict[str, OAuthProvider] | None = None,
    ):
        self.db = db
        self.settings = settings or get_settings()
        self.providers = providers if providers is not None else build_providers(self.settings)
        self.sessions = SessionService(db, self.settings)

    async def login(self, provider_name: str, credential: str) -> tuple[AuthResponse, str]:
        """Zwraca AuthResponse i plaintext refresh token, jak login i verify-email."""
        provider = self.providers.get(provider_name)
        if provider is None:
            raise NotFoundError("Nieznany dostawca logowania")

        identity = await provider.verify(credential)
        result = resolve_user(self.db, identity)
        logger.info(f"Logowanie przez {provider_name} (user_id={result.user.id}, created={result.created})")
        return self.sessions.create(result.user)