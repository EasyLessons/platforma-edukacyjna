"""Schemas dla modułu whiteboard (sesja tablicy)."""
from datetime import datetime
from typing import Optional, Any, Dict
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


class BoardOwnerInfo(BaseModel):
    user_id: int
    username: str

    class Config:
        from_attributes = True


class LastModifiedByInfo(BaseModel):
    user_id: int
    username: str

    class Config:
        from_attributes = True


class LastOpenedInfo(BaseModel):
    user_id: int
    username: str
    last_opened: datetime

    class Config:
        from_attributes = True


class BoardElement(BaseModel):
    element_id: str
    type: str
    data: Dict[str, Any]


class BoardElementWithAuthor(BaseModel):
    element_id: str
    type: str
    data: Dict[str, Any]
    created_by_id: Optional[int] = None
    created_by_username: Optional[str] = None
    created_at: Optional[datetime] = None


class SaveElementsResponse(BaseModel):
    success: bool
    saved: int


class DeleteElementResponse(BaseModel):
    success: bool
    message: str


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