"""
System logowania dla aplikacji
KOMPATYBILNY Z UVICORN - NIE NADPISUJE UVICORN LOGGERÓW!
"""
import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler

def setup_logging(log_level: str = "INFO"):
    """
    Konfiguruje logi dla aplikacji (KOMPATYBILNE Z UVICORN!)
    
    ⚠️ WAŻNE:
    - NIE używa root loggera (nie nadpisuje uvicorn!)
    - Konfiguruje tylko loggery aplikacji
    - Uvicorn zachowuje swoją konfigurację
    
    Handlersy:
    - Konsola: kolorowe logi
    - Plik: logs/app.log (wszystko)
    - Plik: logs/error.log (tylko błędy)
    """
    
    # ========================================
    # ⚠️ KLUCZ DO SUKCESU: NIE RUSZAJ ROOT LOGGERA!
    # ========================================
    # Poprzednio: root_logger.handlers.clear() ← TO NISZCZYŁO UVICORN!
    # Teraz: Konfigurujemy tylko nasze loggery aplikacji
    
    # Konfiguruj handlery dla CAŁEJ aplikacji (root logger)
    root_logger = logging.getLogger()
    
    # Usuń TYLKO nasze poprzednie handlery (jeśli były)
    # NIE usuwaj handlerów uvicorn!
    for handler in root_logger.handlers[:]:
        # Zachowaj handlery uvicorn (mają inne formattery)
        if isinstance(handler, logging.StreamHandler) and hasattr(handler, 'formatter'):
            if handler.formatter and 'uvicorn' in str(type(handler.formatter)):
                continue
        # Usuń nasze stare handlery
        if isinstance(handler, (RotatingFileHandler,)):
            root_logger.removeHandler(handler)
    
    # Ustaw poziom dla root loggera (jeśli nie jest ustawiony)
    if root_logger.level == logging.NOTSET:
        root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # === PLIK: app.log (wszystko) ===
    log_path = Path("logs")
    log_path.mkdir(exist_ok=True)
    
    file_handler = RotatingFileHandler(
        filename=log_path / "app.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)  # Zbierz wszystko
    file_formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)
    
    # === PLIK: error.log (tylko błędy) ===
    error_handler = RotatingFileHandler(
        filename=log_path / "error.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    root_logger.addHandler(error_handler)
    
    # ========================================
    # KONFIGURUJ LOGGERY APLIKACJI
    # ========================================
    # Wszystkie moduły aplikacji będą logować do plików
    
    # Logger dla auth
    auth_logger = logging.getLogger("auth")
    auth_logger.setLevel(logging.DEBUG)
    auth_logger.propagate = True  # Propaguj do root (pliki)
    
    # Logger dla dashboard
    dashboard_logger = logging.getLogger("dashboard")
    dashboard_logger.setLevel(logging.DEBUG)
    dashboard_logger.propagate = True
    
    # Logger dla core
    core_logger = logging.getLogger("core")
    core_logger.setLevel(logging.DEBUG)
    core_logger.propagate = True
    
    # ========================================
    # UVICORN LOGGERS - NIE RUSZAJ ICH!
    # ========================================
    # Uvicorn ma własne loggery:
    # - uvicorn
    # - uvicorn.error
    # - uvicorn.access
    # 
    # Te loggery są już skonfigurowane przez uvicorn
    # i NIE POTRZEBUJĄ naszej ingerencji!
    
    # Info o uruchomieniu
    logger = logging.getLogger(__name__)
    logger.info("✅ System logowania zainicjalizowany")
    logger.debug(f"📝 Poziom logowania: {log_level}")
    logger.debug(f"📁 Katalog logów: {log_path.absolute()}")

def get_logger(name: str) -> logging.Logger:
    """Pobiera logger dla modułu"""
    return logging.getLogger(name)