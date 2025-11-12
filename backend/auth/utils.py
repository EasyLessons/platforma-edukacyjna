"""
Narzędzia dla autentykacji:
- Hashing haseł
- Generowanie tokenów JWT
- Wysyłanie emaili
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
import secrets
import string
import resend

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

# === EMAIL ===
async def send_verification_email(email: str, username: str, code: str,
                                 resend_api_key: str, from_email: str) -> bool:
    """Wysyła email weryfikacyjny"""
    resend.api_key = resend_api_key
    
    try:
        params = {
            "from": from_email,
            "to": [email],
            "subject": "Weryfikacja konta - Platforma Edukacyjna",
            "html": f"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1>🎓 Witaj, {username}!</h1>
                    <p>Użyj poniższego kodu weryfikacyjnego:</p>
                    <div style="background: white; border: 2px dashed #667eea; 
                                padding: 20px; text-align: center; font-size: 32px;
                                font-weight: bold; color: #667eea;">
                        {code}
                    </div>
                    <p><strong>Kod ważny przez 15 minut.</strong></p>
                </div>
            </body>
            </html>
            """
        }
        
        response = resend.Emails.send(params)
        print(f"✅ Email wysłany! Response: {response}")
        return True
        
    except Exception as e:
        print(f"❌ Błąd wysyłania emaila: {e}")
        print(f"📧 API Key: {resend_api_key[:10]}... (pierwsze 10 znaków)")
        print(f"📧 From: {from_email}")
        print(f"📧 To: {email}")
        raise  # Rzuć błąd dalej aby zobaczyć pełny traceback
        return False