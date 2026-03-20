"""
Standard response wrapper dla wszystkich API responses
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, TypeVar, Generic

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    """Standard API response wrapper"""
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class PaginatedResponse(BaseModel):
    """Paginated list response"""
    data: list
    pagination: dict # {page, limit, pages}

    class Config:
        from_attributes = True
