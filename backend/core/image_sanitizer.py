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
"""
import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from core.exceptions import AppException

ALLOWED_INPUT_FORMATS = ("JPEG", "PNG", "WEBP")

# Ochrona przed "decompression bomb": maly plik, ktory po dekompresji zajmuje gigabajty.
# 25 Mpx miesci zdjecia z telefonow (12-24 Mpx); RGBA przy 25 Mpx to ~100 MB RAM.
DEFAULT_MAX_PIXELS = 25_000_000

OUTPUT_FORMAT = "WEBP"
OUTPUT_CONTENT_TYPE = "image/webp"
OUTPUT_EXTENSION = "webp"
OUTPUT_QUALITY = 85


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


def sanitize_image(
    data: bytes,
    *,
    max_side: int,
    max_pixels: int = DEFAULT_MAX_PIXELS,
) -> SanitizedImage:
    """
    Dekoduje `data` (tylko JPEG/PNG/WEBP), zmniejsza do `max_side` x `max_side`
    (z zachowaniem proporcji) i zapisuje od nowa jako WEBP bez metadanych.

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
                if width < 1 or height < 1 or width * height > max_pixels:
                    raise AppException(
                        "Obraz ma zbyt duże wymiary",
                        code="IMAGE_TOO_LARGE",
                        status_code=400,
                    )

                if img.format == "JPEG":
                    # Dekoder JPEG skaluje juz przy dekodowaniu (DCT) - duze zdjecie
                    # nie jest rozpakowywane w pelnej rozdzielczosci.
                    img.draft("RGB", (max_side * 2, max_side * 2))

                img.load()  # tu naprawde dekodujemy; uciety/uszkodzony plik rzuci wyjatek
                # Obrot wg EXIF zanim wyrzucimy EXIF (zdjecia z telefonu lezalyby na boku).
                oriented = ImageOps.exif_transpose(img)
                has_alpha = oriented.mode in ("RGBA", "LA", "PA") or "transparency" in oriented.info
                clean = oriented.convert("RGBA" if has_alpha else "RGB")
    except AppException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise _invalid_image()
    except Exception:
        # Pillow rzuca rozne wyjatki dla uszkodzonych plikow (OSError, SyntaxError,
        # ValueError, struct.error...) - dla klienta to zawsze "niepoprawny obraz".
        raise _invalid_image()

    clean.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
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
