"""
Autoryzacja endpointow snapshotu tablicy (GET/POST /whiteboard/{id}/doc).

Wolajacy to albo whiteboard-sync z kluczem serwis-serwis (naglowek X-Sync-Service-Token,
porownanie stalo-czasowe z SYNC_SERVICE_TOKEN), albo zwykly user z tokenem JWT.
Klucz serwisu nie omija sprawdzenia, ze tablica istnieje (404) - to robi serwis.
"""
import hmac
from dataclasses import dataclass

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from core.config import get_settings
from core.database import get_db
from core.exceptions import AuthenticationError
from core.models import User
from ..auth.dependencies import get_current_user, security

SERVICE_TOKEN_HEADER = "X-Sync-Service-Token"


@dataclass
class DocCaller:
    """user=None oznacza whiteboard-sync uwierzytelniony kluczem serwisu."""
    user: User | None


def is_valid_service_token(candidate: str) -> bool:
    expected = get_settings().sync_service_token
    if not expected:
        return False
    return hmac.compare_digest(candidate.encode("utf-8"), expected.encode("utf-8"))


def get_doc_caller(
    service_token: str | None = Header(default=None, alias=SERVICE_TOKEN_HEADER),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> DocCaller:
    if service_token is not None:
        if not is_valid_service_token(service_token):
            raise AuthenticationError("Nieprawidlowy klucz serwisu")
        return DocCaller(user=None)
    return DocCaller(user=get_current_user(credentials, db))
