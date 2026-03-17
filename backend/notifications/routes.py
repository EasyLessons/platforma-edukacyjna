"""
Endpointy systemu powiadomień.
 
GET  /api/notifications              — pobierz listę powiadomień zalogowanego usera
PATCH /api/notifications/{id}/read   — oznacz jedno jako przeczytane
PATCH /api/notifications/read-all    — oznacz wszystkie jako przeczytane
DELETE /api/notifications/{id}       — usuń powiadomienie
"""

from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from core.database import get_db
from core.models import User

from .schemas import NotificationListResponse, NotificationResponse
from .service import (
    get_user_notifications,
    mark_as_read,
    mark_all_as_read,
    delete_notification,
)
router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"],
)

@router.get('', response_model=NotificationListResponse)
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pobiera powiadomienia zalogowanego usera — najnowsze pierwsze."""
    return get_user_notifications(db=db, user_id=current_user.id)

@router.patch('/read-all', status_code=status.HTTP_200_OK)
async def read_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Oznacza wszystkie nieprzeczytane powiadomienia usera jako przeczytane."""
    updated = mark_all_as_read(db, current_user.id)
    return {"updated": updated}

@router.patch('/{notification_id}/read', response_model=NotificationResponse)
async def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Oznacza jedno powiadomienie jako przeczytane."""
    notification = mark_as_read(db, notification_id, current_user.id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Powiadomienie nie istnieje"
        )
    
    return notification

@router.delete('/{notification_id}', status_code=status.HTTP_204_NO_CONTENT)
async def remove_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Usuwa powiadomienie."""
    deleted = delete_notification(db, notification_id, current_user.id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Powiadomienie nie istnieje"
)
