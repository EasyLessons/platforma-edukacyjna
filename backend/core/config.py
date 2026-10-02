"""
CONFIGURATION - Ustawienia aplikacji
=====================================

Cel:
    Centralne zarządzanie ustawieniami aplikacji.
    Automatycznie czyta zmienne środowiskowe z .env (development)
    lub z systemu (production - Heroku/Vercel).
"""

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os

# Produkcja (Vercel) + lokalny dev. platforma-edukacyjna-five.vercel.app to domena
# przypisana do projektu Vercel (serwuje aplikacje); usunieto "-one" - zwracala 404,
# czyli byla wolna i kazdy mogl ja sobie przypisac.
DEFAULT_ALLOWED_ORIGINS = ",".join([
    "http://localhost:3000",
    "http://localhost:8000",
    "https://easylesson.app",
    "https://www.easylesson.app",
    "https://platforma-edukacyjna-five.vercel.app",
])

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
    frontend_url: str = "http://localhost:3000"  # Opcjonalne - URL frontendu (do przekierowania po logowaniu)

        # === REDIS (kody weryfikacyjne) ===
    redis_url: str  # WYMAGANE - connection string do Redis (np. redis://localhost:6379/0)
    verification_code_expire_minutes: int = 15  # czas ważności kodu weryfikacji/resetu hasła

    port: int = 8000

    # === WHITEBOARD-SYNC (klucz serwis-serwis) ===
    # whiteboard-sync czyta/zapisuje snapshot tablicy (GET/POST /whiteboard/{id}/doc) z naglowkiem
    # X-Sync-Service-Token zamiast tokenu usera, ktory wygasa po 15 min trwajacego polaczenia.
    # Ta sama wartosc musi byc w env whiteboard-sync. Pusty = klucz serwisu wylaczony
    # (dziala tylko token usera). Wygeneruj: python -c "import secrets; print(secrets.token_urlsafe(32))"
    sync_service_token: str = ""

    # === ROZMOWA GLOSOWA (Daily) ===
    # Klucz API Daily - TYLKO backend (api/v1/whiteboard/call.py), nigdy przegladarka.
    # Pusty = rozmowy wylaczone: POST /whiteboard/{id}/call zwraca 503 VOICE_NOT_CONFIGURED.
    # SecretStr: repr(Settings) i logi nie pokazuja wartosci; czytaj przez call_guard.daily_api_key().
    # PRZED wpisaniem klucza ustaw CALL_ALLOWED_USER_IDS (pusta lista = tworzy kazdy wlasciciel).
    daily_api_key: SecretStr = SecretStr("")
    # Prefiks nazw pokoi (<prefix>-board-<id>). Inna wartosc dla dev/stagingu na tym samym
    # koncie Daily, zeby srodowiska nie dzielily pokoi. Tylko male litery, cyfry i myslnik.
    daily_room_prefix: str = "easylesson"
    # Na ile minut wlasciciel tworzy pokoj (po tym czasie uczestnicy sa rozlaczani; wlasciciel
    # moze przedluzyc, klikajac "Rozmowa" w ostatnich 15 min). Sufit w kodzie: 180 (zlecenie
    # 02.10.2026: exp max 3 h + eject_at_room_exp). Krotszy pokoj = mniejsza rezerwacja w progu
    # miesiecznym i w dziennym budzecie tworzacego.
    daily_room_ttl_minutes: int = 90

    # --- Bezpieczniki kosztow rozmow (api/v1/whiteboard/call_guard.py, docs pipelines.md 5a) ---
    # Wylacznik awaryjny: false = 503 VOICE_DISABLED, zero wywolan Daily. Smieciowa wartosc = false.
    call_enabled: bool = True
    # Kto moze TWORZYC pokoje (id uzytkownikow po przecinku). Pusta = kazdy wlasciciel przestrzeni;
    # wartosc nie do sparsowania = nikt (fail closed).
    call_allowed_user_ids: str = ""
    # Kto widzi GET /whiteboard/call/usage (id po przecinku). Pusta = nikt.
    call_admin_user_ids: str = ""
    # Globalny prog minut uczestnikow w miesiacu (zuzycie z Daily /meetings + rezerwacje pokoi).
    daily_monthly_minutes_cap: int = 8000
    # Ile minut rozmow dziennie (UTC) ma jeden tworzacy: zywy pokoj liczy sie caly, zakonczony -
    # wg realnego czasu (potwierdzona pustka albo spotkania z Daily po okresie karencji).
    call_user_daily_minutes_cap: int = 240
    call_max_participants: int = 4

    @field_validator(
        "daily_room_ttl_minutes", "daily_monthly_minutes_cap",
        "call_user_daily_minutes_cap", "call_max_participants",
        mode="before",
    )
    @classmethod
    def _call_int_or_default(cls, value, info):
        """Pusta/nieliczbowa/ujemna wartosc env nie wywraca startu - wraca wartosc domyslna."""
        default = cls.model_fields[info.field_name].default
        if isinstance(value, bool):
            return default
        try:
            number = int(str(value).strip())
        except (TypeError, ValueError):
            return default
        return number if number >= 0 else default

    @field_validator("call_enabled", mode="before")
    @classmethod
    def _call_enabled_or_off(cls, value):
        """Pusta = domyslnie wlaczone; wartosc nie do rozpoznania = WYLACZONE (bezpieczniej)."""
        if isinstance(value, bool):
            return value
        text = str(value).strip().lower()
        if text == "":
            return True
        return text in ("1", "true", "t", "yes", "y", "on")

    # === CORS (SEC-04) ===
    # Jawna lista originow rozdzielona przecinkami (env ALLOWED_ORIGINS). Credentials
    # (refresh cookie) sa wlaczone, wiec kazdy origin wpisujemy osobno - zadnych wildcardow.
    # Domyslna wartosc = produkcja + lokalny dev, zeby deploy dzialal bez ustawiania env.
    allowed_origins: str = DEFAULT_ALLOWED_ORIGINS
    # Opcjonalny regex (env ALLOWED_ORIGIN_REGEX, dopasowanie fullmatch) np. dla preview
    # Vercela. Domyslnie PUSTY = wylaczony: sufiksu "-easylessons-projects.vercel.app" nie da
    # sie uznac za niepodrabialny (wolna subdomene *.vercel.app moze przypisac sobie dowolne
    # konto), a kazdy dopuszczony origin moze wolac /auth/refresh z cookie. Patrz docs/architecture/auth.md.
    allowed_origin_regex: str = ""

    # === PROXY / IP KLIENTA (SEC-06) ===
    # Od ktorych adresow ufamy X-Forwarded-For / X-Forwarded-Proto (jak --forwarded-allow-ips
    # uvicorna; ta sama nazwa env FORWARDED_ALLOW_IPS). Pusty = automatycznie: "*" na Render
    # (Render ustawia env RENDER=true, a serwis jest osiagalny wylacznie przez proxy Render),
    # w pozostalych srodowiskach "127.0.0.1".
    forwarded_allow_ips: str = ""
    # Naglowek z IP klienta ustawiany (NADPISYWANY) przez brzeg sieci - rate limit bierze IP
    # z niego w pierwszej kolejnosci. Pusty = automatycznie: "CF-Connecting-IP" na Render
    # (caly ruch do Render przechodzi przez Cloudflare, ktory ten naglowek nadpisuje), poza
    # Render wylaczone. "none" = wylaczone takze na Render.
    client_ip_header: str = ""
    # Ktory wpis X-Forwarded-For LICZAC OD PRAWEJ jest adresem klienta, gdy naglowka powyzej
    # nie ma w zadaniu (1 = ostatni, dopisany przez proxy bezposrednio przed aplikacja).
    # Lewych wpisow nie uzywamy - wysyla je klient. Zla wartosc = grubsze kubelki, nie obejscie.
    trusted_proxy_hops: int = 1

    @property
    def allowed_origins_list(self) -> list[str]:
        """ALLOWED_ORIGINS -> lista originow (bez spacji, koncowego "/" i wildcardow)."""
        origins = [o.strip().rstrip("/") for o in self.allowed_origins.split(",")]
        return [o for o in origins if o and "*" not in o]

    @property
    def trusted_proxy_hosts(self) -> str:
        """Wartosc dla ProxyHeadersMiddleware (patrz forwarded_allow_ips)."""
        if self.forwarded_allow_ips.strip():
            return self.forwarded_allow_ips.strip()
        return "*" if os.getenv("RENDER") else "127.0.0.1"

    @property
    def effective_client_ip_header(self) -> str:
        """Nazwa naglowka z IP klienta albo "" (patrz client_ip_header)."""
        explicit = self.client_ip_header.strip()
        if explicit:
            return "" if explicit.lower() == "none" else explicit
        return "CF-Connecting-IP" if os.getenv("RENDER") else ""

    # === KONFIGURACJA PYDANTIC ===
    # .env czytany w developmencie; w produkcji (Render) zmienne ida z systemu.
    # case_sensitive=False: DATABASE_URL w .env == database_url w kodzie.
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

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