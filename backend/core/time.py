"""
Jedno miejsce na "teraz" w UTC.

`datetime.utcnow()` jest deprecowane (Python 3.12) i zwraca naive datetime. Kolumny
DateTime w core/models.py sa naive (bez strefy), wiec zachowujemy TEN SAM ksztalt
danych: aware UTC -> naive. Dzieki temu porownania z wartosciami z bazy i stare
rekordy dzialaja bez migracji. Przejscie na aware datetimes (DateTime(timezone=True))
to osobna decyzja z migracja Alembic.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive datetime w UTC - zamiennik 1:1 dla datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
