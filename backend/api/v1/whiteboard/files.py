"""
PLIKI TABLICY (silnik Excalidraw) - /api/v1/whiteboard/{board_id}/files

POST /{board_id}/files              - wgranie obrazu (multipart, pole `file`)
GET  /{board_id}/files/{file_name}  - pobranie obrazu (proxy z prywatnego bucketu)

Po co: obrazy wklejane na tablice Excalidraw trafialy do Y.Doc jako dataURL i snapshot
`board_documents` puchl. Teraz w Y.Doc jest tylko odwolanie `{v: 1, name}`, a plik lezy
w PRYWATNYM buckecie `board-files` pod `{board_id}/{uuid}.webp`.

Dostep "tylko dla czlonkow tablicy":
  * bucket jest prywatny - nie ma publicznego URL-a; plik wydaje wylacznie ten modul,
    kluczem service_role, PO sprawdzeniu czlonkostwa (viewer moze czytac, nie moze wgrywac),
  * sciezka w buckecie jest skladana z `board_id` z URL-a (dla ktorego sprawdzono dostep)
    i nazwy pasujacej do `<32 hex>.webp` - nie da sie siegnac do pliku innej tablicy.

Bucket tworzy backend przy pierwszym uploadzie (core/storage.py: `create_bucket`). Gdy sie
nie da - 503 STORAGE_NOT_CONFIGURED; front zostawia wtedy obraz jako dataURL (jak dawniej).
Nigdy nie przelaczamy sie na bucket publiczny.

Walidacja i limity jak przy awatarze (api/v1/auth/avatar.py): cialo czytane strumieniowo
z twardym limitem 5 MB, typ rozpoznawany po TRESCI i obraz przekodowany do WEBP
(core/image_sanitizer.py), jedno dekodowanie naraz w calym procesie (wspolny semafor).
Stary endpoint `upload-image` (stary silnik, storage.py) zostaje bez zmian.

Ochrona przed zalaniem uploadami (kolejnosc = kolejnosc sprawdzania, wszystko PRZED
czytaniem ciala):
  1. limit zadan per IP i per UZYTKOWNIK (Redis, fail-open),
  2. uprawnienia do tablicy,
  3. miekka quota tablicy (liczba plikow i bajty, licznik w Redis, fail-open),
  4. `upload_slot`: najwyzej MAX_UPLOADS_IN_FLIGHT uploadow w toku w procesie i
     MAX_UPLOADS_IN_FLIGHT_PER_USER na konto; nadmiar dostaje od razu 503/429 z Retry-After
     i jego cialo NIE jest czytane. Bez tego 60 rownoleglych uploadow lezalo w RAM (5 MB
     kazdy) w kolejce do semafora dekodowania i blokowalo awatary na ~2 min.
"""
import re
import uuid
from contextlib import contextmanager
from typing import Iterator

from fastapi import APIRouter, Depends, Request, Response
from redis.exceptions import RedisError
from sqlalchemy.orm import Session

from core import redis_client as redis_client_module
from core.database import get_db
from core.exceptions import AppException, NotFoundError
from core.logging import get_logger
from core.models import User
from core.rate_limit import rate_limit
from core.responses import ApiResponse
from core.storage import BucketSpec, delete_prefix, download_object, upload_object

# Czytanie multipart z limitem 5 MB / 60 s i kolejka dekodowania sa wspolne z awatarem:
# semafor MUSI byc jeden na proces (szczyt RAM jednego uploadu tablicy: do ~145 MB).
from ..auth.avatar import _read_avatar_file as read_image_upload
from ..auth.avatar import _sanitize_one_at_a_time as sanitize_one_at_a_time
from ..auth.dependencies import get_current_user
from .schemas import BoardFileResponse
from .service import WhiteboardService, can_edit

router = APIRouter(tags=["Whiteboard"])
logger = get_logger(__name__)

