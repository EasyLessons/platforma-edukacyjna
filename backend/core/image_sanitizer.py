"""
Walidacja i przekodowanie obrazow wgrywanych przez uzytkownikow (Pillow).

Dlaczego przekodowanie, a nie samo sprawdzenie naglowka (SEC-03):
  * typ rozpoznajemy po TRESCI (dekoder Pillow), nie po Content-Type ani rozszerzeniu -
    oba ustawia klient;
  * wynik to nowy plik zbudowany z samych pikseli: znika EXIF (m.in. GPS), profil ICC,
    komentarze i wszystko, co ktos dokleil do pliku (poliglot obraz+HTML/JS);
  * wymiary sa ograniczone, wiec do Storage nie trafi nic duzego.

Dozwolone wejscie: JPEG (takze z segmentem MPF - "MPO"), PNG, WEBP. SVG, GIF, HTML i reszta sa odrzucane, bo Pillow
dostaje jawna liste dekoderow (`formats=`).

Pamiec ("decompression bomb"): plik 1 KB potrafi opisywac dziesiatki megapikseli.
Wymiary znamy z naglowka PRZED dekodowaniem i odrzucamy za duze, a limit zalezy od tego,
czy dekoder umie zmniejszac obraz juz przy dekodowaniu:
  * JPEG sekwencyjny Huffmana (SOF0/SOF1) z JEDNYM skanem - tak (`draft`, skalowanie
    DCT), wiec dopuszczamy zdjecia z telefonu do 25 Mpx; do pamieci trafia klatka
    zmniejszona, nie pelna;
  * PNG, WEBP i kazdy inny JPEG (progresywny, arytmetyczny, wieloskanowy) - nie: cala
    klatka laduje w RAM razem z buforami dekodera i kopia robiona przy skalowaniu. Tu
    limit pikseli wynika z budzetu pamieci (`max_decode_bytes`) podzielonego przez
    zmierzony koszt piksela w danym formacie.
Ktory to JPEG, rozstrzyga `_jpeg_decodes_scaled` po markerach pliku - flaga `progressive`
z Pillow nie wystarcza: JPEG baseline z komponentami w osobnych skanach libjpeg tez
dekoduje przez pelne bufory wspolczynnikow (5000x5000 CMYK, plik 391 KB: +207 MB).
Szczytu pamieci jednego wywolania pilnuje test
tests/core/test_image_sanitizer.py::TestMemoryBudget.
"""
import io
import re
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps, PngImagePlugin, UnidentifiedImageError

from core.exceptions import AppException

ALLOWED_INPUT_FORMATS = ("JPEG", "PNG", "WEBP")
# JPEG z segmentem MPF (zdjecia prosto z aparatu/telefonu: podglad, mapa glebi) dekoder
# JPEG Pillow zglasza jako "MPO". To zwykly JPEG - dekodujemy tylko pierwsza klatke.
_FORMAT_ALIASES = {"MPO": "JPEG"}

# JPEG jednoskanowy SOF0/SOF1 (dekodowany od razu w zmniejszeniu): zdjecia z telefonow
# maja 12-24 Mpx.
DEFAULT_MAX_PIXELS = 25_000_000
# Budzet RAM na jedno dekodowanie w pelnej rozdzielczosci (PNG, WEBP, pozostale JPEG-i).
DEFAULT_MAX_DECODE_BYTES = 100 * 1024 * 1024
# Szczytowy koszt piksela (bajty) przy takim dekodowaniu - zmierzony na Pillow 12.3
# (peak RSS procesu, najgorszy tryb formatu): PNG z paleta i przezroczystoscia,
# WEBP (dekoder trzyma kilka kopii klatki), JPEG progresywny CMYK (bufory wspolczynnikow).
# Daje to ok. 10 Mpx dla PNG (zrzut ekranu 4K sie miesci), 8 Mpx dla JPEG progresywnego
# lub wieloskanowego (ten sam koszt: bufory wspolczynnikow) i ok. 6 Mpx dla WEBP.
_FULL_DECODE_BYTES_PER_PIXEL = {"PNG": 10, "WEBP": 17, "JPEG": 13}
# Chunki tekstowe PNG (tEXt/zTXt/iTXt) Pillow rozpakowuje do pamieci OBOK pikseli, domyslnie
# do 64 MB - plik 77 KB podnosil szczyt o ponad 60 MB ponad budzet. Tekst i tak wyrzucamy,
# wiec 8 MB to duzy zapas (zwykle to kilka KB XMP); plik z wiekszym tekstem jest odrzucany.
# Ustawienie globalne Pillow - sanitizer jest jedynym miejscem w backendzie, ktore go uzywa.
MAX_PNG_TEXT_BYTES = 8 * 1024 * 1024
PngImagePlugin.MAX_TEXT_MEMORY = min(PngImagePlugin.MAX_TEXT_MEMORY, MAX_PNG_TEXT_BYTES)
# Limit boku: obrazy typu 1 x 8 000 000 rozsadzaja bufory filtra skalujacego.
DEFAULT_MAX_INPUT_SIDE = 10_000

