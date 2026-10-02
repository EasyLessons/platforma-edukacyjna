"""
Testy plikow tablicy (silnik Excalidraw) - api/v1/whiteboard/files.py
POST /api/v1/whiteboard/{id}/files, GET /api/v1/whiteboard/{id}/files/{file_name}

Supabase Storage jest atrapa w pamieci podpieta przez httpx.MockTransport (core/storage.py
i stary whiteboard/storage.py uzywaja httpx.AsyncClient) - zaden test nie wychodzi do sieci.
"""
import io
import json
import re
from datetime import datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from redis.exceptions import ConnectionError as RedisConnectionError

import core.storage as storage
from api.v1.auth.utils import create_access_token
from api.v1.boards.service import BoardService
from api.v1.whiteboard import files as files_module
from core.config import get_settings
from core.database import get_db
from core.models import Board, WorkspaceMember
from main import app

settings = get_settings()
FILE_NAME_RE = re.compile(r"[0-9a-f]{32}\.webp")


def files_url(board_id: int) -> str:
    return f"/api/v1/whiteboard/{board_id}/files"


def auth_headers(user_id: int) -> dict:
    token = create_access_token({"sub": str(user_id)}, settings.secret_key, settings.algorithm)
    return {"Authorization": f"Bearer {token}"}


def image_bytes(fmt: str = "PNG", size=(120, 80), **save_kwargs) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (20, 120, 220)).save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


def animated_gif() -> bytes:
    """GIF z dwiema klatkami: pierwsza czerwona, druga niebieska."""
    first = Image.new("RGB", (40, 30), (255, 0, 0))
    second = Image.new("RGB", (40, 30), (0, 0, 255))
    buf = io.BytesIO()
    first.save(buf, format="GIF", save_all=True, append_images=[second], duration=100, loop=0)
    return buf.getvalue()


class FakeStorage:
    """Supabase Storage w pamieci: buckety, obiekty, lista, kasowanie."""

    def __init__(self, buckets=("board-files",), not_found_status: int = 404, can_create_bucket: bool = True):
        self.buckets: set[str] = set(buckets)
        self.objects: dict[str, bytes] = {}  # "bucket/sciezka" -> bajty
        self.content_types: dict[str, str] = {}
        self.created_buckets: list[dict] = []
        self.requests: list[httpx.Request] = []
        self.not_found_status = not_found_status
        self.can_create_bucket = can_create_bucket

    def _bucket_not_found(self) -> httpx.Response:
        return httpx.Response(
            self.not_found_status,
            json={"statusCode": "404", "error": "Bucket not found", "message": "Bucket not found"},
        )

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if not path.startswith("/storage/v1/"):
            return httpx.Response(404)
        rest = path[len("/storage/v1/"):]

        if rest == "bucket" and request.method == "POST":
            body = json.loads(request.content)
            self.created_buckets.append(body)
            if not self.can_create_bucket:
                return httpx.Response(403, json={"message": "forbidden"})
            if body["id"] in self.buckets:
                return httpx.Response(409, json={"statusCode": "409", "error": "Duplicate"})
            self.buckets.add(body["id"])
            return httpx.Response(200, json={"name": body["id"]})

        if rest.startswith("object/list/") and request.method == "POST":
            bucket = rest[len("object/list/"):]
            if bucket not in self.buckets:
                return self._bucket_not_found()
            body = json.loads(request.content)
            prefix = f"{bucket}/{body['prefix']}"
            names = sorted(k[len(prefix):] for k in self.objects if k.startswith(prefix))
            page = names[body.get("offset", 0):][: body.get("limit", 100)]
            return httpx.Response(200, json=[{"name": n, "id": f"id-{n}"} for n in page])

        if rest.startswith("object/"):
            key = rest[len("object/"):]
            bucket = key.split("/", 1)[0]
            if bucket not in self.buckets:
                return self._bucket_not_found()
            if request.method == "POST":
                self.objects[key] = request.content
                self.content_types[key] = request.headers["content-type"]
                return httpx.Response(200, json={"Key": key})
            if request.method == "GET":
                if key not in self.objects:
                    return httpx.Response(
                        self.not_found_status,
                        json={"statusCode": "404", "error": "not_found", "message": "Object not found"},
                    )
                return httpx.Response(200, content=self.objects[key])
            if request.method == "DELETE":
                for p in json.loads(request.content)["prefixes"]:
                    self.objects.pop(f"{bucket}/{p}", None)
                return httpx.Response(200, json=[])
        return httpx.Response(405)

    def keys(self, bucket: str = "board-files") -> list[str]:
        return sorted(k[len(bucket) + 1:] for k in self.objects if k.startswith(f"{bucket}/"))


