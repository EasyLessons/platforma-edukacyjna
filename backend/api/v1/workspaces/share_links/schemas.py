from typing import Optional
from pydantic import BaseModel

class ShareLinkResponse(BaseModel):
    token: str
    workspace_id: int
    board_id: Optional[int] = None

    class Config:
        from_attributes = True


class ShareLinkPreview(BaseModel):
    workspace_id: int
    workspace_name: str
    workspace_icon: str
    board_id: Optional[int] = None
    board_name: Optional[str] = None
    already_member: bool


class JoinShareLinkResponse(BaseModel):
    message: str
    workspace_id: int
    workspace_name: str
    board_id: Optional[int] = None
    role: str
    already_member: bool


class MessageResponse(BaseModel):
    message: str