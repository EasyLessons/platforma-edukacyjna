"""
Rozmowa glosowa tablicy przez Daily (https://docs.daily.co/reference/rest-api).

POST /api/v1/whiteboard/{board_id}/call (router.py -> WhiteboardService.create_call) wola
`create_board_call`, ktore:

  1. przesuwa wygasanie pokoju tablicy albo tworzy go, gdy nie istnieje (pokoj PRYWATNY,
     nazwa `<prefix>-board-<id>`; pokoje maja `exp`, wiec nie zajmuja limitu pokoi konta
     na stale - wygasle usuwa samo Daily; wygasniecie NIE rozlacza trwajacej rozmowy),
  2. wydaje meeting token dla tego uzytkownika i TEGO pokoju,
  3. zwraca adres pokoju + token. Klucz API zostaje na serwerze.

Zasady:
  * autoryzacje (czlonkostwo w tablicy) sprawdza wolajacy, ZANIM tu trafi,
  * token ZAWSZE ma `room_name` - token bez niego otwiera kazdy pokoj domeny Daily,
  * klucz API i token nigdy nie trafiaja do logow ani do tresci bledow; odpowiedz Daily
    na blad zostaje w logu serwera (przycieta), klient dostaje ogolny komunikat,
  * brak klucza -> 503 VOICE_NOT_CONFIGURED bez zadnego wywolania HTTP.

Kody statusow Daily, ktorych dokumentacja nie potwierdza (brak pokoju: 404 albo 400
"not found"; duplikat nazwy przy tworzeniu), obslugujemy w obu wariantach.
"""
import asyncio
import re
import time
import unicodedata
from datetime import datetime, timezone
from urllib.parse import urlsplit

import httpx
from fastapi import Depends
from redis.exceptions import RedisError

from core import redis_client as redis_client_module
from core.config import get_settings
from core.exceptions import AppException
from core.logging import get_logger
from core.models import User

from ..auth.dependencies import get_current_user
from .schemas import CallResponse

logger = get_logger(__name__)

DAILY_API_URL = "https://api.daily.co/v1"
DAILY_TIMEOUT_SECONDS = 8.0
# Daily: 429 przy przekroczeniu limitu zadan - jedno ponowienie po krotkiej przerwie.
DAILY_RATE_LIMIT_BACKOFF_SECONDS = 1.0

DEFAULT_ROOM_PREFIX = "easylesson"
ROOM_MAX_PARTICIPANTS = 50
# Token ogranicza tylko MOMENT wejscia (bez eject_at_token_exp) - trwajaca rozmowa
# nie jest przerywana, gdy token wygasnie.
TOKEN_TTL_SECONDS = 60 * 60
USER_NAME_MAX_LENGTH = 64
USER_NAME_FALLBACK = "Uczestnik"

# Adres pokoju z odpowiedzi Daily trafia do iframe z mikrofonem/kamera razem z tokenem,
# wiec przyjmujemy tylko https://<subdomena>.daily.co/<nazwa pokoju>.
DAILY_ROOM_HOST_SUFFIX = ".daily.co"

# Limit per UZYTKOWNIK, liczony po autoryzacji: klasa siedzi za jednym NAT-em, wiec limit
# per IP odcinalby wszystkich naraz (ten sam powod co przy /api/turn - docs pipelines.md).
CALL_RATE_LIMIT = 30
CALL_RATE_WINDOW_SECONDS = 60


async def call_rate_limit(current_user: User = Depends(get_current_user)) -> None:
    """Fail-open: awaria Redis nie moze odciac lekcji od rozmowy."""
    key = f"ratelimit:whiteboard_call:user:{current_user.id}"
    try:
        redis = redis_client_module.get_redis_client()
        current = await redis.incr(key)
        if current == 1 or await redis.ttl(key) == -1:
            await redis.expire(key, CALL_RATE_WINDOW_SECONDS)
    except RedisError:
        logger.exception("Błąd Redis przy rate limitingu (scope=whiteboard_call) - przepuszczam")
        return
    if current > CALL_RATE_LIMIT:
        raise AppException(
            "Zbyt wiele prób, spróbuj ponownie później.",
            code="RATE_LIMITED",
            status_code=429,
        )


def room_name_for_board(board_id: int) -> str:
    """Deterministyczna nazwa pokoju: tylko male litery, cyfry i myslnik."""
    prefix = re.sub(r"[^a-z0-9-]", "", (get_settings().daily_room_prefix or "").lower()).strip("-")
    return f"{prefix or DEFAULT_ROOM_PREFIX}-board-{int(board_id)}"


def clean_user_name(username: str | None) -> str:
    """
    Nazwa pokazywana w rozmowie: bez znakow sterujacych i niewidocznych (kategorie
    Unicode C*: sterujace, formatujace - np. odwracanie kierunku tekstu), biale znaki
    scalone do pojedynczej spacji, przycieta.
    """
    text = "".join(
        " " if ch.isspace() else ch
        for ch in (username or "")
        if ch.isspace() or not unicodedata.category(ch).startswith("C")
    )
    text = " ".join(text.split())[:USER_NAME_MAX_LENGTH].strip()
    return text or USER_NAME_FALLBACK


