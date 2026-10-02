"""
AVATAR UPLOAD - POST /api/v1/auth/users/me/avatar  (SEC-03, docs/security/AUDYT-2026-09.md)

Wczesniej przegladarka wgrywala plik prosto do bucketu Supabase `avatars` kluczem anon
(bez walidacji typu i rozmiaru, nazwa z danych klienta). Teraz plik idzie przez backend:

  1. wymagane logowanie + limit zadan per uzytkownik (Redis),
  2. cialo zadania czytane strumieniowo z twardym limitem (nic ponad limit nie trafia
     do RAM ani na dysk; multipart parsujemy dopiero z ograniczonego bufora),
  3. tresc sprawdzana i PRZEKODOWANA przez Pillow (core/image_sanitizer.py),
  4. zapis kluczem service_role pod nazwa wygenerowana przez serwer (core/storage.py),
  5. `users.avatar_url` ustawia backend; poprzedni plik jest kasowany (best-effort).
"""
import asyncio
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from core import redis_client as redis_client_module
from core.database import get_db
from core.exceptions import AppException
from core.image_sanitizer import sanitize_image
from core.logging import get_logger
from core.models import User
from core.responses import ApiResponse
from core.storage import delete_public_object, object_path_from_public_url, upload_public_object
from .dependencies import get_current_user
from .schemas import UserResponse

router = APIRouter(tags=["Authentication"])
logger = get_logger(__name__)

AVATAR_BUCKET = "avatars"
AVATAR_FORM_FIELD = "file"
# Limit pliku WEJSCIOWEGO (zdjecie z telefonu). Do Storage trafia przekodowany WEBP
# 512x512 (kilkadziesiat KB), wiec limit bucketu 2 MB z rls-board-images.sql wystarcza.
AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
# Zapas na naglowki i granice multipart wokol pliku.
MULTIPART_OVERHEAD_BYTES = 64 * 1024
AVATAR_MAX_SIDE = 512

AVATAR_RATE_LIMIT = 10
AVATAR_RATE_WINDOW_SECONDS = 600

# Dekodowanie duzego obrazu to chwilowo ~100 MB RAM - nie wiecej niz 2 naraz.
_decode_slots = asyncio.Semaphore(2)


def _too_large() -> AppException:
    return AppException(
        f"Plik jest za duży (maksymalnie {AVATAR_MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
        code="FILE_TOO_LARGE",
        status_code=413,
    )


def _bad_upload(message: str = "Nieprawidłowe żądanie - wyślij plik w polu 'file' (multipart/form-data)") -> AppException:
    return AppException(message, code="INVALID_UPLOAD", status_code=400)


async def avatar_rate_limit(current_user: User = Depends(get_current_user)) -> None:
    """
    Limit per UZYTKOWNIK (endpoint wymaga logowania, a IP za proxy bywa wspolne).
    Awaria Redis -> 503 (fail-closed), tak jak w core/rate_limit.py.
    """
    key = f"ratelimit:avatar_upload:user:{current_user.id}"
    try:
        redis = redis_client_module.get_redis_client()
        current = await redis.incr(key)
        if current == 1:
            await redis.expire(key, AVATAR_RATE_WINDOW_SECONDS)
    except (RedisConnectionError, RedisTimeoutError):
        logger.exception("Błąd Redis przy rate limitingu (scope=avatar_upload)")
        raise AppException("Serwis chwilowo niedostępny", code="REDIS_ERROR", status_code=503)
    if current > AVATAR_RATE_LIMIT:
        raise AppException(
            "Zbyt wiele prób, spróbuj ponownie później.",
            code="RATE_LIMITED",
            status_code=429,
        )


async def _read_body_limited(request: Request, max_bytes: int) -> bytes:
    """Czyta cialo zadania strumieniowo; po przekroczeniu `max_bytes` przerywa z 413."""
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > max_bytes:
        raise _too_large()

    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > max_bytes:
            raise _too_large()
        chunks.append(chunk)
    return b"".join(chunks)


