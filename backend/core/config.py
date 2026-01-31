"""
CONFIGURATION - Ustawienia aplikacji
=====================================

Cel:
    Centralne zarządzanie ustawieniami aplikacji.
    Automatycznie czyta zmienne środowiskowe z .env (development)
    lub z systemu (production - Heroku/Vercel).

Zmienne środowiskowe:
    DATABASE_URL - Connection string do PostgreSQL (Neon)
        Przykład: postgresql://user:pass@host:5432/db
        Lokalne: postgresql://localhost/mydb
        Produkcja: postgresql://user:pass@aws-xyz.neon.tech:5432/prod_db
    
    SECRET_KEY - Klucz do podpisywania JWT tokenów
        Przykład: super-secret-key-change-in-production-123456
        UWAGA: W produkcji MUSI być długi i losowy!
    
    ALGORITHM - Algorytm szyfrowania JWT (domyślnie HS256)
        HS256 = HMAC-SHA256 (symetryczne, wystarczające dla większości)
        HS512 = HMAC-SHA512 (mocniejsze)
        RS256 = RSA (asymetryczne, dla mikroserwisów)
    
    ACCESS_TOKEN_EXPIRE_MINUTES - Czas ważności tokenu JWT (domyślnie 30 min)
        15 = Bardziej bezpieczne, ale user musi się częściej logować
        30 = Standard (balans między bezpieczeństwem a UX)
        1440 = 24h (wygodne, ale mniej bezpieczne)
    
    RESEND_API_KEY - Klucz API do Resend (wysyłanie emaili)
        Przykład: re_123abc456def
        Pobierz z: https://resend.com/api-keys
    
    FROM_EMAIL - Adres email nadawcy
        Development: onboarding@resend.dev (testowy, wysyła tylko na twój email)
        Production: noreply@twoja-domena.com (wymaga weryfikacji domeny)

Powiązane pliki:
    - .env - plik z zmiennymi środowiskowymi (NIGDY nie commituj do git!)
    - core/database.py - używa DATABASE_URL
    - auth/utils.py - używa SECRET_KEY, ALGORITHM
    - auth/service.py - używa RESEND_API_KEY, FROM_EMAIL
    - wszystkie pliki - używają get_settings()

Użycie:
    from core.config import get_settings
    
    settings = get_settings()  # Cached (lru_cache) - szybkie
    print(settings.database_url)
    print(settings.secret_key)

Jak działa w różnych środowiskach:
    DEVELOPMENT (lokalnie):
        - Czyta z pliku .env w katalogu backend/
        - Jeśli .env nie istnieje → błąd
    
    PRODUCTION (Heroku/Vercel):
        - Czyta ze zmiennych środowiskowych systemu
        - Ustawiane przez: heroku config:set KEY=value
        - Plik .env nie jest wgrywany na serwer!

Bezpieczeństwo:
    ⚠️ NIGDY nie commituj .env do git!
    ⚠️ W produkcji użyj mocnego SECRET_KEY (min. 32 znaki losowe)
    ✅ Dodaj .env do .gitignore
"""

from pydantic_settings import BaseSettings
from functools import lru_cache

