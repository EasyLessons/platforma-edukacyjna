"""
STARTUP.PY - Inicjalizacja bazy danych przy starcie aplikacji
=============================================================

Rozwiązuje problem: "board_elements nie została dodana na Neon"

PROBLEM:
    Migracja startowa (fdc1f49035d9) zakłada, że tabela 'users' już istnieje
    (tworzy FK do users.id). Na świeżej bazie Neon to się nie sprawdza i
    całe alembic upgrade head kończy się błędem → board_elements nie jest
    tworzona.

ROZWIĄZANIE:
    1. Sprawdź czy alembic_version istnieje w bazie
    2. TAK  → normalne alembic upgrade head (migracje inkrementalne)
    3. NIE  → Base.metadata.create_all (tworzy WSZYSTKIE brakujące tabele,
              włącznie z board_elements) + alembic stamp head
              (żeby alembic wiedział że jest już aktualny)

OBSŁUGIWANE SCENARIUSZE:
    - Świeża baza Neon (puste)          → tworzy wszystkie tabele
    - Baza z tabelami, bez alembic       → dokłada brakujące tabele
    - Baza z alembic_version             → normalne alembic upgrade head
    - Timeout połączenia (Neon cold start) → retry 5 razy co 5 sekund
"""

import sys
import time
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

MAX_RETRIES = 5
RETRY_DELAY = 5  # sekund


def _get_engine_and_base():
    """Importuje engine i Base po odczytaniu settings."""
    from core.database import engine, Base
    import core.models  # noqa: F401 - rejestruje wszystkie modele z Base.metadata
    return engine, Base


def _has_alembic_version(engine) -> bool:
    """Sprawdź czy tabela alembic_version istnieje w bazie."""
    from sqlalchemy import inspect as sa_inspect
    inspector = sa_inspect(engine)
    return inspector.has_table("alembic_version")


def _run_alembic_upgrade():
    """Uruchom alembic upgrade head."""
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


def _create_all_and_stamp(engine, Base):
    """Utwórz wszystkie brakujące tabele i oznacz jako head."""
    from alembic.config import Config
    from alembic import command

    logger.info("Tworzenie brakujących tabel (Base.metadata.create_all)...")
    Base.metadata.create_all(engine)  # domyślnie pomija tabele, które już istnieją
    logger.info("✅ Tabele zostały utworzone")

    logger.info("Oznaczanie bazy jako alembic head...")
    alembic_cfg = Config("alembic.ini")
    command.stamp(alembic_cfg, "head")
    logger.info("✅ Alembic stamped at head")


def run_startup():
    """Główna funkcja startowa — inicjalizuje bazę danych."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            engine, Base = _get_engine_and_base()

            if _has_alembic_version(engine):
                # Baza jest już śledzona przez Alembic — uruchom migracje
                logger.info("Uruchamianie alembic upgrade head...")
                _run_alembic_upgrade()
                logger.info("✅ Migracje zastosowane pomyślnie")
            else:
                # Brak historii migracji — utwórz tabele + stamp
                logger.info("Brak alembic_version — inicjalizacja bazy danych...")
                _create_all_and_stamp(engine, Base)

            return  # sukces — wychodzimy z pętli

        except Exception as exc:
            if attempt < MAX_RETRIES:
                logger.warning(
                    "Próba %d/%d nie powiodła się: %s. "
                    "Ponawiam za %ds...",
                    attempt, MAX_RETRIES, exc, RETRY_DELAY
                )
                time.sleep(RETRY_DELAY)
            else:
                logger.error("Inicjalizacja bazy danych nie powiodła się po %d próbach: %s", MAX_RETRIES, exc)
                sys.exit(1)


if __name__ == "__main__":
    run_startup()
