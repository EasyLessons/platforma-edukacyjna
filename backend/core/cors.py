"""
CORS - jedno zrodlo prawdy dla CORSMiddleware i handlera 500 (SEC-04).

Z allow_credentials=True kazdy dopuszczony origin moze wolac POST /auth/refresh
z ciasteczkiem i PRZECZYTAC nowy access token, dlatego:
- originy to jawna lista z env ALLOWED_ORIGINS (bez wildcardow),
- regex (ALLOWED_ORIGIN_REGEX) jest domyslnie wylaczony,
- metody i naglowki sa zawezone do faktycznie uzywanych przez frontend.
"""
import re

from core.config import Settings
from core.logging import get_logger
from core.request_context import REQUEST_ID_HEADER

logger = get_logger(__name__)

# Metody uzywane przez routery api/v1 (OPTIONS = preflight).
ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

# Naglowki wysylane przez przegladarke (src/_new/lib/api/client.ts): Authorization,
# Content-Type (JSON / multipart) i X-Request-ID. Accept, Accept-Language i
# Content-Language Starlette dopuszcza zawsze. X-Sync-Service-Token idzie wylacznie
# serwer-serwer (whiteboard-sync), wiec CORS go nie dotyczy.
ALLOWED_HEADERS = ["Authorization", "Content-Type", REQUEST_ID_HEADER]

# Bez tego JS z innego originu nie odczyta X-Request-ID z odpowiedzi.
EXPOSED_HEADERS = [REQUEST_ID_HEADER]


def compile_origin_regex(pattern: str) -> re.Pattern[str] | None:
    """Kompiluje ALLOWED_ORIGIN_REGEX; pusty lub niepoprawny wzorzec = regex wylaczony."""
    pattern = pattern.strip()
    if not pattern:
        return None
    try:
        return re.compile(pattern)
    except re.error:
        logger.error("ALLOWED_ORIGIN_REGEX nie jest poprawnym wyrazeniem - regex CORS wylaczony")
        return None


class CorsPolicy:
    """Polityka CORS wyliczona z ustawien - uzywana przez middleware i handler 500."""

    def __init__(self, settings: Settings):
        self.origins = settings.allowed_origins_list
        self._regex = compile_origin_regex(settings.allowed_origin_regex)

    def middleware_kwargs(self) -> dict:
        """Argumenty dla starlette CORSMiddleware."""
        return {
            "allow_origins": self.origins,
            "allow_origin_regex": self._regex.pattern if self._regex else None,
            "allow_credentials": True,
            "allow_methods": ALLOWED_METHODS,
            "allow_headers": ALLOWED_HEADERS,
            "expose_headers": EXPOSED_HEADERS,
        }

    def is_allowed_origin(self, origin: str | None) -> bool:
        """Ta sama regula co CORSMiddleware.is_allowed_origin (lista albo fullmatch regexu)."""
        if not origin:
            return False
        if origin in self.origins:
            return True
        return bool(self._regex and self._regex.fullmatch(origin))
