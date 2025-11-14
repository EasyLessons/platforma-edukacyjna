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

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.config import get_settings
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

settings = get_settings()

# ============================================
# ENGINE - Silnik połączenia z bazą danych
# ============================================
# 
# Co to jest engine?
#   - "Silnik" który zarządza połączeniami z bazą
#   - Tworzy pool (pulę) połączeń do reużycia
#   - Wydajniejsze niż tworzenie nowego połączenia za każdym razem
#
# Parametry:
#   pool_pre_ping=True
#     - Przed użyciem połączenia sprawdza czy działa
#     - Jeśli nie działa (np. timeout) → tworzy nowe
#     - Zapobiega błędom "connection closed"
#
#   pool_recycle=1800 (30 minut)
#     - Automatycznie odnawia połączenie co 30 minut
#     - DLACZEGO? Neon serverless zamyka nieaktywne połączenia po ~5 min
#     - Zapobiega SSL timeout errors
#
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # Testuj połączenie przed użyciem
    pool_recycle=1800,   # Odnawiaj połączenie co 30 min
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
    
    Yields:
        Session: Sesja SQLAlchemy do wykonywania operacji na bazie
    
    Użycie:
        @router.post("/endpoint")
        async def endpoint(db: Session = Depends(get_db)):
            # Używaj db do query, add, commit, etc.
            pass
    
    Automatycznie:
        - Tworzy nową sesję przed requestem
        - Zamyka sesję po zakończeniu requestu (nawet przy błędzie)
    """
    db = SessionLocal()
    try:
        yield db  # Pożycz sesję do endpointu
    finally:
        db.close()  # Zawsze zamknij sesję 