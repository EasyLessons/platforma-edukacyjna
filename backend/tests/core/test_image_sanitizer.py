"""
Testy core/image_sanitizer.py - walidacja po tresci i przekodowanie obrazu (SEC-03).
"""
import io
import subprocess
import sys
from pathlib import Path

import pytest
from PIL import Image

from core.exceptions import AppException
from core.image_sanitizer import DEFAULT_MAX_DECODE_BYTES, sanitize_image


def make_image(fmt: str, size=(64, 48), mode="RGB", color=(200, 30, 30), **save_kwargs) -> bytes:
    buf = io.BytesIO()
    Image.new(mode, size, color).save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


def make_png_with_text(size, megabytes: int, **image_kwargs) -> bytes:
    """PNG z `megabytes` chunkami zTXt, kazdy 1 MB po dekompresji (w pliku ~1 KB)."""
    from PIL.PngImagePlugin import PngInfo

    info = PngInfo()
    for i in range(megabytes):
        info.add_text(f"k{i}", "A" * (1024 * 1024 - 1), zip=True)
    return make_image("PNG", size=size, pnginfo=info, **image_kwargs)


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

    def test_jpeg_z_segmentem_mpf_jest_przyjmowany(self):
        """
        Regresja: zdjecie z aparatu/telefonu z segmentem MPF Pillow otwiera jako "MPO"
        (mimo formats=JPEG/PNG/WEBP) - bylo odrzucane jako INVALID_FILE_TYPE.
        """
        second = Image.new("RGB", (800, 600), (9, 9, 9))
        data = make_image("MPO", size=(800, 600), save_all=True, append_images=[second])
        assert Image.open(io.BytesIO(data)).format == "MPO"  # sanity

        result = sanitize_image(data, max_side=512)

        assert (result.width, result.height) == (512, 384)
        out = decode(result.data)
        assert out.format == "WEBP"
        assert getattr(out, "n_frames", 1) == 1
        r, g, b = out.convert("RGB").getpixel((10, 10))
        assert r > 150 and g < 80 and b < 80  # pierwsza klatka, nie druga

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

    @pytest.mark.parametrize(
        "fmt,mode,size,save_kwargs",
        [
            ("PNG", "RGBA", (5000, 5000), {}),
            ("WEBP", "RGBA", (5000, 5000), {"lossless": True}),
            ("WEBP", "RGBA", (3000, 3000), {"lossless": True}),
            ("JPEG", "RGB", (5000, 5000), {"progressive": True}),
        ],
        ids=["png-25mpx", "webp-25mpx", "webp-9mpx", "jpeg-progresywny-25mpx"],
    )
    def test_odrzuca_duzy_obraz_w_formacie_bez_skalowania_przy_dekodowaniu(self, fmt, mode, size, save_kwargs):
        """
        Regresja: te pliki (1-300 KB) miescily sie w limicie 25 Mpx, a ich dekodowanie
        w pelnej rozdzielczosci zajmowalo 250-770 MB RAM. Limit 25 Mpx zostaje tylko
        dla JPEG baseline, ktory jest zmniejszany juz przy dekodowaniu.
        """
        data = make_image(fmt, size=size, mode=mode, color=(1, 2, 3, 128)[: len(mode)], **save_kwargs)
        assert len(data) < 500_000

        with pytest.raises(AppException) as exc:
            sanitize_image(data, max_side=512)

        assert exc.value.code == "IMAGE_TOO_LARGE"

    def test_odrzuca_obraz_o_skrajnych_proporcjach(self):
        """1 x 9 000 000 px: malo pikseli, ale bufory filtra skalujacego szly w setki MB."""
        data = make_image("PNG", size=(1, 9_000_000), mode="L", color=0)

        with pytest.raises(AppException) as exc:
            sanitize_image(data, max_side=512)

        assert exc.value.code == "IMAGE_TOO_LARGE"

    def test_budzet_pamieci_jest_konfigurowalny(self):
        data = make_image("PNG", size=(1000, 1000))
        with pytest.raises(AppException) as exc:
            sanitize_image(data, max_side=512, max_decode_bytes=1_000_000)
        assert exc.value.code == "IMAGE_TOO_LARGE"

    def test_odrzuca_png_z_ogromnym_tekstem_po_dekompresji(self):
        """
        Regresja: 63 chunki zTXt po 1 MB (plik ~70 KB) Pillow rozpakowywal do pamieci
        obok pikseli - ponad 60 MB poza budzetem dekodowania.
        """
        data = make_png_with_text(size=(64, 64), megabytes=63)
        assert len(data) < 200_000

        with pytest.raises(AppException) as exc:
            sanitize_image(data, max_side=512)

        assert exc.value.code == "INVALID_FILE_TYPE"

    def test_png_z_tekstem_w_limicie_przechodzi(self):
        data = make_png_with_text(size=(64, 64), megabytes=2)
        assert sanitize_image(data, max_side=512).width == 64

    def test_jpeg_baseline_25_mpx_nadal_przechodzi(self):
        """Zdjecie z telefonu: dekoder JPEG zmniejsza je juz przy dekodowaniu."""
        result = sanitize_image(make_image("JPEG", size=(5000, 5000)), max_side=512)
        assert (result.width, result.height) == (512, 512)

    def test_zrzut_ekranu_4k_png_przechodzi(self):
        result = sanitize_image(make_image("PNG", size=(3840, 2160)), max_side=512)
        assert (result.width, result.height) == (512, 288)

    def test_panoramiczny_jpeg_jest_zmniejszany(self):
        result = sanitize_image(make_image("JPEG", size=(10_000, 600)), max_side=512)
        assert (result.width, result.height) == (512, 31)


