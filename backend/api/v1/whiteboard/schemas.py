"""Schemas dla modułu whiteboard (sesja tablicy)."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class OnlineUserInfo(BaseModel):
    user_id: int
    username: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class OnlineStatusResponse(BaseModel):
    status: str
    board_id: int
    user_id: int


class UploadImageResponse(BaseModel):
    """Zwracana po udanym uploadzie obrazu do Supabase Storage — patrz storage.py"""
    url: str


class BoardSettings(BaseModel):
    ai_enabled: bool = True
    grid_visible: bool = True
    smartsearch_visible: bool = True
    toolbar_visible: bool = True


class BoardSettingsPatch(BaseModel):
    ai_enabled: Optional[bool] = None
    grid_visible: Optional[bool] = None
    smartsearch_visible: Optional[bool] = None
    toolbar_visible: Optional[bool] = None


class SaveDocumentRequest(BaseModel):
    snapshot: str


class SaveDocumentResponse(BaseModel):
    success: bool


class DocumentResponse(BaseModel):
    snapshot: Optional[str] = None
    updated_at: Optional[datetime] = None


class AccessCheckResponse(BaseModel):
    has_access: bool
    user_id: int
    username: str