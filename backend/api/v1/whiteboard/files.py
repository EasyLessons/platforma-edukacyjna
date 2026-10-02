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
"""
import re
import uuid

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import AppException, NotFoundError
from core.logging import get_logger
from core.models import User
from core.rate_limit import rate_limit
from core.responses import ApiResponse
from core.storage import BucketSpec, delete_prefix, download_object, upload_object

# Czytanie multipart z limitem 5 MB / 60 s i kolejka dekodowania sa wspolne z awatarem:
# semafor MUSI byc jeden na proces (budzet RAM jednego dekodowania to do ~100 MB).
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
# (WEBP/GIF: 17 B/px); zmierzony szczyt calego wywolania: do ~130 MB (szum RGBA).
BOARD_FILE_MAX_DECODE_BYTES = 40 * 1024 * 1024
# Limit i typ obiektu w buckecie (po przekodowaniu zawsze WEBP).
BOARD_FILES_BUCKET_SPEC = BucketSpec(file_size_limit=5 * 1024 * 1024, allowed_mime_types=("image/webp",))

FILE_NAME_PATTERN = re.compile(r"^[0-9a-f]{32}\.webp$")

UPLOAD_RATE_LIMIT = 60
UPLOAD_RATE_WINDOW_SECONDS = 60


def board_file_path(board_id: int, file_name: str) -> str:
    return f"{int(board_id)}/{file_name}"


async def delete_board_files(board_id: int) -> None:
    """Kasuje wszystkie pliki tablicy z `board-files` (przy usunieciu tablicy). Best-effort."""
    await delete_prefix(BOARD_FILES_BUCKET, f"{int(board_id)}/")


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
        413: {"description": "File too large"},
        429: {"description": "Rate limited"},
        503: {"description": "Storage not configured"},
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
):
    # Uprawnienia PRZED czytaniem ciala: viewer i nie-czlonek nie wysylaja nam 5 MB.
    _board, role = WhiteboardService(db)._get_board_and_role(board_id, current_user.id)
    if not can_edit(role):
        raise AppException("Rola viewer nie może dodawać obrazów do tablicy", code="FORBIDDEN", status_code=403)
    user_id = current_user.id
    # Polaczenie z baza wraca do puli na czas wolnego uploadu i dekodowania (jak w avatar.py).
    db.rollback()

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
    },
)
async def get_board_file(
    board_id: int,
    file_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
