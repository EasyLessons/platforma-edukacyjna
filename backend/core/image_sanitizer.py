"""
Walidacja i przekodowanie obrazow wgrywanych przez uzytkownikow (Pillow).

Dlaczego przekodowanie, a nie samo sprawdzenie naglowka (SEC-03):
  * typ rozpoznajemy po TRESCI (dekoder Pillow), nie po Content-Type ani rozszerzeniu -
    oba ustawia klient;
  * wynik to nowy plik zbudowany z samych pikseli: znika EXIF (m.in. GPS), profil ICC,
    komentarze i wszystko, co ktos dokleil do pliku (poliglot obraz+HTML/JS);
  * wymiary sa ograniczone, wiec do Storage nie trafi nic duzego.

Dozwolone wejscie: JPEG, PNG, WEBP. SVG, GIF, HTML i reszta sa odrzucane, bo Pillow
dostaje jawna liste dekoderow (`formats=`).

Pamiec ("decompression bomb"): plik 1 KB potrafi opisywac dziesiatki megapikseli.
Wymiary znamy z naglowka PRZED dekodowaniem i odrzucamy za duze, a limit zalezy od tego,
czy dekoder umie zmniejszac obraz juz przy dekodowaniu:
  * JPEG baseline - tak (`draft`, skalowanie DCT), wiec dopuszczamy zdjecia z telefonu
    do 25 Mpx; do pamieci trafia klatka zmniejszona, nie pelna;
  * PNG, WEBP i JPEG progresywny - nie: cala klatka laduje w RAM razem z buforami
    dekodera i kopia robiona przy skalowaniu. Tu limit pikseli wynika z budzetu pamieci
    (`max_decode_bytes`) podzielonego przez zmierzony koszt piksela w danym formacie.
Szczytu pamieci jednego wywolania pilnuje test
tests/core/test_image_sanitizer.py::TestMemoryBudget.
"""
import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from core.exceptions import AppException

ALLOWED_INPUT_FORMATS = ("JPEG", "PNG", "WEBP")

# JPEG baseline (dekodowany od razu w zmniejszeniu): zdjecia z telefonow maja 12-24 Mpx.
DEFAULT_MAX_PIXELS = 25_000_000
# Budzet RAM na jedno dekodowanie w pelnej rozdzielczosci (PNG, WEBP, JPEG progresywny).
DEFAULT_MAX_DECODE_BYTES = 100 * 1024 * 1024
# Szczytowy koszt piksela (bajty) przy takim dekodowaniu - zmierzony na Pillow 12.3
# (peak RSS procesu, najgorszy tryb formatu): PNG z paleta i przezroczystoscia,
# WEBP (dekoder trzyma kilka kopii klatki), JPEG progresywny CMYK (bufory wspolczynnikow).
# Daje to ok. 10 Mpx dla PNG (zrzut ekranu 4K sie miesci), 8 Mpx dla JPEG progresywnego
# i ok. 6 Mpx dla WEBP.
_FULL_DECODE_BYTES_PER_PIXEL = {"PNG": 10, "WEBP": 17, "JPEG": 13}
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

    `max_pixels` to limit ogolny (w praktyce: JPEG baseline); formaty dekodowane w pelnej
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
                scaled_decode = img.format == "JPEG" and not img.info.get("progressive")
                pixel_limit = max_pixels
                if not scaled_decode:
                    per_pixel = _FULL_DECODE_BYTES_PER_PIXEL[img.format]
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
