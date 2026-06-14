"""
Testy routera boards — warstwa HTTP
GET/POST/PUT/DELETE /api/v1/boards/*

Testują współdziałanie routera, dependency injection i bazy danych.
"""
import pytest
from fastapi.testclient import TestClient

from main import app
from core.database import get_db
from api.v1.auth.utils import create_access_token
from core.config import get_settings
from core.models import Board

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


# ─── GET /boards ───────────────────────────────────────────────────────────────

class TestGetBoards:

    def test_zwraca_liste_tablic(self, client, test_user, test_board):
        """GET /boards?workspace_id=X — zwraca tablice workspace"""
        r = client.get(
            f"/api/v1/boards?workspace_id={test_board.workspace_id}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        ids = [b["id"] for b in data["data"]["boards"]]
        assert test_board.id in ids

    def test_401_bez_tokenu(self, client, test_board):
        """GET /boards bez Authorization → 401"""
        r = client.get(f"/api/v1/boards?workspace_id={test_board.workspace_id}")
        assert r.status_code == 401


# ─── GET /boards/{id} ──────────────────────────────────────────────────────────

class TestGetBoardById:

    def test_zwraca_tablice_po_id(self, client, test_user, test_board):
        """GET /boards/{id} → zwraca dane konkretnej tablicy"""
        r = client.get(
            f"/api/v1/boards/{test_board.id}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["data"]["id"] == test_board.id
        assert data["data"]["name"] == test_board.name

    def test_404_dla_nieistniejacego(self, client, test_user):
        """GET /boards/99999 → 404"""
        r = client.get(
            "/api/v1/boards/99999",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 404


# ─── POST /boards ──────────────────────────────────────────────────────────────

class TestCreateBoard:

    def test_tworzy_tablice(self, client, test_user, test_workspace):
        """POST /boards → 201, tablica zapisana w bazie"""
        r = client.post(
            "/api/v1/boards",
            json={
                "name": "Nowa tablica",
                "icon": "PenTool",
                "bg_color": "bg-blue-500",
                "workspace_id": test_workspace.id,
            },
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 201
        data = r.json()
        assert data["data"]["name"] == "Nowa tablica"
        assert data["data"]["workspace_id"] == test_workspace.id

    def test_422_gdy_brak_wymaganych_pol(self, client, test_user):
        """POST /boards bez name → 422 Unprocessable Entity"""
        r = client.post(
            "/api/v1/boards",
            json={"icon": "PenTool", "bg_color": "bg-blue-500", "workspace_id": 1},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 422


# ─── PUT /boards/{id} ──────────────────────────────────────────────────────────

class TestUpdateBoard:

    def test_aktualizuje_tablice(self, client, test_user, test_board):
        """PUT /boards/{id} → 200, zwraca zaktualizowane dane"""
        r = client.put(
            f"/api/v1/boards/{test_board.id}",
            json={"name": "Zmieniona nazwa", "icon": "Star", "bg_color": "bg-red-500"},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Zmieniona nazwa"


# ─── DELETE /boards/{id} ───────────────────────────────────────────────────────

class TestDeleteBoard:

    def test_usuwa_tablice(self, client, test_user, test_board, db_session):
        """DELETE /boards/{id} → 200, brak rekordu w bazie"""
        board_id = test_board.id
        r = client.delete(
            f"/api/v1/boards/{board_id}",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert db_session.query(Board).filter(Board.id == board_id).first() is None


# ─── POST /boards/{id}/toggle-favourite ────────────────────────────────────────

class TestToggleFavourite:

    def test_przelacza_ulubione(self, client, test_user, test_board):
        """POST /boards/{id}/toggle-favourite → zmienia flagę is_favourite"""
        r = client.post(
            f"/api/v1/boards/{test_board.id}/toggle-favourite",
            json={"is_favourite": True},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["is_favourite"] is True


# ─── GET /boards/{id}/members ──────────────────────────────────────────────────

class TestGetBoardMembers:

    def test_zwraca_czlonkow(self, client, test_user, test_board):
        """GET /boards/{id}/members → lista członków tablicy"""
        r = client.get(
            f"/api/v1/boards/{test_board.id}/members",
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        data = r.json()
        assert "members" in data["data"]
        assert any(m["user_id"] == test_user.id for m in data["data"]["members"])
