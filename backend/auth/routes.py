"""
AUTH ROUTES - Endpointy autentykacji
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from auth.schemas import (
    RegisterUser, RegisterResponse,
    LoginData, AuthResponse,
    VerifyEmail, ResendCode, CheckUser
)
from auth.service import AuthService

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/register", response_model=RegisterResponse)
async def register(user_data: RegisterUser, db: Session = Depends(get_db)):
    """Rejestracja nowego użytkownika"""
    service = AuthService(db)
    return await service.register_user(user_data)


@router.post("/verify-email", response_model=AuthResponse)
async def verify_email(verify_data: VerifyEmail, db: Session = Depends(get_db)):
    """Weryfikacja emaila"""
    service = AuthService(db)
    return await service.verify_email(verify_data)


@router.post("/login", response_model=AuthResponse)
async def login(login_data: LoginData, db: Session = Depends(get_db)):
    """Logowanie użytkownika"""
    service = AuthService(db)
    return await service.login_user(login_data)


@router.post("/resend-code")
async def resend_code(resend_data: ResendCode, db: Session = Depends(get_db)):
    """Ponowne wysłanie kodu"""
    service = AuthService(db)
    return await service.resend_code(resend_data.user_id)


@router.post("/check-user")
async def check_user(check_data: CheckUser, db: Session = Depends(get_db)):
    """Sprawdza czy użytkownik istnieje"""
    service = AuthService(db)
    return await service.check_user(check_data.email)