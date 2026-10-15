"""
Testy routera plans — warstwa HTTP
GET /api/v1/plans/me + kody błędów PLAN_LIMIT_* z boards/workspaces
"""
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from main import app
from core.database import get_db
from core.config import get_settings
from core.models import Board, BoardUsers
from api.v1.auth.utils import create_access_token
from api.v1.plans.models import UserPlan

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


def add_board(db, workspace_id: int, user_id: int, name: str) -> Board:
    board = Board(
        name=name, icon="PenTool", bg_color="bg-gray-500",
        workspace_id=workspace_id, created_by=user_id,
        created_at=datetime.utcnow(), last_modified=datetime.utcnow(),
        last_modified_by=user_id,
    )
    db.add(board)
    db.flush()
    db.add(BoardUsers(board_id=board.id, user_id=user_id, is_favourite=False))
    db.commit()
    return board


# ─── GET /plans/me ─────────────────────────────────────────────────────────────

class TestGetMe:

    def test_free_domyslnie(self, client, test_user, test_workspace, test_board):
        r = client.get("/api/v1/plans/me", headers=make_auth_headers(test_user.id))
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["data"] == {
            "plan": "free",
            "limits": {
                "max_own_workspaces": 2,
                "max_boards_per_workspace": 3,
                "max_elements_per_board": 1000,
                "ai_chat_daily": None,
            },
            "usage": {
                "own_workspaces": 1,
                "boards_by_workspace": {str(test_workspace.id): 1},
            },
        }

    def test_premium(self, client, db_session, test_user):
        db_session.add(UserPlan(user_id=test_user.id, plan="premium"))
        db_session.commit()
        r = client.get("/api/v1/plans/me", headers=make_auth_headers(test_user.id))
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["plan"] == "premium"
        assert data["limits"]["max_boards_per_workspace"] is None
        assert data["limits"]["max_own_workspaces"] is None

    def test_401_bez_tokenu(self, client):
        r = client.get("/api/v1/plans/me")
        assert r.status_code == 401


# ─── 403 PLAN_LIMIT_* w odpowiedzi API ─────────────────────────────────────────

class TestPlanLimitResponses:

    def test_trzecia_przestrzen_403_z_kodem(self, client, test_user, test_workspace):
        ok = client.post(
            "/api/v1/workspaces",
            json={"name": "Druga"},
            headers=make_auth_headers(test_user.id),
        )
        assert ok.status_code in (200, 201)
        r = client.post(
            "/api/v1/workspaces",
            json={"name": "Trzecia"},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 403
        body = r.json()
        assert body["success"] is False
        assert body["code"] == "PLAN_LIMIT_WORKSPACES"
        assert body["data"] == {"limit": 2, "used": 2}

    def test_czwarta_tablica_403_z_kodem(self, client, db_session, test_user, test_workspace):
        for i in range(3):
            add_board(db_session, test_workspace.id, test_user.id, f"T{i}")
        r = client.post(
            "/api/v1/boards",
            json={"name": "Czwarta", "workspace_id": test_workspace.id},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 403
        body = r.json()
        assert body["success"] is False
        assert body["code"] == "PLAN_LIMIT_BOARDS"
        assert body["data"] == {"limit": 3, "used": 3, "workspace_id": test_workspace.id}

    def test_premium_tworzy_bez_limitu(self, client, db_session, test_user, test_workspace):
        db_session.add(UserPlan(user_id=test_user.id, plan="premium"))
        db_session.commit()
        for i in range(3):
            add_board(db_session, test_workspace.id, test_user.id, f"T{i}")
        r = client.post(
            "/api/v1/boards",
            json={"name": "Czwarta", "workspace_id": test_workspace.id},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 201

    def test_editor_dostaje_403_roli_nie_limitu(self, client, db_session, test_user, test_user2, shared_workspace):
        for i in range(3):
            add_board(db_session, shared_workspace.id, test_user.id, f"T{i}")
        r = client.post(
            "/api/v1/boards",
            json={"name": "Czwarta", "workspace_id": shared_workspace.id},
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 403
        assert r.json()["code"] != "PLAN_LIMIT_BOARDS"