def _provider_unavailable() -> AppException:
    return AppException(
        "Rozmowa jest chwilowo niedostępna, spróbuj ponownie za chwilę",
        code="VOICE_PROVIDER_ERROR",
        status_code=502,
    )


def _body(response: httpx.Response) -> dict:
    try:
        data = response.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def _log_text(value, api_key: str) -> str:
    """Fragment odpowiedzi Daily do logu: przyciety, w jednej linii, bez klucza API."""
    text = " ".join(str(value or "").split())
    if api_key:
        text = text.replace(api_key, "***")
    return text[:200]


def _provider_error(response: httpx.Response, action: str, api_key: str) -> AppException:
    """Loguje blad Daily (bez sekretow) i zwraca ogolny blad 502 dla klienta."""
    body = _body(response)
    if response.status_code in (401, 403):
        logger.error(
            f"Daily odrzucił klucz API przy: {action} (HTTP {response.status_code}, "
            f"error={_log_text(body.get('error'), api_key)}) - zły DAILY_API_KEY?"
        )
    else:
        logger.error(
            f"Daily - nieudane: {action} (HTTP {response.status_code}, "
            f"error={_log_text(body.get('error'), api_key)}, info={_log_text(body.get('info'), api_key)})"
        )
    return _provider_unavailable()


async def _request(client: httpx.AsyncClient, method: str, path: str, **kwargs) -> httpx.Response:
    """
    Jedno wywolanie Daily. Timeout -> 504, blad sieci -> 502, 429 -> jedno ponowienie.
    Statusy HTTP interpretuje wolajacy.
    """
    for attempt in (1, 2):
        try:
            response = await client.request(method, path, **kwargs)
        except httpx.TimeoutException:
            logger.error(f"Daily - timeout ({method} {path})")
            raise AppException(
                "Połączenie z usługą rozmów przekroczyło limit czasu, spróbuj ponownie",
                code="VOICE_PROVIDER_TIMEOUT",
                status_code=504,
            )
        except httpx.HTTPError as e:
            logger.error(f"Daily - błąd połączenia ({method} {path}): {type(e).__name__}")
            raise _provider_unavailable()
        if response.status_code != 429 or attempt == 2:
            return response
        logger.warning(f"Daily - limit żądań (429) przy {method} {path}, ponawiam")
        await asyncio.sleep(DAILY_RATE_LIMIT_BACKOFF_SECONDS)
    raise AssertionError("unreachable")  # pragma: no cover


def _is_room_missing(response: httpx.Response) -> bool:
    if response.status_code == 404:
        return True
    if response.status_code != 400:
        return False
    body = _body(response)
    return "not found" in f"{body.get('error', '')} {body.get('info', '')}".lower()


def _room_exp(room: dict) -> float | None:
    config = room.get("config")
    exp = config.get("exp") if isinstance(config, dict) else None
    return exp if isinstance(exp, (int, float)) and not isinstance(exp, bool) else None


def _is_daily_room_url(url, name: str) -> bool:
    if not isinstance(url, str):
        return False
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        return False
    host = parts.hostname or ""
    return (
        parts.scheme == "https"
        and host.endswith(DAILY_ROOM_HOST_SUFFIX)
        and len(host) > len(DAILY_ROOM_HOST_SUFFIX)
        and parts.netloc.lower() == host  # bez userinfo i portu
        and port is None
        and parts.path == f"/{name}"
        and not parts.query
        and not parts.fragment
    )


def _checked_room_url(room: dict, name: str) -> str:
    """Adres pokoju z odpowiedzi Daily; pokoj musi byc nasz, PRYWATNY i w domenie daily.co."""
    url = room.get("url")
    if room.get("name") != name or not _is_daily_room_url(url, name):
        logger.error("Daily - odpowiedź z pokojem ma nieoczekiwany kształt (name/url)")
        raise _provider_unavailable()
    if room.get("privacy") != "private":
        # Publiczny pokoj o przewidywalnej nazwie wpuszczalby kazdego, kto zna adres.
        logger.error(f"Daily - pokój {name} nie jest prywatny, odmawiam wydania tokenu")
        raise _provider_unavailable()
    return url


async def _create_room(client: httpx.AsyncClient, name: str, exp: int) -> httpx.Response:
    return await _request(
        client,
        "POST",
        "/rooms",
        json={
            "name": name,
            "privacy": "private",
            "properties": {
                "exp": exp,
                # Wygasniecie pokoju blokuje tylko NOWE wejscia - trwajaca lekcja nie moze
                # zostac przerwana przez backend (zlecenie 02.10.2026).
                "eject_at_room_exp": False,
                "start_video_off": True,
                "start_audio_off": False,
                "enable_prejoin_ui": True,
                "enable_chat": False,
                "max_participants": ROOM_MAX_PARTICIPANTS,
            },
        },
    )


