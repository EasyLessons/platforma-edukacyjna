"""
Upload obrazów tablicy do Supabase Storage.

DLACZEGO TEN PLIK ISTNIEJE (patrz: docs/known-issues.md #2):
  Zdjęcia i strony PDF wklejane na tablicy wcześniej leciały jako base64
  bezpośrednio W TREŚCI wiadomości Supabase Realtime Broadcast. Plan Free
  ma twardy limit rozmiaru JEDNEJ wiadomości broadcast — 256 KB. Nawet po
  kompresji (1600px, JPEG q0.82) prawdziwe zdjęcia/PDF-y regularnie go
  przekraczały, więc broadcast kończył się statusem "error" i druga osoba
  nigdy nie widziała obrazka (dopóki nie zrobiła F5, bo dopiero wtedy
  dociągało dane z bazy).

  Rozwiązanie: obraz NIE jedzie przez Realtime w ogóle. Zamiast tego:
    1. Frontend wysyła bajty obrazu tutaj (zwykły HTTP POST, bez limitu 256 KB)
    2. My uploadujemy je do Supabase Storage kluczem service_role
       (ten sam klucz co już jest używany w realtime.py — omija RLS,
       bo autoryzację i tak już sprawdziliśmy przez nasz JWT/current_user)
    3. Zwracamy publiczny URL (np. https://xxx.supabase.co/storage/v1/object/public/board-images/...)
    4. Ten URL (kilkadziesiąt bajtów) jedzie przez broadcast zamiast base64
    5. Druga osoba po prostu ładuje obrazek z URL jak każdy zwykły <img src=...>
       — przeglądarka to cache'uje, nie ma znaczenia czy zdjęcie waży 50 KB czy 5 MB
"""
import logging
import os
import uuid

import httpx

from core.exceptions import AppException

logger = logging.getLogger(__name__)

BUCKET_NAME = "board-images"

# Bezpieczny limit górny (sam Storage nie ma limitu 256 KB jak Realtime,
# ale i tak nie chcemy przyjmować dowolnie wielkich plików)
MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB

# Dozwolone typy — obraz musi już być skonwertowany po stronie frontendu
# (PDF-y trafiają tu jako wyrenderowane strony w JPEG, nie jako surowe .pdf)
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


