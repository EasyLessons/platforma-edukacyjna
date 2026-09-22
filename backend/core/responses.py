"""
Standard response wrapper dla wszystkich API responses
"""
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from core.time import utcnow
from typing import Optional, TypeVar, Generic

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    """Standard API response wrapper"""
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    code: Optional[str] = None
    timestamp: datetime = Field(default_factory=utcnow)
    # Identyfikator zadania (X-Request-ID) - w odpowiedziach bledow, do korelacji z logami
    request_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class PaginatedResponse(BaseModel):
    """Paginated list response"""
    data: list
    pagination: dict # {page, limit, pages}

    model_config = ConfigDict(from_attributes=True)
