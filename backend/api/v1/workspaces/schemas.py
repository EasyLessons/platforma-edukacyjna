from typing import List, Optional
from pydantic import BaseModel, Field

from api.v1.boards.schemas import BoardListResponse


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
    is_owner: bool = False
    is_favourite: bool = False

    class Config:
        from_attributes = True


class WorkspaceWithBoardsResponse(WorkspaceResponse):
    boards: BoardListResponse


class WorkspaceListResponse(BaseModel):
    workspaces: List[WorkspaceResponse]
    total: int


class ToggleFavouriteRequest(BaseModel):
    is_favourite: bool


class ToggleFavouriteResponse(BaseModel):
    message: str
    is_favourite: bool


class MessageResponse(BaseModel):
    """Generic response z wiadomością"""
    message: str