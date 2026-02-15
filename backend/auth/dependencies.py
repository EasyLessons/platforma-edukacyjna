"""
AUTH DEPENDENCIES - Współdzielone funkcje autoryzacji
Używane przez wszystkie endpointy które wymagają zalogowania
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from core.database import get_db
from core.models import User
from core.config import get_settings

security = HTTPBearer()
settings = get_settings()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Sprawdza JWT token i zwraca zalogowanego użytkownika.
    
    Używana przez wszystkie endpointy które wymagają autoryzacji.
    """
    
    token = credentials.credentials
    
    print(f"🔍 DEBUG: Otrzymany token: {token[:50]}...")  # Pierwsze 50 znaków
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nieprawidłowy token autoryzacyjny",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        print(f"🔑 DEBUG: Secret key: {settings.secret_key[:20]}...")  # Pierwsze 20 znaków
        print(f"🔑 DEBUG: Algorithm: {settings.algorithm}")
        
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )
        
        print(f"✅ DEBUG: Token zdekodowany! Payload: {payload}")
        
        # Odczytaj user_id z 'sub' i skonwertuj na int
        user_id_str = payload.get("sub")
        if user_id_str is None:
            print("❌ DEBUG: 'sub' jest None!")
            raise credentials_exception
            
        user_id = int(user_id_str)
        print(f"👤 DEBUG: User ID z tokena: {user_id}")
            
    except JWTError as e:
        print(f"❌ DEBUG: JWTError: {e}")
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    print(f"👤 DEBUG: User z bazy: {user}")
    
    if user is None:
        print("❌ DEBUG: User nie znaleziony w bazie!")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie istnieje"
        )
    
    if not user.is_active:
        print("❌ DEBUG: User nieaktywny!")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto niezweryfikowane"
        )
    
    print(f"✅ DEBUG: User zweryfikowany! Username: {user.username}")
    return user