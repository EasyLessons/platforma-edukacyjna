"""Schemas dla modułu plans (GET /api/v1/plans/me)."""
from typing import Literal, Optional

from pydantic import BaseModel

PlanName = Literal["free", "premium"]


class PlanLimitsResponse(BaseModel):
    max_own_workspaces: Optional[int]
    max_boards: Optional[int]
    max_elements_per_board: Optional[int]
    ai_chat_daily: Optional[int]


class PlanUsageResponse(BaseModel):
    own_workspaces: int
    boards: int


class PlanMeResponse(BaseModel):
    plan: PlanName
    limits: PlanLimitsResponse
    usage: PlanUsageResponse