OUTPUT_FORMAT = "WEBP"
OUTPUT_CONTENT_TYPE = "image/webp"
OUTPUT_EXTENSION = "webp"
OUTPUT_QUALITY = 85

# Tryby, ktore Pillow skaluje poprawnie bez wczesniejszej konwersji (paleta "P" i "1"
# bylyby skalowane metoda NEAREST, tryby 16/32-bit i CMYK nie maja zapisu do WEBP).
_RESIZABLE_MODES = ("L", "LA", "RGB", "RGBA")


@dataclass(frozen=True)
class SanitizedImage:
    data: bytes
    content_type: str
    extension: str
    width: int
    height: int


def _invalid_image() -> AppException:
    return AppException(
        "Plik nie jest poprawnym obrazem JPEG, PNG ani WEBP",
        code="INVALID_FILE_TYPE",
        status_code=400,
    )


def _image_too_large() -> AppException:
    return AppException("Obraz ma zbyt duże wymiary", code="IMAGE_TOO_LARGE", status_code=400)


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info


def _thumbnail_size(width: int, height: int, max_side: int) -> tuple[int, int]:
    scale = min(1.0, max_side / max(width, height))
    return max(1, round(width * scale)), max(1, round(height * scale))


# --- Markery JPEG (ITU T.81, tabela B.1) ---
_JPEG_SOI = 0xD8
_JPEG_EOI = 0xD9
_JPEG_SOS = 0xDA
# SOFn: 0xC0-0xCF bez DHT (C4), JPG (C8) i DAC (CC).
_JPEG_SOF_MARKERS = frozenset(range(0xC0, 0xD0)) - {0xC4, 0xC8, 0xCC}
# Sekwencyjne kodowanie Huffmana: baseline (SOF0) i extended (SOF1).
_JPEG_SEQUENTIAL_HUFFMAN_SOF = frozenset({0xC0, 0xC1})
# Zwykle zdjecie ma kilkanascie segmentow przed skanem (ICC w kawalkach: do ~260).
_JPEG_MAX_HEADER_SEGMENTS = 1024
_JPEG_NOT_FILL = re.compile(rb"[^\xff]")
# Koniec danych skanu: 0xFF, po ktorym NIE ma 0x00 (stuffing), RSTn ani kolejnego 0xFF.
_JPEG_SCAN_END = re.compile(rb"\xff[^\x00\xd0-\xd7\xff]")


def _jpeg_decodes_scaled(data: bytes) -> bool:
    """
    Czy libjpeg zdekoduje ten JPEG jednym przebiegiem, bez buforow wspolczynnikow calej
    klatki - tylko wtedy `draft` naprawde ogranicza pamiec.

    Tak jest wylacznie dla SOF0/SOF1 (Huffman, 8 bitow) z jednym skanem obejmujacym
    wszystkie komponenty. Progresywny, arytmetyczny, bezstratny i baseline rozbity na
    kilka skanow ida przez pelne bufory. Wszystko, czego parser nie rozumie (uciety
    naglowek, zla dlugosc segmentu, smieci miedzy segmentami), daje False - plik trafia
    wtedy pod ostrzejszy limit pelnego dekodowania, a o poprawnosci rozstrzyga Pillow.

    Parser nie czyta poza `data` i w kazdym obrocie petli przesuwa sie do przodu.
    """
    size = len(data)
    if data[:2] != bytes((0xFF, _JPEG_SOI)):
        return False

    pos = 2
    frame_components = None
    for _ in range(_JPEG_MAX_HEADER_SEGMENTS):
        if pos >= size or data[pos] != 0xFF:
            return False
        # Marker moze byc poprzedzony dowolna liczba bajtow wypelnienia 0xFF.
        marker_at = _JPEG_NOT_FILL.search(data, pos)
        if marker_at is None:
            return False
        marker = data[marker_at.start()]
        pos = marker_at.start() + 1

        if marker == 0x01 or 0xD0 <= marker <= 0xD7:
            continue  # TEM i RSTn nie maja pola dlugosci
        if marker in (0x00, _JPEG_SOI, _JPEG_EOI):
            return False  # to nie segment naglowka: stuffing, drugi SOI, koniec bez skanu

        if pos + 2 > size:
            return False
        length = int.from_bytes(data[pos:pos + 2], "big")  # liczona razem z 2 bajtami pola
        if length < 2 or pos + length > size:
            return False

        if marker in _JPEG_SOF_MARKERS:
            # SOF: Lf(2) P(1) Y(2) X(2) Nf(1) + 3 bajty na komponent.
            if frame_components is not None or marker not in _JPEG_SEQUENTIAL_HUFFMAN_SOF:
                return False
            if length < 8 or data[pos + 2] != 8:
                return False
            frame_components = data[pos + 7]
            if frame_components < 1 or length != 8 + 3 * frame_components:
                return False
        elif marker == _JPEG_SOS:
            # SOS: Ls(2) Ns(1) ... - skan z czescia komponentow = plik wieloskanowy.
            if frame_components is None or length < 3 or data[pos + 2] != frame_components:
                return False
            # Po danych jedynego skanu ma byc EOI (albo koniec ucietego pliku - wtedy
            # dekoder i tak zglosi blad); kolejny SOS/DHT/cokolwiek = nie ryzykujemy.
            scan_end = _JPEG_SCAN_END.search(data, pos + length)
            return scan_end is None or data[scan_end.start() + 1] == _JPEG_EOI

        pos += length

    return False