async def _ensure_room(client: httpx.AsyncClient, name: str, now: int, api_key: str) -> str:
    """Przesuwa wygasanie pokoju albo tworzy go; zwraca adres pokoju."""
    exp = now + max(1, get_settings().daily_room_ttl_minutes) * 60

    updated = await _request(client, "POST", f"/rooms/{name}", json={"properties": {"exp": exp}})
    if updated.status_code == 200:
        return _checked_room_url(_body(updated), name)
    if updated.status_code not in (400, 404):
        raise _provider_error(updated, "aktualizacja pokoju", api_key)
    if not _is_room_missing(updated):
        logger.warning(
            f"Daily - aktualizacja pokoju {name}: HTTP {updated.status_code}, "
            f"info={_log_text(_body(updated).get('info'), api_key)} - próbuję utworzyć"
        )

    created = await _create_room(client, name, exp)
    if created.status_code == 200:
        return _checked_room_url(_body(created), name)
    if created.status_code != 400:
        raise _provider_error(created, "tworzenie pokoju", api_key)

    # 400 przy tworzeniu = najpewniej wyscig: druga osoba utworzyla pokoj chwile wczesniej.
    existing = await _request(client, "GET", f"/rooms/{name}")
    if existing.status_code != 200:
        raise _provider_error(created, "tworzenie pokoju", api_key)
    room = _body(existing)
    room_exp = _room_exp(room)
    if room_exp is None or room_exp > now:
        return _checked_room_url(room, name)

    # Pokoj istnieje, ale wygasl i Daily nie pozwolil przesunac `exp` (zachowanie
    # niepotwierdzone w dokumentacji): kasujemy WLASNY wygasly pokoj i tworzymy go raz jeszcze.
    logger.warning(f"Daily - pokój {name} wygasł i nie dał się odświeżyć, tworzę od nowa")
    deleted = await _request(client, "DELETE", f"/rooms/{name}")
    if deleted.status_code != 200 and not _is_room_missing(deleted):
        raise _provider_error(deleted, "kasowanie wygasłego pokoju", api_key)
    recreated = await _create_room(client, name, exp)
    if recreated.status_code != 200:
        raise _provider_error(recreated, "ponowne tworzenie pokoju", api_key)
    return _checked_room_url(_body(recreated), name)


async def _create_token(
    client: httpx.AsyncClient,
    *,
    room_name: str,
    user_id: int,
    username: str | None,
    is_owner: bool,
    exp: int,
    api_key: str,
) -> str:
    response = await _request(
        client,
        "POST",
        "/meeting-tokens",
        json={
            "properties": {
                "room_name": room_name,
                "user_name": clean_user_name(username),
                "user_id": str(user_id)[:36],
                "exp": exp,
                "is_owner": bool(is_owner),
                "start_video_off": True,
                "start_audio_off": False,
                "eject_at_token_exp": False,
            }
        },
    )
    if response.status_code != 200:
        raise _provider_error(response, "wydanie tokenu", api_key)
    token = _body(response).get("token")
    if not isinstance(token, str) or not token:
        logger.error("Daily - odpowiedź /meeting-tokens bez tokenu")
        raise _provider_unavailable()
    return token


async def create_board_call(board_id: int, *, user_id: int, username: str | None, is_owner: bool) -> CallResponse:
    """
    Pokoj + token rozmowy dla tablicy. Rzuca AppException: 503 VOICE_NOT_CONFIGURED,
    502 VOICE_PROVIDER_ERROR, 504 VOICE_PROVIDER_TIMEOUT.
    """
    api_key = (get_settings().daily_api_key or "").strip()
    if not api_key:
        logger.warning("Rozmowa głosowa wyłączona: brak DAILY_API_KEY")
        raise AppException(
            "Rozmowy głosowe są chwilowo wyłączone",
            code="VOICE_NOT_CONFIGURED",
            status_code=503,
        )

    name = room_name_for_board(board_id)
    now = int(time.time())
    token_exp = now + TOKEN_TTL_SECONDS

    async with httpx.AsyncClient(
        base_url=DAILY_API_URL,
        timeout=DAILY_TIMEOUT_SECONDS,
        headers={"Authorization": f"Bearer {api_key}"},
    ) as client:
        room_url = await _ensure_room(client, name, now, api_key)
        token = await _create_token(
            client,
            room_name=name,
            user_id=user_id,
            username=username,
            is_owner=is_owner,
            exp=token_exp,
            api_key=api_key,
        )

    logger.info(f"Rozmowa: wydano token (board_id={board_id}, owner={bool(is_owner)})")
    return CallResponse(
        room_url=room_url,
        token=token,
        expires_at=datetime.fromtimestamp(token_exp, tz=timezone.utc),
    )