BOARD_FILES_BUCKET = "board-files"
# Wejscie: to, co Excalidraw wkleja jako raster. GIF -> pierwsza klatka (Excalidraw i tak
# rysuje obraz na canvasie bez animacji). SVG/BMP/ICO/AVIF sa odrzucane (400).
BOARD_INPUT_FORMATS = ("JPEG", "PNG", "WEBP", "GIF")
# Excalidraw sam zmniejsza wklejany obraz do 1440 px; 1600 to zapas, nie cel.
BOARD_FILE_MAX_SIDE = 1600
# Budzet RAM dekodowania w pelnej rozdzielczosci (PNG/WEBP/GIF/JPEG progresywny). Mniejszy
# niz domyslne 100 MB sanitizera, bo wynik jest tu duzo wiekszy niz awatar 512 px i sam
# koder WEBP potrzebuje kilkudziesieciu MB. 40 MB miesci 1440x1440 w kazdym formacie
# (WEBP/GIF: 17 B/px); zmierzony szczyt calego wywolania: do ~145 MB (szum RGBA).
BOARD_FILE_MAX_DECODE_BYTES = 40 * 1024 * 1024
# Limit i typ obiektu w buckecie (po przekodowaniu zawsze WEBP).
BOARD_FILES_BUCKET_SPEC = BucketSpec(file_size_limit=5 * 1024 * 1024, allowed_mime_types=("image/webp",))

FILE_NAME_PATTERN = re.compile(r"^[0-9a-f]{32}\.webp$")

# Limit per IP (wspolne IP szkoly/NAT-u: kilka osob naraz) i ciasniejszy per konto.
UPLOAD_RATE_LIMIT = 60
UPLOAD_RATE_WINDOW_SECONDS = 60
UPLOAD_USER_RATE_LIMIT = 30
# Pobrania: tablica z wieloma obrazami to tyle GET-ow przy kazdym wejsciu - limit hojny,
# ma zatrzymac tylko petle/skrypt (kazdy GET to pobranie ze Storage przez backend).
DOWNLOAD_USER_RATE_LIMIT = 600
DOWNLOAD_RATE_WINDOW_SECONDS = 60

# Uploady "w toku" = od wejscia do handlera do konca dekodowania i zapisu. Kazdy trzyma w RAM
# cialo (do 5 MB, chwilowo kilka kopii przy parsowaniu multipart), a dekoduje sie jeden naraz
# (~145 MB). 4 w toku => szczyt ograniczony z gory do ok. 4 x 15 MB + 145 MB, a awatar czeka
# w kolejce do semafora najwyzej za 4 dekodowaniami (nie za 60).
MAX_UPLOADS_IN_FLIGHT = 4
# Jedno konto nie zajmuje wszystkich miejsc (front wysyla najwyzej 2 obrazy naraz).
MAX_UPLOADS_IN_FLIGHT_PER_USER = 2
UPLOAD_BUSY_RETRY_AFTER_SECONDS = 2

# Miekka quota tablicy. Licznik jest w Redis (INCR po udanym zapisie, kasowany razem z
# plikami tablicy): tani, ale NIE autorytatywny - po utracie danych Redis liczy od zera,
# a rownolegle uploady moga przekroczyc limit o kilka plikow. Chroni przed zapchaniem
# Storage przez jedna tablice, nie jest rozliczeniem. Awaria Redis = brak limitu (fail-open).
BOARD_MAX_FILES = 300
BOARD_MAX_BYTES = 100 * 1024 * 1024

_uploads_in_flight = 0
_uploads_in_flight_by_user: dict[int, int] = {}


def board_file_path(board_id: int, file_name: str) -> str:
    return f"{int(board_id)}/{file_name}"


def _usage_keys(board_id: int) -> tuple[str, str]:
    return f"board_files:{int(board_id)}:count", f"board_files:{int(board_id)}:bytes"


async def delete_board_files(board_id: int) -> None:
    """Kasuje wszystkie pliki tablicy z `board-files` (przy usunieciu tablicy). Best-effort."""
    await delete_prefix(BOARD_FILES_BUCKET, f"{int(board_id)}/")
    try:
        await redis_client_module.get_redis_client().delete(*_usage_keys(board_id))
    except RedisError:
        logger.warning(f"Nie udało się skasować licznika plików tablicy {board_id} (Redis)")


