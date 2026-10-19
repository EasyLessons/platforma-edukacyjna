"""Weryfikacja ID tokena z Google Identity Services."""
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from core.exceptions import AuthenticationError
from core.logging import get_logger
from .base import ProviderIdentity

logger = get_logger(__name__)


class GoogleProvider:
    name = "google"

    def __init__(self, client_id: str):
        self.client_id = client_id

    async def verify(self, credential: str) -> ProviderIdentity:
        """Weryfikuje podpis, aud i exp ID tokena Google."""
        try:
            idinfo = id_token.verify_oauth2_token(credential, google_requests.Request(), self.client_id)
        except ValueError:
            logger.warning("Nieprawidłowy token Google ID")
            raise AuthenticationError("Nieprawidłowy token logowania Google")

        subject = idinfo.get("sub")
        email = idinfo.get("email")
        if not subject or not email:
            raise AuthenticationError("Google nie zwrócił wymaganych danych konta")
        if not idinfo.get("email_verified", False):
            raise AuthenticationError("Email Google niezweryfikowany")

        return ProviderIdentity(
            provider=self.name,
            subject=subject,
            email=email,
            email_verified=True,
            name=idinfo.get("name") or None,
            picture_url=idinfo.get("picture"),
        )