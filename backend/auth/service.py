"""
AUTH SERVICE - Cała logika autentykacji
"""
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from fastapi import HTTPException
from core.logging import get_logger
from core.config import get_settings

from .models import User
from .schemas import RegisterUser, LoginData, VerifyEmail
from .utils import (
    hash_password, verify_password, create_access_token,
    generate_verification_code, send_verification_email
)

logger = get_logger(__name__)

class AuthService:
    """Serwis zarządzający autentykacją"""
    
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
    
    async def register_user(self, user_data: RegisterUser) -> dict:
        """Rejestracja nowego użytkownika"""
        logger.info(f"🆕 Próba rejestracji: {user_data.email}")
        
        # Sprawdź email
        if self.db.query(User).filter(User.email == user_data.email).first():
            logger.warning(f"⚠️ Email zajęty: {user_data.email}")
            raise HTTPException(status_code=400, detail="Email zajęty")
        
        # Sprawdź username
        if self.db.query(User).filter(User.username == user_data.username).first():
            logger.warning(f"⚠️ Username zajęty: {user_data.username}")
            raise HTTPException(status_code=400, detail="Nazwa użytkownika zajęta")
        
        # Hashuj hasło
        hashed_password = hash_password(user_data.password)
        
        # Generuj kod
        verification_code = generate_verification_code()
        code_expires = datetime.utcnow() + timedelta(minutes=15)
        
        logger.debug(f"🔐 Wygenerowano kod dla {user_data.email}")
        
        # Utwórz użytkownika
        new_user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            is_active=False,
            verification_code=verification_code,
            verification_code_expires=code_expires
        )
        
        try:
            self.db.add(new_user)
            self.db.commit()
            self.db.refresh(new_user)
            logger.info(f"✅ User utworzony: {new_user.username} (ID: {new_user.id})")
        except Exception as e:
            logger.exception(f"❌ Błąd zapisu do bazy: {e}")
            self.db.rollback()
            raise HTTPException(status_code=500, detail="Błąd serwera")
        
        # Wyślij email
        try:
            await send_verification_email(
                new_user.email,
                new_user.username,
                verification_code,
                self.settings.resend_api_key,
                self.settings.from_email
            )
            logger.info(f"📧 Email wysłany do {new_user.email}")
        except Exception as e:
            logger.exception(f"❌ Błąd wysyłania emaila: {e}")
        
        return {
            "user": new_user,
            "message": "Użytkownik zarejestrowany. Sprawdź email.",
        }
    
    async def verify_email(self, verify_data: VerifyEmail) -> dict:
        """Weryfikacja emaila"""
        logger.info(f"🔍 Weryfikacja dla user_id: {verify_data.user_id}")
        
        user = self.db.query(User).filter(User.id == verify_data.user_id).first()
        
        if not user:
            logger.warning(f"⚠️ User nie znaleziony: {verify_data.user_id}")
            raise HTTPException(status_code=404, detail="User nie znaleziony")
        
        if user.is_active:
            logger.info(f"ℹ️ User już zweryfikowany: {user.username}")
            raise HTTPException(status_code=400, detail="Już zweryfikowane")
        
        if datetime.utcnow() > user.verification_code_expires:
            logger.warning(f"⏰ Kod wygasł: {user.username}")
            raise HTTPException(status_code=400, detail="Kod wygasł")
        
        if user.verification_code != verify_data.code:
            logger.warning(f"❌ Zły kod: {user.username}")
            raise HTTPException(status_code=400, detail="Zły kod")
        
        # Aktywuj
        user.is_active = True
        user.verification_code = None
        self.db.commit()
        
        logger.info(f"✅ User zweryfikowany: {user.username}")
        
        # Token
        access_token = create_access_token(
            data={"sub": user.id},
            secret_key=self.settings.secret_key,
            algorithm=self.settings.algorithm,
            expires_delta=timedelta(minutes=self.settings.access_token_expire_minutes)
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
    
    async def login_user(self, login_data: LoginData) -> dict:
        """Logowanie"""
        logger.info(f"🔐 Próba logowania: {login_data.login}")
        
        user = self.db.query(User).filter(
            (User.username == login_data.login) | (User.email == login_data.login)
        ).first()
        
        if not user or not verify_password(login_data.password, user.hashed_password):
            logger.warning(f"❌ Nieudane logowanie: {login_data.login}")
            raise HTTPException(status_code=401, detail="Błędny login lub hasło")
        
        if not user.is_active:
            logger.warning(f"⚠️ Niezweryfikowane konto: {user.username}")
            raise HTTPException(status_code=403, detail="Konto niezweryfikowane")
        
        # Token
        access_token = create_access_token(
            data={"sub": user.id},
            secret_key=self.settings.secret_key,
            algorithm=self.settings.algorithm,
            expires_delta=timedelta(minutes=self.settings.access_token_expire_minutes)
        )
        
        logger.info(f"✅ User zalogowany: {user.username}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
    
    async def resend_code(self, user_id: int) -> dict:
        """Ponowne wysłanie kodu"""
        logger.info(f"🔄 Resend dla user_id: {user_id}")
        
        user = self.db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User nie znaleziony")
        if user.is_active:
            raise HTTPException(status_code=400, detail="Już zweryfikowane")
        
        # Nowy kod
        verification_code = generate_verification_code()
        code_expires = datetime.utcnow() + timedelta(minutes=15)
        
        user.verification_code = verification_code
        user.verification_code_expires = code_expires
        self.db.commit()
        
        # Email
        await send_verification_email(
            user.email,
            user.username,
            verification_code,
            self.settings.resend_api_key,
            self.settings.from_email
        )
        
        logger.info(f"📧 Nowy kod wysłany: {user.email}")
        
        return {
            "message": "Nowy kod wysłany",
        }
    
    async def check_user(self, email: str) -> dict:
        """Sprawdza czy user istnieje"""
        logger.info(f"🔍 Check user: {email}")
        
        user = self.db.query(User).filter(User.email == email).first()
        
        if not user:
            return {"exists": False, "verified": False}
        
        if user.is_active:
            return {"exists": True, "verified": True}
        
        # Wyślij nowy kod
        verification_code = generate_verification_code()
        code_expires = datetime.utcnow() + timedelta(minutes=15)
        
        user.verification_code = verification_code
        user.verification_code_expires = code_expires
        self.db.commit()
        
        await send_verification_email(
            user.email,
            user.username,
            verification_code,
            self.settings.resend_api_key,
            self.settings.from_email
        )
        
        return {
            "exists": True,
            "verified": False,
            "user_id": user.id,
            "message": "Nowy kod wysłany"
        }