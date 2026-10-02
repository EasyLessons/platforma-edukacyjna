"""
Testy walidacji avatar_url (SEC-14)
PUT /api/v1/auth/users/me, api/v1/auth/avatar_url.py
"""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api.v1.auth.avatar_url import AVATAR_URL_MAX_LENGTH, safe_avatar_url
from api.v1.auth.schemas import AvatarUpdate, UserResponse
from api.v1.auth.utils import create_access_token
from core.config import get_settings
from core.database import get_db
from main import app

settings = get_settings()
SUPABASE = settings.supabase_url.rstrip("/")
# Dokładnie taki adres zwraca supabase.storage.from('avatars').getPublicUrl() na froncie.
FRONTEND_AVATAR_URL = f"{SUPABASE}/storage/v1/object/public/avatars/12-1727800000000.png"
GOOGLE_AVATAR_URL = "https://lh3.googleusercontent.com/a/ACg8ocJx=s96-c"

SUPABASE_HOST = SUPABASE.removeprefix("https://")
REJECTED = [
    "https://evil.example/pixel.png",
    "http://lh3.googleusercontent.com/a/x",                       # nie https
    f"http://{SUPABASE_HOST}/storage/v1/object/public/avatars/a.png",
    "https://attacker-project.supabase.co/storage/v1/object/public/avatars/a.png",  # cudzy projekt
    f"https://{SUPABASE_HOST}.evil.example/storage/v1/object/public/avatars/a.png",
    f"https://{SUPABASE_HOST}@evil.example/storage/v1/object/public/avatars/a.png",  # userinfo
    f"https://evil.example/?{SUPABASE_HOST}/storage/v1/object/public/avatars/a.png",
    f"https://{SUPABASE_HOST}:8443/storage/v1/object/public/avatars/a.png",
    f"{SUPABASE}/functions/v1/tracker",                            # nasz host, ale nie Storage
    "https://lh3.googleusercontent.com.evil.example/a/x",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,AAAA",
    "//lh3.googleusercontent.com/a/x",
    " https://lh3.googleusercontent.com/a/x",
    "https://lh3.googleusercontent.com/a/x\n",
    "https://lh3.googleusercontent.com\\@evil.example/a",
    "",
]


class TestAvatarUpdateSchema:
    @pytest.mark.parametrize("url", [FRONTEND_AVATAR_URL, GOOGLE_AVATAR_URL])
    def test_accepts_allowed_urls(self, url):
        assert AvatarUpdate(avatar_url=url).avatar_url == url

    @pytest.mark.parametrize("url", REJECTED)
    def test_rejects_everything_else(self, url):
        with pytest.raises(ValidationError):
            AvatarUpdate(avatar_url=url)

    def test_rejects_too_long_url(self):
        url = FRONTEND_AVATAR_URL + "a" * AVATAR_URL_MAX_LENGTH
        with pytest.raises(ValidationError):
            AvatarUpdate(avatar_url=url)


@pytest.fixture
def client(db_session, monkeypatch, redis_client):
    import core.redis_client as redis_client_module

    monkeypatch.setattr(redis_client_module, "_redis_client", redis_client)

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def auth_headers(user_id: int) -> dict:
    token = create_access_token({"sub": str(user_id)}, settings.secret_key, settings.algorithm)
    return {"Authorization": f"Bearer {token}"}


class TestUpdateProfileEndpoint:
    def test_frontend_upload_flow_still_works(self, client, db_session, test_user):
        r = client.put(
            "/api/v1/auth/users/me",
            json={"avatar_url": FRONTEND_AVATAR_URL},
            headers=auth_headers(test_user.id),
        )
        assert r.status_code == 200
        assert r.json()["data"]["avatar_url"] == FRONTEND_AVATAR_URL
        db_session.refresh(test_user)
        assert test_user.avatar_url == FRONTEND_AVATAR_URL

    def test_tracking_pixel_is_rejected_with_422(self, client, db_session, test_user):
        r = client.put(
            "/api/v1/auth/users/me",
            json={"avatar_url": "https://evil.example/pixel.png"},
            headers=auth_headers(test_user.id),
        )
        assert r.status_code == 422
        assert r.json()["code"] == "VALIDATION_ERROR"
        db_session.refresh(test_user)
        assert test_user.avatar_url is None

    def test_rate_limited_per_ip(self, client, test_user):
        last = None
        for _ in range(31):
            last = client.put(
                "/api/v1/auth/users/me",
                json={"avatar_url": FRONTEND_AVATAR_URL},
                headers=auth_headers(test_user.id),
            )
        assert last.status_code == 429


class TestLegacyAvatarOnRead:
    """Wartości zapisane przed allowlistą (obcy host) nie są oddawane klientom."""

    LEGACY = "https://attacker.example/pixel.png"

    def test_safe_avatar_url(self):
        assert safe_avatar_url(self.LEGACY) is None
        assert safe_avatar_url(None) is None
        assert safe_avatar_url("") is None
        assert safe_avatar_url(FRONTEND_AVATAR_URL) == FRONTEND_AVATAR_URL
        assert safe_avatar_url(GOOGLE_AVATAR_URL) == GOOGLE_AVATAR_URL

    def test_user_response_hides_legacy_value(self, db_session, test_user):
        test_user.avatar_url = self.LEGACY
        db_session.commit()
        assert UserResponse.model_validate(test_user).avatar_url is None
        test_user.avatar_url = FRONTEND_AVATAR_URL
        db_session.commit()
        assert UserResponse.model_validate(test_user).avatar_url == FRONTEND_AVATAR_URL

    def test_workspace_members_hide_legacy_value(self, db_session, test_user, test_workspace):
        from api.v1.workspaces.members.service import MemberService

        test_user.avatar_url = self.LEGACY
        db_session.commit()
        members = MemberService(db_session).get_workspace_members(test_workspace.id, test_user.id).members
        assert [m.avatar_url for m in members if m.user_id == test_user.id] == [None]

    @pytest.mark.asyncio
    async def test_presence_hides_legacy_value(self, db_session, redis_client, test_user):
        from core.presence import PresenceService

        test_user.avatar_url = self.LEGACY
        db_session.commit()
        service = PresenceService(db_session, redis_client)
        await service.mark_online(1, test_user.id)
        online = await service.get_online_users([1])
        assert [u.avatar_url for u in online[1]] == [None]
