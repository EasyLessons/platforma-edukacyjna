"""
Testy uploadu awatara przez backend (SEC-03)
POST /api/v1/auth/users/me/avatar
"""
import io
import re

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import api.v1.auth.avatar as avatar_module
from api.v1.auth.utils import create_access_token
from core.config import get_settings
from core.database import get_db
from core.exceptions import AppException
from main import app

settings = get_settings()

URL = "/api/v1/auth/users/me/avatar"
BUCKET_PREFIX = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/avatars/"


def auth_headers(user_id: int) -> dict:
    token = create_access_token({"sub": str(user_id)}, settings.secret_key, settings.algorithm)
    return {"Authorization": f"Bearer {token}"}


def image_bytes(fmt: str = "PNG", size=(120, 80)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (20, 120, 220)).save(buf, format=fmt)
    return buf.getvalue()


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


@pytest.fixture(autouse=True)
def use_fake_redis_singleton(monkeypatch, redis_client):
    import core.redis_client as redis_client_module
    monkeypatch.setattr(redis_client_module, "_redis_client", redis_client)
    yield


@pytest.fixture
def fake_storage(monkeypatch):
    """Atrapa Supabase Storage: zapamietuje uploady i kasowania."""
    state = {"uploads": [], "deletes": []}

    async def fake_upload(bucket, path, data, content_type):
        state["uploads"].append({"bucket": bucket, "path": path, "data": data, "content_type": content_type})
        return f"{BUCKET_PREFIX}{path}" if bucket == "avatars" else f"https://x/{bucket}/{path}"

    async def fake_delete(bucket, path):
        state["deletes"].append((bucket, path))

    monkeypatch.setattr(avatar_module, "upload_public_object", fake_upload)
    monkeypatch.setattr(avatar_module, "delete_public_object", fake_delete)
    return state


def post_file(client, user, data: bytes, filename="avatar.png", content_type="image/png"):
    return client.post(URL, headers=auth_headers(user.id), files={"file": (filename, data, content_type)})


class TestAuth:

    def test_401_bez_tokenu(self, client, fake_storage):
        r = client.post(URL, files={"file": ("a.png", image_bytes(), "image/png")})
        assert r.status_code == 401
        assert fake_storage["uploads"] == []


