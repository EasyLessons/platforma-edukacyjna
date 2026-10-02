"""
Testy uploadu awatara przez backend (SEC-03)
POST /api/v1/auth/users/me/avatar
"""
import asyncio
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
from core.models import User
from main import app
from tests.conftest import TestingSessionLocal

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

    def test_odrzuca_bombe_ponizej_25_mpx(self, client, test_user, fake_storage):
        """WEBP 5000x5000 w jednym kolorze: plik ~1 KB, dekodowanie zajmowalo ponad 400 MB."""
        buf = io.BytesIO()
        Image.new("RGBA", (5000, 5000), (1, 2, 3, 128)).save(buf, format="WEBP", lossless=True)
        assert len(buf.getvalue()) < 5_000

        r = post_file(client, test_user, buf.getvalue(), filename="a.webp", content_type="image/webp")

        assert r.status_code == 400
        assert r.json()["code"] == "IMAGE_TOO_LARGE"
        assert fake_storage["uploads"] == []

    def test_tylko_jedno_dekodowanie_naraz(self):
        """Jedno dekodowanie to do ~100 MB RAM (budzet sanitizera) - nie rownolegle."""
        assert avatar_module._decode_slots._value == 1

    def test_anulowanie_zadania_nie_zwalnia_slotu_przed_koncem_dekodowania(self, monkeypatch):
        """
        Regresja: `async with semafor` oddawal slot w chwili anulowania korutyny (zerwane
        polaczenie), a watek dekodujacy pracowal dalej - dwa dekodowania mogly sie nalozyc.
        """
        import threading

        started, finish = threading.Event(), threading.Event()

        def slow_sanitize(raw, *, max_side):
            started.set()
            finish.wait(timeout=10)
            raise AppException("x", code="INVALID_FILE_TYPE", status_code=400)

        monkeypatch.setattr(avatar_module, "sanitize_image", slow_sanitize)

        async def scenario():
            slots = asyncio.Semaphore(1)
            monkeypatch.setattr(avatar_module, "_decode_slots", slots)
            task = asyncio.create_task(avatar_module._sanitize_one_at_a_time(b"x"))
            while not started.is_set():
                await asyncio.sleep(0.01)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            locked_while_thread_runs = slots.locked()
            finish.set()
            for _ in range(200):
                if not slots.locked():
                    break
                await asyncio.sleep(0.01)
            return locked_while_thread_runs, slots.locked()

        locked_while_thread_runs, locked_after = asyncio.run(scenario())

        assert locked_while_thread_runs is True
        assert locked_after is False


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

    @pytest.mark.parametrize(
        "content_type",
        ["multipart/form-data; boundary=", "multipart/form-data"],
        ids=["pusty-boundary", "brak-boundary"],
    )
    def test_400_gdy_naglowek_multipart_jest_zepsuty(self, client, test_user, fake_storage, content_type):
        """Regresja: pusty boundary wywracal parser wyjatkiem spoza MultiPartException -> 500."""
        body = b'--x\r\nContent-Disposition: form-data; name="file"; filename="a"\r\n\r\nabc\r\n--x--\r\n'

        r = client.post(URL, headers={**auth_headers(test_user.id), "Content-Type": content_type}, content=body)

        assert r.status_code == 400
        assert r.json()["code"] == "INVALID_UPLOAD"
        assert fake_storage["uploads"] == []

    def test_408_gdy_cialo_przychodzi_za_wolno(self, client, test_user, fake_storage, monkeypatch):
        """Saczenie ciala po bajcie nie moze trzymac zadania bez konca."""
        async def never_ending_body(request, max_bytes):
            await asyncio.sleep(30)

        monkeypatch.setattr(avatar_module, "_read_body_limited", never_ending_body)
        monkeypatch.setattr(avatar_module, "AVATAR_BODY_TIMEOUT_SECONDS", 0.05)

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 408
        assert r.json()["code"] == "UPLOAD_TIMEOUT"
        assert fake_storage["uploads"] == []


