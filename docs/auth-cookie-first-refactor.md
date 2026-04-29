# Przebudowa autoryzacji — Cookie-First z HttpOnly Refresh Token

## Motywacja

Przed przebudową system autoryzacji miał kilka poważnych wad:

- **access token w localStorage** — dostępny dla każdego skryptu JS na stronie (podatność XSS)
- **brak refresh tokenu** — po wygaśnięciu access tokenu (lub zamknięciu karty) użytkownik
  był wylogowywany mimo aktywnej sesji
- **niespójność** — middleware sprawdzał cookie `access_token`, AuthContext czytał localStorage,
  token był zapisywany w obu miejscach jednocześnie bez jasnej reguły
- **brak mechanizmu unieważniania sesji** — nie było możliwości wylogowania użytkownika
  po stronie serwera (np. przy kradzieży tokenu)

---

## Nowy model sesji

```
┌─────────────────────────────────────────────────────────┐
│                      PRZEGLĄDARKA                       │
│                                                         │
│  access_token — tylko in-memory (zmienna modułowa JS)  │
│  • żyje do odświeżenia strony lub wylogowania           │
│  • niedostępny po hard reload → odnawiany przez refresh │
│                                                         │
│  refresh_token — HttpOnly cookie (ustawia backend)      │
│  • niedostępny dla JS (ochrona przed XSS)               │
│  • wysyłany automatycznie przez przeglądarkę            │
│  • ważny 7 dni, rotowany przy każdym użyciu             │
└─────────────────────────────────────────────────────────┘
```

**Bootstrap przy wejściu na stronę:**
1. `GET /me` z access tokenem z pamięci → 200 (token świeży) lub 403 (brak/wygasł)
2. Jeśli 403 → `POST /refresh` z cookie → backend zwraca nowy access token
3. Jeśli refresh też się nie powiódł → przekierowanie na `/login`

**Rotacja refresh tokenu:** przy każdym wywołaniu `/refresh` stary token jest unieważniany
w bazie danych i wystawiany nowy. Ponowne użycie unieważnionego tokenu zwraca błąd 401.

---

## Zmiany w backendzie

### Nowa tabela — `refresh_tokens` (`core/models.py`)

```python
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    token_hash  = Column(String(64), unique=True)   # SHA-256, nigdy plain token
    expires_at  = Column(DateTime)
    revoked     = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
```

Token nigdy nie jest przechowywany w bazie w formie jawnej — tylko jego hash SHA-256.
Nawet przy wycieku bazy danych atakujący nie może odtworzyć oryginalnego tokenu.

### Nowe ustawienia (`core/config.py`)

```python
access_token_expire_minutes: int = 15      # krótki TTL access tokenu
refresh_token_expire_days: int = 7
cookie_secure: bool = False                # True w produkcji (HTTPS)
cookie_samesite: str = "lax"
cookie_domain: str = ""                    # np. ".easylesson.app" w produkcji
```

### Nowe funkcje pomocnicze (`api/v1/auth/utils.py`)

```python
def generate_refresh_token() -> str:
    return secrets.token_hex(32)           # 64 znaki, kryptograficznie losowe

def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
```

### Nowe schematy (`api/v1/auth/schemas.py`)

```python
class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int                        # sekundy do wygaśnięcia

class MeResponse(BaseModel):
    user: UserResponse
```

### Refaktor serwisu (`api/v1/auth/service.py`)

Wydzielono wspólną logikę tworzenia sesji:

```python
def _create_session(self, user: User) -> tuple[AuthResponse, str]:
    """Tworzy access token + zapisuje refresh token w bazie. Zwraca (response, plain_token)."""
```

Wywołują ją `login_user`, `verify_email` i `google_login` — spójne zachowanie w każdym
scenariuszu logowania.

Nowe metody serwisu:
- `refresh_session(token)` — waliduje token, unieważnia stary, tworzy nowy (rotacja)
- `get_me(user)` — zwraca dane zalogowanego użytkownika
- `logout_session(token)` — unieważnia refresh token w bazie

### Nowe endpointy (`api/v1/auth/router.py`)

| Endpoint | Opis |
|----------|------|
| `POST /api/v1/auth/refresh` | Odświeża access token; wymaga refresh cookie; rotuje token |
| `GET /api/v1/auth/me` | Zwraca dane zalogowanego użytkownika (wymaga access tokenu) |
| `POST /api/v1/auth/logout` | Unieważnia refresh token, usuwa cookie |

Cookie ustawiane po każdym zalogowaniu (`login`, `verify-email`, `google/callback`):