def _decode_downscaled(img: Image.Image, max_side: int, scaled_decode: bool) -> Image.Image:
    """
    Dekoduje `img` i zwraca obraz RGB/RGBA nie wiekszy niz max_side x max_side.
    Kolejnosc ma znaczenie dla pamieci: NAJPIERW zmniejszamy, dopiero potem obracamy
    i konwertujemy - te kroki nie robia juz kopii w pelnej rozdzielczosci.
    """
    if scaled_decode:
        # Rozmiar liczymy z zachowaniem proporcji: przy kwadratowym zadaniu waski,
        # panoramiczny JPEG nie zostalby zmniejszony przy dekodowaniu wcale.
        target = _thumbnail_size(img.width, img.height, max_side)
        img.draft("RGB", (target[0] * 2, target[1] * 2))

    img.load()  # tu naprawde dekodujemy; uciety/uszkodzony plik rzuci wyjatek

    if img.mode not in _RESIZABLE_MODES:
        img = img.convert("RGBA" if _has_alpha(img) else "RGB")

    img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    # Obrot wg EXIF zanim wyrzucimy EXIF (zdjecia z telefonu lezalyby na boku).
    ImageOps.exif_transpose(img, in_place=True)

    target_mode = "RGBA" if _has_alpha(img) else "RGB"
    return img if img.mode == target_mode else img.convert(target_mode)


def sanitize_image(
    data: bytes,
    *,
    max_side: int,
    max_pixels: int = DEFAULT_MAX_PIXELS,
    max_decode_bytes: int = DEFAULT_MAX_DECODE_BYTES,
    max_input_side: int = DEFAULT_MAX_INPUT_SIDE,
) -> SanitizedImage:
    """
    Dekoduje `data` (tylko JPEG/PNG/WEBP), zmniejsza do `max_side` x `max_side`
    (z zachowaniem proporcji) i zapisuje od nowa jako WEBP bez metadanych.

    `max_pixels` to limit ogolny (w praktyce: jednoskanowy JPEG baseline); obrazy dekodowane w pelnej
    rozdzielczosci ogranicza dodatkowo budzet pamieci `max_decode_bytes` (opis modulu).

    Funkcja jest synchroniczna i obciaza CPU - z kodu async wolaj przez
    `run_in_threadpool`. Rzuca AppException 400 (INVALID_FILE_TYPE / IMAGE_TOO_LARGE).
    """
    if not data:
        raise _invalid_image()

    try:
        with warnings.catch_warnings():
            # DecompressionBombWarning (> MAX_IMAGE_PIXELS Pillow) traktujemy jak blad.
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=ALLOWED_INPUT_FORMATS) as img:
                # Image.open czyta tylko naglowek - wymiary znamy PRZED dekodowaniem pikseli.
                width, height = img.size
                fmt = _FORMAT_ALIASES.get(img.format, img.format)
                scaled_decode = (
                    fmt == "JPEG" and not img.info.get("progressive") and _jpeg_decodes_scaled(data)
                )
                pixel_limit = max_pixels
                if not scaled_decode:
                    per_pixel = _FULL_DECODE_BYTES_PER_PIXEL[fmt]
                    pixel_limit = min(max_pixels, max_decode_bytes // per_pixel)
                if (
                    width < 1
                    or height < 1
                    or max(width, height) > max_input_side
                    or width * height > pixel_limit
                ):
                    raise _image_too_large()

                clean = _decode_downscaled(img, max_side, scaled_decode)
    except AppException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise _invalid_image()
    except Exception:
        # Pillow rzuca rozne wyjatki dla uszkodzonych plikow (OSError, SyntaxError,
        # ValueError, struct.error...) - dla klienta to zawsze "niepoprawny obraz".
        raise _invalid_image()

    # Zadnych metadanych z oryginalu (EXIF, ICC, XMP, komentarze) w pliku wynikowym.
    clean.info.clear()

    out = io.BytesIO()
    clean.save(out, format=OUTPUT_FORMAT, quality=OUTPUT_QUALITY, method=4)
    return SanitizedImage(
        data=out.getvalue(),
        content_type=OUTPUT_CONTENT_TYPE,
        extension=OUTPUT_EXTENSION,
        width=clean.width,
        height=clean.height,
    )
