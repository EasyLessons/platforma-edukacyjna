"""
Testy routera snapshotu tablicy — GET/POST /api/v1/whiteboard/{id}/doc
Klucz serwis-serwis (X-Sync-Service-Token) dla whiteboard-sync oraz token usera.
"""
import base64
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from main import app
from core.database import get_db
from core.config import get_settings
from core.models import WorkspaceMember
from api.v1.auth.utils import create_access_token
from api.v1.whiteboard.dependencies import SERVICE_TOKEN_HEADER

SERVICE_TOKEN = "test-sync-service-token-not-real"
SNAPSHOT = base64.b64encode(b"\x01\x02\x03").decode("ascii")


def user_headers(user_id: int, expires: timedelta | None = None) -> dict:
    settings = get_settings()
    data = {"sub": str(user_id)}
    if expires is not None:
        token = create_access_token(data, settings.secret_key, settings.algorithm, expires_delta=expires)
    else:
        token = create_access_token(data, settings.secret_key, settings.algorithm)
    return {"Authorization": f"Bearer {token}"}


def service_headers(token: str = SERVICE_TOKEN) -> dict:
    return {SERVICE_TOKEN_HEADER: token}


@pytest.fixture
def client(db_session, monkeypatch):
    monkeypatch.setattr(get_settings(), "sync_service_token", SERVICE_TOKEN)

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


class TestServiceToken:

    def test_save_and_load_with_service_token(self, client, test_board):
        r = client.post(f"/api/v1/whiteboard/{test_board.id}/doc", json={"snapshot": SNAPSHOT}, headers=service_headers())
        assert r.status_code == 200
        r = client.get(f"/api/v1/whiteboard/{test_board.id}/doc", headers=service_headers())
        assert r.status_code == 200
        assert r.json()["data"]["snapshot"] == SNAPSHOT

    def test_wrong_service_token_401(self, client, test_board):
        r = client.post(
            f"/api/v1/whiteboard/{test_board.id}/doc",
            json={"snapshot": SNAPSHOT},
            headers=service_headers("zly-klucz"),
        )
        assert r.status_code == 401

    def test_service_token_disabled_when_not_configured(self, client, test_board, monkeypatch):
        monkeypatch.setattr(get_settings(), "sync_service_token", "")
        r = client.get(f"/api/v1/whiteboard/{test_board.id}/doc", headers=service_headers(""))
        assert r.status_code == 401

    def test_service_token_still_requires_existing_board(self, client):
        r = client.get("/api/v1/whiteboard/999999/doc", headers=service_headers())
        assert r.status_code == 404

    def test_service_token_does_not_open_other_endpoints(self, client, test_board):
        r = client.get(f"/api/v1/whiteboard/{test_board.id}/access", headers=service_headers())
        assert r.status_code == 401


class TestUserToken:

    def test_member_can_save(self, client, test_user, test_board):
        r = client.post(
            f"/api/v1/whiteboard/{test_board.id}/doc",
            json={"snapshot": SNAPSHOT},
            headers=user_headers(test_user.id),
        )
        assert r.status_code == 200

    def test_viewer_save_403(self, client, db_session, test_user2, test_board):
        db_session.add(WorkspaceMember(workspace_id=test_board.workspace_id, user_id=test_user2.id, role="viewer"))
        db_session.commit()
        r = client.post(
            f"/api/v1/whiteboard/{test_board.id}/doc",
            json={"snapshot": SNAPSHOT},
            headers=user_headers(test_user2.id),
        )
        assert r.status_code == 403

    def test_expired_user_token_401(self, client, test_user, test_board):
        """Scenariusz utraty zapisu: token usera z chwili polaczenia wygasl."""
        r = client.post(
            f"/api/v1/whiteboard/{test_board.id}/doc",
            json={"snapshot": SNAPSHOT},
            headers=user_headers(test_user.id, expires=timedelta(seconds=-1)),
        )
        assert r.status_code == 401

    def test_no_auth_401(self, client, test_board):
        r = client.get(f"/api/v1/whiteboard/{test_board.id}/doc")
        assert r.status_code == 401
