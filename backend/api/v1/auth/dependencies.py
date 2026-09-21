"""
AUTH DEPENDENCIES - Współdzielone funkcje autoryzacji
Używane przez wszystkie endpointy które wymagają zalogowania
"""
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from core.database import get_db
from core.models import User
from core.config import get_settings
from core.exceptions import AuthenticationError, NotFoundError, AppException
from core.request_context import set_user_id

security = HTTPBearer(auto_error=False)
settings = get_settings()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Sprawdza JWT token i zwraca zalogowanego użytkownika.
    """

    if not credentials:
        raise AuthenticationError("Nieprawidłowy token autoryzacyjny")

    token = credentials.credentials
    
    try:        
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
                
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise AuthenticationError("Nieprawidłowy token autoryzacyjny")
            
        user_id = int(user_id_str)
            
    except (JWTError, ValueError):
        raise AuthenticationError("Nieprawidłowy token autoryzacyjny")
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if user is None:
        raise NotFoundError("Użytkownik nie istnieje")
    
    if not user.is_active:
        raise AppException("Konto niezweryfikowane", code="AUTH_ERROR", status_code=403)

    # user_id do logow tego zadania (core/logging.py RequestContextFilter)
    set_user_id(user.id)
    return user