class TestSuccess:

    @pytest.mark.parametrize("fmt,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
    def test_zapisuje_przekodowany_obraz_i_ustawia_avatar_url(self, client, db_session, test_user, fake_storage, fmt, mime):
        r = post_file(client, test_user, image_bytes(fmt), filename=f"foto.{fmt.lower()}", content_type=mime)

        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True

        assert len(fake_storage["uploads"]) == 1
        upload = fake_storage["uploads"][0]
        assert upload["bucket"] == "avatars"
        assert upload["content_type"] == "image/webp"
        stored = Image.open(io.BytesIO(upload["data"]))
        assert stored.format == "WEBP"
        assert stored.size == (120, 80)

        assert body["data"]["avatar_url"] == BUCKET_PREFIX + upload["path"]
        db_session.refresh(test_user)
        assert test_user.avatar_url == BUCKET_PREFIX + upload["path"]

    def test_nazwa_pliku_w_storage_pochodzi_z_serwera(self, client, test_user, fake_storage):
        r = post_file(client, test_user, image_bytes(), filename="../../evil<script>.php.png")

        assert r.status_code == 200
        path = fake_storage["uploads"][0]["path"]
        assert re.fullmatch(r"[0-9a-f]{32}\.webp", path)

    def test_duzy_obraz_jest_zmniejszany_do_512(self, client, test_user, fake_storage):
        r = post_file(client, test_user, image_bytes("JPEG", size=(3000, 1500)), content_type="image/jpeg")

        assert r.status_code == 200
        assert Image.open(io.BytesIO(fake_storage["uploads"][0]["data"])).size == (512, 256)

    def test_naglowek_content_type_czesci_jest_ignorowany(self, client, test_user, fake_storage):
        """Poprawny PNG wyslany jako text/html - liczy sie tresc, nie naglowek."""
        r = post_file(client, test_user, image_bytes(), filename="x.html", content_type="text/html")

        assert r.status_code == 200
        assert fake_storage["uploads"][0]["content_type"] == "image/webp"


class TestRejectedContent:

    @pytest.mark.parametrize(
        "data,filename,content_type",
        [
            (b"<html><script>alert(1)</script></html>", "a.png", "image/png"),
            (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "a.svg", "image/svg+xml"),
            (b"MZ\x90\x00" + b"\x00" * 100, "a.jpg", "image/jpeg"),
            (b"\x89PNG\r\n\x1a\n" + b"A" * 100, "a.png", "image/png"),
        ],
        ids=["html-jako-png", "svg", "exe-jako-jpg", "sama-sygnatura-png"],
    )
    def test_odrzuca_plik_ktory_nie_jest_obrazem(self, client, db_session, test_user, fake_storage, data, filename, content_type):
        r = post_file(client, test_user, data, filename=filename, content_type=content_type)

        assert r.status_code == 400
        assert r.json()["code"] == "INVALID_FILE_TYPE"
        assert fake_storage["uploads"] == []
        db_session.refresh(test_user)
        assert test_user.avatar_url is None

    def test_odrzuca_gif(self, client, test_user, fake_storage):
        r = post_file(client, test_user, image_bytes("GIF"), filename="a.gif", content_type="image/gif")

        assert r.status_code == 400
        assert r.json()["code"] == "INVALID_FILE_TYPE"
        assert fake_storage["uploads"] == []

    def test_odrzuca_bombe_dekompresyjna(self, client, test_user, fake_storage):
        buf = io.BytesIO()
        Image.new("L", (6000, 6000), 0).save(buf, format="PNG")
        assert len(buf.getvalue()) < 200_000

        r = post_file(client, test_user, buf.getvalue())

        assert r.status_code == 400
        assert r.json()["code"] == "IMAGE_TOO_LARGE"
        assert fake_storage["uploads"] == []


class TestSizeLimit:

    def test_413_gdy_plik_przekracza_limit(self, client, test_user, fake_storage, monkeypatch):
        monkeypatch.setattr(avatar_module, "AVATAR_MAX_UPLOAD_BYTES", 1024)
        monkeypatch.setattr(avatar_module, "MULTIPART_OVERHEAD_BYTES", 100_000)

        r = post_file(client, test_user, b"\x00" * 2048)

        assert r.status_code == 413
        assert r.json()["code"] == "FILE_TOO_LARGE"
        assert fake_storage["uploads"] == []

    def test_413_po_content_length_bez_czytania_ciala(self, client, test_user, fake_storage, monkeypatch):
        """Zadeklarowany rozmiar ponad limit -> odrzucenie, zanim cokolwiek przeczytamy."""
        monkeypatch.setattr(avatar_module, "AVATAR_MAX_UPLOAD_BYTES", 1024)
        monkeypatch.setattr(avatar_module, "MULTIPART_OVERHEAD_BYTES", 512)

        async def stream_must_not_be_read(*args, **kwargs):
            raise AssertionError("cialo nie powinno byc parsowane")

        monkeypatch.setattr(avatar_module, "MultiPartParser", stream_must_not_be_read)

        r = post_file(client, test_user, b"\x00" * 10_000)

        assert r.status_code == 413
        assert fake_storage["uploads"] == []

    @pytest.mark.asyncio
    async def test_limit_strumienia_dziala_bez_content_length(self):
        """Chunked upload bez Content-Length: przerywamy po przekroczeniu limitu."""
        consumed = []

        class FakeRequest:
            headers = {}

            async def stream(self):
                for _ in range(100):
                    consumed.append(1)
                    yield b"x" * 1000

        with pytest.raises(AppException) as exc:
            await avatar_module._read_body_limited(FakeRequest(), 2500)

        assert exc.value.status_code == 413
        assert len(consumed) == 3  # przerwane na 3. kawalku, reszta nieprzeczytana


class TestBadRequest:

    def test_400_gdy_brak_pola_file(self, client, test_user, fake_storage):
        r = client.post(URL, headers=auth_headers(test_user.id), files={"inne": ("a.png", image_bytes(), "image/png")})
        assert r.status_code == 400
        assert r.json()["code"] == "INVALID_UPLOAD"

    def test_400_gdy_json_zamiast_multipart(self, client, test_user, fake_storage):
        r = client.post(URL, headers=auth_headers(test_user.id), json={"avatar_url": "https://evil.example.com/x.png"})
        assert r.status_code == 400
        assert r.json()["code"] == "INVALID_UPLOAD"
        assert fake_storage["uploads"] == []

    def test_400_gdy_pole_file_jest_tekstem(self, client, test_user, fake_storage):
        r = client.post(URL, headers=auth_headers(test_user.id), data={"file": "tekst"}, files={"x": ("", b"", "")})
        assert r.status_code == 400

    def test_400_gdy_pusty_plik(self, client, test_user, fake_storage):
        r = post_file(client, test_user, b"")
        assert r.status_code == 400


class TestPreviousAvatarCleanup:

    def test_kasuje_poprzedni_plik_z_naszego_bucketu(self, client, db_session, test_user, fake_storage):
        test_user.avatar_url = BUCKET_PREFIX + "stary-plik.png"
        db_session.commit()

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 200
        assert fake_storage["deletes"] == [("avatars", "stary-plik.png")]

    def test_nie_kasuje_zewnetrznego_adresu(self, client, db_session, test_user, fake_storage):
        test_user.avatar_url = "https://lh3.googleusercontent.com/a/abc"
        db_session.commit()

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 200
        assert fake_storage["deletes"] == []

    def test_nie_kasuje_pliku_uzywanego_przez_innego_uzytkownika(self, client, db_session, test_user, test_user2, fake_storage):
        """Atak: podstawiam cudzy avatar_url, potem zmieniam awatar, zeby skasowac cudzy plik."""
        shared = BUCKET_PREFIX + "cudzy.webp"
        test_user.avatar_url = shared
        test_user2.avatar_url = shared
        db_session.commit()

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 200
        assert fake_storage["deletes"] == []
        db_session.refresh(test_user2)
        assert test_user2.avatar_url == shared

    def test_nie_zmienia_awatara_innego_uzytkownika(self, client, db_session, test_user, test_user2, fake_storage):
        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 200
        db_session.refresh(test_user2)
        assert test_user2.avatar_url is None


class TestStorageFailures:

    def test_503_gdy_storage_nie_jest_skonfigurowany(self, client, db_session, test_user, monkeypatch):
        import core.storage as storage
        from types import SimpleNamespace
        monkeypatch.setattr(
            storage, "get_settings",
            lambda: SimpleNamespace(supabase_url="", supabase_service_role_key=""),
        )

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 503
        assert r.json()["code"] == "STORAGE_NOT_CONFIGURED"
        db_session.refresh(test_user)
        assert test_user.avatar_url is None

    def test_blad_storage_nie_zmienia_avatar_url(self, client, db_session, test_user, monkeypatch):
        async def failing_upload(*args, **kwargs):
            raise AppException("blad", code="STORAGE_UPLOAD_FAILED", status_code=502)

        monkeypatch.setattr(avatar_module, "upload_public_object", failing_upload)
        test_user.avatar_url = BUCKET_PREFIX + "obecny.webp"
        db_session.commit()

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 502
        db_session.refresh(test_user)
        assert test_user.avatar_url == BUCKET_PREFIX + "obecny.webp"


class TestRateLimit:

    def test_429_po_przekroczeniu_limitu_per_uzytkownik(self, client, test_user, test_user2, fake_storage):
        statuses = [post_file(client, test_user, image_bytes()).status_code for _ in range(11)]

        assert statuses[:10] == [200] * 10
        assert statuses[10] == 429
        # limit jest per uzytkownik - inny uzytkownik nadal moze
        assert post_file(client, test_user2, image_bytes()).status_code == 200

    def test_limit_liczy_takze_odrzucone_pliki(self, client, test_user, fake_storage):
        last = None
        for _ in range(11):
            last = post_file(client, test_user, b"nie obraz")
        assert last.status_code == 429
        assert last.json()["code"] == "RATE_LIMITED"
