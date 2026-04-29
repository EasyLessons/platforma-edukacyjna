"""
CONFIGURATION - Ustawienia aplikacji
=====================================

Cel:
    Centralne zarządzanie ustawieniami aplikacji.
    Automatycznie czyta zmienne środowiskowe z .env (development)
    lub z systemu (production - Heroku/Vercel).
"""

from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # === BAZA DANYCH ===
    database_url: str  # WYMAGANE (brak domyślnej wartości)
    # Connection string do PostgreSQL
    supabase_url: str  # WYMAGANE - URL Twojego projektu Supabase
    supabase_service_role_key: str  # WYMAGANE - Service Role Key z Supabase
    
    # === JWT TOKENY ===
    secret_key: str  # WYMAGANE - klucz do podpisywania tokenów
    # W produkcji: python -c "import secrets; print(secrets.token_urlsafe(32))"
    
    algorithm: str = "HS256"  # Opcjonalne - algorytm szyfrowania JWT

    access_token_expire_minutes: int = 15   # Krótki czas życia - refresh token odnawia sesję
    refresh_token_expire_days: int = 7  # Dłuższy czas życia - użytkownik nie musi się logować przez tydzień
    cookie_secure: bool = False  # Ustaw na True w produkcji (HTTPS)
    cookie_samesite: str = "lax"  # "strict" | "lax" | "none"
    cookie_domain: str = ""  # np. ".easylesson.app" w produkcji (pusta = brak domain attr)

    # === EMAIL (RESEND) ===
    resend_api_key: str  # WYMAGANE - klucz API z resend.com
    # Pobierz z: https://resend.com/api-keys
    
    from_email: str  # WYMAGANE - adres nadawcy emaili
    # Development: onboarding@resend.dev (testowy, działa od razu)
    # Production: noreply@twoja-domena.com (wymaga weryfikacji domeny w Resend)

    # === GOOGLE OAUTH ===
    google_client_id: str  # WYMAGANE - Client ID z Google Cloud Console
    google_client_secret: str  # WYMAGANE - Client Secret z Google Cloud Console
    google_redirect_uri: str  # WYMAGANE - URI callback (np. http://localhost:8000/api/v1/auth/google/callback)
    frontend_url: str = "http://localhost:3000"  # Opcjonalne - URL frontendu (do przekierowania po logowaniu)

    port: int = 8000
    
    # === KONFIGURACJA PYDANTIC ===
    class Config:
        env_file = ".env"  # Czytaj zmienne z pliku .env (development)
        # W produkcji (Heroku/Vercel) .env nie istnieje, czyta z systemu
        
        case_sensitive = False  # database_url == DATABASE_URL (nie ma różnicy)
        # Dzięki temu możesz pisać DATABASE_URL w .env ale database_url w kodzie

@lru_cache()
def get_settings():
    """
    Pobiera ustawienia aplikacji (cached dla wydajności)
    
    Returns:
        Settings: Obiekt z wszystkimi ustawieniami z .env
    
    Cache:
        Wynik jest cache'owany - pierwsze wywołanie czyta .env,
        kolejne zwracają zapamiętany obiekt (optymalizacja).
    """
    return Settings()