"""
System logowania aplikacji - JSON na stdout (Render/Docker), kompatybilny z uvicornem.

Etap O2 z docs/architecture/OBSERWOWALNOSC-PLAN.md:
- kazda linia to jeden obiekt JSON: ts, level, logger, msg, request_id, user_id
  (+ pola z `extra=` i exc_info przy bledach) - do przeszukiwania w Render Logs,
- request_id/user_id dokleja filtr z core.request_context (contextvars),
- NIE rusza loggerow uvicorna (uvicorn.access zostaje tekstowy),
- pliki logs/*.log usuniete: na Render dysk kontenera jest efemeryczny, a lokalnie
  stdout w terminalu wystarcza.

RODO: do logow NIE trafiaja tokeny, hasla, e-maile ani tresc tablicy - loguj id,
statusy i kody; query string zadania nie jest logowany (patrz core/request_id.py).
"""
import json
import logging
import sys
from datetime import datetime, timezone

from core.request_context import get_request_id, get_user_id

# Pola standardowe LogRecord, ktorych nie kopiujemy do JSON-a jako "extra"
_STANDARD_ATTRS = set(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime"}


class RequestContextFilter(logging.Filter):
    """Dokleja request_id i user_id z contextvars do kazdego rekordu."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        record.user_id = get_user_id()
        return True


class JsonFormatter(logging.Formatter):
    """Jedna linia JSON na rekord; `extra=` z wywolania trafia jako dodatkowe pola."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
            "user_id": getattr(record, "user_id", None),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD_ATTRS and key not in payload and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc_type"] = record.exc_info[0].__name__ if record.exc_info[0] else None
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_logging(log_level: str = "INFO") -> None:
    """
    Konfiguruje root logger: jeden handler JSON na stdout + filtr kontekstu.
    Loggery uvicorna maja wlasne handlery i propagate=False - nie dotykamy ich.
    """
    root_logger = logging.getLogger()

    # Usun tylko nasze poprzednie handlery (reload uvicorna, testy) - poznajemy je po formatterze
    for handler in root_logger.handlers[:]:
        if isinstance(handler.formatter, JsonFormatter):
            root_logger.removeHandler(handler)

    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(JsonFormatter())
    console_handler.addFilter(RequestContextFilter())
    root_logger.addHandler(console_handler)

    for name in ("auth", "dashboard", "core", "http"):
        app_logger = logging.getLogger(name)
        app_logger.setLevel(logging.DEBUG)
        app_logger.propagate = True

    logging.getLogger(__name__).info("logging.ready", extra={"log_level": log_level})


def get_logger(name: str) -> logging.Logger:
    """Pobiera logger dla modulu"""
    return logging.getLogger(name)