def user_rate_limit(scope: str, limit: int, window_seconds: int):
    """
    Limit zadan per UZYTKOWNIK (wzorzec `avatar_rate_limit`; IP za proxy bywa wspolne, a
    jedno konto moze miec wiele IP). Fail-open: tablica na lekcji ma dzialac takze bez Redis.
    """
    async def dependency(current_user: User = Depends(get_current_user)) -> None:
        key = f"ratelimit:{scope}:user:{current_user.id}"
        try:
            redis = redis_client_module.get_redis_client()
            current = await redis.incr(key)
            # TTL przy kazdym zadaniu: licznik bez wygasniecia blokowalby konto na stale.
            if current == 1 or await redis.ttl(key) == -1:
                await redis.expire(key, window_seconds)
        except RedisError:
            logger.exception(f"Błąd Redis przy rate limitingu (scope={scope})")
            return
        if current > limit:
            raise AppException(
                "Zbyt wiele prób, spróbuj ponownie później.",
                code="RATE_LIMITED",
                status_code=429,
                headers={"Retry-After": str(window_seconds)},
            )

    return dependency


async def _check_board_quota(board_id: int) -> None:
    try:
        count, size = await redis_client_module.get_redis_client().mget(*_usage_keys(board_id))
    except RedisError:
        logger.exception("Błąd Redis przy sprawdzaniu quoty plików tablicy")
        return
    if int(count or 0) >= BOARD_MAX_FILES or int(size or 0) >= BOARD_MAX_BYTES:
        raise AppException(
            "Ta tablica osiągnęła limit obrazów",
            code="BOARD_FILE_QUOTA_EXCEEDED",
            status_code=409,
        )


async def _record_board_usage(board_id: int, size: int) -> None:
    count_key, bytes_key = _usage_keys(board_id)
    try:
        redis = redis_client_module.get_redis_client()
        await redis.incr(count_key)
        await redis.incrby(bytes_key, size)
    except RedisError:
        logger.warning(f"Nie udało się zaktualizować licznika plików tablicy {board_id} (Redis)")


@contextmanager
def upload_slot(user_id: int) -> Iterator[None]:
    """
    Miejsce na upload w toku. Brak miejsca -> wyjatek OD RAZU (bez czekania i bez czytania
    ciala): 429 TOO_MANY_UPLOADS (limit konta) albo 503 UPLOAD_BUSY (limit procesu), oba
    z Retry-After - front ponawia je z rosnacym odstepem (board-file-sync.ts).

    Sprawdzenie i zajecie miejsca nie maja miedzy soba `await`, wiec sa atomowe w petli
    asyncio. Znany margines: przy zerwanym polaczeniu miejsce wraca od razu, a watek
    dekodujacy konczy prace sam - ale to najwyzej JEDEN taki watek (semafor dekodowania
    zwalnia dopiero watek, patrz avatar.py).
    """
    global _uploads_in_flight
    mine = _uploads_in_flight_by_user.get(user_id, 0)
    if mine >= MAX_UPLOADS_IN_FLIGHT_PER_USER:
        raise AppException(
            "Trwa już wgrywanie Twoich obrazów - spróbuj za chwilę",
            code="TOO_MANY_UPLOADS",
            status_code=429,
            headers={"Retry-After": str(UPLOAD_BUSY_RETRY_AFTER_SECONDS)},
        )
    if _uploads_in_flight >= MAX_UPLOADS_IN_FLIGHT:
        raise AppException(
            "Serwer przetwarza teraz inne obrazy - spróbuj za chwilę",
            code="UPLOAD_BUSY",
            status_code=503,
            headers={"Retry-After": str(UPLOAD_BUSY_RETRY_AFTER_SECONDS)},
        )
    _uploads_in_flight += 1
    _uploads_in_flight_by_user[user_id] = mine + 1
    try:
        yield
    finally:
        _uploads_in_flight -= 1
        left = _uploads_in_flight_by_user.get(user_id, 1) - 1
        if left > 0:
            _uploads_in_flight_by_user[user_id] = left
        else:
            _uploads_in_flight_by_user.pop(user_id, None)