# Skrypt uruchamiany w OSOBNYM procesie: szczyt RSS da sie wiarygodnie zmierzyc tylko
# dla calego procesu (Pillow alokuje piksele poza Pythonem - tracemalloc ich nie widzi).
_MEASURE_PEAK_SCRIPT = """
import sys

def peak_rss() -> int:
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class Counters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
                (name, ctypes.c_size_t)
                for name in ("PeakWorkingSetSize", "WorkingSetSize", "a", "b", "c", "d", "e", "f")
            ]

        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        ctypes.windll.kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        ctypes.windll.psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD]
        ctypes.windll.psapi.GetProcessMemoryInfo(
            ctypes.windll.kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb
        )
        return counters.PeakWorkingSetSize
    import resource
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak if sys.platform == "darwin" else peak * 1024

from core.image_sanitizer import sanitize_image

with open(sys.argv[1], "rb") as f:
    data = f.read()
before = peak_rss()
result = sanitize_image(data, max_side=512)
print(peak_rss() - before, result.width, result.height)
"""


class TestMemoryBudget:
    """
    Najwieksze obrazy, jakie sanitizer PRZYJMUJE, nie moga zuzyc wiecej RAM niz budzet -
    backend to jeden proces uvicorn na malej instancji, OOM zrywa wszystkie zadania.
    """

    # Zapas na roznice miedzy systemami i alokatorami; przed poprawka bylo 400-770 MB.
    ALLOWED_PEAK_BYTES = int(DEFAULT_MAX_DECODE_BYTES * 1.4)

    @pytest.mark.parametrize(
        "fmt,mode,size,color,save_kwargs",
        [
            ("PNG", "RGBA", (3238, 3238), (1, 2, 3, 128), {}),
            ("PNG", "P", (3238, 3238), 3, {"transparency": 3}),
            ("WEBP", "RGBA", (2483, 2483), (1, 2, 3, 128), {"lossless": True}),
            ("WEBP", "RGB", (2483, 2483), (1, 2, 3), {}),
            ("JPEG", "RGB", (2840, 2840), (1, 2, 3), {"progressive": True, "subsampling": 0}),
            ("JPEG", "CMYK", (2840, 2840), (1, 2, 3, 4), {"progressive": True}),
            ("JPEG", "RGB", (5000, 5000), (1, 2, 3), {}),
            ("JPEG", "RGB", (10_000, 2500), (1, 2, 3), {}),
        ],
        ids=[
            "png-rgba", "png-paleta-alfa", "webp-lossless", "webp-lossy",
            "jpeg-progresywny", "jpeg-progresywny-cmyk", "jpeg-25mpx", "jpeg-panorama",
        ],
    )
    def test_szczyt_pamieci_miesci_sie_w_budzecie(self, tmp_path, fmt, mode, size, color, save_kwargs):
        self.assert_peak_within_budget(
            tmp_path, make_image(fmt, size=size, mode=mode, color=color, **save_kwargs)
        )

    def test_jpeg_z_mpf_25_mpx_jest_zmniejszany_przy_dekodowaniu(self, tmp_path):
        """MPO to JPEG baseline - ma isc sciezka `draft`, a nie pelnym dekodowaniem."""
        second = Image.new("RGB", (5000, 5000), (9, 9, 9))
        self.assert_peak_within_budget(
            tmp_path, make_image("MPO", size=(5000, 5000), save_all=True, append_images=[second])
        )

    def test_tekst_png_w_limicie_miesci_sie_w_budzecie(self, tmp_path):
        """Najwiekszy PNG + maksymalna dozwolona ilosc tekstu (7 z 8 MB) nadal w budzecie."""
        data = make_png_with_text(size=(3162, 3162), megabytes=7, mode="P", color=3, transparency=3)
        self.assert_peak_within_budget(tmp_path, data)

    def assert_peak_within_budget(self, tmp_path, data: bytes) -> None:
        source = tmp_path / "input.bin"
        source.write_bytes(data)

        proc = subprocess.run(
            [sys.executable, "-c", _MEASURE_PEAK_SCRIPT, str(source)],
            cwd=Path(__file__).resolve().parents[2],
            capture_output=True,
            text=True,
            timeout=120,
        )

        assert proc.returncode == 0, proc.stderr
        peak_growth, width, height = (int(v) for v in proc.stdout.split())
        assert max(width, height) == 512
        assert peak_growth < self.ALLOWED_PEAK_BYTES, f"szczyt +{peak_growth / 1e6:.0f} MB"
