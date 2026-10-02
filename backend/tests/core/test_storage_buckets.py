"""
Testy core/storage.py dla bucketow prywatnych: ensure_bucket, upload z tworzeniem bucketu,
download_object, delete_prefix (httpx podmieniony na MockTransport).

Dokladne kody bledow Supabase Storage roznia sie miedzy wersjami (HTTP 404 albo HTTP 400
z "statusCode": "404"), dlatego kazdy przypadek jest sprawdzany w obu wariantach.
"""
import json
import secrets
from types import SimpleNamespace

import httpx
import pytest

import core.storage as storage
from core.exceptions import AppException
from core.storage import BucketSpec

SUPABASE_URL = "https://proj.supabase.co"
# Wartosc losowa na czas testu - zaden staly literal udajacy klucz.
SERVICE_KEY = secrets.token_hex(16)
SPEC = BucketSpec(file_size_limit=5 * 1024 * 1024, allowed_mime_types=("image/webp",))

BUCKET_NOT_FOUND_RESPONSES = [
    pytest.param(lambda: httpx.Response(404, json={"statusCode": "404", "error": "Bucket not found", "message": "Bucket not found"}), id="http404"),
    pytest.param(lambda: httpx.Response(400, json={"statusCode": "404", "error": "Bucket not found", "message": "Bucket not found"}), id="http400-statusCode404"),
    pytest.param(lambda: httpx.Response(404, text="Bucket not found"), id="http404-text"),
]

ALREADY_EXISTS_RESPONSES = [
    pytest.param(lambda: httpx.Response(409, json={"statusCode": "409", "error": "Duplicate", "message": "The resource already exists"}), id="http409"),
    pytest.param(lambda: httpx.Response(400, json={"statusCode": "409", "error": "Duplicate", "message": "The resource already exists"}), id="http400-statusCode409"),
    pytest.param(lambda: httpx.Response(400, json={"error": "Duplicate", "message": "The resource already exists"}), id="http400-text"),
]


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(
        storage,
        "get_settings",
        lambda: SimpleNamespace(supabase_url=SUPABASE_URL + "/", supabase_service_role_key=SERVICE_KEY),
    )


@pytest.fixture
def not_configured(monkeypatch):
    monkeypatch.setattr(
        storage,
        "get_settings",
        lambda: SimpleNamespace(supabase_url="", supabase_service_role_key=""),
    )


def mock_http(monkeypatch, handler):
    real_client = httpx.AsyncClient
    requests: list[httpx.Request] = []

    def recording_handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return handler(request)

    monkeypatch.setattr(
        storage.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(recording_handler), **kwargs),
    )
    return requests


class TestEnsureBucket:

    @pytest.mark.asyncio
    async def test_tworzy_prywatny_bucket(self, configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200, json={"name": "board-files"}))

        assert await storage.ensure_bucket("board-files", SPEC) is True

        assert len(requests) == 1
        req = requests[0]
        assert req.method == "POST"
        assert str(req.url) == f"{SUPABASE_URL}/storage/v1/bucket"
        assert req.headers["authorization"] == f"Bearer {SERVICE_KEY}"
        assert req.headers["apikey"] == SERVICE_KEY
        assert json.loads(req.content) == {
            "id": "board-files",
            "name": "board-files",
            "public": False,
            "file_size_limit": 5 * 1024 * 1024,
            "allowed_mime_types": ["image/webp"],
        }

    @pytest.mark.parametrize("make_response", ALREADY_EXISTS_RESPONSES)
    @pytest.mark.asyncio
    async def test_juz_istnieje_to_sukces(self, configured, monkeypatch, make_response):
        mock_http(monkeypatch, lambda r: make_response())

        assert await storage.ensure_bucket("board-files", SPEC) is True

    @pytest.mark.parametrize("status", [400, 401, 403, 500])
    @pytest.mark.asyncio
    async def test_inny_blad_to_porazka(self, configured, monkeypatch, status):
        mock_http(monkeypatch, lambda r: httpx.Response(status, json={"message": "nope"}))

        assert await storage.ensure_bucket("board-files", SPEC) is False

    @pytest.mark.asyncio
    async def test_blad_sieci_to_porazka_bez_wyjatku(self, configured, monkeypatch):
        def handler(request):
            raise httpx.ConnectError("refused", request=request)

        mock_http(monkeypatch, handler)

        assert await storage.ensure_bucket("board-files", SPEC) is False

    @pytest.mark.asyncio
    async def test_brak_konfiguracji(self, not_configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200))

        assert await storage.ensure_bucket("board-files", SPEC) is False
        assert requests == []


