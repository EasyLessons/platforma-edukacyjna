from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class WorkspaceMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    joined_at: datetime
    is_owner: bool

    class Config:
        from_attributes = True


class WorkspaceMembersListResponse(BaseModel):
    members: List[WorkspaceMemberResponse]
    total: int


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(owner|editor|viewer)$")


class MyRoleResponse(BaseModel):
    role: str
    is_owner: bool
    workspace_id: int


class RemoveMemberResponse(BaseModel):
    message: str