"""
Wspólny kontrakt providerów logowania OAuth.
"""
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ProviderIdentity:
    """Tożsamość potwierdzona przez providera: wynik `OAuthProvider.verify`."""
    provider: str
    subject: str
    email: str
    email_verified: bool
    name: str | None = None
    picture_url: str | None = None


class OAuthProvider(Protocol):
    name: str

    async def verify(self, credential: str) -> ProviderIdentity:
        """Weryfikuje dane od klienta; przy błędzie rzuca AuthenticationError."""
        ...