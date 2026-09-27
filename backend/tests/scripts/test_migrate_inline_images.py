"""
Testy logiki migracji obrazów inline (scripts/migrate_inline_images.py).
Bez bazy i bez Storage: upload podstawiony, snapshoty budowane w pycrdt.
pycrdt jest tylko w scripts/requirements-scripts.txt, więc w CI te testy są pomijane.
"""
import base64

import pytest

pytest.importorskip("pycrdt")

from pycrdt import Doc, Map  # noqa: E402

from scripts.migrate_inline_images import migrate_snapshot  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"p" * 5000
JPEG = b"\xff\xd8\xff\xe0" + b"j" * 5000


def data_url(mime: str, payload: bytes) -> str:
    return f"data:{mime};base64,{base64.b64encode(payload).decode('ascii')}"


def make_snapshot(elements: dict[str, dict]) -> bytes:
    doc = Doc()
    root = doc.get("elements", type=Map)
    with doc.transaction():
        for element_id, fields in elements.items():
            root[element_id] = Map(fields)
    return doc.get_update()


def read_elements(snapshot: bytes) -> dict[str, dict]:
    doc = Doc()
    doc.apply_update(snapshot)
    return doc.get("elements", type=Map).to_py()


class FakeUpload:
    def __init__(self):
        self.calls: list[tuple[int, str, str]] = []

    async def __call__(self, board_id: int, data: bytes, content_type: str, object_name: str) -> str:
        self.calls.append((board_id, content_type, object_name))
        return f"https://storage.test/{board_id}/{object_name}"


@pytest.mark.asyncio
async def test_podmienia_inline_obrazy_i_zmniejsza_snapshot():
    snapshot = make_snapshot({
        "a": {"type": "image", "x": 1, "src": data_url("image/png", PNG)},
        "b": {"type": "image", "x": 2, "src": data_url("image/jpeg", JPEG)},
        "c": {"type": "image", "x": 3, "src": "https://juz.url/obraz.png"},
        "d": {"type": "shape", "x": 4},
    })
    upload = FakeUpload()

    new_snapshot, report = await migrate_snapshot(7, snapshot, upload)
    elements = read_elements(new_snapshot)

    assert report.replaced == 2
    assert report.uploaded == 2
    assert len(new_snapshot) < len(snapshot) / 2  # stare base64 usunięte przez GC, nie tylko oznaczone
    assert elements["a"]["src"].startswith("https://storage.test/7/")
    assert elements["b"]["src"].startswith("https://storage.test/7/")
    assert elements["c"]["src"] == "https://juz.url/obraz.png"
    assert elements["d"] == {"type": "shape", "x": 4}
    assert elements["a"]["x"] == 1 and elements["a"]["type"] == "image"
    assert {c[1] for c in upload.calls} == {"image/png", "image/jpeg"}


@pytest.mark.asyncio
async def test_ten_sam_obraz_w_wielu_elementach_wgrywany_raz():
    snapshot = make_snapshot({
        "a": {"type": "image", "src": data_url("image/png", PNG)},
        "b": {"type": "image", "src": data_url("image/png", PNG)},
    })
    upload = FakeUpload()

    new_snapshot, report = await migrate_snapshot(7, snapshot, upload)
    elements = read_elements(new_snapshot)

    assert report.uploaded == 1
    assert report.replaced == 2
    assert len(upload.calls) == 1
    assert elements["a"]["src"] == elements["b"]["src"]


@pytest.mark.asyncio
async def test_nieobslugiwane_typy_zostaja_inline_i_trafiaja_do_raportu():
    pdf_src = data_url("application/pdf", b"%PDF-1.4 fake")
    gif_src = data_url("image/gif", b"GIF89a fake")
    snapshot = make_snapshot({
        "p": {"type": "pdf", "src": pdf_src},
        "g": {"type": "image", "src": gif_src},
    })
    upload = FakeUpload()

    new_snapshot, report = await migrate_snapshot(7, snapshot, upload)

    assert upload.calls == []
    assert report.replaced == 0
    assert report.skipped == {"application/pdf": 1, "image/gif": 1}
    assert new_snapshot == snapshot
    assert read_elements(new_snapshot)["p"]["src"] == pdf_src


@pytest.mark.asyncio
async def test_ponowne_uruchomienie_nic_nie_zmienia():
    snapshot = make_snapshot({"a": {"type": "image", "src": data_url("image/png", PNG)}})
    first, _ = await migrate_snapshot(7, snapshot, FakeUpload())

    upload = FakeUpload()
    second, report = await migrate_snapshot(7, first, upload)

    assert upload.calls == []
    assert report.replaced == 0
    assert second == first


@pytest.mark.asyncio
async def test_image_jpg_traktowany_jak_jpeg():
    snapshot = make_snapshot({"a": {"type": "image", "src": data_url("image/jpg", JPEG)}})
    upload = FakeUpload()

    await migrate_snapshot(7, snapshot, upload)

    assert upload.calls[0][1] == "image/jpeg"


@pytest.mark.asyncio
async def test_niepoprawny_base64_zostaje_bez_zmian():
    snapshot = make_snapshot({"a": {"type": "image", "src": "data:image/png;base64,@@nie-base64@@"}})
    upload = FakeUpload()

    new_snapshot, report = await migrate_snapshot(7, snapshot, upload)

    assert upload.calls == []
    assert report.skipped == {"niepoprawny base64": 1}
    assert new_snapshot == snapshot