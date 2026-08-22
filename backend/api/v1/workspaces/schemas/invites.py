from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class InviteCreate(BaseModel):
    invited_user_id: int


class InviteResponse(BaseModel):
    id: int
    workspace_id: int
    invited_by: int
    invited_id: int
    invite_token: str
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class UserSearchResult(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    has_pending_invite: bool = False

    class Config:
        from_attributes = True


class AcceptInviteResponse(BaseModel):
    message: str
    workspace_id: int
    workspace_name: str
    role: str