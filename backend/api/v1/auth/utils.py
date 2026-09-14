"""
Narzędzia dla autentykacji:
- Hashing haseł
- Generowanie tokenów JWT
- Generowanie kodów weryfikacyjnych i refresh tokenów
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
import secrets
import string
import hashlib

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# === HASŁA ===
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# === JWT TOKENY ===
def create_access_token(data: dict, secret_key: str, algorithm: str,
                       expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)

# === KODY WERYFIKACYJNE ===
def generate_verification_code(length: int = 6) -> str:
    return ''.join(secrets.choice(string.digits) for _ in range(length))

# === REFRESH TOKENY ===
def generate_refresh_token() -> str:
    """Generuje bezpieczny, losowy refresh token"""
    return secrets.token_hex(32)

def hash_refresh_token(token: str) -> str:
    """Hashuje refresh token przed zapisaniem w bazie (dla bezpieczeństwa)"""
    return hashlib.sha256(token.encode()).hexdigest()
