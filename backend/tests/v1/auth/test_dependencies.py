"""
Testy get_current_user (dependency autoryzacji) - warstwa HTTP.
Weryfikowane przez GET /api/v1/auth/me.
"""
import pytest
from fastapi.testclient import TestClient

from main import app
from core.database import get_db
from api.v1.auth.utils import create_access_token
from core.config import get_settings

settings = get_settings()

def make_auth_headers(sub: str) -> dict:
    token = create_access_token({"sub": sub}, settings.secret_key, settings.algorithm)
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

class TestGetCurrentUser:

    def test_no_token_returns_401_standard_format(self, client):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401
        data = r.json()
        assert data["success"] is False
        assert "detail" not in data
        assert data.get("code") == "AUTH_ERROR"

    def test_garbage_token_returns_401(self, client):
        r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
        assert r.status_code == 401

    def test_non_numeric_sub_returns_401_not_500(self, client):
        r = client.get("/api/v1/auth/me", headers=make_auth_headers("not-an-int"))
        assert r.status_code == 401

    def test_nonexistent_user_returns_404(self, client):
        r = client.get("/api/v1/auth/me", headers=make_auth_headers("999999"))
        assert r.status_code == 404
        assert r.json()["success"] is False

    def test_inactive_user_returns_403(self, client, db_session):
        from core.models import User
        from api.v1.auth.utils import hash_password

        inactive = User(
            username="inactive", email="inactive@x.com",
            hashed_password=hash_password("pass"), is_active=False,
        )
        db_session.add(inactive)
        db_session.commit()

        r = client.get("/api/v1/auth/me", headers=make_auth_headers(str(inactive.id)))
        assert r.status_code == 403

    def test_valid_token_returns_200(self, client, test_user):
        r = client.get("/api/v1/auth/me", headers=make_auth_headers(str(test_user.id)))
        assert r.status_code == 200
        assert r.json()["data"]["user"]["id"] == test_user.id