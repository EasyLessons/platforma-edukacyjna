"""
Testy routera share links — warstwa HTTP
POST   /api/v1/workspaces/{workspace_id}/share-link
POST   /api/v1/workspaces/{workspace_id}/share-link/refresh
DELETE /api/v1/workspaces/{workspace_id}/share-link/{token}
GET    /api/v1/workspaces/share-link/{token}
POST   /api/v1/workspaces/share-link/{token}/join
(serwis jest testowany w test_share_links_service.py — tu tylko autoryzacja i kształt odpowiedzi)
"""
import secrets
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from main import app
from core.database import get_db
from core.config import get_settings
from core.models import Board, WorkspaceMember, WorkspaceShareLink
from api.v1.auth.utils import create_access_token

settings = get_settings()

API_RESPONSE_KEYS = {"success", "data", "error", "code", "timestamp"}


def make_auth_headers(user_id: int) -> dict:
    token = create_access_token(
        {"sub": str(user_id)},
        settings.secret_key,
        settings.algorithm,
    )
    return {"Authorization": f"Bearer {token}"}


def make_viewer(db_session, workspace_id: int, user_id: int) -> WorkspaceMember:
    member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=user_id,
        role="viewer",
        is_favourite=False,
        joined_at=datetime.utcnow(),
    )
    db_session.add(member)
    db_session.commit()
    return member


def make_link(db_session, workspace_id: int, board_id: int | None = None, *, expired=False, revoked=False) -> WorkspaceShareLink:
    link = WorkspaceShareLink(
        workspace_id=workspace_id,
        board_id=board_id,
        token=secrets.token_urlsafe(16),
        expires_at=datetime.utcnow() - timedelta(days=1) if expired else datetime.utcnow() + timedelta(days=90),
        revoked_at=datetime.utcnow() if revoked else None,
    )
    db_session.add(link)
    db_session.commit()
    db_session.refresh(link)
    return link


def get_link(db_session, token: str) -> WorkspaceShareLink | None:
    return db_session.query(WorkspaceShareLink).filter(WorkspaceShareLink.token == token).first()


def is_member(db_session, workspace_id: int, user_id: int) -> bool:
    return db_session.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first() is not None


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


# ─── POST /workspaces/{id}/share-link ─────────────────────────────────────────

