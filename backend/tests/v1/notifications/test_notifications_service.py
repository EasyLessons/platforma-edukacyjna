"""
Testy serwisu powiadomień
api/v1/notifications/service.py
"""
import pytest
from datetime import datetime, timedelta

from api.v1.notifications.service import (
    create_notification,
    get_user_notifications,
    mark_as_read,
    mark_all_as_read,
    delete_notification,
)
from api.v1.notifications.schemas import (
    NotificationResponse,
    NotificationListResponse,
)
from core.models import Notification

INVITE_PAYLOAD = {
    "workspace_id": 1,
    "workspace_name": "Test WS",
    "workspace_icon": "Home",
    "workspace_bg_color": "bg-green-500",
    "inviter_name": "inviter",
    "invite_token": "token-abc",
    "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
    "created_at": datetime.utcnow().isoformat(),
}


# ── Helpers ────────────────────────────────────────────────────────────────

def add_notification(db, user_id, *, is_read=False, type="invite", payload=None):
    n = Notification(
        user_id=user_id,
        type=type,
        payload=payload or INVITE_PAYLOAD,
        is_read=is_read,
        created_at=datetime.utcnow(),
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


# ── create_notification ────────────────────────────────────────────────────

class TestCreateNotification:

    def test_returns_notification_response(self, db_session, test_user):
        result = create_notification(
            db_session, test_user.id, "invite", INVITE_PAYLOAD
        )
        assert isinstance(result, NotificationResponse)
        assert result.id is not None

    def test_stores_in_db(self, db_session, test_user):
        result = create_notification(
            db_session, test_user.id, "invite", INVITE_PAYLOAD
        )
        db_n = db_session.query(Notification).filter(Notification.id == result.id).first()
        assert db_n is not None
        assert db_n.user_id == test_user.id

    def test_created_as_unread(self, db_session, test_user):
        result = create_notification(
            db_session, test_user.id, "invite", INVITE_PAYLOAD
        )
        assert result.is_read is False

    def test_stores_payload(self, db_session, test_user):
        result = create_notification(
            db_session, test_user.id, "invite", INVITE_PAYLOAD
        )
        assert result.payload["workspace_name"] == "Test WS"
        assert result.payload["invite_token"] == "token-abc"

    def test_stores_type(self, db_session, test_user):
        result = create_notification(
            db_session, test_user.id, "system", {"title": "hello"}
        )
        assert result.type == "system"


# ── get_user_notifications ─────────────────────────────────────────────────

class TestGetUserNotifications:

    def test_returns_notification_list_response(self, db_session, test_user):
        result = get_user_notifications(db_session, test_user.id)
        assert isinstance(result, NotificationListResponse)

    def test_empty_for_new_user(self, db_session, test_user):
        result = get_user_notifications(db_session, test_user.id)
        assert result.notifications == []
        assert result.unread_count == 0

    def test_returns_own_notifications_only(self, db_session, test_user, test_user2):
        add_notification(db_session, test_user.id)
        add_notification(db_session, test_user2.id)

        result = get_user_notifications(db_session, test_user.id)
        assert len(result.notifications) == 1
        assert result.notifications[0].user_id == test_user.id

    def test_newest_first(self, db_session, test_user):
        n1 = add_notification(db_session, test_user.id)
        n2 = add_notification(db_session, test_user.id)

        result = get_user_notifications(db_session, test_user.id)
        assert result.notifications[0].id == n2.id
        assert result.notifications[1].id == n1.id

    def test_unread_count_correct(self, db_session, test_user):
        add_notification(db_session, test_user.id, is_read=False)
        add_notification(db_session, test_user.id, is_read=False)
        add_notification(db_session, test_user.id, is_read=True)

        result = get_user_notifications(db_session, test_user.id)
        assert result.unread_count == 2
        assert len(result.notifications) == 3

    def test_limit_respected(self, db_session, test_user):
        for _ in range(10):
            add_notification(db_session, test_user.id)

        result = get_user_notifications(db_session, test_user.id, limit=3)
        assert len(result.notifications) == 3


# ── mark_as_read ───────────────────────────────────────────────────────────

class TestMarkAsRead:

    def test_marks_notification_as_read(self, db_session, test_user):
        n = add_notification(db_session, test_user.id, is_read=False)

        result = mark_as_read(db_session, n.id, test_user.id)

        assert result is not None
        assert result.is_read is True
        assert result.read_at is not None

    def test_returns_notification_response(self, db_session, test_user):
        n = add_notification(db_session, test_user.id)
        result = mark_as_read(db_session, n.id, test_user.id)
        assert isinstance(result, NotificationResponse)

    def test_returns_none_for_nonexistent(self, db_session, test_user):
        result = mark_as_read(db_session, 99999, test_user.id)
        assert result is None

    def test_cannot_read_other_users_notification(self, db_session, test_user, test_user2):
        n = add_notification(db_session, test_user.id)

        result = mark_as_read(db_session, n.id, test_user2.id)
        assert result is None

        db_session.refresh(n)
        assert n.is_read is False

    def test_idempotent_on_already_read(self, db_session, test_user):
        n = add_notification(db_session, test_user.id, is_read=True)
        original_read_at = n.read_at

        result = mark_as_read(db_session, n.id, test_user.id)
        assert result is not None
        assert result.is_read is True


# ── mark_all_as_read ───────────────────────────────────────────────────────

class TestMarkAllAsRead:

    def test_marks_all_unread(self, db_session, test_user):
        for _ in range(3):
            add_notification(db_session, test_user.id, is_read=False)

        updated = mark_all_as_read(db_session, test_user.id)
        assert updated == 3

        remaining = (
            db_session.query(Notification)
            .filter(Notification.user_id == test_user.id, Notification.is_read == False)
            .count()
        )
        assert remaining == 0

    def test_returns_count_of_updated(self, db_session, test_user):
        add_notification(db_session, test_user.id, is_read=False)
        add_notification(db_session, test_user.id, is_read=False)
        add_notification(db_session, test_user.id, is_read=True)

        updated = mark_all_as_read(db_session, test_user.id)
        assert updated == 2

    def test_returns_zero_when_nothing_to_update(self, db_session, test_user):
        add_notification(db_session, test_user.id, is_read=True)

        updated = mark_all_as_read(db_session, test_user.id)
        assert updated == 0

    def test_only_marks_own_notifications(self, db_session, test_user, test_user2):
        add_notification(db_session, test_user.id, is_read=False)
        add_notification(db_session, test_user2.id, is_read=False)

        mark_all_as_read(db_session, test_user.id)

        user2_unread = (
            db_session.query(Notification)
            .filter(Notification.user_id == test_user2.id, Notification.is_read == False)
            .count()
        )
        assert user2_unread == 1


# ── delete_notification ────────────────────────────────────────────────────

class TestDeleteNotification:

    def test_deletes_notification(self, db_session, test_user):
        n = add_notification(db_session, test_user.id)
        n_id = n.id

        result = delete_notification(db_session, n_id, test_user.id)
        assert result is True

        deleted = db_session.query(Notification).filter(Notification.id == n_id).first()
        assert deleted is None

    def test_returns_true_on_success(self, db_session, test_user):
        n = add_notification(db_session, test_user.id)
        result = delete_notification(db_session, n.id, test_user.id)
        assert result is True

    def test_returns_false_for_nonexistent(self, db_session, test_user):
        result = delete_notification(db_session, 99999, test_user.id)
        assert result is False

    def test_cannot_delete_other_users_notification(self, db_session, test_user, test_user2):
        n = add_notification(db_session, test_user.id)

        result = delete_notification(db_session, n.id, test_user2.id)
        assert result is False

        still_exists = db_session.query(Notification).filter(Notification.id == n.id).first()
        assert still_exists is not None

    def test_idempotent_double_delete(self, db_session, test_user):
        n = add_notification(db_session, test_user.id)

        first = delete_notification(db_session, n.id, test_user.id)
        second = delete_notification(db_session, n.id, test_user.id)

        assert first is True
        assert second is False