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

Buckety PRYWATNE (np. `board-files`, api/v1/whiteboard/files.py): `upload_object` z
`create_bucket=BucketSpec(...)` sam tworzy brakujacy bucket (zawsze `public: false`),
a plik wydaje wylacznie backend przez `download_object` - po sprawdzeniu uprawnien.
"""
import re
from dataclasses import dataclass

import httpx

from core.config import get_settings
from core.exceptions import AppException
from core.logging import get_logger

logger = get_logger(__name__)

UPLOAD_TIMEOUT_SECONDS = 15.0
DELETE_TIMEOUT_SECONDS = 10.0
DOWNLOAD_TIMEOUT_SECONDS = 15.0
BUCKET_TIMEOUT_SECONDS = 10.0
# Storage zwraca domyslnie 100 pozycji listy - prosimy o strony po 1000 i kasujemy strona
# po stronie; limit stron chroni przed petla, gdyby kasowanie po cichu nie dzialalo.
LIST_PAGE_SIZE = 1000
DELETE_PREFIX_MAX_PAGES = 100

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


@dataclass(frozen=True)
class BucketSpec:
    """Parametry PRYWATNEGO bucketu tworzonego przez backend, gdy go jeszcze nie ma."""
    file_size_limit: int
    allowed_mime_types: tuple[str, ...]


def _not_configured() -> AppException:
    return AppException(
        "Przechowywanie plików jest chwilowo niedostępne",
        code="STORAGE_NOT_CONFIGURED",
        status_code=503,
    )


def _require_config() -> tuple[str, str]:
    config = _storage_config()
    if not config:
        logger.error("Supabase Storage nie jest skonfigurowany (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
        raise _not_configured()
    return config


def _error_text(response: httpx.Response) -> str:
    """Tresc bledu Storage malymi literami (JSON albo tekst) - do rozpoznawania przyczyny."""
    try:
        return response.text[:2000].lower()
    except Exception:
        return ""


def _error_status_code(response: httpx.Response) -> str:
    """Pole `statusCode` z ciala bledu - Storage potrafi odeslac HTTP 400 z "statusCode": "404"."""
    try:
        body = response.json()
    except Exception:
        return ""
    if isinstance(body, dict):
        return str(body.get("statusCode") or "")
    return ""


def is_bucket_not_found(response: httpx.Response) -> bool:
    """
    Czy odpowiedz Storage oznacza "nie ma takiego bucketu". Dokladny status zalezy od
    wersji Storage (HTTP 404 albo HTTP 400 z "statusCode": "404"), dlatego patrzymy na
    status ORAZ tresc - samo 404 moze tez znaczyc brak obiektu.
    """
    if response.status_code not in (400, 404):
        return False
    text = _error_text(response)
    return "bucket" in text and "not found" in text


def _is_already_exists(response: httpx.Response) -> bool:
    if response.status_code == 409:
        return True
    if response.status_code != 400:
        return False
    text = _error_text(response)
    return _error_status_code(response) == "409" or "already exists" in text or "duplicate" in text


def _is_object_not_found(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    if response.status_code != 400:
        return False
    return _error_status_code(response) == "404" or "not found" in _error_text(response)


async def ensure_bucket(bucket: str, spec: BucketSpec) -> bool:
    """
    Tworzy PRYWATNY bucket (`public: false`), jesli go nie ma. "Juz istnieje" = sukces.
    Zwraca False, gdy sie nie udalo (blad loguje) - wolajacy odpowiada wtedy 503 i NIE
    przelacza sie na zaden inny (publiczny) bucket.
    """
    config = _storage_config()
    if not config:
        return False
    supabase_url, service_role_key = config

    try:
        async with httpx.AsyncClient(timeout=BUCKET_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{supabase_url}/storage/v1/bucket",
                headers={**_auth_headers(service_role_key), "Content-Type": "application/json"},
                json={
                    "id": bucket,
                    "name": bucket,
                    "public": False,
                    "file_size_limit": spec.file_size_limit,
                    "allowed_mime_types": list(spec.allowed_mime_types),
                },
            )
    except httpx.HTTPError as e:
        logger.error(f"Tworzenie bucketu {bucket} nieudane: {type(e).__name__}")
        return False

    if response.status_code < 300:
        logger.info(f"Utworzono prywatny bucket Storage: {bucket}")
        return True
    if _is_already_exists(response):
        return True
    logger.error(
        f"Tworzenie bucketu {bucket} nieudane: HTTP {response.status_code}: {response.text[:300]}"
    )
    return False


async def _post_object(
    config: tuple[str, str], bucket: str, path: str, data: bytes, content_type: str
) -> httpx.Response:
    supabase_url, service_role_key = config
    async with httpx.AsyncClient(timeout=UPLOAD_TIMEOUT_SECONDS) as client:
        return await client.post(
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


async def upload_object(
    bucket: str,
    path: str,
    data: bytes,
    content_type: str,
    *,
    create_bucket: BucketSpec | None = None,
) -> None:
    """
    Zapisuje `data` w `bucket` pod `path` (bucket publiczny albo prywatny).

    `create_bucket`: gdy Storage odpowie "Bucket not found", bucket jest tworzony jako
    PRYWATNY i upload ponawiany jeden raz; jesli utworzyc sie nie da - 503
    STORAGE_NOT_CONFIGURED (klient ma wtedy wlasna sciezke awaryjna).

    Rzuca AppException: 503 (brak konfiguracji / bucketu), 502 (blad Storage), 504 (timeout).
    """
    config = _require_config()

    try:
        response = await _post_object(config, bucket, path, data, content_type)
        if create_bucket is not None and is_bucket_not_found(response):
            logger.warning(f"Bucket {bucket} nie istnieje - tworze (prywatny)")
            if not await ensure_bucket(bucket, create_bucket):
                raise _not_configured()
            response = await _post_object(config, bucket, path, data, content_type)
            if is_bucket_not_found(response):
                logger.error(f"Bucket {bucket} nadal niedostepny po utworzeniu")
                raise _not_configured()
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


async def upload_public_object(bucket: str, path: str, data: bytes, content_type: str) -> str:
    """
    Zapisuje `data` w publicznym buckecie pod `path` i zwraca publiczny URL.
    Rzuca AppException: 503 (brak konfiguracji), 502 (blad Storage), 504 (timeout).
    """
    await upload_object(bucket, path, data, content_type)
    return public_object_url(_require_config()[0], bucket, path)


async def download_object(bucket: str, path: str) -> bytes | None:
    """
    Pobiera obiekt kluczem service_role (dziala takze dla bucketu prywatnego).
    Zwraca None, gdy obiektu (albo calego bucketu) nie ma.
    Rzuca AppException: 503 (brak konfiguracji), 502 (blad Storage), 504 (timeout).
    """
    supabase_url, service_role_key = _require_config()

    try:
        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{supabase_url}/storage/v1/object/{bucket}/{path}",
                headers=_auth_headers(service_role_key),
            )
    except httpx.TimeoutException:
        logger.error(f"Pobieranie ze Storage - timeout (bucket={bucket})")
        raise AppException(
            "Pobieranie pliku przekroczyło limit czasu",
            code="STORAGE_TIMEOUT",
            status_code=504,
        )
    except httpx.HTTPError as e:
        logger.error(f"Pobieranie ze Storage - blad polaczenia (bucket={bucket}): {type(e).__name__}")
        raise AppException(
            "Nie udało się pobrać pliku (błąd magazynu plików)",
            code="STORAGE_DOWNLOAD_FAILED",
            status_code=502,
        )

    if response.status_code == 200:
        return response.content
    if _is_object_not_found(response):
        return None
    logger.error(
        f"Pobieranie ze Storage nieudane (bucket={bucket}): "
        f"HTTP {response.status_code}: {response.text[:300]}"
    )
    raise AppException(
        "Nie udało się pobrać pliku (błąd magazynu plików)",
        code="STORAGE_DOWNLOAD_FAILED",
        status_code=502,
    )


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


async def delete_prefix(bucket: str, prefix: str) -> int:
    """
    Kasuje wszystkie obiekty z folderu `prefix` (np. "12/") - listuje strony po
    LIST_PAGE_SIZE i kasuje strona po stronie. Best-effort: bledy tylko loguje.
    Zwraca liczbe skasowanych obiektow.
    """
    config = _storage_config()
    if not config:
        return 0
    supabase_url, service_role_key = config
    headers = {**_auth_headers(service_role_key), "Content-Type": "application/json"}
    folder = prefix.strip("/")
    deleted = 0

    try:
        async with httpx.AsyncClient(timeout=DELETE_TIMEOUT_SECONDS) as client:
            for _ in range(DELETE_PREFIX_MAX_PAGES):
                # Zawsze offset 0: poprzednia strona zostala wlasnie skasowana.
                listing = await client.post(
                    f"{supabase_url}/storage/v1/object/list/{bucket}",
                    headers=headers,
                    json={"prefix": f"{folder}/", "limit": LIST_PAGE_SIZE, "offset": 0},
                )
                if listing.status_code >= 400:
                    if not is_bucket_not_found(listing):
                        logger.warning(
                            f"Listowanie plikow {bucket}/{folder}/ nieudane: HTTP {listing.status_code}"
                        )
                    break
                entries = listing.json()
                if not isinstance(entries, list) or not entries:
                    break
                # Pozycje z "id": null to podfoldery - nie kasujemy ich jak plikow.
                paths = [
                    f"{folder}/{entry['name']}"
                    for entry in entries
                    if isinstance(entry, dict)
                    and isinstance(entry.get("name"), str)
                    and entry.get("id", "") is not None
                    and _SAFE_OBJECT_PATH.fullmatch(f"{folder}/{entry['name']}")
                ]
                if not paths:
                    break
                response = await client.request(
                    "DELETE",
                    f"{supabase_url}/storage/v1/object/{bucket}",
                    headers=headers,
                    json={"prefixes": paths},
                )
                if response.status_code >= 400:
                    logger.warning(
                        f"Kasowanie plikow {bucket}/{folder}/ nieudane: HTTP {response.status_code}"
                    )
                    break
                deleted += len(paths)
                if len(entries) < LIST_PAGE_SIZE:
                    break
    except Exception as e:
        logger.warning(f"Kasowanie folderu {bucket}/{folder}/ nieudane: {type(e).__name__}")

    if deleted:
        logger.info(f"Skasowano {deleted} plik(ow) z {bucket}/{folder}/")
    return deleted