async def _read_avatar_file(request: Request) -> bytes:
    """Zwraca bajty pliku z pola `file` (multipart), z twardym limitem rozmiaru."""
    if not request.headers.get("content-type", "").lower().startswith("multipart/form-data"):
        raise _bad_upload()

    body = await _read_body_limited(request, AVATAR_MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES)

    async def body_stream() -> AsyncGenerator[bytes, None]:
        yield body

    try:
        form = await MultiPartParser(request.headers, body_stream(), max_files=1, max_fields=1).parse()
    except MultiPartException:
        raise _bad_upload()

    try:
        upload = form.get(AVATAR_FORM_FIELD)
        if not isinstance(upload, UploadFile):
            raise _bad_upload()
        data = await upload.read(AVATAR_MAX_UPLOAD_BYTES + 1)
    finally:
        await form.close()

    if len(data) > AVATAR_MAX_UPLOAD_BYTES:
        raise _too_large()
    if not data:
        raise _bad_upload("Plik jest pusty")
    return data


async def _delete_previous_avatar(db: Session, user_id: int, previous_url: str | None) -> None:
    """
    Kasuje poprzedni plik awatara, jesli lezy w NASZYM buckecie `avatars` i nie wskazuje
    na niego zaden inny uzytkownik (avatar_url dalo sie kiedys ustawic recznie przez
    PUT /users/me - nie chcemy, zeby ktos podstawil cudzy URL i skasowal cudzy plik).
    """
    path = object_path_from_public_url(AVATAR_BUCKET, previous_url)
    if not path:
        return
    try:
        used_by_other = (
            db.query(User.id).filter(User.avatar_url == previous_url, User.id != user_id).first()
        )
    except Exception:
        logger.warning("Nie udało się sprawdzić właściciela starego awatara - plik zostaje")
        return
    if used_by_other:
        return
    await delete_public_object(AVATAR_BUCKET, path)


@router.post(
    "/users/me/avatar",
    response_model=ApiResponse[UserResponse],
    summary="Upload avatar",
    description=(
        "Wgrywa awatar zalogowanego użytkownika (multipart/form-data, pole `file`). "
        "Dozwolone: JPEG, PNG, WEBP do 5 MB. Obraz jest przekodowywany do WEBP 512x512."
    ),
    responses={
        400: {"description": "Invalid upload or not a JPEG/PNG/WEBP image"},
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
                        "required": [AVATAR_FORM_FIELD],
                        "properties": {AVATAR_FORM_FIELD: {"type": "string", "format": "binary"}},
                    }
                }
            },
        }
    },
)
async def upload_avatar(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(avatar_rate_limit),
):
    """Upload awatara - walidacja, przekodowanie, zapis w Storage, aktualizacja avatar_url."""
    raw = await _read_avatar_file(request)

    async with _decode_slots:
        image = await run_in_threadpool(sanitize_image, raw, max_side=AVATAR_MAX_SIDE)
    del raw

    # Nazwa w calosci z serwera: bez nazwy pliku, rozszerzenia ani id od klienta.
    object_path = f"{uuid.uuid4().hex}.{image.extension}"
    new_url = await upload_public_object(AVATAR_BUCKET, object_path, image.data, image.content_type)

    previous_url = current_user.avatar_url
    user_id = current_user.id
    try:
        current_user.avatar_url = new_url
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()
        # Nie zostawiamy sieroty w Storage, skoro URL nie trafil do bazy.
        await delete_public_object(AVATAR_BUCKET, object_path)
        raise

    await _delete_previous_avatar(db, user_id, previous_url)

    logger.info(f"Awatar użytkownika {user_id} zaktualizowany ({image.width}x{image.height}, {len(image.data)} B)")
    return ApiResponse(success=True, data=UserResponse.model_validate(current_user))
