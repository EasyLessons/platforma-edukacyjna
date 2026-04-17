"""
AUTH ROUTES - /api/v1/auth/*
Endpointy dotyczące autentykacji i autoryzacji
Wszystkie endpointy zwracają ApiResponse[T] z timestamp i metadata
"""
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json
import base64
from urllib.parse import quote_plus

from core.database import get_db
from core.responses import ApiResponse
from core.exceptions import AppException, AuthenticationError
from core.logging import get_logger
from auth.dependencies import get_current_user
from .schemas import (
    RegisterUser, RegisterResponse,
    LoginData, AuthResponse,
    VerifyEmail, ResendCode, CheckUser,
    UserSearchResult,
    RequestPasswordReset, VerifyPasswordResetCode, ResetPassword,
    ResendCodeResponse, CheckUserResponse, MessageResponse, VerifyResetCodeResponse,
    UserResponse
)
from .service import AuthService
from core.models import User

router = APIRouter(tags=["Authentication"])
logger = get_logger(__name__)

# === REGISTRATION & EMAIL VERIFICATION ===

@router.post(
    "/register",
    response_model=ApiResponse[RegisterResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Tworzy nowe konto użytkownika oraz przestrzeń roboczą",
    responses={400: {"description": "Email or username already exists"}}
)
async def register(user_data: RegisterUser, db: Session = Depends(get_db)):
    """Rejestracja nowego użytkownika i utworzenie przestrzeni roboczej"""
    service = AuthService(db)
    result = await service.register_user(user_data)
    return ApiResponse(success=True, data=result)


@router.post(
    "/verify-email",
    response_model=ApiResponse[AuthResponse],
    summary="Verify email with code",
    description="Weryfikuje email użytkownika za pomocą 6-znakowego kodu",
    responses={400: {"description": "Invalid or expired code"}, 404: {"description": "User not found"}}
)
async def verify_email(verify_data: VerifyEmail, db: Session = Depends(get_db)):
    """Weryfikacja emaila - aktywuje konto i zwraca token JWT"""
    service = AuthService(db)
    result = await service.verify_email(verify_data)
    return ApiResponse(success=True, data=result)


@router.post(
    "/resend-code",
    response_model=ApiResponse[ResendCodeResponse],
    summary="Resend verification code",
    description="Wysyła nowy kod weryfikacyjny na email",
    responses={404: {"description": "User not found"}}
)
async def resend_code(resend_data: ResendCode, db: Session = Depends(get_db)):
    """Ponowne wysłanie kodu weryfikacyjnego na email"""
    service = AuthService(db)
    result = await service.resend_code(resend_data.user_id)
    return ApiResponse(success=True, data=result)

# === LOGIN ===

@router.post(
    "/login",
    response_model=ApiResponse[AuthResponse],
    summary="Login user",
    description="Loguje użytkownika za pomocą nazwy użytkownika/emaila i hasła",
    responses={401: {"description": "Invalid email/username or password"}, 403: {"description": "Account not verified"}}
)
async def login(login_data: LoginData, db: Session = Depends(get_db)):
    """Logowanie użytkownika - zwraca token JWT"""
    service = AuthService(db)
    result = await service.login_user(login_data)
    return ApiResponse(success=True, data=result)

# === USER CHECKS & SEARCH ===

@router.post(
    "/check-user",
    response_model=ApiResponse[CheckUserResponse],
    summary="Check if user exists",
    description="Sprawdza czy email jest zarejestrowany",
    responses={200: {"description": "User existence status"}}
)
async def check_user(check_data: CheckUser, db: Session = Depends(get_db)):
    """Sprawdza czy użytkownik istnieje - zwraca exists i verified flags"""
    service = AuthService(db)
    result = await service.check_user(check_data.email)
    return ApiResponse(success=True, data=result)


@router.get(
    "/users/search",
    response_model=list[UserSearchResult],
    summary="Search users",
    description="Wyszukuje aktywnych użytkowników po username, email lub full_name",
    responses={400: {"description": "Query too short (minimum 2 characters)"}}
)
async def search_users(
    query: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
    limit: int = Query(10, ge=1, le=50, description="Result limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Wyszukuje użytkowników po username, email lub full_name.
    Wymaga: aktualne token JWT.
    Wyklucza bieżącego użytkownika i niezweryfikowanych użytkowników.
    """
    service = AuthService(db)
    result = service.search_users(query, current_user.id, limit)
    return result

# === PASSWORD RESET ===

@router.post(
    "/request-password-reset",
    response_model=ApiResponse[MessageResponse],
    summary="Request password reset",
    description="Wysyła kod resetowania hasła na email",
    responses={403: {"description": "Account not verified"}}
)
async def request_password_reset(reset_data: RequestPasswordReset, db: Session = Depends(get_db)):
    """Wysyła kod resetowania hasła na email (nie ujawnia czy email istnieje)"""
    service = AuthService(db)
    result = await service.request_password_reset(reset_data)
    return ApiResponse(success=True, data=result)


@router.post(
    "/verify-reset-code",
    response_model=ApiResponse[VerifyResetCodeResponse],
    summary="Verify password reset code",
    description="Weryfikuje kod resetowania hasła",
    responses={400: {"description": "Invalid or expired code"}, 403: {"description": "Account not verified"}}
)
async def verify_reset_code(verify_data: VerifyPasswordResetCode, db: Session = Depends(get_db)):
    """Weryfikuje kod resetowania hasła - zwraca status valid=true/false"""
    service = AuthService(db)
    result = await service.verify_reset_code(verify_data)
    return ApiResponse(success=True, data=result)


@router.post(
    "/reset-password",
    response_model=ApiResponse[MessageResponse],
    summary="Reset password",
    description="Resetuje hasło użytkownika",
    responses={400: {"description": "Invalid code, password, or passwords don't match"}, 403: {"description": "Account not verified"}}
)
async def reset_password(reset_data: ResetPassword, db: Session = Depends(get_db)):
    """Resetuje hasło użytkownika za pomocą kodu weryfikacyjnego"""
    service = AuthService(db)
    result = await service.reset_password(reset_data)
    return ApiResponse(success=True, data=result)

# === GOOGLE OAUTH ===

@router.get(
    "/google",
    summary="Redirect to Google login",
    description="Przekierowuje do Google OAuth consent screen",
    responses={307: {"description": "Redirect to Google OAuth"}}
)
async def google_login(db: Session = Depends(get_db)):
    """
    Przekierowuje użytkownika do Google OAuth consent screen.
    Użytkownik zostanie przekierowany powrotem na /google/callback po autoryzacji.
    """
    service = AuthService(db)
    authorization_url = await service.get_google_auth_url()
    return RedirectResponse(authorization_url)


@router.get(
    "/google/callback",
    summary="Google OAuth callback",
    description="Obsługuje callback z Google OAuth",
    responses={307: {"description": "Redirect to frontend with token and user data"}}
)
async def google_callback(
    code: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db)
):
    """
    Callback od Google po autoryzacji.
    - Jeśli użytkownik istnieje: loguje do systemu
    - Jeśli nie istnieje: tworzy nowe konto
    - Zwraca: RedirectResponse na frontend z token i user data w base64
    """
    service = AuthService(db)

    if error:
        logger.warning("⚠️ Google OAuth zwrócił error=%s description=%s", error, error_description)
        frontend_url = service.settings.frontend_url
        safe_error = quote_plus(error_description or error)
        return RedirectResponse(f"{frontend_url}/auth/callback?error={safe_error}")

    if not code:
        raise AuthenticationError("Brak kodu autoryzacji Google")

    try:
        result = await service.google_login(code)

        # Zakoduj dane użytkownika do base64 (dla przesłania w URL)
        user_json = json.dumps(result.user.model_dump(mode="json"), default=str)
        user_encoded = base64.b64encode(user_json.encode()).decode()

        # Przekieruj na frontend z tokenem i danymi
        frontend_url = service.settings.frontend_url
        return RedirectResponse(f"{frontend_url}/auth/callback?token={result.access_token}&user={user_encoded}")
    except AppException:
        raise
    except Exception as exc:
        logger.exception("❌ Nieobsłużony wyjątek w callback Google OAuth: %s", exc)
        frontend_url = service.settings.frontend_url
        safe_error = quote_plus("Błąd logowania przez Google")
        return RedirectResponse(f"{frontend_url}/auth/callback?error={safe_error}")

class AvatarUpdate(BaseModel):
    avatar_url: str

@router.put("/users/me", response_model=ApiResponse[UserResponse])
async def update_user_profile(
    update_data: AvatarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.avatar_url = update_data.avatar_url
    db.commit()
    db.refresh(current_user)
    return ApiResponse(
        success=True,
        data=UserResponse.model_validate(current_user)
    )

