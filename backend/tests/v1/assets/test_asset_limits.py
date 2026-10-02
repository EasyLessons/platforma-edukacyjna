"""
Testy limitów SavedAsset (SEC-15)
api/v1/assets/schemas.py + service.py
"""
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api.v1.assets import service
from api.v1.assets.schemas import (
    MAX_ASSET_ELEMENTS,
    MAX_ASSET_ELEMENTS_BYTES,
    MAX_ASSET_NAME_LENGTH,
    MAX_ASSET_THUMBNAIL_CHARS,
    MAX_ASSETS_PER_USER,
    AssetCreate,
    AssetResponse,
)
from api.v1.auth.utils import create_access_token
from core.config import get_settings
from core.database import get_db
from core.exceptions import AppException
from core.models import SavedAsset
from main import app

settings = get_settings()


def auth_headers(user_id: int) -> dict:
    token = create_access_token({"sub": str(user_id)}, settings.secret_key, settings.algorithm)
    return {"Authorization": f"Bearer {token}"}


def svg_thumbnail(points: int) -> str:
    """Miniatura w kształcie tej z frontu (generateElementsSvgThumbnail)."""
    d = "M " + " L ".join(f"{i * 1.2345678},{i * 2.3456789}" for i in range(points))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">'
        f'<path d="{d}" fill="none" stroke="#333" stroke-width="1" /></svg>'
    )


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


class TestAssetCreateLimits:
    def test_realistic_frontend_payload_passes(self):
        """Kilkadziesiąt odręcznych ścieżek + miniatura SVG (dziesiątki kB) musi przechodzić."""
        elements = [
            {"id": f"el{i}", "type": "path", "color": "#000", "strokeWidth": 2,
             "points": [{"x": j * 1.5, "y": j * 2.5} for j in range(200)]}
            for i in range(50)
        ]
        thumbnail = svg_thumbnail(10_000)
        assert len(thumbnail) > 200  # limit 200 znaków z audytu odciąłby każdą miniaturę
        asset = AssetCreate(name="Notatki", elements_data=elements, thumbnail=thumbnail)
        assert len(asset.elements_data) == 50

    def test_name_limits(self):
        AssetCreate(name="x" * MAX_ASSET_NAME_LENGTH, elements_data=[])
        with pytest.raises(ValidationError):
            AssetCreate(name="x" * (MAX_ASSET_NAME_LENGTH + 1), elements_data=[])
        with pytest.raises(ValidationError):
            AssetCreate(name="", elements_data=[])

    def test_too_many_elements(self):
        AssetCreate(name="x", elements_data=[{}] * MAX_ASSET_ELEMENTS)
        with pytest.raises(ValidationError):
            AssetCreate(name="x", elements_data=[{}] * (MAX_ASSET_ELEMENTS + 1))

    def test_elements_too_big(self):
        with pytest.raises(ValidationError):
            AssetCreate(name="x", elements_data=[{"blob": "a" * MAX_ASSET_ELEMENTS_BYTES}])

    def test_thumbnail_too_big(self):
        AssetCreate(name="x", elements_data=[], thumbnail="a" * MAX_ASSET_THUMBNAIL_CHARS)
        with pytest.raises(ValidationError):
            AssetCreate(name="x", elements_data=[], thumbnail="a" * (MAX_ASSET_THUMBNAIL_CHARS + 1))

    def test_response_model_has_no_input_limits(self):
        """Zasób zapisany przed wprowadzeniem limitów nadal da się zwrócić z GET."""
        legacy = SavedAsset(
            id=1,
            user_id=1,
            name="stary",
            elements_data=[{}] * (MAX_ASSET_ELEMENTS + 1),
            thumbnail="a" * (MAX_ASSET_THUMBNAIL_CHARS + 1),
            created_at=datetime.utcnow(),
        )
        assert AssetResponse.model_validate(legacy).id == 1


class TestAssetsPerUserLimit:
    def _fill(self, db_session, user_id: int, count: int) -> None:
        db_session.add_all(
            SavedAsset(user_id=user_id, name=f"a{i}", elements_data=[], created_at=datetime.utcnow())
            for i in range(count)
        )
        db_session.commit()

    def test_service_rejects_over_limit(self, db_session, test_user):
        self._fill(db_session, test_user.id, MAX_ASSETS_PER_USER)
        with pytest.raises(AppException) as exc:
            service.create_asset(db_session, test_user.id, AssetCreate(name="x", elements_data=[]))
        assert exc.value.status_code == 409
        assert exc.value.code == "ASSET_LIMIT_REACHED"

    def test_limit_is_per_user(self, db_session, test_user, test_user2):
        self._fill(db_session, test_user.id, MAX_ASSETS_PER_USER)
        asset = service.create_asset(db_session, test_user2.id, AssetCreate(name="x", elements_data=[]))
        assert asset.id is not None

    def test_endpoint_returns_409_and_recovers_after_delete(self, client, db_session, test_user):
        self._fill(db_session, test_user.id, MAX_ASSETS_PER_USER)
        headers = auth_headers(test_user.id)
        payload = {"name": "x", "elements_data": []}

        r = client.post("/api/v1/assets/", json=payload, headers=headers)
        assert r.status_code == 409
        assert r.json()["code"] == "ASSET_LIMIT_REACHED"

        first = db_session.query(SavedAsset).filter(SavedAsset.user_id == test_user.id).first()
        assert client.delete(f"/api/v1/assets/{first.id}", headers=headers).status_code == 200
        assert client.post("/api/v1/assets/", json=payload, headers=headers).status_code == 200

    def test_endpoint_rejects_oversized_thumbnail_with_422(self, client, test_user):
        r = client.post(
            "/api/v1/assets/",
            json={"name": "x", "elements_data": [], "thumbnail": "a" * (MAX_ASSET_THUMBNAIL_CHARS + 1)},
            headers=auth_headers(test_user.id),
        )
        assert r.status_code == 422
