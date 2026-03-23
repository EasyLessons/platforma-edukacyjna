from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class UserBasic(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    icon: Optional[str] = Field(default="Home")
    bg_color: Optional[str] = Field(default="bg-green-500")


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    icon: Optional[str] = None
    bg_color: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    icon: str
    bg_color: str
    created_by: int
    creator: Optional[UserBasic] = None
    member_count: int = 0
    board_count: int = 0
    is_owner: bool = False
    role: str = "editor"
    is_favourite: bool = False

    class Config:
        from_attributes = True


class WorkspaceListResponse(BaseModel):
    workspaces: List[WorkspaceResponse]
    total: int


class ToggleFavouriteRequest(BaseModel):
    is_favourite: bool


class SetActiveResponse(BaseModel):
    message: str
    active_workspace_id: int

class MessageResponse(BaseModel):
    """Generic response z wiadomością"""
    message: str