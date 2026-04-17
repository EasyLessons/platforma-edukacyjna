from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class RegisterUser(BaseModel):
    """Schema do rejestracji użytkownika"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    password_confirm: str = Field(..., min_length=8, max_length=72)
    full_name: Optional[str] = None

class LoginData(BaseModel):
    """Schema do logowania"""
    login: str
    password: str

class VerifyEmail(BaseModel):
    """Schema do weryfikacji emaila"""
    user_id: int
    code: str = Field(..., min_length=6, max_length=6)

class ResendCode(BaseModel):
    """Schema dla ponownego wysłania kodu weryfikacyjnego"""
    user_id: int

class UserResponse(BaseModel):
    """Schema odpowiedzi z danymi użytkownika"""
    id: int
    username: str
    email: str
    full_name: Optional[str]
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    """Schema odpowiedzi z tokenem JWT"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class CheckUser(BaseModel):
    """Schema do sprawdzania czy user istnieje"""
    email: EmailStr

class RegisterResponse(BaseModel):
    """Response po rejestracji"""
    user: UserResponse
    message: str

class UserSearchResult(BaseModel):
    """Wynik wyszukiwania użytkownika"""
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class RequestPasswordReset(BaseModel):
    """Schema dla żądania resetu hasła"""
    email: EmailStr

class VerifyPasswordResetCode(BaseModel):
    """Schema dla weryfikacji kodu resetowania hasła"""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)

class ResetPassword(BaseModel):
    """Schema dla resetu hasła"""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    password: str = Field(..., min_length=8, max_length=72)
    password_confirm: str = Field(..., min_length=8, max_length=72)

# === RESPONSE SCHEMAS (API output) ===

class ResendCodeResponse(BaseModel):
    """Response po ponownym wysłaniu kodu"""
    message: str


class CheckUserResponse(BaseModel):
    """Response sprawdzenia czy user istnieje"""
    exists: bool
    verified: bool
    user_id: Optional[int] = None
    message: Optional[str] = None


class MessageResponse(BaseModel):
    """Generic response z wiadomością"""
    message: str


class VerifyResetCodeResponse(BaseModel):
    """Response weryfikacji kodu resetu hasła"""
    message: str
    valid: bool
