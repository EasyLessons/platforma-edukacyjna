"""
Łączenie konta użytkownika z tożsamością dostawcy logowania (OAuth). Jedno miejsce prawdy dla providerów logowania.
"""
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from api.v1.onboarding.service import OnboardingService
from core.exceptions import AppException, AuthenticationError
from core.logging import get_logger
from core.models import User, UserIdentity
from core.time import utcnow
from .base import ProviderIdentity

logger = get_logger(__name__)


@dataclass(frozen=True)
class LinkResult:
    user: User
    created: bool


def _unique_username(db: Session, email: str) -> str:
    base = email.split("@")[0]
    username = base
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base}{counter}"
        counter += 1
    return username

def _identity_row(user_id: int, identity: ProviderIdentity) -> UserIdentity:
    return UserIdentity(
        user_id=user_id,
        provider=identity.provider,
        provider_user_id=identity.subject,
        email=identity.email,
        email_verified=identity.email_verified,
        picture_url=identity.picture_url,
        last_login_at=utcnow(),
    )

def _resolve(db: Session, identity: ProviderIdentity) -> LinkResult:
    existing = db.query(UserIdentity).filter(
        UserIdentity.provider == identity.provider,
        UserIdentity.provider_user_id == identity.subject,
    ).first()
    if existing:
        existing.email = identity.email
        existing.email_verified = identity.email_verified
        existing.picture_url = identity.picture_url
        existing.last_login_at = utcnow()
        db.commit()
        logger.info(f"Logowanie istniejącą tożsamością (user_id={existing.user_id}, provider={identity.provider})")
        return LinkResult(user=existing.user, created=False)

    if not identity.email_verified:
        raise AuthenticationError("Dostawca logowania nie potwierdził adresu e-mail. Zaloguj się hasłem.")

    user = db.query(User).filter(User.email == identity.email).first()
    if user:
        same_provider = db.query(UserIdentity).filter(
            UserIdentity.user_id == user.id,
            UserIdentity.provider == identity.provider,
        ).first()
        if same_provider:
            logger.warning(f"Odmowa połączenia: konto ma już inną tożsamość (user_id={user.id}, provider={identity.provider})")
            raise AppException(
                "To konto jest już połączone z innym kontem tego dostawcy logowania.",
                code="IDENTITY_CONFLICT",
                status_code=409,
            )
        if not user.is_active:
            user.hashed_password = None
            user.is_active = True
            logger.warning(f"Wyczyszczono hasło niezweryfikowanego konta przy łączeniu tożsamości (user_id={user.id})")
        db.add(_identity_row(user.id, identity))
        db.commit()
        logger.info(f"Połączono tożsamość z istniejącym kontem (user_id={user.id}, provider={identity.provider})")
        return LinkResult(user=user, created=False)

    user = User(
        username=_unique_username(db, identity.email),
        email=identity.email,
        full_name=identity.name,
        is_active=True,
        hashed_password=None,
    )
    db.add(user)
    db.flush()
    OnboardingService(db).setup_new_user(user.id)
    db.add(_identity_row(user.id, identity))
    db.commit()
    db.refresh(user)
    logger.info(f"Nowy użytkownik przez {identity.provider} (user_id={user.id})")
    return LinkResult(user=user, created=True)

def resolve_user(db: Session, identity: ProviderIdentity) -> LinkResult:
    """
    Znajduje, łączy albo zakłada konto dla potwierdzonej tożsamości.
    Wyścig dwóch pierwszych logowań tego samego konta kończy się jednym ponowieniem.
    """
    try:
        try:
            return _resolve(db, identity)
        except IntegrityError:
            db.rollback()
            return _resolve(db, identity)
    except AppException:
        db.rollback()
        raise
    except OperationalError:
        db.rollback()
        logger.exception("Błąd połączenia z bazą podczas logowania przez providera")
        raise AppException("Baza danych chwilowo niedostępna", code="DB_ERROR", status_code=503)
    except Exception:
        db.rollback()
        logger.exception("Błąd tworzenia lub łączenia konta przez providera")
        raise AppException("Błąd tworzenia konta", status_code=500)
    