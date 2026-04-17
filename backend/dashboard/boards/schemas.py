from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

class CreateBoard(BaseModel):
    """Schema do tworzenia nowej tablicy"""
    name: str = Field(..., min_length=1, max_length=50)
    icon: Optional[str] = Field("PenTool", max_length=50)
    bg_color: Optional[str] = Field("bg-gray-500", max_length=50)
    workspace_id: int

class UpdateBoard(BaseModel):
    """Schema do aktualizacji tablicy"""
    name: Optional[str] = Field(None, max_length=50)
    icon: Optional[str] = Field(None, max_length=50)
    bg_color: Optional[str] = Field(None, max_length=50)

class ToggleFavourite(BaseModel):
    """Schema do toggleowania ulubionej tablicy"""
    is_favourite: bool = Field(...)

class ToggleFavouriteResponse(BaseModel):
    """Response po toggleowaniu ulubionej tablicy"""
    is_favourite: bool
    message: str
    
    class Config:
        from_attributes = True

class BoardSettings(BaseModel):
    """Ustawienia tablicy zarządzane przez właściciela"""
    ai_enabled: bool = True
    grid_visible: bool = True
    smartsearch_visible: bool = True
    toolbar_visible: bool = True

class UpdateBoardSettings(BaseModel):
    """Schema do aktualizacji ustawień tablicy"""
    settings: BoardSettings

class BoardMember(BaseModel):
    """Członek tablicy (z poziomu workspace)"""
    user_id: int
    username: str
    email: str
    role: str  # owner | admin | member | viewer
    is_owner: bool
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BoardMembersResponse(BaseModel):
    """Lista członków tablicy"""
    members: List[BoardMember]

class OnlineUserInfo(BaseModel):
    """Użytkownicy korzystający z danej tablicy"""
    user_id: int
    username: str
    avatar_url: Optional[str] = None
class BoardOwnerInfo(BaseModel):
    """Informacje o właścicielu tablicy"""
    user_id: int
    username: str
    
    class Config:
        from_attributes = True

class BoardResponse(BaseModel):
    """
    Podstawowy response z tablicą
    """
    id: int
    name: str
    icon: str
    bg_color: str
    workspace_id: int
    
    # Informacje o właścicielu
    owner_id: int
    owner_username: str
    
    # Statusy
    is_favourite: bool
    
    # Ustawienia tablicy (domyślne gdy None)
    settings: Optional[BoardSettings] = None
    
    # Timestamps
    last_modified: datetime
    last_modified_by: Optional[str]
    last_opened: Optional[datetime]
    created_at: datetime
    created_by: str
    
    class Config:
        from_attributes = True

class BoardListResponse(BaseModel):
    """
    Response z listą tablic
    """
    boards: List[BoardResponse]
    total: int
    limit: int
    offset: int

class LastModifiedByInfo(BaseModel):
    """Informacje o ostatnim modyfikatorze tablicy"""
    user_id: int
    username: str
    
    class Config:
        from_attributes = True

class LastOpenedInfo(BaseModel):
    """Informacje o ostatnim otwarciu tablicy"""
    user_id: int
    username: str
    last_opened: datetime
    
    class Config:
        from_attributes = True

class DeleteBoardResponse(BaseModel):
    """Response po usunięciu tablicy"""
    success: bool
    message: str