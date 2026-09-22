"""
Kontekst zadania (request_id, user_id) w contextvars - dostepny w logach,
odpowiedziach bledow i handlerach bez przekazywania przez parametry.
Etap O2 z docs/architecture/OBSERWOWALNOSC-PLAN.md.
"""
import re
import uuid
from contextvars import ContextVar

REQUEST_ID_HEADER = "X-Request-ID"
# Dopuszczalny identyfikator z zewnatrz: uuid/ulid/hex, max 64 znaki - nic innego
# (klient moglby podrzucic dowolny tekst, ktory trafilby do logow).
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_user_id: ContextVar[int | None] = ContextVar("user_id", default=None)


def new_request_id() -> str:
    return uuid.uuid4().hex


def sanitize_request_id(value: str | None) -> str:
    """Zwraca id z naglowka, jesli jest poprawny; inaczej nowy uuid."""
    if value and _VALID_REQUEST_ID.match(value):
        return value
    return new_request_id()


def set_request_id(value: str) -> None:
    _request_id.set(value)


def get_request_id() -> str | None:
    return _request_id.get()


def set_user_id(value: int | None) -> None:
    _user_id.set(value)


def get_user_id() -> int | None:
    return _user_id.get()
