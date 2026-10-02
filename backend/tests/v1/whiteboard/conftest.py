"""Fixtures testow rozmowy glosowej (Daily) - atrapa API w daily_fake.py."""
import httpx
import pytest
from fastapi.testclient import TestClient

import api.v1.whiteboard.call_usage as call_usage
import api.v1.whiteboard.daily_client as daily_client
from core import redis_client as redis_client_module
from core.config import Settings, get_settings
from core.database import get_db
from main import app

from .daily_fake import API_KEY, ROOM_TTL_MINUTES, FakeDaily


@pytest.fixture
def daily(monkeypatch):
    fake = FakeDaily()
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        daily_client.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(fake.handler), **kwargs),
    )
    monkeypatch.setattr(daily_client, "DAILY_RATE_LIMIT_BACKOFF_SECONDS", 0)
    return fake


@pytest.fixture
def call_settings(monkeypatch):
    """Ustawienia rozmowy w stanie domyslnym + klucz; niezalezne od env maszyny."""
    settings = get_settings()
    for name in (
        "call_enabled", "call_allowed_user_ids", "call_admin_user_ids", "daily_monthly_minutes_cap",
        "call_user_daily_minutes_cap", "call_max_participants",
    ):
        monkeypatch.setattr(settings, name, Settings.model_fields[name].default)
    monkeypatch.setattr(settings, "daily_api_key", API_KEY)
    monkeypatch.setattr(settings, "daily_room_prefix", "easylesson")
    monkeypatch.setattr(settings, "daily_room_ttl_minutes", ROOM_TTL_MINUTES)
    return settings


@pytest.fixture
def client(db_session, monkeypatch, redis_client, call_settings):
    monkeypatch.setattr(redis_client_module, "get_redis_client", lambda: redis_client)
    call_usage.reset_memory_cache()

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()
    call_usage.reset_memory_cache()
