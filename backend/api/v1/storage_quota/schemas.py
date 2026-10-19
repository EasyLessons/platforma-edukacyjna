"""Schemas dla podgladu zajetosci Storage (GET /api/v1/whiteboard/storage/usage) - patrz usage.py."""
from typing import Any, Optional

from pydantic import BaseModel


class OwnerUsage(BaseModel):
    user_id: int
    username: Optional[str] = None  # None: konto usuniete, a pliki jeszcze czekaja na skasowanie
    plan: str
    files: int
    used_bytes: int
    limit_bytes: Optional[int] = None
    percent: Optional[float] = None  # used / limit w procentach


class StorageUsageResponse(BaseModel):
    # "ok" | "warning" (>= 70% budzetu Supabase Free) | "critical" (>= 90%)
    state: str
    hint: Optional[str] = None
    budget_bytes: int
    # max(rejestr, pomiar bucketu board-files) + pomiar bucketu avatars
    estimated_bytes: int
    percent_of_budget: float
    # Rejestr `board_files`: aktywne pliki i pliki czekajace na skasowanie (30 dni karencji).
    registry_files: int
    registry_bytes: int
    pending_delete_files: int
    pending_delete_bytes: int
    # Pomiar prawdziwego Storage z ostatniego przebiegu sprzatania (None, gdy jeszcze nie bylo).
    measured_board_files_bytes: Optional[int] = None
    measured_avatars_bytes: Optional[int] = None
    measured_at: Optional[str] = None
    accounts_with_files: int
    accounts_over_limit: int
    top_accounts: list[OwnerUsage]
    # Raport ostatniego przebiegu (liczniki, bledy) albo None.
    last_cleanup: Optional[dict[str, Any]] = None
