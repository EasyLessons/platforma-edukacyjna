# 🚀 EasyLesson - TODO do Produkcji

> **Cel**: Pełna analiza projektu pod kątem gotowości do sprzedaży/wdrożenia produkcyjnego.
> **Data analizy**: Styczeń 2025
> **Stack**: Next.js 16 + FastAPI + PostgreSQL (Neon) + Supabase Realtime

---

## 📋 Spis Treści

1. [🔴 KRYTYCZNE - Bezpieczeństwo](#-krytyczne---bezpieczeństwo)
2. [🟠 WYSOKIE - Stabilność i Wydajność](#-wysokie---stabilność-i-wydajność)
3. [🟡 ŚREDNIE - Jakość Kodu](#-średnie---jakość-kodu)
4. [🟢 NISKIE - Nice-to-have](#-niskie---nice-to-have)
5. [✅ CO JUŻ JEST DOBRZE](#-co-już-jest-dobrze)
6. [📊 METRYKI PROJEKTU](#-metryki-projektu)

---

## 🔴 KRYTYCZNE - Bezpieczeństwo

### 1. ⚠️ HARDCODED SUPABASE KEYS w kodzie!

**Plik**: `src/lib/supabase.ts` (linie 27-31)

```typescript
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shqfitnzlrtpqgabtzgv.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'; // ❌ KLUCZ W KODZIE!
```

**Problem**:

- Klucz Supabase jest zahardkodowany jako fallback
- Jeśli kod trafi do publicznego repo - klucz jest wystawiony
- Mimo że to `anon key` (publiczny), to złą praktyką jest commitowanie kluczy

**Rozwiązanie**:

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}
```

**Priorytet**: 🔴 KRYTYCZNE
**Czas naprawy**: 15 min

---

### 2. ⚠️ Brak Refresh Token - Sesja wygasa po 24h

**Pliki**:

- `backend/core/config.py` - `access_token_expire_minutes: int = 1440`
- `src/app/context/AuthContext.tsx` - brak obsługi refresh token

**Problem**:

- Token JWT wygasa po 24h
- Użytkownik musi się przelogować
- Brak mechanizmu auto-refresh tokena
- W środku pracy użytkownik może stracić sesję

**Rozwiązanie**:

1. Dodać endpoint `/api/refresh-token` w backend
2. Implementować refresh token (długożyjący)
3. Frontend: automatyczne odświeżanie przed wygaśnięciem

**Priorytet**: 🔴 KRYTYCZNE dla UX
**Czas naprawy**: 4-6h

---

### 3. ⚠️ Brak Rate Limiting na Backend (główne API)

**Plik**: `backend/main.py`

**Problem**:

- Chat API (`/api/chat`) MA rate limiting ✅
- Ale główne API (login, register, boards, workspaces) NIE MA
- Możliwy atak brute-force na logowanie
- Możliwy atak DDoS na API

**Rozwiązanie**:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/login")
@limiter.limit("5/minute")
async def login(...):
```

**Priorytet**: 🔴 KRYTYCZNE
**Czas naprawy**: 2-3h

---

### 4. ⚠️ Xirsys Secret w NEXT_PUBLIC env

**Plik**: `src/app/context/VoiceChatContext.tsx` (linia 154)

```typescript
const xirsysSecret = process.env.NEXT_PUBLIC_XIRSYS_SECRET;
```

**Problem**:

- `NEXT_PUBLIC_*` zmienne są WIDOCZNE w przeglądarce!
- Secret nie powinien być publiczny
- Ktoś może wykraść klucz i używać Twojego Xirsys

**Rozwiązanie**:

1. Przenieść wywołanie Xirsys do API route (`/api/turn-credentials`)
2. Secret przechowywać tylko na serwerze

**Priorytet**: 🔴 KRYTYCZNE
**Czas naprawy**: 2-3h

---

### 5. ⚠️ DEBUG MODE włączony w produkcji

**Pliki**:

- `backend/main.py` linia 16: `setup_logging(log_level="DEBUG")`
- `src/app/context/VoiceChatContext.tsx` linia 698-708: DEBUG TURN forcing

**Problem**:

- Debug logging w produkcji = wyciek wrażliwych danych do logów
- Wymuszanie TURN relay niepotrzebnie zużywa resources

**Rozwiązanie**:

```python
# backend/main.py
import os
log_level = "DEBUG" if os.getenv("ENV", "production") == "development" else "INFO"
setup_logging(log_level=log_level)
```

**Priorytet**: 🔴 KRYTYCZNE
**Czas naprawy**: 30 min

---

## 🟠 WYSOKIE - Stabilność i Wydajność

### 6. 📊 Empty next.config.ts - brak optymalizacji

**Plik**: `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  /* config options here */
  // ← PUSTY!
};
```

**Brakuje**:

- Image optimization
- Headers bezpieczeństwa
- Compression
- Bundle analyzer
- Standalong output dla lepszego deploymentu

**Rekomendowana konfiguracja**:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone', // Dla Docker/produkcji

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  compress: true,
  poweredByHeader: false,
};
```

**Priorytet**: 🟠 WYSOKIE
**Czas naprawy**: 1-2h

---

### 7. 🐌 Backend na Render Free Tier - Cold Starts

**Problem**:

- Render free tier usypia serwer po 15 min nieaktywności
- Pierwszy request po uśpieniu = 30-60s ładowania!
- Użytkownicy zobaczą timeout/loading

**Rozwiązanie**:

1. **Krótkoterminowe**: Health check cron (ping co 10 min)
2. **Długoterminowe**: Upgrade do paid tier ($7/mies)

**Skrypt health check (GitHub Actions)**:

```yaml
name: Keep Backend Alive
on:
  schedule:
    - cron: '*/10 * * * *' # Co 10 minut
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -s https://your-api.onrender.com/health
```

**Priorytet**: 🟠 WYSOKIE (wpływa na UX)
**Czas naprawy**: 30 min (health check) lub upgrade

---

### 8. 📝 Nadmiar console.log - produkcja

**Znaleziono**: 50+ wywołań `console.log/warn/error`

**Pliki z największą ilością**:

- `VoiceChatContext.tsx` - ~40 console.log (debug voice)
- `WhiteboardCanvas.tsx` - ~25 console.log (debug canvas)
- `auth_api/api.ts` - debug logowanie URL
- `boards_api/api.ts` - debug fetch

**Problem**:

- Zaśmieca konsolę użytkownika
- Potencjalnie ujawnia wrażliwe informacje
- Zmniejsza wydajność (I/O)

**Rozwiązanie**:

1. ESLint `no-console: error` (już masz `warn`)
2. Użyj loggera z levels (debug tylko w dev):

```typescript
const logger = {
  debug: (...args) => process.env.NODE_ENV === 'development' && console.log(...args),
  error: console.error,
};
```

3. `npm run lint:fix` przed merge do main

**Priorytet**: 🟠 WYSOKIE
**Czas naprawy**: 2-3h (ręczne czyszczenie lub skrypt)

---

### 9. 🔌 Brak obsługi offline/reconnect w UI

**Problem**:

- Gdy Supabase się rozłączy - użytkownik nie wie
- Gdy backend jest niedostępny - brak informacji
- Elementy mogą się "zgubić" przy słabym necie

**Rozwiązanie**:

1. Toast/Banner "Połączenie przerwane, ponawiam..."
2. Queuing lokalnych zmian
3. Sync po reconnect

**Priorytet**: 🟠 WYSOKIE (UX)
**Czas naprawy**: 4-6h

---

### 10. 📦 Nieużywany kod w `_new` folder

**Plik**: `src/_new/lib/`

**Problem**:

- TanStack Query setup który nie jest używany
- Brakujące zależności (`@tanstack/react-query` jest, ale może nie działać)
- Martwy kod = confusion

**Rozwiązanie**:

- Usunąć jeśli nieużywane
- Albo dokończyć migrację do React Query

**Priorytet**: 🟠 ŚREDNIE
**Czas naprawy**: 30 min (usunięcie) lub 4h (migracja)

---

## 🟡 ŚREDNIE - Jakość Kodu

### 11. 🔤 Użycie `any` w TypeScript

**Znaleziono**: 30+ miejsc z `: any` lub `as any`

**Najgorsze przypadki**:

```typescript
// InvitePopup.tsx
results.map(async (user: any) => { ... })

// BoardRealtimeContext.tsx
Object.values(state).forEach((presences: any) => { ... })

// TemplateSection.tsx
icon: any;
```

**Problem**:

- Brak type safety
- Możliwe runtime błędy
- Trudniejsze refactoring

**Rozwiązanie**:

1. Zdefiniować interfejsy dla wszystkich typów
2. Użyć `unknown` + type guards zamiast `any`
3. Włączyć `strict: true` w tsconfig (stopniowo)

**Priorytet**: 🟡 ŚREDNIE
**Czas naprawy**: 4-8h

---

### 12. 📋 TODO/FIXME w kodzie

**Znaleziono**:

- `utils.ts`: "TODO: implement proper culling"
- `VoiceChatContext.tsx`: "DEBUG: Wymuszam TURN relay (testowanie)"

**Rozwiązanie**:
Przejrzeć każde TODO i:

- Zrobić task
- Usunąć jeśli nieaktualne
- Oznaczyć priorytet

**Priorytet**: 🟡 ŚREDNIE
**Czas naprawy**: 1-2h

---

### 13. 🧪 Pokrycie testami - nieznane

**Pliki testów**: 7 plików w `backend/tests/`

- test_auth_service.py
- test_board_service.py
- test_logger.py
- test_user_search.py
- test_workspace_invites.py
- test_workspace_service.py
- conftest.py

**Problem**:

- Brak testów frontendu
- Nieznane pokrycie backendu
- Brak CI/CD z testami

**Rozwiązanie**:

1. Dodać coverage report: `pytest --cov=. --cov-report=html`
2. Dodać Jest/Vitest dla frontendu
3. GitHub Actions z testami

**Priorytet**: 🟡 ŚREDNIE
**Czas naprawy**: 8-16h (setup + podstawowe testy)

---

### 14. 📚 Brak Error Boundary

**Problem**:

- Jeśli komponent React crashuje - cała aplikacja pada
- Użytkownik widzi białą stronę
- Brak graceful degradation

**Rozwiązanie**:

```tsx
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage />;
    }
    return this.props.children;
  }
}
```

**Priorytet**: 🟡 ŚREDNIE
**Czas naprawy**: 2h

---

### 15. 🔐 CORS - zbyt szeroki w development

**Plik**: `backend/main.py`

```python
origins = [
    "http://localhost:3000",
    "https://platforma-edukacyjna.vercel.app",
    # ...
]
```

**Problem**:

- Lista jest OK, ale hardcoded
- Przy zmianie domeny trzeba rebuilda
- Brak wildcard dla staging

**Rozwiązanie**:

```python
import os
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
```

**Priorytet**: 🟡 ŚREDNIE
**Czas naprawy**: 30 min

---

## 🟢 NISKIE - Nice-to-have

### 16. 📈 Brak Analytics

**Problem**:

- Nie wiesz ile masz użytkowników
- Nie wiesz gdzie klikają
- Brak danych do decyzji

**Rozwiązanie**:

- Vercel Analytics (wbudowane, free tier)
- Lub Plausible/Posthog (privacy-friendly)

**Priorytet**: 🟢 NISKIE
**Czas naprawy**: 1h

---

### 17. 🌍 Brak i18n (internacjonalizacja)

**Problem**:

- Teksty są po polsku, zahardkodowane
- Trudna ekspansja na inne rynki

**Rozwiązanie**:

- `next-intl` lub `react-i18next`
- Wyodrębnić teksty do plików JSON

**Priorytet**: 🟢 NISKIE (chyba że planujesz ekspansję)
**Czas naprawy**: 8-16h

---

### 18. 📱 PWA (Progressive Web App)

**Problem**:

- Brak manifest.json (jest tylko w `public/resources/`)
- Brak service worker
- Nie można "zainstalować" na telefonie

**Rozwiązanie**:

- `next-pwa` package
- Manifest w root public/

**Priorytet**: 🟢 NISKIE
**Czas naprawy**: 2-4h

---

### 19. 🎨 Accessibility (a11y)

**Do sprawdzenia**:

- Czy wszystkie przyciski mają `aria-label`?
- Czy formularze mają `label` + `htmlFor`?
- Czy kolory mają wystarczający kontrast?
- Czy można nawigować klawiaturą?

**Narzędzia**:

- axe DevTools extension
- Lighthouse accessibility audit

**Priorytet**: 🟢 NISKIE (ale ważne dla compliance)
**Czas naprawy**: 4-8h audyt + naprawy

---

### 20. 📄 Brak SEO meta tags

**Problem**:

- Strony mogą nie mieć proper `<title>`, `<meta description>`
- Brak Open Graph dla social sharing

**Rozwiązanie**:

```tsx
// app/layout.tsx lub per-page
export const metadata = {
  title: 'EasyLesson - Platforma Edukacyjna',
  description: 'Interaktywna tablica online...',
  openGraph: {
    title: '...',
    images: ['/og-image.png'],
  },
};
```

**Priorytet**: 🟢 NISKIE
**Czas naprawy**: 2h

---

## ✅ CO JUŻ JEST DOBRZE

### Bezpieczeństwo ✅

- ✅ Hasła hashowane bcrypt
- ✅ JWT tokeny (HS256)
- ✅ Email weryfikacja
- ✅ Password reset flow
- ✅ Rate limiting na Chat API
- ✅ CORS poprawnie skonfigurowany

### Architektura ✅

- ✅ Czysta separacja frontend/backend
- ✅ TypeScript na froncie
- ✅ Pydantic walidacja na backendzie
- ✅ Alembic migracje DB
- ✅ SQLAlchemy ORM
- ✅ Supabase Realtime z reconnect logic

### Kod ✅

- ✅ ESLint + Prettier skonfigurowane
- ✅ Dobra struktura folderów
- ✅ Komentarze dokumentacyjne (bardzo dobre!)
- ✅ Context pattern dla stanu
- ✅ Lazy loading (VoiceChatContext po fixie)

### Funkcjonalności ✅

- ✅ Logowanie/Rejestracja
- ✅ Workspaces + Członkowie
- ✅ Tablice z real-time sync
- ✅ Voice chat P2P (WebRTC)
- ✅ AI Chatbot (Gemini)
- ✅ Role użytkowników (admin/editor/viewer)

---

## 📊 METRYKI PROJEKTU

| Metryka            | Wartość  | Status |
| ------------------ | -------- | ------ |
| Pliki .tsx/.ts     | ~50+     | ✅     |
| Pliki .py          | ~20+     | ✅     |
| Testy backend      | 7 plików | 🟡     |
| Testy frontend     | 0 plików | ❌     |
| console.log        | 50+      | 🔴     |
| `any` types        | 30+      | 🟡     |
| TODO/FIXME         | 5+       | 🟡     |
| Dependencies (npm) | 20       | ✅     |
| Dependencies (pip) | 48       | ✅     |

---

## 📅 REKOMENDOWANY PLAN DZIAŁANIA

### Tydzień 1 - KRYTYCZNE

1. [ ] Usunąć hardcoded Supabase keys
2. [ ] Przenieść Xirsys secret na API route
3. [ ] Dodać rate limiting na backend
4. [ ] Wyłączyć DEBUG mode w produkcji

### Tydzień 2 - WYSOKIE

5. [ ] Skonfigurować next.config.ts
6. [ ] Wyczyścić console.log (lub logger)
7. [ ] Health check dla Render
8. [ ] Error handling UI (toasty)

### Tydzień 3 - ŚREDNIE

9. [ ] Usunąć `any` types
10. [ ] Error Boundary
11. [ ] Coverage report

### Ongoing

12. [ ] Rozwiązać TODO w kodzie
13. [ ] Dodać testy frontendu
14. [ ] Analytics

---

## 🔧 QUICK WINS (< 30 min każde)

1. **Usunąć hardcoded keys** - 15 min
2. **Wyłączyć DEBUG** - 10 min
3. **Health check cron** - 15 min
4. **next.config headers** - 20 min
5. **Usunąć `_new` folder** - 5 min

---

> **Podsumowanie**: Projekt jest w dobrym stanie architektonicznym, ale wymaga pracy nad bezpieczeństwem i produkcyjną konfiguracją. Najważniejsze: usunąć zahardkodowane klucze i dodać rate limiting.

_Wygenerowano automatycznie przez analizę kodu_
