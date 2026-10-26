"""Schemas dla modułu plans (GET /api/v1/plans/me)."""
from typing import Dict, Literal, Optional

from pydantic import BaseModel

PlanName = Literal["free", "premium"]


class PlanLimitsResponse(BaseModel):
    max_own_workspaces: Optional[int]
    max_boards_per_workspace: Optional[int]
    max_elements_per_board: Optional[int]
    max_storage_bytes: Optional[int]
    ai_chat_daily: Optional[int]


class PlanUsageResponse(BaseModel):
    own_workspaces: int
    # id własnej przestrzeni -> liczba tablic w niej (klucze jako string, tak serializuje JSON)
    boards_by_workspace: Dict[str, int]
    # miejsce zajęte przez pliki tablic we WŁASNYCH przestrzeniach (bajty)
    storage_bytes: int = 0


class PlanMeResponse(BaseModel):
    plan: PlanName
    limits: PlanLimitsResponse
    usage: PlanUsageResponse