class TestUploadObjectWithBucketCreation:

    @pytest.mark.parametrize("make_not_found", BUCKET_NOT_FOUND_RESPONSES)
    @pytest.mark.asyncio
    async def test_bucket_not_found_tworzy_bucket_i_ponawia_raz(self, configured, monkeypatch, make_not_found):
        state = {"bucket": False}

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/storage/v1/bucket":
                state["bucket"] = True
                return httpx.Response(200, json={"name": "board-files"})
            if not state["bucket"]:
                return make_not_found()
            return httpx.Response(200, json={"Key": "board-files/1/a.webp"})

        requests = mock_http(monkeypatch, handler)

        await storage.upload_object("board-files", "1/a.webp", b"DATA", "image/webp", create_bucket=SPEC)

        assert [r.url.path for r in requests] == [
            "/storage/v1/object/board-files/1/a.webp",
            "/storage/v1/bucket",
            "/storage/v1/object/board-files/1/a.webp",
        ]
        assert requests[2].content == b"DATA"

    @pytest.mark.asyncio
    async def test_nie_da_sie_utworzyc_bucketu_daje_503(self, configured, monkeypatch):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/storage/v1/bucket":
                return httpx.Response(403, json={"message": "new row violates row-level security policy"})
            return httpx.Response(404, json={"statusCode": "404", "error": "Bucket not found"})

        requests = mock_http(monkeypatch, handler)

        with pytest.raises(AppException) as exc:
            await storage.upload_object("board-files", "1/a.webp", b"DATA", "image/webp", create_bucket=SPEC)

        assert exc.value.status_code == 503
        assert exc.value.code == "STORAGE_NOT_CONFIGURED"
        assert SERVICE_KEY not in exc.value.message
        # Zadnej trzeciej proby i zadnego innego bucketu.
        assert [r.url.path for r in requests] == [
            "/storage/v1/object/board-files/1/a.webp",
            "/storage/v1/bucket",
        ]

    @pytest.mark.asyncio
    async def test_bucket_utworzony_ale_nadal_niewidoczny_daje_503(self, configured, monkeypatch):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/storage/v1/bucket":
                return httpx.Response(200, json={"name": "board-files"})
            return httpx.Response(400, json={"statusCode": "404", "error": "Bucket not found"})

        requests = mock_http(monkeypatch, handler)

        with pytest.raises(AppException) as exc:
            await storage.upload_object("board-files", "1/a.webp", b"DATA", "image/webp", create_bucket=SPEC)

        assert exc.value.code == "STORAGE_NOT_CONFIGURED"
        assert len(requests) == 3

    @pytest.mark.asyncio
    async def test_bez_create_bucket_brak_bucketu_to_zwykly_blad_502(self, configured, monkeypatch):
        """Awatary (upload_public_object) nie tworza bucketu - zachowanie bez zmian."""
        requests = mock_http(
            monkeypatch, lambda r: httpx.Response(404, json={"statusCode": "404", "error": "Bucket not found"})
        )

        with pytest.raises(AppException) as exc:
            await storage.upload_public_object("avatars", "a.webp", b"DATA", "image/webp")

        assert exc.value.status_code == 502
        assert exc.value.code == "STORAGE_UPLOAD_FAILED"
        assert len(requests) == 1

    @pytest.mark.asyncio
    async def test_inny_blad_400_nie_tworzy_bucketu(self, configured, monkeypatch):
        """Np. obiekt przekracza limit bucketu - to nie jest "Bucket not found"."""
        requests = mock_http(
            monkeypatch,
            lambda r: httpx.Response(400, json={"statusCode": "413", "error": "Payload too large"}),
        )

        with pytest.raises(AppException) as exc:
            await storage.upload_object("board-files", "1/a.webp", b"DATA", "image/webp", create_bucket=SPEC)

        assert exc.value.status_code == 502
        assert len(requests) == 1


