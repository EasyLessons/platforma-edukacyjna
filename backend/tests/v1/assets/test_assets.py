"""
Testy modułu assets (zapisane szablony użytkownika)
api/v1/assets/service.py + router.py — GET/POST /api/v1/assets/, DELETE /api/v1/assets/{id}
"""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from main import app
from core.database import get_db
from core.config import get_settings
from core.models import SavedAsset
from api.v1.assets import service
from api.v1.assets.schemas import AssetCreate
from api.v1.auth.utils import create_access_token

settings = get_settings()


def make_auth_headers(user_id: int) -> dict:
    token = create_access_token(
        {"sub": str(user_id)},
        settings.secret_key,
        settings.algorithm,
    )
    return {"Authorization": f"Bearer {token}"}


def make_asset(db_session, user_id: int, name: str = "Szablon", *, created_at: datetime | None = None) -> SavedAsset:
    asset = SavedAsset(
        user_id=user_id,
        name=name,
        elements_data=[{"type": "rect", "x": 1, "y": 2}],
        thumbnail="data:image/png;base64,AAA=",
        created_at=created_at or datetime.utcnow(),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    return asset


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


# ─── service.create_asset ─────────────────────────────────────────────────────

class TestCreateAssetService:

    def test_tworzy_asset_i_zapisuje_w_bazie(self, db_session, test_user):
        """create_asset → rekord SavedAsset przypisany do usera, elements_data zachowane"""
        schema = AssetCreate(
            name="Mój szablon",
            elements_data=[{"type": "text", "text": "hej"}, {"type": "line"}],
            thumbnail="data:image/png;base64,AAA=",
        )
        asset = service.create_asset(db_session, test_user.id, schema)

        assert asset.id is not None
        assert asset.user_id == test_user.id
        assert asset.name == "Mój szablon"
        assert asset.elements_data == [{"type": "text", "text": "hej"}, {"type": "line"}]
        assert asset.thumbnail == "data:image/png;base64,AAA="
        assert isinstance(asset.created_at, datetime)

        saved = db_session.query(SavedAsset).filter(SavedAsset.id == asset.id).first()
        assert saved is not None
        assert saved.user_id == test_user.id

    def test_thumbnail_jest_opcjonalny(self, db_session, test_user):
        """create_asset bez thumbnail → zapisany z thumbnail=None"""
        schema = AssetCreate(name="Bez miniatury", elements_data=[])
        asset = service.create_asset(db_session, test_user.id, schema)
        assert asset.thumbnail is None
        assert asset.elements_data == []


# ─── service.get_user_assets ──────────────────────────────────────────────────

class TestGetUserAssetsService:

    def test_zwraca_tylko_assety_usera(self, db_session, test_user, test_user2):
        """get_user_assets → tylko assety danego usera, cudze pominięte"""
        own = make_asset(db_session, test_user.id, "Własny")
        make_asset(db_session, test_user2.id, "Cudzy")

        result = service.get_user_assets(db_session, test_user.id)

        assert [a.id for a in result] == [own.id]

    def test_sortuje_od_najnowszego(self, db_session, test_user):
        """get_user_assets → kolejność created_at malejąco"""
        now = datetime.utcnow()
        oldest = make_asset(db_session, test_user.id, "Stary", created_at=now - timedelta(days=2))
        newest = make_asset(db_session, test_user.id, "Nowy", created_at=now)
        middle = make_asset(db_session, test_user.id, "Środkowy", created_at=now - timedelta(days=1))

        result = service.get_user_assets(db_session, test_user.id)

        assert [a.id for a in result] == [newest.id, middle.id, oldest.id]

    def test_pusta_lista_gdy_brak_assetow(self, db_session, test_user):
        """get_user_assets dla usera bez assetów → []"""
        assert service.get_user_assets(db_session, test_user.id) == []


# ─── service.delete_asset ─────────────────────────────────────────────────────

class TestDeleteAssetService:

    def test_usuwa_wlasny_asset(self, db_session, test_user):
        """delete_asset własnego assetu → True, rekord znika z bazy"""
        asset = make_asset(db_session, test_user.id)
        asset_id = asset.id

        assert service.delete_asset(db_session, test_user.id, asset_id) is True
        assert db_session.query(SavedAsset).filter(SavedAsset.id == asset_id).first() is None

    def test_nie_usuwa_cudzego_assetu(self, db_session, test_user, test_user2):
        """delete_asset cudzego assetu → False, rekord zostaje"""
        asset = make_asset(db_session, test_user2.id)
        asset_id = asset.id

        assert service.delete_asset(db_session, test_user.id, asset_id) is False
        assert db_session.query(SavedAsset).filter(SavedAsset.id == asset_id).first() is not None

    def test_false_gdy_asset_nie_istnieje(self, db_session, test_user):
        """delete_asset nieistniejącego id → False"""
        assert service.delete_asset(db_session, test_user.id, 99999) is False


# ─── POST /assets/ ────────────────────────────────────────────────────────────

class TestCreateAssetEndpoint:

    def test_401_bez_tokenu(self, client):
        """POST /assets/ bez Authorization → 401"""
        r = client.post("/api/v1/assets/", json={"name": "X", "elements_data": []})
        assert r.status_code == 401
        assert r.json()["success"] is False

    def test_tworzy_asset(self, client, db_session, test_user):
        """POST /assets/ → 200, ApiResponse z zapisanym assetem (router nie ustawia 201)"""
        r = client.post(
            "/api/v1/assets/",
            json={
                "name": "Szablon z API",
                "elements_data": [{"type": "rect"}],
                "thumbnail": "data:image/png;base64,AAA=",
            },
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        assert data["name"] == "Szablon z API"
        assert data["elements_data"] == [{"type": "rect"}]
        assert data["thumbnail"] == "data:image/png;base64,AAA="
        assert isinstance(data["id"], int)
        assert "created_at" in data

        saved = db_session.query(SavedAsset).filter(SavedAsset.id == data["id"]).first()
        assert saved is not None
        assert saved.user_id == test_user.id

    def test_422_gdy_brak_wymaganych_pol(self, client, test_user):
        """POST /assets/ bez name → 422 w kształcie ApiResponse"""
        r = client.post(
            "/api/v1/assets/",
            json={"elements_data": []},
            headers=make_auth_headers(test_user.id),
        )
        assert r.status_code == 422
        body = r.json()
        assert body["success"] is False
        assert body["code"] == "VALIDATION_ERROR"

    def test_403_dla_niezweryfikowanego_konta(self, client, unverified_user):
        """POST /assets/ z tokenem nieaktywnego usera → 403"""
        r = client.post(
            "/api/v1/assets/",
            json={"name": "X", "elements_data": []},
            headers=make_auth_headers(unverified_user.id),
        )
        assert r.status_code == 403


# ─── GET /assets/ ─────────────────────────────────────────────────────────────

class TestGetAssetsEndpoint:

    def test_401_bez_tokenu(self, client):
        """GET /assets/ bez Authorization → 401"""
        r = client.get("/api/v1/assets/")
        assert r.status_code == 401

    def test_zwraca_tylko_wlasne_assety(self, client, db_session, test_user, test_user2):
        """GET /assets/ → lista tylko assetów aktualnego usera"""
        own = make_asset(db_session, test_user.id, "Własny")
        make_asset(db_session, test_user2.id, "Cudzy")

        r = client.get("/api/v1/assets/", headers=make_auth_headers(test_user.id))

        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert [a["id"] for a in body["data"]] == [own.id]
        assert body["data"][0]["name"] == "Własny"

    def test_pusta_lista(self, client, test_user):
        """GET /assets/ bez assetów → data == []"""
        r = client.get("/api/v1/assets/", headers=make_auth_headers(test_user.id))
        assert r.status_code == 200
        assert r.json()["data"] == []


# ─── DELETE /assets/{id} ──────────────────────────────────────────────────────

class TestDeleteAssetEndpoint:

    def test_401_bez_tokenu(self, client, db_session, test_user):
        """DELETE /assets/{id} bez Authorization → 401, asset zostaje"""
        asset = make_asset(db_session, test_user.id)
        r = client.delete(f"/api/v1/assets/{asset.id}")
        assert r.status_code == 401
        assert db_session.query(SavedAsset).filter(SavedAsset.id == asset.id).first() is not None

    def test_usuwa_wlasny_asset(self, client, db_session, test_user):
        """DELETE /assets/{id} własnego → 200, data.deleted True, brak rekordu"""
        asset = make_asset(db_session, test_user.id)
        asset_id = asset.id

        r = client.delete(f"/api/v1/assets/{asset_id}", headers=make_auth_headers(test_user.id))

        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"] == {"deleted": True}
        assert db_session.query(SavedAsset).filter(SavedAsset.id == asset_id).first() is None

    def test_404_dla_cudzego_assetu(self, client, db_session, test_user, test_user2):
        """DELETE /assets/{id} cudzego → 404, rekord zostaje"""
        asset = make_asset(db_session, test_user2.id)
        asset_id = asset.id

        r = client.delete(f"/api/v1/assets/{asset_id}", headers=make_auth_headers(test_user.id))

        assert r.status_code == 404
        assert db_session.query(SavedAsset).filter(SavedAsset.id == asset_id).first() is not None

    def test_404_gdy_asset_nie_istnieje(self, client, test_user):
        """DELETE /assets/{id} nieistniejącego → 404"""
        r = client.delete("/api/v1/assets/99999", headers=make_auth_headers(test_user.id))
        assert r.status_code == 404

    def test_404_ma_ksztalt_fastapi_a_nie_apiresponse(self, client, test_user):
        """Dokumentuje: 404 z routera assets to HTTPException → body {"detail": ...},
        a nie ApiResponse (brak handlera HTTPException w main.py, router nie używa NotFoundError)."""
        r = client.delete("/api/v1/assets/99999", headers=make_auth_headers(test_user.id))
        assert r.status_code == 404
        body = r.json()
        assert "detail" in body
        assert "success" not in body

    def test_422_dla_nienumerycznego_id(self, client, test_user):
        """DELETE /assets/abc → 422 (asset_id musi być int)"""
        r = client.delete("/api/v1/assets/abc", headers=make_auth_headers(test_user.id))
        assert r.status_code == 422
        assert r.json()["success"] is False