```python
response.set_cookie(
    key="refresh_token",
    httponly=True,          # niedostępne dla JS
    secure=True,            # tylko HTTPS
    samesite="lax",
    path="/",
    domain=".easylesson.app",
    max_age=7 * 24 * 3600,
)
```

### Testy jednostkowe (`backend/tests/v1/auth/`)

Dodano trzy nowe pliki testów:
- `test_refresh.py` — rotacja tokenu, obsługa wygasłych i unieważnionych tokenów
- `test_me.py` — zwracanie danych zalogowanego użytkownika
- `test_logout.py` — unieważnianie sesji, bezpieczne podwójne wylogowanie

Zaktualizowano istniejące testy (`test_login.py`, `test_verify_email.py`,
`test_google_login.py`, `test_integration.py`) pod kątem nowego zwracanego tuple
`(AuthResponse, refresh_token_plain)`.

---

## Zmiany na frontendzie

### Access token tylko in-memory (`src/_new/lib/auth/tokenStore.ts`)

```typescript
let _accessToken: string | null = null;

export function getAccessToken(): string | null { return _accessToken; }
export function setAccessToken(token: string): void { _accessToken = token; }
export function removeAccessToken(): void { _accessToken = null; }
```

Usunięto wszelkie odwołania do `localStorage` i `document.cookie` dla access tokenu.
Token znika przy odświeżeniu strony — to celowe; sesja jest odtwarzana przez `/refresh`.

### Odblokowanie interceptora (`src/_new/lib/auth/tokenService.ts`)

Usunięto flagę `isRefreshAvailable = false`, która blokowała mechanizm odświeżania.
Axios interceptor na błąd 401 od teraz zawsze próbuje odnowić token przez `/refresh`.

### AuthContext — bootstrap przez API (`src/app/context/AuthContext.tsx`)

```typescript
// Przy inicjalizacji aplikacji:
try {
    const user = await getCurrentUser();   // GET /me
    setIsLoggedIn(true); setUser(user);
} catch {
    try {
        await refreshAccessToken();        // POST /refresh (z cookie)
        const user = await getCurrentUser();
        setIsLoggedIn(true); setUser(user);
    } catch {
        setIsLoggedIn(false);              // brak sesji
    }
}
```

Zamiast czytać token z localStorage przy starcie, aplikacja weryfikuje sesję przez API.

### Nowe funkcje API (`src/_new/features/auth/api/authApi.ts`)

```typescript
export const getCurrentUser = (): Promise<User> =>
    apiClient.get<{ user: User }>('/api/v1/auth/me').then(res => res.data.user);

export const logoutUser = (): Promise<void> =>
    apiClient.post('/api/v1/auth/logout').then(res => res.data);
```

### Middleware (`src/middleware.ts`)

Zmieniono sprawdzaną nazwę cookie z `access_token` na `refresh_token`.
Middleware sprawdza jedynie **obecność** cookie — nie dekoduje JWT (klucz jest po
stronie backendu). Wygasły access token jest obsługiwany przez interceptor Axios
(401 → refresh → ponów request).

### Google OAuth callback (`src/app/auth/callback/page.tsx` + `authLayout.tsx`)

- **Popup flow**: `router.push('/dashboard')` zamiast `window.location.href`
  (SPA navigation zachowuje in-memory token)
- **Redirect flow**: wywołuje `login(token, userData)` z AuthContext zamiast zapisywać
  do localStorage, następnie nawiguje przez `router.replace('/dashboard')`

---

## Zmiany infrastrukturalne

### Migracja bazy danych (Alembic)

Wygenerowano i uruchomiono migrację tworzącą tabelę `refresh_tokens`.

### Zmienne środowiskowe (Render)

```
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=.easylesson.app
FRONTEND_URL=https://www.easylesson.app
GOOGLE_REDIRECT_URI=https://api.easylesson.app/api/v1/auth/google/callback
```

### Google Cloud Console

Dodano `https://api.easylesson.app/api/v1/auth/google/callback` jako autoryzowany
Redirect URI w OAuth 2.0 Client.

---

## Porównanie przed i po

| Aspekt | Przed | Po |
|--------|-------|----|
| Access token | localStorage + cookie JS | In-memory (zmienna modułowa) |
| Refresh token | brak | HttpOnly cookie, 7 dni, rotowany |
| Unieważnianie sesji | niemożliwe | Tak (tabela `refresh_tokens`) |
| Ochrona przed XSS | słaba (token w localStorage) | Wysoka (token nie dostępny dla JS) |
| Sesja po hard reload | zależna od localStorage | Odtwarzana przez `/refresh` |
| Wylogowanie | tylko lokalne | Backend unieważnia token |
| Spójność middleware / AuthContext | niespójna | Jedna zasada: refresh cookie |
