"""
Klient REST API Daily (https://docs.daily.co/reference/rest-api) - wspolne prymitywy dla
call.py (pokoj + token) i call_usage.py (zuzycie minut).

Zasady:
  * klucz API i token nigdy nie trafiaja do logow ani do tresci bledow; odpowiedz Daily na blad
    zostaje w logu serwera (przycieta, bez klucza), klient dostaje ogolny komunikat,
  * statusy HTTP interpretuje wolajacy; tutaj tylko transport (timeout, siec, jedno ponowienie 429).
"""
import asyncio
import re

import httpx

from core.exceptions import AppException
from core.logging import get_logger

logger = get_logger(__name__)

DAILY_API_URL = "https://api.daily.co/v1"
DAILY_TIMEOUT_SECONDS = 8.0
# Daily: 429 przy przekroczeniu limitu zadan - jedno ponowienie po krotkiej przerwie.
DAILY_RATE_LIMIT_BACKOFF_SECONDS = 1.0


_OPAQUE = re.compile(r"[A-Za-z0-9_\-.=+/]{32,}")


def daily_http_client(api_key: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=DAILY_API_URL,
        timeout=DAILY_TIMEOUT_SECONDS,
        headers={"Authorization": f"Bearer {api_key}"},
    )


def provider_unavailable() -> AppException:
    return AppException(
        "Rozmowa jest chwilowo niedostępna, spróbuj ponownie za chwilę",
        code="VOICE_PROVIDER_ERROR",
        status_code=502,
    )


def provider_limit() -> AppException:
    """Limit konta Daily (liczba pokoi) albo problem z platnoscia (402) - ponowienie nic nie da."""
    return AppException(
        "Rozmowa jest chwilowo niedostępna (limit konta rozmów)",
        code="VOICE_PROVIDER_LIMIT",
        status_code=503,
    )


def body(response: httpx.Response) -> dict:
    try:
        data = response.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def log_text(value, api_key: str) -> str:
    """Fragment odpowiedzi Daily do logu: przyciety, w jednej linii, bez klucza API."""
    text = " ".join(str(value or "").split())
    if api_key:
        text = text.replace(api_key, "***")
    # Dlugie ciagi bez spacji (tokeny spotkan, klucze w innym zapisie) tez nie trafiaja do logu.
    return _OPAQUE.sub("***", text)[:200]


def looks_like_account_limit(response: httpx.Response) -> bool:
    """402 albo blad z trescia o limicie (kod Daily dla limitu pokoi nie jest udokumentowany)."""
    if response.status_code == 402:
        return True
    if response.status_code not in (400, 403):
        return False
    data = body(response)
    text = f"{data.get('error', '')} {data.get('info', '')}".lower()
    return "limit" in text or "maximum" in text or "payment" in text


def provider_error(response: httpx.Response, action: str, api_key: str) -> AppException:
    """Loguje blad Daily (bez sekretow) i zwraca blad dla klienta (502 albo 503 przy limicie konta)."""
    data = body(response)
    error, info = log_text(data.get("error"), api_key), log_text(data.get("info"), api_key)
    if response.status_code == 401 or (response.status_code == 403 and not looks_like_account_limit(response)):
        logger.error(
            f"Daily odrzucił klucz API przy: {action} (HTTP {response.status_code}, error={error}) "
            "- zły DAILY_API_KEY?"
        )
        return provider_unavailable()
    if looks_like_account_limit(response):
        logger.error(
            f"Daily - limit konta albo płatność przy: {action} (HTTP {response.status_code}, "
            f"error={error}, info={info}) - sprawdź panel Daily (limit pokoi, billing)"
        )
        return provider_limit()
    logger.error(f"Daily - nieudane: {action} (HTTP {response.status_code}, error={error}, info={info})")
    return provider_unavailable()


async def request(client: httpx.AsyncClient, method: str, path: str, **kwargs) -> httpx.Response:
    """
    Jedno wywolanie Daily. Timeout -> 504, blad sieci / nieoczekiwany -> 502, 429 -> jedno ponowienie.
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
            raise provider_unavailable()
        except Exception as e:
            # Nieoczekiwany blad transportu: tresci wyjatku NIE logujemy (moze zawierac naglowki).
            logger.error(f"Daily - nieoczekiwany błąd ({method} {path}): {type(e).__name__}")
            raise provider_unavailable()
        if response.status_code != 429 or attempt == 2:
            return response
        logger.warning(f"Daily - limit żądań (429) przy {method} {path}, ponawiam")
        await asyncio.sleep(DAILY_RATE_LIMIT_BACKOFF_SECONDS)
    raise AssertionError("unreachable")  # pragma: no cover
