"""Schemas dla modułu whiteboard (sesja tablicy)."""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


class OnlineUserInfo(BaseModel):
    user_id: int
    username: str

    class Config:
        from_attributes = True


class OnlineUsersBatchRequest(BaseModel):
    board_ids: List[int]


class OnlineUsersBatchResponse(BaseModel):
    online_users_by_board: Dict[int, List[OnlineUserInfo]]


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