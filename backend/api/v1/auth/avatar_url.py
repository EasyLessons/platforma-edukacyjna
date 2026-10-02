"""
Walidacja `avatar_url` (SEC-14).

Adres awatara jest renderowany jako <img src> u wszystkich współczłonków workspace'u,
więc dowolny URL = tracking pixel (wyciek IP i czasu aktywności). Dopuszczamy wyłącznie:
- publiczne obiekty Storage NASZEGO projektu Supabase (host z SUPABASE_URL) - to wysyła
  dziś frontend po uploadzie do bucketu `avatars`,
- awatary kont Google (lh3.googleusercontent.com).
"""
from urllib.parse import urlsplit

from core.config import get_settings

AVATAR_URL_MAX_LENGTH = 500
GOOGLE_AVATAR_HOST = "lh3.googleusercontent.com"
SUPABASE_PUBLIC_OBJECT_PREFIX = "/storage/v1/object/public/"

_ERROR = "Niedozwolony adres awatara"


def _supabase_host() -> str | None:
    return urlsplit(get_settings().supabase_url).hostname


def validate_avatar_url(value: str) -> str:
    """Zwraca `value` albo rzuca ValueError (Pydantic zamienia go na 422)."""
    if len(value) > AVATAR_URL_MAX_LENGTH:
        raise ValueError(f"Adres awatara może mieć najwyżej {AVATAR_URL_MAX_LENGTH} znaków")
    # Białe znaki, znaki sterujące i backslash bywają różnie interpretowane przez parsery URL.
    if any(ch <= " " or ch == "\\" or ch == "\x7f" for ch in value):
        raise ValueError(_ERROR)

    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError:
        raise ValueError(_ERROR) from None

    if parts.scheme != "https" or parts.username or parts.password or port not in (None, 443):
        raise ValueError(_ERROR)

    host = parts.hostname
    if host == GOOGLE_AVATAR_HOST:
        return value
    if host and host == _supabase_host() and parts.path.startswith(SUPABASE_PUBLIC_OBJECT_PREFIX):
        return value
    raise ValueError(_ERROR)
