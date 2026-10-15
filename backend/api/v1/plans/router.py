"""
Plans router — /api/v1/plans/*

GET /me — plan bieżącego użytkownika, limity i zużycie
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from core.database import get_db
from core.models import User
from core.responses import ApiResponse

from .schemas import PlanMeResponse
from .service import PlanService

router = APIRouter(tags=["Plans"])


@router.get("/me", response_model=ApiResponse[PlanMeResponse])
async def get_my_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = PlanService(db)
    return ApiResponse(success=True, data=service.get_me(current_user.id))
