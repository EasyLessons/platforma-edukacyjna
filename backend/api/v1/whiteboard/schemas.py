"""Schemas dla modułu whiteboard (sesja tablicy)."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class OnlineUserInfo(BaseModel):
    user_id: int
    username: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class OnlineStatusResponse(BaseModel):
    status: str
    board_id: int
    user_id: int


class UploadImageResponse(BaseModel):
    """Zwracana po udanym uploadzie obrazu do Supabase Storage — patrz storage.py"""
    url: str


class BoardFileResponse(BaseModel):
    """Plik tablicy (silnik Excalidraw) w prywatnym buckecie - patrz files.py"""
    file_name: str
    mime_type: str
    size: int
    width: int
    height: int


class BoardSettings(BaseModel):
    ai_enabled: bool = True
    grid_visible: bool = True
    smartsearch_visible: bool = True
    toolbar_visible: bool = True


class BoardSettingsPatch(BaseModel):
    ai_enabled: Optional[bool] = None
    grid_visible: Optional[bool] = None
    smartsearch_visible: Optional[bool] = None
    toolbar_visible: Optional[bool] = None


class SaveDocumentRequest(BaseModel):
    snapshot: str


class SaveDocumentResponse(BaseModel):
    success: bool


class DocumentResponse(BaseModel):
    snapshot: Optional[str] = None
    updated_at: Optional[datetime] = None


class AccessCheckResponse(BaseModel):
    has_access: bool
    user_id: int
    username: str
    # Rola w workspace tablicy; whiteboard-sync ustawia viewerowi połączenie tylko do odczytu.
    role: str
    can_edit: bool


class CallResponse(BaseModel):
    """Dane do dołączenia do rozmowy głosowej tablicy (Daily) — patrz call.py"""
    room_url: str
    token: str
    # Wygaśnięcie tokenu (UTC): do kiedy można nim WEJŚĆ; trwającej rozmowy nie przerywa.
    expires_at: datetime


class CallUsageResponse(BaseModel):
    """Stan bezpieczników rozmów dla admina (GET /whiteboard/call/usage) — patrz call_usage.py"""
    # "enabled" | "disabled" (CALL_ENABLED=false) | "not_configured" (brak klucza)
    # | "limit" (próg miesięczny osiągnięty) | "unknown" (nie udało się odczytać zużycia z Daily)
    state: str
    month: str
    cap_minutes: int
    user_daily_cap_minutes: int
    max_participants: int
    used_minutes: int | None = None  # minuty uczestników wg Daily /meetings
    reserved_minutes: int | None = None  # najgorszy przypadek dla trwających pokoi
    planned_minutes: int | None = None  # used + reserved: to porównujemy z progiem
    meetings: int | None = None
    ongoing_meetings: int | None = None
    active_rooms: int | None = None  # nasze pokoje przed `exp` (rejestr w Redis)
    rooms_count: int | None = None  # wszystkie pokoje konta Daily (limit konta: 50)
    fetched_at: datetime | None = None