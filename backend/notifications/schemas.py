"""
Schematy Pydantic dla systemu powiadomień.
 
NotificationResponse — pojedyncze powiadomienie zwracane przez API
NotificationListResponse — lista powiadomień z licznikiem nieprzeczytanych
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel

class NotificationResponse(BaseModel):
    """
    Pojedyncze powiadomienie.
 
    `payload` to dict specyficzny dla `type`:
      - 'invite':  { workspace_id, workspace_name, workspace_icon,
                     workspace_bg_color, inviter_name, invite_token,
                     expires_at, created_at }
      - 'comment': { board_id, board_name, comment_text, author_name }
      - 'system':  { title, message, action_url }
    """
    id: int
    user_id: int
    type: str
    payload: dict[str, Any]
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    """Lista powiadomień z licznikiem nieprzeczytanych."""
    notifications: list[NotificationResponse]
    unread_count: int
