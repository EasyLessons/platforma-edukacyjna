from datetime import datetime
from typing import List, Optional
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


class PendingInviteResponse(BaseModel):
    id: int
    workspace_id: int
    workspace_name: str
    workspace_icon: str
    workspace_bg_color: str
    invited_by: int
    inviter_name: str
    invited_id: int
    invited_user_name: str
    invite_token: str
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class InviteStatusResponse(BaseModel):
    is_member: bool
    has_pending_invite: bool
    can_invite: bool


class AcceptInviteResponse(BaseModel):
    message: str
    workspace_id: int
    workspace_name: str
    role: str