class TestDownload:

    @pytest.mark.asyncio
    async def test_pobiera_kluczem_service_role(self, configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200, content=b"WEBP-BYTES"))

        data = await storage.download_object("board-files", "7/abc.webp")

        assert data == b"WEBP-BYTES"
        req = requests[0]
        assert req.method == "GET"
        assert str(req.url) == f"{SUPABASE_URL}/storage/v1/object/board-files/7/abc.webp"
        assert req.headers["authorization"] == f"Bearer {SERVICE_KEY}"

    @pytest.mark.parametrize(
        "make_response",
        [
            pytest.param(lambda: httpx.Response(404, json={"statusCode": "404", "error": "not_found", "message": "Object not found"}), id="http404"),
            pytest.param(lambda: httpx.Response(400, json={"statusCode": "404", "error": "not_found", "message": "Object not found"}), id="http400-statusCode404"),
            pytest.param(lambda: httpx.Response(400, json={"error": "Bucket not found"}), id="brak-bucketu"),
        ],
    )
    @pytest.mark.asyncio
    async def test_brak_obiektu_daje_none(self, configured, monkeypatch, make_response):
        mock_http(monkeypatch, lambda r: make_response())

        assert await storage.download_object("board-files", "7/abc.webp") is None

    @pytest.mark.asyncio
    async def test_blad_storage_daje_502(self, configured, monkeypatch):
        mock_http(monkeypatch, lambda r: httpx.Response(500, text="boom"))

        with pytest.raises(AppException) as exc:
            await storage.download_object("board-files", "7/abc.webp")

        assert exc.value.status_code == 502
        assert exc.value.code == "STORAGE_DOWNLOAD_FAILED"

    @pytest.mark.asyncio
    async def test_timeout_daje_504(self, configured, monkeypatch):
        def handler(request):
            raise httpx.ReadTimeout("timeout", request=request)

        mock_http(monkeypatch, handler)

        with pytest.raises(AppException) as exc:
            await storage.download_object("board-files", "7/abc.webp")

        assert exc.value.status_code == 504

    @pytest.mark.asyncio
    async def test_brak_konfiguracji_daje_503(self, not_configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200))

        with pytest.raises(AppException) as exc:
            await storage.download_object("board-files", "7/abc.webp")

        assert exc.value.code == "STORAGE_NOT_CONFIGURED"
        assert requests == []


class FakeBucket:
    """Atrapa listowania/kasowania jednego bucketu."""

    def __init__(self, names: list[str]):
        self.names = list(names)
        self.list_bodies: list[dict] = []
        self.delete_bodies: list[dict] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if request.method == "POST" and "/object/list/" in request.url.path:
            self.list_bodies.append(body)
            page = self.names[body.get("offset", 0):][: body.get("limit", 100)]
            return httpx.Response(200, json=[{"name": n, "id": f"id-{n}"} for n in page])
        if request.method == "DELETE":
            self.delete_bodies.append(body)
            gone = {p.split("/", 1)[1] for p in body["prefixes"]}
            self.names = [n for n in self.names if n not in gone]
            return httpx.Response(200, json=[])
        return httpx.Response(500)