@router.post(
    "/{board_id}/files",
    response_model=ApiResponse[BoardFileResponse],
    summary="Upload board file",
    description=(
        "Wgrywa obraz tablicy (multipart/form-data, pole `file`). Dozwolone: JPEG, PNG, WEBP, "
        "GIF (pierwsza klatka) do 5 MB. Obraz jest przekodowywany do WEBP (max 1600 px)."
    ),
    responses={
        400: {"description": "Invalid upload or unsupported image"},
        403: {"description": "Viewer cannot upload"},
        404: {"description": "Board not found or no access"},
        409: {"description": "Board file quota exceeded"},
        413: {"description": "File too large"},
        429: {"description": "Rate limited or too many uploads in progress (Retry-After)"},
        503: {"description": "Storage not configured, or server busy (UPLOAD_BUSY, Retry-After)"},
    },
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {"file": {"type": "string", "format": "binary"}},
                    }
                }
            },
        }
    },
)
async def upload_board_file(
    board_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(
        rate_limit("board_file_upload", limit=UPLOAD_RATE_LIMIT, window_seconds=UPLOAD_RATE_WINDOW_SECONDS, fail_open=True)
    ),
    __: None = Depends(
        user_rate_limit("board_file_upload", limit=UPLOAD_USER_RATE_LIMIT, window_seconds=UPLOAD_RATE_WINDOW_SECONDS)
    ),
):
    # Uprawnienia PRZED czytaniem ciala: viewer i nie-czlonek nie wysylaja nam 5 MB.
    _board, role = WhiteboardService(db)._get_board_and_role(board_id, current_user.id)
    if not can_edit(role):
        raise AppException("Rola viewer nie może dodawać obrazów do tablicy", code="FORBIDDEN", status_code=403)
    user_id = current_user.id
    # Polaczenie z baza wraca do puli na czas wolnego uploadu i dekodowania (jak w avatar.py).
    db.rollback()

    await _check_board_quota(board_id)

    # Od tego miejsca cialo trafia do RAM - dlatego najpierw miejsce (albo 429/503).
    with upload_slot(user_id):
        raw = await read_image_upload(request)
        image = await sanitize_one_at_a_time(
            raw,
            max_side=BOARD_FILE_MAX_SIDE,
            formats=BOARD_INPUT_FORMATS,
            max_decode_bytes=BOARD_FILE_MAX_DECODE_BYTES,
        )
        del raw

        # Nazwa w calosci z serwera: bez nazwy pliku, rozszerzenia ani id od klienta.
        file_name = f"{uuid.uuid4().hex}.{image.extension}"
        await upload_object(
            BOARD_FILES_BUCKET,
            board_file_path(board_id, file_name),
            image.data,
            image.content_type,
            create_bucket=BOARD_FILES_BUCKET_SPEC,
        )
    await _record_board_usage(board_id, len(image.data))

    logger.info(
        f"Plik tablicy {board_id} zapisany przez użytkownika {user_id} "
        f"({image.width}x{image.height}, {len(image.data)} B)"
    )
    return ApiResponse(
        success=True,
        data=BoardFileResponse(
            file_name=file_name,
            mime_type=image.content_type,
            size=len(image.data),
            width=image.width,
            height=image.height,
        ),
    )


@router.get(
    "/{board_id}/files/{file_name}",
    summary="Download board file",
    response_class=Response,
    responses={
        200: {"content": {"image/webp": {}}, "description": "Obraz WEBP"},
        404: {"description": "Board or file not found, or no access"},
        429: {"description": "Rate limited"},
    },
)
async def get_board_file(
    board_id: int,
    file_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(
        user_rate_limit("board_file_download", limit=DOWNLOAD_USER_RATE_LIMIT, window_seconds=DOWNLOAD_RATE_WINDOW_SECONDS)
    ),
):
    # Czlonkostwo (takze viewer). Nie-czlonek dostaje 404 niezaleznie od nazwy pliku.
    WhiteboardService(db)._get_board_and_role(board_id, current_user.id)
    db.rollback()

    if not FILE_NAME_PATTERN.fullmatch(file_name):
        raise NotFoundError("Plik nie istnieje")

    data = await download_object(BOARD_FILES_BUCKET, board_file_path(board_id, file_name))
    if data is None:
        raise NotFoundError("Plik nie istnieje")

    return Response(
        content=data,
        media_type="image/webp",
        headers={
            # Nazwa jest losowa, a plik niezmienny; `private` - tylko cache przegladarki.
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
        },
    )