# ============================================
# SETTINGS - Klasa ustawień aplikacji
# ============================================
#
# BaseSettings (z Pydantic):
#   - Automatycznie czyta zmienne środowiskowe
#   - Waliduje typy (int, str, bool)
#   - Konwertuje typy (string "8000" → int 8000)
#   - Ustawia domyślne wartości
#
# Jak działa automatyczne czytanie:
#   database_url: str → czyta DATABASE_URL z .env
#   secret_key: str → czyta SECRET_KEY z .env
#   (wielkość liter nie ma znaczenia gdy case_sensitive=False)
#
class Settings(BaseSettings):
    # === BAZA DANYCH ===
    database_url: str  # WYMAGANE (brak domyślnej wartości)
    # Connection string do PostgreSQL
    # Format: postgresql://username:password@host:port/database_name
    
    # === JWT TOKENY ===
    secret_key: str  # WYMAGANE - klucz do podpisywania tokenów
    # W produkcji: python -c "import secrets; print(secrets.token_urlsafe(32))"
    
    algorithm: str = "HS256"  # Opcjonalne - algorytm szyfrowania JWT
    # HS256 = HMAC-SHA256 (standard, szybki, wystarczający)
    # HS512 = HMAC-SHA512 (wolniejszy, mocniejszy)
    # RS256 = RSA (klucze publiczny/prywatny, dla mikroserwisów)
    
    access_token_expire_minutes: int = 1440  # Opcjonalne - czas życia tokenu (24h)
    # 15 = Więcej bezpieczeństwa, gorsze UX (częste logowania)
    # 30 = Standard (balans)
    # 360 = 6h (dla długich sesji pracy na tablicy)
    # 1440 = 24h (wygodne, ale jeśli token wycieknie → szkody przez 24h)
    
    # === EMAIL (RESEND) ===
    resend_api_key: str  # WYMAGANE - klucz API z resend.com
    # Pobierz z: https://resend.com/api-keys
    
    from_email: str  # WYMAGANE - adres nadawcy emaili
    # Development: onboarding@resend.dev (testowy, działa od razu)
    # Production: noreply@twoja-domena.com (wymaga weryfikacji domeny w Resend)

    port: int = 8000
    
    # === KONFIGURACJA PYDANTIC ===
    class Config:
        env_file = ".env"  # Czytaj zmienne z pliku .env (development)
        # W produkcji (Heroku/Vercel) .env nie istnieje, czyta z systemu
        
        case_sensitive = False  # database_url == DATABASE_URL (nie ma różnicy)
        # Dzięki temu możesz pisać DATABASE_URL w .env ale database_url w kodzie

# ============================================
# GET_SETTINGS - Funkcja do pobierania ustawień
# ============================================
#
# @lru_cache() - Cache'owanie wyniku
#   - Pierwsza wywołanie: Settings() czyta .env, parsuje, waliduje (0.1s)
#   - Kolejne wywołania: zwraca z cache (0.0001s)
#   - DLACZEGO? Optymalizacja - nie chcemy czytać .env 1000x na sekundę
#
# LRU = Least Recently Used
#   - Zapamiętywa N ostatnich wyników (domyślnie 128)
#   - Jeśli cache się zapełni → usuwa najstarszy wynik
#   - W naszym przypadku: zawsze 1 wynik (Settings nie zmienia się)
#
# Przykład działania:
#   call 1: get_settings() → czyta .env (0.1s) → zwraca Settings
#   call 2: get_settings() → zwraca z cache (0.0001s)
#   call 3: get_settings() → zwraca z cache (0.0001s)
#   ... 1000 razy → cache
#
# BEZ cache:
#   1000 wywołań × 0.1s = 100 sekund zmarnowane!
#
# Z cache:
#   1 wywołanie × 0.1s + 999 wywołań × 0.0001s ≈ 0.1s total!
#
@lru_cache()
def get_settings():
    """
    Pobiera ustawienia aplikacji (cached dla wydajności)
    
    Returns:
        Settings: Obiekt z wszystkimi ustawieniami z .env
    
    Cache:
        Wynik jest cache'owany - pierwsze wywołanie czyta .env,
        kolejne zwracają zapamiętany obiekt (optymalizacja).
    
    Użycie:
        from core.config import get_settings
        
        settings = get_settings()
        print(settings.database_url)  # postgresql://...
        print(settings.secret_key)    # super-secret-123
    
    Przykład w service:
        class AuthService:
            def __init__(self, db):
                self.settings = get_settings()  # Szybkie (cache)
            
            async def login(self, data):
                token = create_token(
                    secret_key=self.settings.secret_key,
                    algorithm=self.settings.algorithm
                )
    """
    return Settings()