"""
Testy routera workspaces — warstwa HTTP
GET/POST/PUT/DELETE /api/v1/workspaces/*  (w tym members i invites)
"""
import pytest
from fastapi.testclient import TestClient

from main import app
from core.database import get_db
from api.v1.auth.utils import create_access_token
from core.config import get_settings
from core.models import Workspace, WorkspaceMember

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


# ─── GET /workspaces ───────────────────────────────────────────────────────────

class TestGetWorkspaces:

    def test_zwraca_liste_workspace(self, client, test_user, test_workspace):
        """GET /workspaces → lista workspace aktualnego użytkownika"""
        r = client.get(
            "/api/v1/workspaces",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        ids = [w["id"] for w in data["data"]["workspaces"]]
        assert test_workspace.id in ids

    def test_401_bez_tokenu(self, client):
        """GET /workspaces bez Authorization → 401"""
        r = client.get("/api/v1/workspaces")
        assert r.status_code == 401

    def test_nie_zwraca_workspace_innego_usera(self, client, test_user, test_workspace2):
        """GET /workspaces — nie zawiera workspace należącego do innego usera"""
        r = client.get(
            "/api/v1/workspaces",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        ids = [w["id"] for w in r.json()["data"]["workspaces"]]
        assert test_workspace2.id not in ids


# ─── POST /workspaces ──────────────────────────────────────────────────────────

class TestCreateWorkspace:

    def test_tworzy_workspace(self, client, test_user):
        """POST /workspaces → 201, workspace zapisany w bazie"""
        r = client.post(
            "/api/v1/workspaces",
            json={"name": "Nowy Workspace", "icon": "Home", "bg_color": "bg-blue-500"},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["data"]["name"] == "Nowy Workspace"
        assert data["data"]["is_owner"] is True


# ─── PUT /workspaces/{id} ──────────────────────────────────────────────────────

class TestUpdateWorkspace:

    def test_owner_moze_edytowac(self, client, test_user, test_workspace):
        """PUT /workspaces/{id} jako owner → 200"""
        r = client.put(
            f"/api/v1/workspaces/{test_workspace.id}",
            json={"name": "Zmieniony workspace", "icon": "Star", "bg_color": "bg-red-500"},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Zmieniony workspace"

    def test_403_dla_nieownera(self, client, test_user2, shared_workspace):
        """PUT /workspaces/{id} jako editor (nie owner) → 403"""
        r = client.put(
            f"/api/v1/workspaces/{shared_workspace.id}",
            json={"name": "Próba zmiany", "icon": "Star", "bg_color": "bg-red-500"},
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 403


# ─── DELETE /workspaces/{id} ───────────────────────────────────────────────────

class TestDeleteWorkspace:

    def test_usuwa_workspace(self, client, test_user, test_workspace, db_session):
        """DELETE /workspaces/{id} → 200, brak rekordu w bazie"""
        ws_id = test_workspace.id
        r = client.delete(
            f"/api/v1/workspaces/{ws_id}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert db_session.query(Workspace).filter(Workspace.id == ws_id).first() is None


# ─── DELETE /workspaces/{id}/leave ────────────────────────────────────────────

class TestLeaveWorkspace:

    def test_editor_moze_opuscic(self, client, test_user2, shared_workspace, db_session):
        """DELETE /workspaces/{id}/leave jako editor → 200, usunięty z members"""
        r = client.delete(
            f"/api/v1/workspaces/{shared_workspace.id}/leave",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 200
        remaining = (
            db_session.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == shared_workspace.id,
                WorkspaceMember.user_id == test_user2.id,
            )
            .first()
        )
        assert remaining is None


# ─── GET /workspaces/{id}/members ──────────────────────────────────────────────

class TestGetMembers:

    def test_zwraca_czlonkow_z_rolami(self, client, test_user, shared_workspace):
        """GET /workspaces/{id}/members → lista dwóch członków z rolami"""
        r = client.get(
            f"/api/v1/workspaces/{shared_workspace.id}/members",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data["data"]["members"]) == 2
        roles = {m["user_id"]: m["role"] for m in data["data"]["members"]}
        assert roles[test_user.id] == "owner"


# ─── DELETE /workspaces/{id}/members/{uid} ────────────────────────────────────

class TestRemoveMember:

    def test_owner_usuwa_czlonka(self, client, test_user, test_user2, shared_workspace, db_session):
        """DELETE /workspaces/{id}/members/{uid} jako owner → 200"""
        r = client.delete(
            f"/api/v1/workspaces/{shared_workspace.id}/members/{test_user2.id}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        remaining = (
            db_session.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == shared_workspace.id,
                WorkspaceMember.user_id == test_user2.id,
            )
            .first()
        )
        assert remaining is None


# ─── POST /workspaces/{id}/invite ─────────────────────────────────────────────

class TestCreateInvite:

    def test_tworzy_zaproszenie(self, client, test_user, test_user2, test_workspace):
        """POST /workspaces/{id}/invite → zaproszenie z tokenem"""
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/invite",
            json={"invited_user_id": test_user2.id},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "invite_token" in data["data"]


# ─── POST /workspaces/invites/accept/{token} ──────────────────────────────────

class TestAcceptInvite:

    def test_user_akceptuje_zaproszenie(self, client, test_user2, test_invite, db_session):
        """POST /invites/accept/{token} → dołączenie do workspace"""
        r = client.post(
            f"/api/v1/workspaces/invites/accept/{test_invite.invite_token}",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 200
        assert r.json()["success"] is True
        membership = (
            db_session.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == test_invite.workspace_id,
                WorkspaceMember.user_id == test_user2.id,
            )
            .first()
        )
        assert membership is not None

    def test_blad_dla_wygaslego_zaproszenia(self, client, test_user2, expired_invite):
        """POST /invites/accept/{token} z wygasłym tokenem → błąd 400/404/410"""
        r = client.post(
            f"/api/v1/workspaces/invites/accept/{expired_invite.invite_token}",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code in (400, 404, 410)