async def upload_board_image(
    board_id: int,
    file_bytes: bytes,
    content_type: str,
) -> str:
    """
    Uploaduje obraz do Supabase Storage i zwraca publiczny URL.

    Rzuca AppException (400/500) jeśli coś pójdzie nie tak — upload
    obrazu NIE jest "best effort" jak broadcast notyfikacji: jeśli się
    nie uda, frontend musi o tym wiedzieć (inaczej element trafiłby na
    tablicę bez działającego obrazka).
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise AppException(
            f"Nieobsługiwany typ pliku: {content_type}. Dozwolone: {', '.join(ALLOWED_CONTENT_TYPES)}",
            code="INVALID_FILE_TYPE",
            status_code=400,
        )

    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise AppException(
            f"Plik za duży ({len(file_bytes) / 1024 / 1024:.1f} MB, max {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024:.0f} MB)",
            code="FILE_TOO_LARGE",
            status_code=400,
        )

    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        raise AppException(
            "Brak konfiguracji SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY na serwerze",
            code="STORAGE_NOT_CONFIGURED",
            status_code=500,
        )

    ext = ALLOWED_CONTENT_TYPES[content_type]
    # Losowa nazwa pliku (uuid4) — nie chcemy kolizji ani zgadywalnych URL-i
    path = f"{board_id}/{uuid.uuid4().hex}.{ext}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{supabase_url}/storage/v1/object/{BUCKET_NAME}/{path}",
                headers={
                    "Authorization": f"Bearer {service_role_key}",
                    "apikey": service_role_key,
                    "Content-Type": content_type,
                },
                content=file_bytes,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error(f"Upload do Supabase Storage nieudany: HTTP {e.response.status_code}: {e.response.text}")
        raise AppException(
            "Nie udało się zapisać obrazu (Storage error)",
            code="STORAGE_UPLOAD_FAILED",
            status_code=502,
        )
    except httpx.TimeoutException:
        logger.error("Upload do Supabase Storage — timeout")
        raise AppException(
            "Zapis obrazu przekroczył limit czasu",
            code="STORAGE_TIMEOUT",
            status_code=504,
        )

    public_url = f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/{path}"
    logger.info(f"Obraz tablicy {board_id} zapisany: {public_url}")
    return public_url


def _public_url_prefix(supabase_url: str) -> str:
    return f"{supabase_url}/storage/v1/object/public/{BUCKET_NAME}/"


async def delete_board_image(url: str) -> None:
    """
    Kasuje JEDEN plik ze Storage po jego publicznym URL — wołane przy
    usunięciu pojedynczego elementu-obrazu z tablicy (WhiteboardService.delete_element).

    BEZ TEGO: Storage rósłby w nieskończoność, bo raz wgrany plik zostawałby
    tam na zawsze nawet po usunięciu elementu z tablicy — dokładnie ten
    scenariusz "zapchania się", o który zapytał user. Best-effort: nie
    rzuca wyjątku (błąd kasowania nie powinien blokować usunięcia elementu
    z tablicy — plik-sierota w Storage to dużo mniejszy problem niż
    zablokowany UI).
    """
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        return

    prefix = _public_url_prefix(supabase_url)
    if not url.startswith(prefix):
        # Nie nasz plik (np. stary base64 sprzed tej zmiany, albo zewnętrzny URL) — nic do skasowania
        return
    path = url[len(prefix):]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.request(
                "DELETE",
                f"{supabase_url}/storage/v1/object/{BUCKET_NAME}",
                headers={
                    "Authorization": f"Bearer {service_role_key}",
                    "apikey": service_role_key,
                    "Content-Type": "application/json",
                },
                json={"prefixes": [path]},
            )
            if response.status_code >= 400:
                logger.warning(f"Kasowanie obrazu ze Storage nieudane ({path}): HTTP {response.status_code}: {response.text}")
    except Exception as e:
        logger.warning(f"Kasowanie obrazu ze Storage nieudane ({path}): {e}")


async def delete_board_folder(board_id: int) -> None:
    """
    Kasuje WSZYSTKIE obrazy danej tablicy ze Storage naraz (cały folder
    `{board_id}/`) — wołane przy usunięciu całej tablicy
    (boards/service.py → delete_board). Best-effort, jak wyżej.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        return

    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Wylistuj wszystkie pliki w folderze tablicy (Storage nie ma
            #    "usuń cały folder" — trzeba najpierw wiedzieć co w nim jest)
            list_response = await client.post(
                f"{supabase_url}/storage/v1/object/list/{BUCKET_NAME}",
                headers=headers,
                json={"prefix": f"{board_id}/"},
            )
            if list_response.status_code >= 400:
                logger.warning(f"Listowanie obrazów tablicy {board_id} nieudane: HTTP {list_response.status_code}")
                return

            files = list_response.json()
            if not files:
                return
            paths = [f"{board_id}/{f['name']}" for f in files if isinstance(f, dict) and f.get("name")]
            if not paths:
                return

            # 2. Skasuj je wszystkie jednym requestem
            delete_response = await client.request(
                "DELETE",
                f"{supabase_url}/storage/v1/object/{BUCKET_NAME}",
                headers=headers,
                json={"prefixes": paths},
            )
            if delete_response.status_code >= 400:
                logger.warning(f"Kasowanie obrazów tablicy {board_id} nieudane: HTTP {delete_response.status_code}")
            else:
                logger.info(f"Skasowano {len(paths)} obraz(ów) tablicy {board_id} ze Storage")
    except Exception as e:
        logger.warning(f"Kasowanie folderu tablicy {board_id} ze Storage nieudane: {e}")
