# Refaktoryzacja struktury `src/app` — Route Groups

**Data:** maj 2026  
**Zakres:** `src/app/` — reorganizacja routingu, podział na layouty, ujednolicenie nazewnictwa

---

## Problem

Przed refaktoryzacją cały routing aplikacji był zarządzany przez jeden plik `src/app/layout.tsx`, który:

- Był oznaczony jako `'use client'` — blokując Server-Side Rendering dla całego drzewa komponentów
- Zawierał ręczną listę `pathname`ów decydującą o tym, czy pokazać header i footer:
  ```tsx
  const showHeader = pathname === '/' || pathname === '/login' || pathname === '/rejestracja' || ...
  ```
  Każda nowa strona wymagała ręcznej edycji tej listy — łatwy sposób na błędy
- Łączył logikę trzech różnych kontekstów UX (landing, dashboard, tablica) w jednym miejscu
- Zawierał polskie nazwy folderów w URLach (`/rejestracja`, `/tablica`, `/podrecznik-uzytkownika`)

---

## Rozwiązanie — Next.js Route Groups

Next.js App Router obsługuje **Route Groups** — foldery w nawiasach `(nazwa)`, które grupują trasy bez wpływu na URL. Pozwala to przypisać każdej grupie stron własny `layout.tsx`.

### Trzy layouty zamiast jednego

```
src/app/
├── layout.tsx              ← minimalny Server Component
├── (public)/
│   └── layout.tsx          ← Header + Footer (strony publiczne)
├── (dashboard)/
│   └── layout.tsx          ← DashboardHeader (panel użytkownika)
└── (whiteboard)/
    └── layout.tsx          ← fullscreen, bez chrome (tablica)
```

### Podział stron

| Grupa | Trasy |
|---|---|
| `(public)` | `/`, `/login`, `/register`, `/verify`, `/reset-password`, `/product`, `/news`, `/contact`, `/docs/*`, `/privacy-policy`, `/cookies-policy`, `/terms`, `/terms-of-use`, `/gdpr`, `/auth/callback` |
| `(dashboard)` | `/dashboard`, `/account`, `/invite/[token]` |
| `(whiteboard)` | `/whiteboard` |

---

## Argumentacja techniczna

### Root layout jako Server Component

Usunięcie `'use client'` z root layoutu oznacza, że Next.js może go renderować po stronie serwera. Korzyści:

- Szybszy TTFB (Time to First Byte)
- Metadane (`<title>`, `<meta>`) mogą być eksportowane przez `export const metadata` zamiast hardkodowane w `<head>`
- Providers (`AuthProvider`, `QueryProvider`) i tak są Client Components — granica klienta jest na ich poziomie, nie na poziomie całej aplikacji

### Eliminacja warunkowej logiki pathname

Wzorzec `if (pathname === '/dashboard')` w layoucie jest łamliwy — łatwo pominąć nową trasę. Route Groups rozwiązują to strukturalnie: przynależność do layoutu wynika z miejsca pliku w drzewie katalogów, a nie z ręcznie utrzymywanej listy.

### `useSearchParams` i Suspense

Next.js 13+ wymaga owijania `useSearchParams()` w `<Suspense>`. Powód: hook czyta dane z URL po stronie klienta — podczas statycznego prerenderowania (buildu) Next.js nie zna wartości query params i bez Suspense rzuca błąd. Naprawione w 4 miejscach:

- `(public)/auth/callback/page.tsx`
- `(public)/login/page.tsx`
- `(public)/verify/page.tsx`
- `(dashboard)/dashboard/page.tsx`

---

## Zmiany nazewnictwa tras (PL → EN)

Ujednolicenie URLów do języka angielskiego — spójność z konwencją kodu i łatwiejsza internacjonalizacja w przyszłości.

| Było | Jest |
|---|---|
| `/rejestracja` | `/register` |
| `/weryfikacja` | `/verify` |
| `/odzyskiwanie-hasla` | `/reset-password` |
| `/produkt` | `/product` |
| `/aktualnosci` | `/news` |
| `/kontakt` | `/contact` |
| `/podrecznik-uzytkownika` | `/docs` |
| `/polityka-prywatnosci` | `/privacy-policy` |
| `/polityka-cookies` | `/cookies-policy` |
| `/regulamin` | `/terms` |
| `/warunki-korzystania` | `/terms-of-use` |
| `/rodo` | `/gdpr` |
| `/clientPanel` | `/account` |
| `/tablica` | `/whiteboard` |

---

## Poprawki towarzyszące

### Import paths po przeniesieniu do route groups

Pliki przeniesione do `(dashboard)/dashboard/` są o jeden poziom głębiej niż wcześniej. Względne ścieżki do `src/app/context/` przestały działać — zastąpione aliasem `@/app/`:

```tsx
// było (zepsute po migracji)
import { useAuth } from '../../../context/AuthContext';

// jest
import { useAuth } from '@/app/context/AuthContext';
```

### `DashboardHeader.refreshWorkspaces` jako opcjonalny prop

`DashboardHeader` był ściśle sprzężony z `dashboard/page.tsx` przez wymagany prop `refreshWorkspaces`. Po przeniesieniu headera do layoutu grupowego prop stał się opcjonalny z domyślnym no-op. Właściwa refaktoryzacja (przeniesienie logiki odświeżania do samego headera przez React Query) zaplanowana osobno.

### Usunięcie duplikatów Header/Footer ze stron prawnych

Strony `/terms`, `/privacy-policy`, `/cookies-policy`, `/gdpr`, `/contact` renderowały własne `<Header />` i `<Footer />` — stary wzorzec sprzed layoutów. Po wprowadzeniu `(public)/layout.tsx` było to zbędne i powodowało podwójny header. Importy i tagi usunięte.

---

## Struktura po refaktoryzacji

```
src/app/
├── layout.tsx                    ← Server Component: fonty, providerzy, html/body
├── not-found.tsx
├── globals.css
├── favicon.ico
├── context/                      ← AuthContext, BoardRealtimeContext, VoiceChatContext
├── layout/                       ← Header, AuthHeader, Footer, mega-menus
├── api/                          ← route handlers (chat, contact)
│
├── (public)/
│   ├── layout.tsx                ← Header/AuthHeader + Footer
│   ├── page.tsx                  (/)
│   ├── login/
│   ├── register/
│   ├── verify/
│   ├── reset-password/
│   ├── product/
│   ├── news/
│   ├── contact/
│   ├── docs/
│   │   └── layout.tsx            ← sidebar dokumentacji (dziedzicząc z public)
│   ├── privacy-policy/
│   ├── cookies-policy/
│   ├── terms/
│   ├── terms-of-use/
│   ├── gdpr/
│   └── auth/callback/
│
├── (dashboard)/
│   ├── layout.tsx                ← DashboardHeader
│   ├── dashboard/
│   ├── account/
│   └── invite/[token]/
│
└── (whiteboard)/
    ├── layout.tsx                ← fullscreen, brak header/footer
    └── whiteboard/
```