def install_storage(monkeypatch, fake: FakeStorage) -> FakeStorage:
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        storage.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(fake.handler), **kwargs),
    )
    return fake


@pytest.fixture
def fake_storage(monkeypatch):
    return install_storage(monkeypatch, FakeStorage())


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def use_fake_redis_singleton(monkeypatch, redis_client):
    import core.redis_client as redis_client_module
    monkeypatch.setattr(redis_client_module, "_redis_client", redis_client)
    yield


def make_board(db_session, workspace, creator, name="Board") -> Board:
    board = Board(
        name=name, icon="PenTool", bg_color="bg-gray-500",
        workspace_id=workspace.id, created_by=creator.id,
        last_modified_by=creator.id, last_modified=datetime.utcnow(),
    )
    db_session.add(board)
    db_session.commit()
    db_session.refresh(board)
    return board


def set_role(db_session, workspace, user, role: str) -> None:
    member = db_session.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace.id, WorkspaceMember.user_id == user.id
    ).first()
    member.role = role
    db_session.commit()


def post_file(client, board_id, user, data: bytes, filename="obraz.png", content_type="image/png"):
    return client.post(
        files_url(board_id), headers=auth_headers(user.id), files={"file": (filename, data, content_type)}
    )


def upload_ok(client, board_id, user, data: bytes | None = None) -> str:
    r = post_file(client, board_id, user, data or image_bytes())
    assert r.status_code == 200, r.text
    return r.json()["data"]["file_name"]


