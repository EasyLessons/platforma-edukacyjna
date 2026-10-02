"""
Supabase Storage - wspolne funkcje zapisu/kasowania plikow kluczem service_role.

Wydzielone ze wzorca `api/v1/whiteboard/storage.py` (tamten plik zostaje bez zmian;
docelowo moze korzystac z tego modulu - patrz docs/security/AUDYT-2026-09.md, PR 12).
service_role omija polityki RLS bucketu, dlatego autoryzacje (kto i co moze zapisac)
ZAWSZE sprawdza wolajacy, zanim tu trafi.

Zasady:
  * sciezke obiektu i Content-Type ustala serwer - nic od klienta,
  * brak konfiguracji -> czytelny 503 (nie 500),
  * kasowanie jest best-effort: nigdy nie rzuca wyjatku.
"""
import re

import httpx

from core.config import get_settings
from core.exceptions import AppException
from core.logging import get_logger

logger = get_logger(__name__)

UPLOAD_TIMEOUT_SECONDS = 15.0
DELETE_TIMEOUT_SECONDS = 10.0

# Segmenty sciezki obiektu: tylko bezpieczne znaki, bez "..", bez query/fragmentu.
_SAFE_OBJECT_PATH = re.compile(r"^[A-Za-z0-9_-][A-Za-z0-9._-]*(/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$")


def _storage_config() -> tuple[str, str] | None:
    settings = get_settings()
    url = (settings.supabase_url or "").strip().rstrip("/")
    key = (settings.supabase_service_role_key or "").strip()
    if not url or not key:
        return None
    return url, key


def _auth_headers(service_role_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {service_role_key}", "apikey": service_role_key}


def public_object_url(supabase_url: str, bucket: str, path: str) -> str:
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{path}"


def object_path_from_public_url(bucket: str, url: str | None) -> str | None:
    """
    Zwraca sciezke obiektu, jesli `url` to publiczny adres pliku w `bucket` NASZEGO
    projektu Supabase i sciezka sklada sie wylacznie z bezpiecznych znakow.
    W kazdym innym przypadku (obcy host, inny bucket, "..", query) - None.
    """
    config = _storage_config()
    if not config or not url:
        return None
    prefix = public_object_url(config[0], bucket, "")
    if not url.startswith(prefix):
        return None
    path = url[len(prefix):]
    if not _SAFE_OBJECT_PATH.fullmatch(path) or ".." in path:
        return None
    return path


async def upload_public_object(bucket: str, path: str, data: bytes, content_type: str) -> str:
    """
    Zapisuje `data` w publicznym buckecie pod `path` i zwraca publiczny URL.
    Rzuca AppException: 503 (brak konfiguracji), 502 (blad Storage), 504 (timeout).
    """
    config = _storage_config()
    if not config:
        logger.error("Supabase Storage nie jest skonfigurowany (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
        raise AppException(
            "Przechowywanie plików jest chwilowo niedostępne",
            code="STORAGE_NOT_CONFIGURED",
            status_code=503,
        )
    supabase_url, service_role_key = config

    try:
        async with httpx.AsyncClient(timeout=UPLOAD_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{supabase_url}/storage/v1/object/{bucket}/{path}",
                headers={
                    **_auth_headers(service_role_key),
                    "Content-Type": content_type,
                    # Nazwy sa losowe i niezmienne - plik mozna cache'owac dlugo.
                    "Cache-Control": "max-age=31536000",
                    "x-upsert": "false",
                },
                content=data,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error(
            f"Upload do Supabase Storage nieudany (bucket={bucket}): "
            f"HTTP {e.response.status_code}: {e.response.text[:300]}"
        )
        raise AppException(
            "Nie udało się zapisać pliku (błąd magazynu plików)",
            code="STORAGE_UPLOAD_FAILED",
            status_code=502,
        )
    except httpx.TimeoutException:
        logger.error(f"Upload do Supabase Storage - timeout (bucket={bucket})")
        raise AppException(
            "Zapis pliku przekroczył limit czasu",
            code="STORAGE_TIMEOUT",
            status_code=504,
        )
    except httpx.HTTPError as e:
        logger.error(f"Upload do Supabase Storage - blad polaczenia (bucket={bucket}): {type(e).__name__}")
        raise AppException(
            "Nie udało się zapisać pliku (błąd magazynu plików)",
            code="STORAGE_UPLOAD_FAILED",
            status_code=502,
        )

    return public_object_url(supabase_url, bucket, path)


async def delete_public_object(bucket: str, path: str) -> None:
    """Kasuje jeden obiekt. Best-effort: bledy tylko loguje (plik-sierota to maly problem)."""
    config = _storage_config()
    if not config:
        return
    supabase_url, service_role_key = config

    try:
        async with httpx.AsyncClient(timeout=DELETE_TIMEOUT_SECONDS) as client:
            response = await client.request(
                "DELETE",
                f"{supabase_url}/storage/v1/object/{bucket}",
                headers={**_auth_headers(service_role_key), "Content-Type": "application/json"},
                json={"prefixes": [path]},
            )
            if response.status_code >= 400:
                logger.warning(
                    f"Kasowanie pliku ze Storage nieudane (bucket={bucket}): HTTP {response.status_code}"
                )
    except Exception as e:
        logger.warning(f"Kasowanie pliku ze Storage nieudane (bucket={bucket}): {type(e).__name__}")