class TestCreateShareLink:

    def test_401_bez_tokenu(self, client, test_workspace):
        """POST /share-link bez Authorization → 401"""
        r = client.post(f"/api/v1/workspaces/{test_workspace.id}/share-link")
        assert r.status_code == 401
        assert r.json()["success"] is False

    def test_owner_tworzy_link(self, client, db_session, test_user, test_workspace):
        """POST /share-link jako owner → 200, ApiResponse[ShareLinkResponse], link w bazie"""
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == API_RESPONSE_KEYS
        assert body["success"] is True
        assert body["error"] is None
        data = body["data"]
        assert set(data.keys()) == {"token", "workspace_id", "board_id"}
        assert data["workspace_id"] == test_workspace.id
        assert data["board_id"] is None
        assert isinstance(data["token"], str) and len(data["token"]) > 20

        link = get_link(db_session, data["token"])
        assert link is not None
        assert link.revoked_at is None

    def test_editor_tez_moze_tworzyc(self, client, test_user2, shared_workspace):
        """POST /share-link jako editor → 200 (require_editor_or_owner dopuszcza editora)"""
        r = client.post(
            f"/api/v1/workspaces/{shared_workspace.id}/share-link",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["workspace_id"] == shared_workspace.id

    def test_403_dla_viewera(self, client, db_session, test_user3, test_workspace):
        """POST /share-link jako viewer → 403 w kształcie ApiResponse, brak linku w bazie"""
        make_viewer(db_session, test_workspace.id, test_user3.id)
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link",
            headers=make_auth_headers(test_user3.id),
        )
        assert r.status_code == 403
        body = r.json()
        assert body["success"] is False
        assert body["code"] == "APP_ERROR"
        assert body["data"] is None
        assert db_session.query(WorkspaceShareLink).count() == 0

    def test_404_dla_nieczlonka(self, client, test_user2, test_workspace):
        """POST /share-link przez usera spoza workspace → 404 (brak członkostwa)"""
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 404
        assert r.json()["code"] == "NOT_FOUND"

    def test_404_dla_nieistniejacego_workspace(self, client, test_user):
        """POST /share-link dla workspace 99999 → 404"""
        r = client.post(
            "/api/v1/workspaces/99999/share-link",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 404

    def test_reuzywa_aktywny_link(self, client, test_user, test_workspace):
        """Drugi POST /share-link → ten sam token (get_or_create)"""
        headers = make_auth_headers(test_user.id)
        first = client.post(f"/api/v1/workspaces/{test_workspace.id}/share-link", headers=headers)
        second = client.post(f"/api/v1/workspaces/{test_workspace.id}/share-link", headers=headers)
        assert first.status_code == second.status_code == 200
        assert first.json()["data"]["token"] == second.json()["data"]["token"]

    def test_link_do_tablicy_przez_query_param(self, client, test_user, test_workspace, test_board):
        """POST /share-link?board_id=X → data.board_id == X"""
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link",
            params={"board_id": test_board.id},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["board_id"] == test_board.id

    def test_404_dla_nieistniejacej_tablicy(self, client, test_user, test_workspace):
        """POST /share-link?board_id=99999 → 404"""
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link",
            params={"board_id": 99999},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 404

    def test_400_dla_tablicy_z_innego_workspace(self, client, db_session, test_user, test_workspace, test_workspace2, test_user2):
        """POST /share-link?board_id=<tablica z cudzego workspace> → 400"""
        other_board = Board(
            name="Cudza tablica",
            icon="PenTool",
            workspace_id=test_workspace2.id,
            created_by=test_user2.id,
            created_at=datetime.utcnow(),
            last_modified_by=test_user2.id,
        )
        db_session.add(other_board)
        db_session.commit()
        db_session.refresh(other_board)

        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link",
            params={"board_id": other_board.id},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 400
        assert r.json()["success"] is False

    def test_422_dla_nienumerycznego_board_id(self, client, test_user, test_workspace):
        """POST /share-link?board_id=abc → 422"""
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link",
            params={"board_id": "abc"},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 422
        assert r.json()["code"] == "VALIDATION_ERROR"


# ─── POST /workspaces/{id}/share-link/refresh ─────────────────────────────────

class TestRefreshShareLink:

    def test_401_bez_tokenu(self, client, test_workspace):
        """POST /share-link/refresh bez Authorization → 401"""
        r = client.post(f"/api/v1/workspaces/{test_workspace.id}/share-link/refresh")
        assert r.status_code == 401

    def test_owner_odswieza_link(self, client, db_session, test_user, test_workspace):
        """POST /share-link/refresh → nowy token, stary link ma revoked_at"""
        old = make_link(db_session, test_workspace.id)
        old_token = old.token

        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link/refresh",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        new_token = body["data"]["token"]
        assert new_token != old_token
        assert body["data"]["workspace_id"] == test_workspace.id

        db_session.expire_all()
        assert get_link(db_session, old_token).revoked_at is not None
        assert get_link(db_session, new_token).revoked_at is None

    def test_refresh_bez_istniejacego_linku_tworzy_nowy(self, client, db_session, test_user, test_workspace):
        """POST /share-link/refresh gdy nie ma aktywnego linku → 200, powstaje nowy"""
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link/refresh",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert get_link(db_session, r.json()["data"]["token"]) is not None

    def test_403_dla_viewera(self, client, db_session, test_user3, test_workspace):
        """POST /share-link/refresh jako viewer → 403, istniejący link nietknięty"""
        link = make_link(db_session, test_workspace.id)
        make_viewer(db_session, test_workspace.id, test_user3.id)

        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link/refresh",
            headers=make_auth_headers(test_user3.id),
        )
        assert r.status_code == 403
        db_session.expire_all()
        assert get_link(db_session, link.token).revoked_at is None
        assert db_session.query(WorkspaceShareLink).count() == 1

    def test_404_dla_nieczlonka(self, client, test_user2, test_workspace):
        """POST /share-link/refresh przez usera spoza workspace → 404"""
        r = client.post(
            f"/api/v1/workspaces/{test_workspace.id}/share-link/refresh",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 404


# ─── DELETE /workspaces/{id}/share-link/{token} ───────────────────────────────

class TestRevokeShareLink:

    def test_401_bez_tokenu(self, client, db_session, test_workspace):
        """DELETE /share-link/{token} bez Authorization → 401, link nadal aktywny"""
        link = make_link(db_session, test_workspace.id)
        r = client.delete(f"/api/v1/workspaces/{test_workspace.id}/share-link/{link.token}")
        assert r.status_code == 401
        db_session.expire_all()
        assert get_link(db_session, link.token).revoked_at is None

    def test_owner_uniewaznia_link(self, client, db_session, test_user, test_workspace):
        """DELETE /share-link/{token} jako owner → 200, ApiResponse[MessageResponse], revoked_at ustawione"""
        link = make_link(db_session, test_workspace.id)

        r = client.delete(
            f"/api/v1/workspaces/{test_workspace.id}/share-link/{link.token}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"] == {"message": "Link został unieważniony"}

        db_session.expire_all()
        assert get_link(db_session, link.token).revoked_at is not None

    def test_403_dla_viewera(self, client, db_session, test_user3, test_workspace):
        """DELETE /share-link/{token} jako viewer → 403, link nadal aktywny"""
        link = make_link(db_session, test_workspace.id)
        make_viewer(db_session, test_workspace.id, test_user3.id)

        r = client.delete(
            f"/api/v1/workspaces/{test_workspace.id}/share-link/{link.token}",
            headers=make_auth_headers(test_user3.id),
        )
        assert r.status_code == 403
        db_session.expire_all()
        assert get_link(db_session, link.token).revoked_at is None

    def test_404_dla_nieznanego_tokenu(self, client, test_user, test_workspace):
        """DELETE /share-link/nieistniejacy → 404"""
        r = client.delete(
            f"/api/v1/workspaces/{test_workspace.id}/share-link/nie-ma-takiego",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 404
        assert r.json()["code"] == "NOT_FOUND"

    def test_404_gdy_token_nalezy_do_innego_workspace(self, client, db_session, test_user, test_workspace, test_workspace2):
        """DELETE /{moj_ws}/share-link/{token z cudzego ws} → 404, cudzy link nietknięty"""
        foreign_link = make_link(db_session, test_workspace2.id)

        r = client.delete(
            f"/api/v1/workspaces/{test_workspace.id}/share-link/{foreign_link.token}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 404
        db_session.expire_all()
        assert get_link(db_session, foreign_link.token).revoked_at is None


# ─── GET /workspaces/share-link/{token} ───────────────────────────────────────

class TestPreviewShareLink:

    def test_401_bez_tokenu(self, client, db_session, test_workspace):
        """GET /share-link/{token} bez Authorization → 401"""
        link = make_link(db_session, test_workspace.id)
        r = client.get(f"/api/v1/workspaces/share-link/{link.token}")
        assert r.status_code == 401

    def test_podglad_dla_nieczlonka(self, client, db_session, test_user2, test_workspace):
        """GET /share-link/{token} → 200, ApiResponse[ShareLinkPreview], already_member False"""
        link = make_link(db_session, test_workspace.id)

        r = client.get(
            f"/api/v1/workspaces/share-link/{link.token}",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"] == {
            "workspace_id": test_workspace.id,
            "workspace_name": test_workspace.name,
            "workspace_icon": test_workspace.icon,
            "board_id": None,
            "board_name": None,
            "already_member": False,
        }

    def test_podglad_dla_czlonka_ma_already_member(self, client, db_session, test_user, test_workspace):
        """GET /share-link/{token} jako członek → already_member True"""
        link = make_link(db_session, test_workspace.id)
        r = client.get(
            f"/api/v1/workspaces/share-link/{link.token}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["already_member"] is True

    def test_podglad_linku_do_tablicy(self, client, db_session, test_user2, test_workspace, test_board):
        """GET /share-link/{token tablicy} → board_id i board_name w podglądzie"""
        link = make_link(db_session, test_workspace.id, board_id=test_board.id)
        r = client.get(
            f"/api/v1/workspaces/share-link/{link.token}",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["board_id"] == test_board.id
        assert r.json()["data"]["board_name"] == test_board.name

    def test_404_dla_nieznanego_tokenu(self, client, test_user):
        """GET /share-link/nieistniejacy → 404"""
        r = client.get(
            "/api/v1/workspaces/share-link/nie-ma-takiego",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 404
        assert r.json()["code"] == "NOT_FOUND"

    def test_410_dla_uniewaznionego(self, client, db_session, test_user2, test_workspace):
        """GET /share-link/{token unieważniony} → 410"""
        link = make_link(db_session, test_workspace.id, revoked=True)
        r = client.get(
            f"/api/v1/workspaces/share-link/{link.token}",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 410
        assert r.json()["success"] is False

    def test_410_dla_wygaslego(self, client, db_session, test_user2, test_workspace):
        """GET /share-link/{token wygasły} → 410"""
        link = make_link(db_session, test_workspace.id, expired=True)
        r = client.get(
            f"/api/v1/workspaces/share-link/{link.token}",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 410


# ─── POST /workspaces/share-link/{token}/join ─────────────────────────────────

class TestJoinShareLink:

    def test_401_bez_tokenu(self, client, db_session, test_workspace, test_user2):
        """POST /share-link/{token}/join bez Authorization → 401, nikt nie dołącza"""
        link = make_link(db_session, test_workspace.id)
        r = client.post(f"/api/v1/workspaces/share-link/{link.token}/join")
        assert r.status_code == 401
        assert not is_member(db_session, test_workspace.id, test_user2.id)

    def test_dolacza_jako_editor(self, client, db_session, test_user2, test_workspace):
        """POST /share-link/{token}/join → 200, ApiResponse[JoinShareLinkResponse], WorkspaceMember(editor)"""
        link = make_link(db_session, test_workspace.id)
        assert not is_member(db_session, test_workspace.id, test_user2.id)

        r = client.post(
            f"/api/v1/workspaces/share-link/{link.token}/join",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        assert set(data.keys()) == {"message", "workspace_id", "workspace_name", "board_id", "role", "already_member"}
        assert data["workspace_id"] == test_workspace.id
        assert data["workspace_name"] == test_workspace.name
        assert data["board_id"] is None
        assert data["role"] == "editor"
        assert data["already_member"] is False

        member = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user2.id,
        ).one()
        assert member.role == "editor"

    def test_join_linku_do_tablicy_zwraca_board_id(self, client, db_session, test_user2, test_workspace, test_board):
        """POST /share-link/{token tablicy}/join → board_id w odpowiedzi"""
        link = make_link(db_session, test_workspace.id, board_id=test_board.id)
        r = client.post(
            f"/api/v1/workspaces/share-link/{link.token}/join",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["board_id"] == test_board.id

    def test_juz_czlonek_nie_dubluje_membershipu(self, client, db_session, test_user, test_workspace):
        """POST /join jako owner → 200, already_member True, rola zostaje 'owner', jeden rekord"""
        link = make_link(db_session, test_workspace.id)
        r = client.post(
            f"/api/v1/workspaces/share-link/{link.token}/join",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["already_member"] is True
        assert data["role"] == "owner"

        memberships = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user.id,
        ).all()
        assert len(memberships) == 1
        assert memberships[0].role == "owner"

    def test_404_dla_nieznanego_tokenu(self, client, test_user2):
        """POST /share-link/nieistniejacy/join → 404"""
        r = client.post(
            "/api/v1/workspaces/share-link/nie-ma-takiego/join",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 404
        assert r.json()["code"] == "NOT_FOUND"

    def test_410_dla_uniewaznionego(self, client, db_session, test_user2, test_workspace):
        """POST /join z unieważnionym tokenem → 410, brak członkostwa"""
        link = make_link(db_session, test_workspace.id, revoked=True)
        r = client.post(
            f"/api/v1/workspaces/share-link/{link.token}/join",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 410
        assert r.json()["success"] is False
        assert not is_member(db_session, test_workspace.id, test_user2.id)

    def test_410_dla_wygaslego(self, client, db_session, test_user2, test_workspace):
        """POST /join z wygasłym tokenem → 410, brak członkostwa"""
        link = make_link(db_session, test_workspace.id, expired=True)
        r = client.post(
            f"/api/v1/workspaces/share-link/{link.token}/join",
            headers=make_auth_headers(test_user2.id),
        )
        assert r.status_code == 410
        assert not is_member(db_session, test_workspace.id, test_user2.id)