class TestUpload:

    def test_401_bez_tokenu(self, client, test_board, fake_storage):
        r = client.post(files_url(test_board.id), files={"file": ("a.png", image_bytes(), "image/png")})
        assert r.status_code == 401
        assert fake_storage.objects == {}

    @pytest.mark.parametrize("fmt,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
    def test_zapisuje_przekodowany_webp_pod_sciezka_tablicy(self, client, test_user, test_board, fake_storage, fmt, mime):
        r = post_file(client, test_board.id, test_user, image_bytes(fmt), content_type=mime)

        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert FILE_NAME_RE.fullmatch(data["file_name"])
        assert data["mime_type"] == "image/webp"
        assert (data["width"], data["height"]) == (120, 80)

        key = f"board-files/{test_board.id}/{data['file_name']}"
        assert list(fake_storage.objects) == [key]
        assert fake_storage.content_types[key] == "image/webp"
        assert data["size"] == len(fake_storage.objects[key])
        stored = Image.open(io.BytesIO(fake_storage.objects[key]))
        assert stored.format == "WEBP"
        assert stored.size == (120, 80)

    def test_odpowiedz_nie_zawiera_publicznego_url(self, client, test_user, test_board, fake_storage):
        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 200
        assert "http" not in json.dumps(r.json()["data"])
        assert "/object/public/" not in r.text

    def test_gif_zapisywana_jest_tylko_pierwsza_klatka(self, client, test_user, test_board, fake_storage):
        r = post_file(client, test_board.id, test_user, animated_gif(), filename="anim.gif", content_type="image/gif")

        assert r.status_code == 200, r.text
        stored = Image.open(io.BytesIO(next(iter(fake_storage.objects.values()))))
        assert stored.format == "WEBP"
        assert getattr(stored, "n_frames", 1) == 1
        red, green, blue = stored.convert("RGB").getpixel((20, 15))
        assert red > 200 and blue < 60

    def test_nazwa_pliku_klienta_jest_ignorowana(self, client, test_user, test_board, fake_storage):
        r = post_file(client, test_board.id, test_user, image_bytes(), filename="../../1/evil<script>.php.png")

        assert r.status_code == 200
        assert FILE_NAME_RE.fullmatch(fake_storage.keys()[0].split("/", 1)[1])
        assert fake_storage.keys()[0].startswith(f"{test_board.id}/")

    def test_duzy_obraz_jest_zmniejszany_do_1600(self, client, test_user, test_board, fake_storage):
        r = post_file(client, test_board.id, test_user, image_bytes("JPEG", size=(4000, 1000)), content_type="image/jpeg")

        assert r.status_code == 200
        assert (r.json()["data"]["width"], r.json()["data"]["height"]) == (1600, 400)

    @pytest.mark.parametrize("fmt", ["PNG", "WEBP", "GIF"])
    def test_obraz_1440_na_1440_miesci_sie_w_budzecie_kazdego_formatu(self, client, test_user, test_board, fake_storage, fmt):
        """Excalidraw zmniejsza wklejany obraz do 1440 px - taki plik nie moze byc odrzucony."""
        r = post_file(client, test_board.id, test_user, image_bytes(fmt, size=(1440, 1440)))

        assert r.status_code == 200, r.text

    def test_za_duze_wymiary_400(self, client, test_user, test_board, fake_storage):
        r = post_file(client, test_board.id, test_user, image_bytes("PNG", size=(4000, 4000)))

        assert r.status_code == 400
        assert r.json()["code"] == "IMAGE_TOO_LARGE"
        assert fake_storage.objects == {}

    def test_editor_moze_wgrac(self, client, db_session, test_user, test_user2, shared_workspace, fake_storage):
        board = make_board(db_session, shared_workspace, test_user)

        r = post_file(client, board.id, test_user2, image_bytes())

        assert r.status_code == 200

    def test_viewer_403_i_nic_nie_trafia_do_storage(self, client, db_session, test_user, test_user2, shared_workspace, fake_storage):
        board = make_board(db_session, shared_workspace, test_user)
        set_role(db_session, shared_workspace, test_user2, "viewer")

        r = post_file(client, board.id, test_user2, image_bytes())

        assert r.status_code == 403
        assert fake_storage.requests == []

    def test_nie_czlonek_404(self, client, test_board, test_user2, fake_storage):
        r = post_file(client, test_board.id, test_user2, image_bytes())

        assert r.status_code == 404
        assert fake_storage.requests == []

    def test_nieistniejaca_tablica_404(self, client, test_user, fake_storage):
        r = post_file(client, 999_999, test_user, image_bytes())

        assert r.status_code == 404

    @pytest.mark.parametrize(
        "data,filename",
        [
            (b"<html><script>alert(1)</script></html>", "a.png"),
            (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "a.svg"),
            (b"\x89PNG\r\n\x1a\n" + b"A" * 100, "a.png"),
            (b"GIF89a" + b"\x00" * 50, "a.gif"),
            (b"BM" + b"\x00" * 100, "a.bmp"),
        ],
    )
    def test_nie_obraz_z_naglowkiem_image_png_400(self, client, test_user, test_board, fake_storage, data, filename):
        """Liczy sie TRESC: naglowek Content-Type czesci multipart ustawia klient."""
        r = post_file(client, test_board.id, test_user, data, filename=filename, content_type="image/png")

        assert r.status_code == 400
        assert r.json()["code"] == "INVALID_FILE_TYPE"
        assert fake_storage.objects == {}

    def test_poprawny_png_z_naglowkiem_text_html_przechodzi(self, client, test_user, test_board, fake_storage):
        r = post_file(client, test_board.id, test_user, image_bytes(), filename="x.html", content_type="text/html")

        assert r.status_code == 200
        assert next(iter(fake_storage.content_types.values())) == "image/webp"

    def test_ponad_5_mb_413(self, client, test_user, test_board, fake_storage):
        too_big = image_bytes() + b"\x00" * (5 * 1024 * 1024)

        r = post_file(client, test_board.id, test_user, too_big)

        assert r.status_code == 413
        assert r.json()["code"] == "FILE_TOO_LARGE"
        assert fake_storage.objects == {}

    def test_brak_pola_file_400(self, client, test_user, test_board, fake_storage):
        r = client.post(
            files_url(test_board.id), headers=auth_headers(test_user.id),
            files={"inne": ("a.png", image_bytes(), "image/png")},
        )

        assert r.status_code == 400
        assert r.json()["code"] == "INVALID_UPLOAD"

    def test_json_zamiast_multipart_400(self, client, test_user, test_board, fake_storage):
        r = client.post(files_url(test_board.id), headers=auth_headers(test_user.id), json={"file": "x"})

        assert r.status_code == 400

    def test_awaria_redis_nie_blokuje_uploadu(self, client, test_user, test_board, fake_storage, monkeypatch, redis_client):
        """Rate limit jest fail-open: tablica na lekcji ma dzialac takze bez Redis."""
        async def broken(*args, **kwargs):
            raise RedisConnectionError("down")

        monkeypatch.setattr(redis_client, "incr", broken)

        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 200, r.text

    def test_rate_limit_429(self, client, test_user, test_board, fake_storage, monkeypatch):
        calls = {"n": 0}
        original = files_module.read_image_upload

        async def counting(request):
            calls["n"] += 1
            return await original(request)

        monkeypatch.setattr(files_module, "read_image_upload", counting)
        statuses = [
            post_file(client, test_board.id, test_user, b"x").status_code
            for _ in range(files_module.UPLOAD_RATE_LIMIT + 1)
        ]

        assert statuses[-1] == 429
        assert 429 not in statuses[:-1]
        assert calls["n"] == files_module.UPLOAD_RATE_LIMIT


class TestBucketCreation:

    @pytest.mark.parametrize("not_found_status", [404, 400])
    def test_brak_bucketu_backend_tworzy_prywatny_i_ponawia(self, client, test_user, test_board, monkeypatch, not_found_status):
        fake = install_storage(monkeypatch, FakeStorage(buckets=(), not_found_status=not_found_status))

        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 200, r.text
        assert len(fake.created_buckets) == 1
        created = fake.created_buckets[0]
        assert created["id"] == "board-files"
        assert created["public"] is False
        assert created["allowed_mime_types"] == ["image/webp"]
        assert len(fake.keys()) == 1

    def test_nie_da_sie_utworzyc_bucketu_503_bez_publicznego_zastepstwa(self, client, test_user, test_board, monkeypatch):
        fake = install_storage(monkeypatch, FakeStorage(buckets=("board-images",), can_create_bucket=False))

        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 503
        assert r.json()["code"] == "STORAGE_NOT_CONFIGURED"
        # Nic nie trafilo do zadnego bucketu - w szczegolnosci do publicznego board-images.
        assert fake.objects == {}
        assert all("board-images" not in req.url.path for req in fake.requests)

    def test_storage_nieskonfigurowany_503(self, client, test_user, test_board, fake_storage, monkeypatch):
        monkeypatch.setattr(storage, "_storage_config", lambda: None)

        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 503
        assert r.json()["code"] == "STORAGE_NOT_CONFIGURED"
        assert fake_storage.requests == []

    def test_blad_storage_502(self, client, test_user, test_board, monkeypatch):
        real_client = httpx.AsyncClient
        monkeypatch.setattr(
            storage.httpx,
            "AsyncClient",
            lambda **kwargs: real_client(transport=httpx.MockTransport(lambda r: httpx.Response(500)), **kwargs),
        )

        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 502
        assert r.json()["code"] == "STORAGE_UPLOAD_FAILED"


class TestDownload:

    def test_czlonek_pobiera_plik_z_bezpiecznymi_naglowkami(self, client, test_user, test_board, fake_storage):
        name = upload_ok(client, test_board.id, test_user)

        r = client.get(f"{files_url(test_board.id)}/{name}", headers=auth_headers(test_user.id))

        assert r.status_code == 200
        assert r.content == fake_storage.objects[f"board-files/{test_board.id}/{name}"]
        assert r.headers["content-type"] == "image/webp"
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["cache-control"].startswith("private")
        assert Image.open(io.BytesIO(r.content)).format == "WEBP"

    def test_viewer_moze_pobrac(self, client, db_session, test_user, test_user2, shared_workspace, fake_storage):
        board = make_board(db_session, shared_workspace, test_user)
        name = upload_ok(client, board.id, test_user)
        set_role(db_session, shared_workspace, test_user2, "viewer")

        r = client.get(f"{files_url(board.id)}/{name}", headers=auth_headers(test_user2.id))

        assert r.status_code == 200

    def test_401_bez_tokenu(self, client, test_user, test_board, fake_storage):
        name = upload_ok(client, test_board.id, test_user)

        r = client.get(f"{files_url(test_board.id)}/{name}")

        assert r.status_code == 401

    def test_nie_czlonek_404(self, client, test_user, test_user2, test_board, fake_storage):
        name = upload_ok(client, test_board.id, test_user)
        before = len(fake_storage.requests)

        r = client.get(f"{files_url(test_board.id)}/{name}", headers=auth_headers(test_user2.id))

        assert r.status_code == 404
        assert len(fake_storage.requests) == before  # Storage nie byl pytany

    def test_plik_cudzej_tablicy_przez_wlasna_tablice_404(
        self, client, db_session, test_user, test_user2, test_board, test_workspace2, fake_storage
    ):
        """Czlonek tablicy B nie dostanie pliku tablicy A, podajac jego nazwe pod swoim board_id."""
        name = upload_ok(client, test_board.id, test_user)
        other_board = make_board(db_session, test_workspace2, test_user2, name="Cudza")

        r = client.get(f"{files_url(other_board.id)}/{name}", headers=auth_headers(test_user2.id))

        assert r.status_code == 404
        assert fake_storage.requests[-1].url.path == f"/storage/v1/object/board-files/{other_board.id}/{name}"

    def test_nieistniejacy_plik_404(self, client, test_user, test_board, fake_storage):
        r = client.get(f"{files_url(test_board.id)}/{'0' * 32}.webp", headers=auth_headers(test_user.id))

        assert r.status_code == 404

    @pytest.mark.parametrize("not_found_status", [404, 400])
    def test_brak_bucketu_404(self, client, test_user, test_board, monkeypatch, not_found_status):
        install_storage(monkeypatch, FakeStorage(buckets=(), not_found_status=not_found_status))

        r = client.get(f"{files_url(test_board.id)}/{'0' * 32}.webp", headers=auth_headers(test_user.id))

        assert r.status_code == 404

    @pytest.mark.parametrize(
        "file_name",
        [
            "abc.webp",
            f"{'A' * 32}.webp",
            f"{'0' * 32}.png",
            f"{'0' * 32}.webp.html",
            f"{'0' * 31}.webp",
            f"..%2F{'0' * 32}.webp",
            f"{'0' * 32}.webp%0A",
            "%2E%2E",
        ],
    )
    def test_zla_nazwa_pliku_404_bez_pytania_storage(self, client, test_user, test_board, fake_storage, file_name):
        r = client.get(f"{files_url(test_board.id)}/{file_name}", headers=auth_headers(test_user.id))

        assert r.status_code in (400, 404)
        assert fake_storage.requests == []

    def test_blad_storage_502(self, client, test_user, test_board, monkeypatch):
        real_client = httpx.AsyncClient
        monkeypatch.setattr(
            storage.httpx,
            "AsyncClient",
            lambda **kwargs: real_client(transport=httpx.MockTransport(lambda r: httpx.Response(500)), **kwargs),
        )

        r = client.get(f"{files_url(test_board.id)}/{'0' * 32}.webp", headers=auth_headers(test_user.id))

        assert r.status_code == 502


class TestDeleteWithBoard:

    @pytest.mark.asyncio
    async def test_usuniecie_tablicy_kasuje_jej_pliki(self, client, db_session, test_user, test_workspace, test_board, fake_storage):
        other = make_board(db_session, test_workspace, test_user, name="Inna")
        upload_ok(client, test_board.id, test_user)
        upload_ok(client, test_board.id, test_user)
        kept = upload_ok(client, other.id, test_user)
        board_id = test_board.id

        await BoardService(db_session).delete_board(board_id, test_user.id)

        assert fake_storage.keys() == [f"{other.id}/{kept}"]

    @pytest.mark.asyncio
    async def test_blad_storage_nie_blokuje_usuniecia_tablicy(self, db_session, test_user, test_board, monkeypatch):
        def handler(request):
            raise httpx.ConnectError("refused", request=request)

        real_client = httpx.AsyncClient
        monkeypatch.setattr(
            storage.httpx,
            "AsyncClient",
            lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
        )
        board_id = test_board.id

        result = await BoardService(db_session).delete_board(board_id, test_user.id)

        assert result["success"] is True
        assert db_session.query(Board).filter(Board.id == board_id).first() is None


class TestLegacyUploadImage:
    """Stary endpoint starego silnika: jedyna zmiana to blokada dla roli viewer."""

    URL = "/api/v1/whiteboard/{board_id}/upload-image"

    def test_viewer_403(self, client, db_session, test_user, test_user2, shared_workspace, fake_storage):
        board = make_board(db_session, shared_workspace, test_user)
        set_role(db_session, shared_workspace, test_user2, "viewer")

        r = client.post(
            self.URL.format(board_id=board.id), headers=auth_headers(test_user2.id),
            files={"file": ("a.png", image_bytes(), "image/png")},
        )

        assert r.status_code == 403
        assert fake_storage.requests == []

    def test_nie_czlonek_nadal_404(self, client, test_board, test_user2, fake_storage):
        r = client.post(
            self.URL.format(board_id=test_board.id), headers=auth_headers(test_user2.id),
            files={"file": ("a.png", image_bytes(), "image/png")},
        )

        assert r.status_code == 404

    def test_editor_nadal_moze(self, client, db_session, test_user, test_user2, shared_workspace, monkeypatch):
        import api.v1.whiteboard.service as service_module

        seen = {}

        async def fake_upload(board_id, file_bytes, content_type):
            seen["args"] = (board_id, len(file_bytes), content_type)
            return "https://example.invalid/obraz.png"

        monkeypatch.setattr(service_module, "upload_board_image", fake_upload)
        board = make_board(db_session, shared_workspace, test_user)

        r = client.post(
            self.URL.format(board_id=board.id), headers=auth_headers(test_user2.id),
            files={"file": ("a.png", image_bytes(), "image/png")},
        )

        assert r.status_code == 200, r.text
        assert seen["args"][0] == board.id
