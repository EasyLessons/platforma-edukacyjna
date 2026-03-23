"""
DATABASE CONNECTION - PostgreSQL (Neon)
========================================

Cel: 
    Zarządza połączeniem z bazą danych PostgreSQL.
    Tworzy silnik (engine) i fabrykę sesji do komunikacji z bazą.

Konfiguracja:
    - DATABASE_URL z .env - connection string do bazy Neon PostgreSQL
      Przykład: postgresql://user:password@host:5432/database
    
    - Pool z connection recycling - rozwiązuje problem SSL timeout
      (Neon serverless zamyka nieaktywne połączenia po ~5 minutach)

Powiązane pliki:
    - core/config.py - pobiera DATABASE_URL z .env
    - auth/models.py - definiuje tabele (User, etc.)
    - auth/routes.py - używa get_db() w endpointach
    - main.py - importuje engine do inicjalizacji tabel

Użycie w endpointach:
    @router.post("/register")
    async def register(db: Session = Depends(get_db)):
        # db to sesja bazy danych
        user = db.query(User).filter(User.email == email).first()
        db.add(new_user)
        db.commit()

Technologie:
    - SQLAlchemy - ORM (Object-Relational Mapping)
    - PostgreSQL - relacyjna baza danych
    - Neon - serverless PostgreSQL hosting
"""

import time
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import OperationalError
from core.config import get_settings
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()
logger = logging.getLogger(__name__)

settings = get_settings()

# ============================================
# ENGINE - Silnik połączenia z bazą danych
# ============================================
# 
# NullPool — wyłącza LOKALNY connection pool w SQLAlchemy.
#
# DLACZEGO?
#   Neon używa wbudowanego PgBouncer pooler (widać w URL: "...pooler.eu-west-2...").
#   PgBouncer już zarządza pulą połączeń po stronie serwera.
#   Jeśli SQLAlchemy też trzyma swój pool, to mamy "double pooling":
#     SQLAlchemy trzyma stare połączenie → Neon/PgBouncer je zamyka po timeout →
#     SQLAlchemy próbuje użyć martwego połączenia → "server closed the connection unexpectedly"
#
#   NullPool = każdy request tworzy NOWE połączenie i zamyka je po zakończeniu.
#   PgBouncer i tak je zrecykluje po stronie serwera — zero marnotrawstwa.
#
engine = create_engine(
    settings.database_url,
    poolclass=NullPool,  # Bez lokalnego poola — Neon pooler zarządza połączeniami
    connect_args={
        # Nie pozwól requestom wisieć przy problemach sieci/SSL do Neon.
        "connect_timeout": 5,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    },
)

# ============================================
# SESSION FACTORY - Fabryka sesji
# ============================================
#
# Co to jest SessionLocal?
#   - Fabryka (factory) do tworzenia sesji bazy danych
#   - Sesja = pojedyncze połączenie do wykonania operacji (SELECT, INSERT, UPDATE)
#
# Parametry:
#   autocommit=False
#     - Transakcje NIE są automatycznie commitowane
#     - Musisz ręcznie wywołać db.commit()
#     - DLACZEGO? Bezpieczeństwo - możesz rollback przy błędzie
#
#   autoflush=False
#     - Zmiany NIE są automatycznie wysyłane do bazy
#     - Musisz ręcznie wywołać db.flush() lub db.commit()
#     - DLACZEGO? Kontrola - możesz zgrupować wiele operacji
#
#   bind=engine
#     - Przypisz ten SessionLocal do konkretnego engine
#
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ============================================
# GET_DB - Generator sesji (Dependency)
# ============================================
#
# Co to robi?
#   - Tworzy nową sesję bazy danych
#   - Używa yield (generator) zamiast return
#   - Po zakończeniu requestu automatycznie zamyka sesję
#
# Dlaczego yield a nie return?
#   - yield = "pożycz sesję, potem ją zamknij"
#   - return = "daj sesję i zapomnij" (nigdy się nie zamknie!)
#
# Jak działa w FastAPI?
#   1. Request przychodzi do endpointu
#   2. FastAPI wywołuje get_db()
#   3. Tworzy sesję: db = SessionLocal()
#   4. yield db → przekazuje sesję do endpointu
#   5. Endpoint używa db
#   6. Endpoint kończy pracę
#   7. finally: db.close() → zamyka sesję
#
# Przykład użycia:
#   @router.post("/register")
#   async def register(data: RegisterUser, db: Session = Depends(get_db)):
#       # FastAPI automatycznie:
#       # 1. Wywołuje get_db()
#       # 2. Przekazuje sesję jako parametr 'db'
#       # 3. Po zakończeniu funkcji zamyka sesję
#       
#       user = db.query(User).filter(User.email == data.email).first()
#       if user:
#           raise HTTPException(400, "Email zajęty")
#       
#       new_user = User(username=data.username, email=data.email)
#       db.add(new_user)
#       db.commit()  # Zapisz do bazy
#       db.refresh(new_user)  # Odśwież obiekt (ID, created_at, etc.)
#       return new_user
#
# Dlaczego Depends(get_db)?
#   - Depends = FastAPI Dependency Injection
#   - FastAPI automatycznie zarządza cyklem życia sesji
#   - Nie musisz ręcznie tworzyć/zamykać połączeń
#
def get_db():
    """
    Generator sesji bazy danych dla FastAPI Dependency Injection

    Zawiera retry logic dla Neon serverless:
        Neon może zwrócić "Control plane request failed" gdy compute
        endpoint właśnie się budzi po auto-suspend (cold start).
        Próbujemy połączenia do 3 razy z wykładniczym backoffem (1s, 2s).

    Yields:
        Session: Sesja SQLAlchemy do wykonywania operacji na bazie
    """
    MAX_RETRIES = 3
    db = None
    last_exc = None

    for attempt in range(MAX_RETRIES):
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))  # Eagerly test connection (cold start Neon)
            last_exc = None
            break
        except OperationalError as e:
            db.close()
            db = None
            last_exc = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s

    if last_exc is not None:
        raise last_exc

    try:
        yield db
    finally:
        if db is not None:
            try:
                db.close()
            except OperationalError:
                # Połączenie mogło zostać ubite zdalnie; ignorujemy przy cleanupie,
                # bo i tak kończymy request.
                logger.warning("DB session close failed: stale/closed SSL connection")