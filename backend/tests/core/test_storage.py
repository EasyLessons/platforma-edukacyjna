"""
Testy core/storage.py - zapis/kasowanie w Supabase Storage (httpx podmieniony na MockTransport).
"""
import json
from types import SimpleNamespace

import httpx
import pytest

import core.storage as storage
from core.exceptions import AppException

SUPABASE_URL = "https://proj.supabase.co"
SERVICE_KEY = "service-role-test-key"


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
    """Podmienia httpx.AsyncClient w core.storage na klienta z MockTransport."""
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


class TestUpload:

    @pytest.mark.asyncio
    async def test_wysyla_plik_z_kluczem_service_role_i_typem_z_serwera(self, configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200, json={"Key": "avatars/a.webp"}))

        url = await storage.upload_public_object("avatars", "a.webp", b"DATA", "image/webp")

        assert url == f"{SUPABASE_URL}/storage/v1/object/public/avatars/a.webp"
        assert len(requests) == 1
        req = requests[0]
        assert req.method == "POST"
        assert str(req.url) == f"{SUPABASE_URL}/storage/v1/object/avatars/a.webp"
        assert req.headers["authorization"] == f"Bearer {SERVICE_KEY}"
        assert req.headers["apikey"] == SERVICE_KEY
        assert req.headers["content-type"] == "image/webp"
        assert req.headers["x-upsert"] == "false"
        assert req.content == b"DATA"

    @pytest.mark.asyncio
    async def test_brak_konfiguracji_daje_503(self, not_configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200))

        with pytest.raises(AppException) as exc:
            await storage.upload_public_object("avatars", "a.webp", b"DATA", "image/webp")

        assert exc.value.status_code == 503
        assert exc.value.code == "STORAGE_NOT_CONFIGURED"
        assert requests == []

    @pytest.mark.asyncio
    async def test_blad_storage_daje_502_bez_sekretu_w_komunikacie(self, configured, monkeypatch):
        mock_http(monkeypatch, lambda r: httpx.Response(403, json={"message": "denied"}))

        with pytest.raises(AppException) as exc:
            await storage.upload_public_object("avatars", "a.webp", b"DATA", "image/webp")

        assert exc.value.status_code == 502
        assert exc.value.code == "STORAGE_UPLOAD_FAILED"
        assert SERVICE_KEY not in exc.value.message

    @pytest.mark.asyncio
    async def test_timeout_daje_504(self, configured, monkeypatch):
        def handler(request):
            raise httpx.ReadTimeout("timeout", request=request)

        mock_http(monkeypatch, handler)

        with pytest.raises(AppException) as exc:
            await storage.upload_public_object("avatars", "a.webp", b"DATA", "image/webp")

        assert exc.value.status_code == 504

    @pytest.mark.asyncio
    async def test_blad_polaczenia_daje_502(self, configured, monkeypatch):
        def handler(request):
            raise httpx.ConnectError("refused", request=request)

        mock_http(monkeypatch, handler)

        with pytest.raises(AppException) as exc:
            await storage.upload_public_object("avatars", "a.webp", b"DATA", "image/webp")

        assert exc.value.status_code == 502


class TestDelete:

    @pytest.mark.asyncio
    async def test_kasuje_po_sciezce(self, configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200, json=[]))

        await storage.delete_public_object("avatars", "old.webp")

        assert len(requests) == 1
        assert requests[0].method == "DELETE"
        assert str(requests[0].url) == f"{SUPABASE_URL}/storage/v1/object/avatars"
        assert json.loads(requests[0].content) == {"prefixes": ["old.webp"]}

    @pytest.mark.asyncio
    async def test_bledy_nie_rzucaja_wyjatku(self, configured, monkeypatch):
        def handler(request):
            raise httpx.ConnectError("refused", request=request)

        mock_http(monkeypatch, handler)
        await storage.delete_public_object("avatars", "old.webp")  # brak wyjatku

        mock_http(monkeypatch, lambda r: httpx.Response(500))
        await storage.delete_public_object("avatars", "old.webp")  # brak wyjatku

    @pytest.mark.asyncio
    async def test_brak_konfiguracji_nic_nie_robi(self, not_configured, monkeypatch):
        requests = mock_http(monkeypatch, lambda r: httpx.Response(200))
        await storage.delete_public_object("avatars", "old.webp")
        assert requests == []


class TestObjectPathFromPublicUrl:

    PREFIX = f"{SUPABASE_URL}/storage/v1/object/public/avatars/"

    def test_zwraca_sciezke_dla_naszego_bucketu(self, configured):
        assert storage.object_path_from_public_url("avatars", self.PREFIX + "abc123.webp") == "abc123.webp"
        assert storage.object_path_from_public_url("avatars", self.PREFIX + "7-1700000000.png") == "7-1700000000.png"

    @pytest.mark.parametrize(
        "url",
        [
            None,
            "",
            "https://evil.example.com/storage/v1/object/public/avatars/a.webp",
            f"{SUPABASE_URL}/storage/v1/object/public/board-images/1/a.webp",
            f"{SUPABASE_URL}/storage/v1/object/public/avatars/../board-images/1/a.webp",
            f"{SUPABASE_URL}/storage/v1/object/public/avatars/a.webp?x=1",
            f"{SUPABASE_URL}/storage/v1/object/public/avatars/",
            f"{SUPABASE_URL}/storage/v1/object/public/avatars/a b.webp",
            f"{SUPABASE_URL}/storage/v1/object/public/avatars/%2e%2e/x",
        ],
    )
    def test_odrzuca_obce_i_podejrzane_adresy(self, configured, url):
        assert storage.object_path_from_public_url("avatars", url) is None

    def test_brak_konfiguracji_zwraca_none(self, not_configured):
        assert storage.object_path_from_public_url("avatars", self.PREFIX + "a.webp") is None