class TestDatabaseConnection:
    """
    Zaleznosc get_current_user otwiera transakcje, a ten endpoint czyta cialo DOPIERO
    w handlerze. Polaczenie z puli (5+10) nie moze byc trzymane przez wolne czesci:
    czytanie ciala, kolejke do dekodowania, upload do Storage i kasowanie starego pliku.
    """

    def test_polaczenie_zwolnione_na_czas_wolnych_operacji(self, client, db_session, test_user, monkeypatch):
        seen = {}
        original_read = avatar_module._read_body_limited

        async def spy_read(request, max_bytes):
            seen["body"] = db_session.in_transaction()
            return await original_read(request, max_bytes)

        async def spy_upload(bucket, path, data, content_type):
            seen["upload"] = db_session.in_transaction()
            return BUCKET_PREFIX + path

        async def spy_delete(bucket, path):
            seen["delete"] = db_session.in_transaction()

        monkeypatch.setattr(avatar_module, "_read_body_limited", spy_read)
        monkeypatch.setattr(avatar_module, "upload_public_object", spy_upload)
        monkeypatch.setattr(avatar_module, "delete_public_object", spy_delete)
        test_user.avatar_url = BUCKET_PREFIX + "stary.webp"
        db_session.commit()

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 200, r.text
        assert seen == {"body": False, "upload": False, "delete": False}
        assert r.json()["data"]["avatar_url"].startswith(BUCKET_PREFIX)


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

    def test_kasuje_plik_ktory_byl_w_bazie_w_chwili_zapisu(self, client, db_session, test_user, monkeypatch):
        """
        Wyscig dwoch uploadow tego samego konta: gdy nasze zadanie wgrywalo plik, inne
        zdazylo zapisac awatar B. Kasujemy B (to, co faktycznie zastepujemy), a nie
        wartosc sprzed zadania - inaczej B zostalby w buckecie jako sierota.
        """
        test_user.avatar_url = BUCKET_PREFIX + "a.webp"
        db_session.commit()
        user_id = test_user.id
        deletes = []

        async def upload_while_other_request_wins(bucket, path, data, content_type):
            other = TestingSessionLocal()
            try:
                other.query(User).filter(User.id == user_id).update({"avatar_url": BUCKET_PREFIX + "b.webp"})
                other.commit()
            finally:
                other.close()
            return BUCKET_PREFIX + path

        async def fake_delete(bucket, path):
            deletes.append((bucket, path))

        monkeypatch.setattr(avatar_module, "upload_public_object", upload_while_other_request_wins)
        monkeypatch.setattr(avatar_module, "delete_public_object", fake_delete)

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 200, r.text
        assert deletes == [("avatars", "b.webp")]

    def test_404_i_brak_sieroty_gdy_konto_zniknelo_w_trakcie(self, client, db_session, test_user, monkeypatch):
        user_id = test_user.id
        uploaded = []
        deletes = []

        async def upload_while_account_is_deleted(bucket, path, data, content_type):
            other = TestingSessionLocal()
            try:
                other.query(User).filter(User.id == user_id).delete()
                other.commit()
            finally:
                other.close()
            uploaded.append(path)
            return BUCKET_PREFIX + path

        async def fake_delete(bucket, path):
            deletes.append((bucket, path))

        monkeypatch.setattr(avatar_module, "upload_public_object", upload_while_account_is_deleted)
        monkeypatch.setattr(avatar_module, "delete_public_object", fake_delete)

        r = post_file(client, test_user, image_bytes())

        assert r.status_code == 404
        assert deletes == [("avatars", uploaded[0])]

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

    @pytest.mark.asyncio
    async def test_licznik_bez_ttl_dostaje_ttl(self, redis_client, test_user):
        """
        Regresja: gdy `expire` nie doszlo po pierwszym `incr` (zerwane polaczenie),
        klucz zostawal bez wygasniecia i po 10 probach blokowal uzytkownika na stale.
        """
        key = f"ratelimit:avatar_upload:user:{test_user.id}"
        await redis_client.set(key, 3)
        assert await redis_client.ttl(key) == -1

        await avatar_module.avatar_rate_limit(current_user=test_user)

        assert await redis_client.get(key) == "4"
        assert 0 < await redis_client.ttl(key) <= avatar_module.AVATAR_RATE_WINDOW_SECONDS

    @pytest.mark.asyncio
    async def test_kolejne_zadania_nie_przedluzaja_okna(self, redis_client, test_user):
        key = f"ratelimit:avatar_upload:user:{test_user.id}"
        await avatar_module.avatar_rate_limit(current_user=test_user)
        await redis_client.expire(key, 100)

        await avatar_module.avatar_rate_limit(current_user=test_user)

        assert await redis_client.ttl(key) <= 100
