"""
Testy core/image_sanitizer.py - walidacja po tresci i przekodowanie obrazu (SEC-03).
"""
import io

import pytest
from PIL import Image

from core.exceptions import AppException
from core.image_sanitizer import sanitize_image


def make_image(fmt: str, size=(64, 48), mode="RGB", color=(200, 30, 30), **save_kwargs) -> bytes:
    buf = io.BytesIO()
    Image.new(mode, size, color).save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


def decode(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    img.load()
    return img


class TestAcceptedFormats:

    @pytest.mark.parametrize("fmt", ["JPEG", "PNG", "WEBP"])
    def test_przekodowuje_do_webp(self, fmt):
        result = sanitize_image(make_image(fmt), max_side=512)

        assert result.content_type == "image/webp"
        assert result.extension == "webp"
        out = decode(result.data)
        assert out.format == "WEBP"
        assert out.size == (64, 48)
        assert (result.width, result.height) == (64, 48)

    def test_zmniejsza_do_max_side_z_zachowaniem_proporcji(self):
        result = sanitize_image(make_image("JPEG", size=(2000, 1000)), max_side=512)

        assert (result.width, result.height) == (512, 256)
        assert decode(result.data).size == (512, 256)

    def test_zachowuje_przezroczystosc(self):
        data = make_image("PNG", mode="RGBA", color=(10, 20, 30, 0))
        out = decode(sanitize_image(data, max_side=512).data)

        assert out.mode == "RGBA"
        assert out.getpixel((0, 0))[3] == 0

    def test_paleta_png_jest_obslugiwana(self):
        data = make_image("PNG", mode="P", color=3)
        assert decode(sanitize_image(data, max_side=512).data).format == "WEBP"


class TestMetadataStripping:

    def test_usuwa_exif(self):
        exif = Image.Exif()
        exif[0x010F] = "TajnyAparat"  # Make
        exif[0x8825] = {1: "N", 2: (52.0, 13.0, 0.0)}  # GPS IFD
        data = make_image("JPEG", exif=exif.tobytes())
        assert b"TajnyAparat" in data  # sanity: EXIF naprawde jest w wejsciu

        result = sanitize_image(data, max_side=512)

        assert b"TajnyAparat" not in result.data
        assert len(decode(result.data).getexif()) == 0

    def test_usuwa_doklejony_payload(self):
        """Poliglot: poprawny PNG + HTML/JS doklejony za koncem obrazu."""
        payload = b"<script>alert(document.domain)</script>"
        data = make_image("PNG") + payload

        result = sanitize_image(data, max_side=512)

        assert payload not in result.data
        assert b"<script" not in result.data

    def test_usuwa_komentarz_tekstowy_png(self):
        from PIL.PngImagePlugin import PngInfo
        info = PngInfo()
        info.add_text("Comment", "<?php system($_GET['c']); ?>")
        data = make_image("PNG", pnginfo=info)
        assert b"<?php" in data

        assert b"<?php" not in sanitize_image(data, max_side=512).data

    def test_obraca_wg_orientacji_exif(self):
        exif = Image.Exif()
        exif[0x0112] = 6  # obrot o 90 stopni
        data = make_image("JPEG", size=(80, 40), exif=exif.tobytes())

        result = sanitize_image(data, max_side=512)

        assert (result.width, result.height) == (40, 80)


class TestRejected:

    @pytest.mark.parametrize(
        "data",
        [
            b"",
            b"to nie jest obraz",
            b"<html><body><script>alert(1)</script></body></html>",
            b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            b"MZ\x90\x00" + b"\x00" * 64,  # naglowek EXE
            b"%PDF-1.7\n",
        ],
        ids=["pusty", "tekst", "html", "svg", "exe", "pdf"],
    )
    def test_odrzuca_nie_obrazy(self, data):
        with pytest.raises(AppException) as exc:
            sanitize_image(data, max_side=512)
        assert exc.value.status_code == 400
        assert exc.value.code == "INVALID_FILE_TYPE"

    @pytest.mark.parametrize("fmt", ["GIF", "BMP", "TIFF", "ICO"])
    def test_odrzuca_inne_formaty_obrazow(self, fmt):
        """Prawdziwy obraz, ale spoza allowlisty JPEG/PNG/WEBP."""
        with pytest.raises(AppException) as exc:
            sanitize_image(make_image(fmt), max_side=512)
        assert exc.value.code == "INVALID_FILE_TYPE"

    def test_odrzuca_uciety_plik(self):
        data = make_image("PNG", size=(300, 300))
        with pytest.raises(AppException) as exc:
            sanitize_image(data[: len(data) // 2], max_side=512)
        assert exc.value.code == "INVALID_FILE_TYPE"

    def test_odrzuca_png_z_sama_sygnatura(self):
        """Magic bytes PNG + smieci - sam naglowek nie wystarcza."""
        with pytest.raises(AppException) as exc:
            sanitize_image(b"\x89PNG\r\n\x1a\n" + b"A" * 200, max_side=512)
        assert exc.value.code == "INVALID_FILE_TYPE"

    def test_odrzuca_bombe_dekompresyjna_po_wymiarach(self):
        """Maly plik (kilka KB), ogromne wymiary - odrzucony przed dekodowaniem pikseli."""
        data = make_image("PNG", size=(6000, 6000), mode="L", color=0)
        assert len(data) < 200_000

        with pytest.raises(AppException) as exc:
            sanitize_image(data, max_side=512)  # domyslny limit 25 Mpx < 36 Mpx

        assert exc.value.status_code == 400
        assert exc.value.code == "IMAGE_TOO_LARGE"

    def test_limit_pikseli_jest_konfigurowalny(self):
        data = make_image("PNG", size=(100, 100))
        with pytest.raises(AppException) as exc:
            sanitize_image(data, max_side=512, max_pixels=9_999)
        assert exc.value.code == "IMAGE_TOO_LARGE"
