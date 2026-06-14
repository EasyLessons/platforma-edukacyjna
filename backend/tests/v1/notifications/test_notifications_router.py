"""
Testy routera notifications — warstwa HTTP
GET/PATCH/DELETE /api/v1/notifications/*
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from main import app
from core.database import get_db
from api.v1.auth.utils import create_access_token
from core.config import get_settings
from core.models import Notification

settings = get_settings()


def make_auth_headers(user_id: int) -> dict:
    token = create_access_token(
        {"sub": str(user_id)},
        settings.secret_key,
        settings.algorithm,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_notification(db_session, test_user):
    n = Notification(
        user_id=test_user.id,
        type="invite",
        payload={"workspace_id": 1, "workspace_name": "Test WS"},
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db_session.add(n)
    db_session.commit()
    db_session.refresh(n)
    return n


@pytest.fixture
def three_notifications(db_session, test_user):
    notifications = []
    for i in range(3):
        n = Notification(
            user_id=test_user.id,
            type="invite",
            payload={"info": f"notif {i}"},
            is_read=False,
            created_at=datetime.utcnow(),
        )
        db_session.add(n)
        notifications.append(n)
    db_session.commit()
    for n in notifications:
        db_session.refresh(n)
    return notifications


# ─── GET /notifications ────────────────────────────────────────────────────────

class TestGetNotifications:

    def test_zwraca_powiadomienia(self, client, test_user, test_notification):
        """GET /notifications → lista powiadomień usera"""
        r = client.get(
            "/api/v1/notifications",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        ids = [n["id"] for n in data["data"]["notifications"]]
        assert test_notification.id in ids

    def test_pusta_lista_gdy_brak(self, client, test_user):
        """GET /notifications bez danych → pusta lista"""
        r = client.get(
            "/api/v1/notifications",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["notifications"] == []

    def test_401_bez_tokenu(self, client):
        """GET /notifications bez Authorization → 401"""
        r = client.get("/api/v1/notifications")
        assert r.status_code == 401


# ─── PATCH /notifications/{id}/read ───────────────────────────────────────────

class TestMarkAsRead:

    def test_oznacza_jako_przeczytane(self, client, test_user, test_notification, db_session):
        """PATCH /notifications/{id}/read → is_read=True w bazie"""
        r = client.patch(
            f"/api/v1/notifications/{test_notification.id}/read",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["data"]["is_read"] is True
        db_session.refresh(test_notification)
        assert test_notification.is_read is True

    def test_404_dla_nieistniejacego(self, client, test_user):
        """PATCH /notifications/99999/read → 404"""
        r = client.patch(
            "/api/v1/notifications/99999/read",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 404


# ─── PATCH /notifications/read-all ────────────────────────────────────────────

class TestMarkAllAsRead:

    def test_oznacza_wszystkie(self, client, test_user, three_notifications, db_session):
        """PATCH /notifications/read-all → wszystkie is_read=True, updated=3"""
        r = client.patch(
            "/api/v1/notifications/read-all",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["data"]["updated"] == 3
        for n in three_notifications:
            db_session.refresh(n)
            assert n.is_read is True

    def test_updated_zero_gdy_juz_przeczytane(self, client, test_user):
        """PATCH /notifications/read-all gdy brak nieprzeczytanych → updated=0"""
        r = client.patch(
            "/api/v1/notifications/read-all",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["updated"] == 0


# ─── DELETE /notifications/{id} ───────────────────────────────────────────────

class TestDeleteNotification:

    def test_usuwa_powiadomienie(self, client, test_user, test_notification, db_session):
        """DELETE /notifications/{id} → 204, brak rekordu w bazie"""
        notif_id = test_notification.id
        r = client.delete(
            f"/api/v1/notifications/{notif_id}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 204
        assert db_session.query(Notification).filter(Notification.id == notif_id).first() is None

    def test_404_dla_nieistniejacego(self, client, test_user):
        """DELETE /notifications/99999 → 404"""
        r = client.delete(
            "/api/v1/notifications/99999",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 404
