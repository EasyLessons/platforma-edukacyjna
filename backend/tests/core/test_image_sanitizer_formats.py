"""
Testy parametru `formats` w core/image_sanitizer.py (GIF dla obrazow tablicy).
Domyslne zachowanie (awatary: tylko JPEG/PNG/WEBP) ma zostac bez zmian.
"""
import io

import pytest
from PIL import Image

from core.exceptions import AppException
from core.image_sanitizer import ALLOWED_INPUT_FORMATS, sanitize_image

WITH_GIF = ("JPEG", "PNG", "WEBP", "GIF")


def gif_bytes(size=(60, 40), frames=1, transparent=False) -> bytes:
    colors = [(255, 0, 0), (0, 0, 255), (0, 255, 0)]
    images = [Image.new("RGB", size, colors[i % 3]).convert("P") for i in range(frames)]
    buf = io.BytesIO()
    kwargs = {}
    if transparent:
        kwargs["transparency"] = 1
    if frames > 1:
        kwargs.update(save_all=True, append_images=images[1:], duration=80, loop=0)
    images[0].save(buf, format="GIF", **kwargs)
    return buf.getvalue()


class TestDefaultsUnchanged:

    def test_domyslna_lista_to_jpeg_png_webp(self):
        assert ALLOWED_INPUT_FORMATS == ("JPEG", "PNG", "WEBP")

    def test_gif_domyslnie_odrzucony(self):
        with pytest.raises(AppException) as exc:
            sanitize_image(gif_bytes(), max_side=512)

        assert exc.value.code == "INVALID_FILE_TYPE"
        assert exc.value.message == "Plik nie jest poprawnym obrazem JPEG, PNG ani WEBP"


class TestGifAllowed:

    def test_gif_przekodowany_do_webp(self):
        out = sanitize_image(gif_bytes(), max_side=512, formats=WITH_GIF)

        assert out.content_type == "image/webp"
        assert (out.width, out.height) == (60, 40)
        assert Image.open(io.BytesIO(out.data)).format == "WEBP"

    def test_animacja_tylko_pierwsza_klatka(self):
        out = sanitize_image(gif_bytes(frames=3), max_side=512, formats=WITH_GIF)

        stored = Image.open(io.BytesIO(out.data))
        assert getattr(stored, "n_frames", 1) == 1
        red, _green, blue = stored.convert("RGB").getpixel((30, 20))
        assert red > 200 and blue < 60

    def test_przezroczystosc_zachowana(self):
        # Lewa polowa: indeks 0 (czerwony), prawa: indeks 1 oznaczony jako przezroczysty.
        img = Image.new("P", (60, 40), 0)
        img.putpalette([255, 0, 0, 0, 0, 255] + [0] * (254 * 3))
        img.paste(1, (30, 0, 60, 40))
        buf = io.BytesIO()
        img.save(buf, format="GIF", transparency=1)

        out = sanitize_image(buf.getvalue(), max_side=512, formats=WITH_GIF)

        stored = Image.open(io.BytesIO(out.data)).convert("RGBA")
        assert stored.getpixel((10, 20))[3] == 255
        assert stored.getpixel((50, 20))[3] == 0

    def test_gif_zmniejszany(self):
        out = sanitize_image(gif_bytes(size=(1000, 500)), max_side=200, formats=WITH_GIF)

        assert (out.width, out.height) == (200, 100)

    def test_gif_ponad_budzet_pamieci_odrzucony_przed_dekodowaniem(self):
        with pytest.raises(AppException) as exc:
            sanitize_image(gif_bytes(size=(2000, 2000)), max_side=512, formats=WITH_GIF, max_decode_bytes=1024 * 1024)

        assert exc.value.code == "IMAGE_TOO_LARGE"

    def test_uszkodzony_gif_400_z_lista_formatow_w_komunikacie(self):
        with pytest.raises(AppException) as exc:
            sanitize_image(b"GIF89a" + b"\x00" * 40, max_side=512, formats=WITH_GIF)

        assert exc.value.code == "INVALID_FILE_TYPE"
        assert "GIF" in exc.value.message

    def test_bmp_nadal_odrzucony(self):
        buf = io.BytesIO()
        Image.new("RGB", (10, 10)).save(buf, format="BMP")

        with pytest.raises(AppException) as exc:
            sanitize_image(buf.getvalue(), max_side=512, formats=WITH_GIF)

        assert exc.value.code == "INVALID_FILE_TYPE"


class TestFormatsValidation:

    @pytest.mark.parametrize("formats", [("BMP",), ("PNG", "TIFF"), ()])
    def test_nieznany_format_to_blad_programisty(self, formats):
        with pytest.raises(ValueError):
            sanitize_image(b"x", max_side=512, formats=formats)
