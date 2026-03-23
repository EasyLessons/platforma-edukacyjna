"""
Service dla systemu powiadomień.

Funkcje:
  create_notification()      — tworzy rekord w bazie (wywoływana wewnętrznie)
  get_user_notifications()   — pobiera listę powiadomień usera
  mark_as_read()             — oznacza jedno powiadomienie jako przeczytane
  mark_all_as_read()         — oznacza wszystkie powiadomienia usera jako przeczytane
  delete_notification()      — usuwa powiadomienie

Użycie create_notification() w innych modułach:
    from api.v1.notifications.service import create_notification

    create_notification(
        db=db,
        user_id=invited_user_id,
        type="invite",
        payload={
            "workspace_id":       workspace.id,
            "workspace_name":     workspace.name,
            "workspace_icon":     workspace.icon,
            "workspace_bg_color": workspace.bg_color,
            "inviter_name":       inviter.username,
            "invite_token":       new_invite.invite_token,
            "expires_at":         new_invite.expires_at.isoformat(),
            "created_at":         new_invite.created_at.isoformat(),
        },
    )
"""
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from core.models import Notification
from .schemas import NotificationListResponse, NotificationResponse


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    payload: dict[str, Any],
) -> NotificationResponse:
    """Tworzy powiadomienie w bazie. Wywoływana wewnętrznie."""
    notification = Notification(
        user_id=user_id,
        type=type,
        payload=payload,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return NotificationResponse.model_validate(notification)


def get_user_notifications(
    db: Session,
    user_id: int,
    limit: int = 50,
) -> NotificationListResponse:
    """Pobiera powiadomienia usera — najnowsze pierwsze."""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .count()
    )
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        unread_count=unread_count,
    )


def mark_as_read(
    db: Session,
    notification_id: int,
    user_id: int,
) -> NotificationResponse | None:
    """
    Oznacza jedno powiadomienie jako przeczytane.
    Sprawdza czy powiadomienie należy do usera (security).
    Zwraca zaktualizowane powiadomienie lub None jeśli nie znaleziono.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        .first()
    )
    if not notification:
        return None

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)

    return NotificationResponse.model_validate(notification)


def mark_all_as_read(
    db: Session,
    user_id: int,
) -> int:
    """
    Oznacza wszystkie powiadomienia usera jako przeczytane.
    Zwraca liczbę zaktualizowanych powiadomień.
    """
    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
        .update(
            {
                Notification.is_read: True,
                Notification.read_at: datetime.utcnow(),
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return updated


def delete_notification(
    db: Session,
    notification_id: int,
    user_id: int,
) -> bool:
    """
    Usuwa powiadomienie.
    Sprawdza czy powiadomienie należy do usera (security).
    Zwraca True jeśli usunięto, False jeśli nie znaleziono.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        .first()
    )
    if not notification:
        return False

    db.delete(notification)
    db.commit()
    return True