"""Schemas dla modułu boards (CRUD tablicy)."""
from datetime import datetime
from typing import Dict, Optional, List
from pydantic import BaseModel, Field

from api.v1.whiteboard.schemas import OnlineUserInfo

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


class OnlineUsersRequest(BaseModel):
    board_ids: List[int]


class OnlineUsersResponse(BaseModel):
    online_users_by_board: Dict[int, List[OnlineUserInfo]]