class TestDeletePrefix:

    @pytest.mark.asyncio
    async def test_kasuje_wszystko_strona_po_stronie(self, configured, monkeypatch):
        monkeypatch.setattr(storage, "LIST_PAGE_SIZE", 3)
        bucket = FakeBucket([f"f{i}.webp" for i in range(8)])
        mock_http(monkeypatch, bucket.handler)

        deleted = await storage.delete_prefix("board-files", "12/")

        assert deleted == 8
        assert bucket.names == []
        assert all(b == {"prefix": "12/", "limit": 3, "offset": 0} for b in bucket.list_bodies)
        assert [len(b["prefixes"]) for b in bucket.delete_bodies] == [3, 3, 2]
        assert bucket.delete_bodies[0]["prefixes"][0] == "12/f0.webp"

    @pytest.mark.asyncio
    async def test_prosi_o_strone_1000(self, configured, monkeypatch):
        bucket = FakeBucket(["a.webp"])
        mock_http(monkeypatch, bucket.handler)

        await storage.delete_prefix("board-files", "12/")

        assert bucket.list_bodies[0]["limit"] == 1000

    @pytest.mark.asyncio
    async def test_pusty_folder_bez_kasowania(self, configured, monkeypatch):
        bucket = FakeBucket([])
        mock_http(monkeypatch, bucket.handler)

        assert await storage.delete_prefix("board-files", "12/") == 0
        assert bucket.delete_bodies == []

    @pytest.mark.asyncio
    async def test_nieudane_kasowanie_nie_zapetla(self, configured, monkeypatch):
        calls = {"list": 0, "delete": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "DELETE":
                calls["delete"] += 1
                return httpx.Response(500)
            calls["list"] += 1
            return httpx.Response(200, json=[{"name": "a.webp", "id": "1"}])

        mock_http(monkeypatch, handler)

        assert await storage.delete_prefix("board-files", "12/") == 0
        assert calls == {"list": 1, "delete": 1}

    @pytest.mark.asyncio
    async def test_limit_stron_gdy_storage_udaje_ze_kasuje(self, configured, monkeypatch):
        monkeypatch.setattr(storage, "LIST_PAGE_SIZE", 1)
        monkeypatch.setattr(storage, "DELETE_PREFIX_MAX_PAGES", 5)
        calls = {"list": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "DELETE":
                return httpx.Response(200, json=[])
            calls["list"] += 1
            return httpx.Response(200, json=[{"name": "wieczny.webp", "id": "1"}])

        mock_http(monkeypatch, handler)

        await storage.delete_prefix("board-files", "12/")

        assert calls["list"] == 5

    @pytest.mark.asyncio
    async def test_pomija_podfoldery_i_niebezpieczne_nazwy(self, configured, monkeypatch):
        deletes: list[dict] = []

        def handler(request: httpx.Request) -> httpx.Response:
            if request.method == "DELETE":
                deletes.append(json.loads(request.content))
                return httpx.Response(200, json=[])
            return httpx.Response(
                200,
                json=[
                    {"name": "ok.webp", "id": "1"},
                    {"name": "podfolder", "id": None},
                    {"name": "../../avatars/x.webp", "id": "2"},
                    "smiec",
                ],
            )

        mock_http(monkeypatch, handler)

        await storage.delete_prefix("board-files", "12/")

        assert deletes == [{"prefixes": ["12/ok.webp"]}]

    @pytest.mark.asyncio
    async def test_bledy_nie_rzucaja_wyjatku(self, configured, monkeypatch):
        def handler(request):
            raise httpx.ConnectError("refused", request=request)

        mock_http(monkeypatch, handler)
        assert await storage.delete_prefix("board-files", "12/") == 0

        mock_http(monkeypatch, lambda r: httpx.Response(404, json={"error": "Bucket not found"}))
        assert await storage.delete_prefix("board-files", "12/") == 0

    @pytest.mark.asyncio
    async def test_brak_konfiguracji_nic_nie_robi(self, not_configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200, json=[]))

        assert await storage.delete_prefix("board-files", "12/") == 0
        assert requests == []
