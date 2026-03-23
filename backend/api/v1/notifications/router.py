"""
Notifications router — /api/v1/notifications/*

GET    /                  — lista powiadomień zalogowanego usera
PATCH  /read-all          — oznacz wszystkie jako przeczytane
PATCH  /{id}/read         — oznacz jedno jako przeczytane
DELETE /{id}              — usuń powiadomienie
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from core.database import get_db
from core.exceptions import NotFoundError
from core.models import User
from core.responses import ApiResponse

from .schemas import NotificationListResponse, NotificationResponse, ReadAllResponse
from .service import (
    get_user_notifications,
    mark_as_read,
    mark_all_as_read,
    delete_notification,
)

router = APIRouter(tags=["Notifications"])


@router.get(
    "",
    response_model=ApiResponse[NotificationListResponse],
    summary="Get notifications",
    description="Pobiera powiadomienia zalogowanego usera — najnowsze pierwsze.",
)
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = get_user_notifications(db=db, user_id=current_user.id)
    return ApiResponse(success=True, data=result)


@router.patch(
    "/read-all",
    response_model=ApiResponse[ReadAllResponse],
    summary="Mark all as read",
    description="Oznacza wszystkie nieprzeczytane powiadomienia usera jako przeczytane.",
)
async def read_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = mark_all_as_read(db, current_user.id)
    return ApiResponse(success=True, data=ReadAllResponse(updated=updated))


@router.patch(
    "/{notification_id}/read",
    response_model=ApiResponse[NotificationResponse],
    summary="Mark one as read",
    description="Oznacza jedno powiadomienie jako przeczytane.",
    responses={404: {"description": "Notification not found"}},
)
async def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = mark_as_read(db, notification_id, current_user.id)
    if not notification:
        raise NotFoundError("Powiadomienie nie istnieje")
    return ApiResponse(success=True, data=notification)


@router.delete(
    "/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete notification",
    description="Usuwa powiadomienie.",
    responses={404: {"description": "Notification not found"}},
)
async def remove_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = delete_notification(db, notification_id, current_user.id)
    if not deleted:
        raise NotFoundError("Powiadomienie nie istnieje")