"""Schemas dla modułu boards (CRUD tablicy)."""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field

class OnlineUserInfo(BaseModel):
    user_id: int
    username: str
    avatar_url: Optional[str] = None

class CreateBoard(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    icon: Optional[str] = Field("PenTool", max_length=50)
    bg_color: Optional[str] = Field("bg-gray-500", max_length=50)
    workspace_id: int


class UpdateBoard(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    icon: Optional[str] = Field(None, max_length=50)
    bg_color: Optional[str] = Field(None, max_length=50)


class ToggleFavourite(BaseModel):
    is_favourite: bool


class ToggleFavouriteResponse(BaseModel):
    is_favourite: bool
    message: str

    class Config:
        from_attributes = True


class BoardSettings(BaseModel):
    ai_enabled: bool = True
    grid_visible: bool = True
    smartsearch_visible: bool = True
    toolbar_visible: bool = True


class UpdateBoardSettings(BaseModel):
    settings: BoardSettings


class BoardMember(BaseModel):
    user_id: int
    username: str
    email: str
    role: str
    is_owner: bool
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BoardMembersResponse(BaseModel):
    members: List[BoardMember]


class BoardResponse(BaseModel):
    id: int
    name: str
    icon: str
    bg_color: str
    workspace_id: int
    owner_id: int
    owner_username: str
    is_favourite: bool
    settings: Optional[BoardSettings] = None
    last_modified: datetime
    last_modified_by: Optional[str]
    last_opened: Optional[datetime]
    created_at: datetime
    created_by: str
    online_users: List[OnlineUserInfo] = []

    class Config:
        from_attributes = True


class BoardListResponse(BaseModel):
    boards: List[BoardResponse]
    total: int
    limit: int
    offset: int


class DeleteBoardResponse(BaseModel):
    success: bool
    message: str


class MessageResponse(BaseModel):
    message: str

class JoinBoardResponse(BaseModel):
    success: bool
    already_member: bool
    workspace_id: int
    board_id: int
    owner_id: int
    is_owner: bool
    user_role: str
    message: Optional[str] = None