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