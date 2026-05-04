# Architektura `src/app` — Podział na grupy routingowe

**Data:** maj 2026  
**Zakres:** `src/app/` — podział `(public)` na trzy dedykowane grupy

---

## Aktualna struktura

```
src/app/
├── layout.tsx                        ← root: fonty, AuthProvider, QueryProvider
│
├── (public)/                         ← marketing i landing page
│   ├── layout.tsx                    ← Header + Footer
│   ├── _components/                  ← Header, Footer, mega-menus
│   ├── page.tsx                      (/)
│   ├── sections/                     ← komponenty sekcji landing page
│   ├── product/
│   ├── news/
│   └── contact/
│
├── (auth)/                           ← autoryzacja
│   ├── layout.tsx                    ← gradient blobs + top bar (lang + logo)
│   ├── login/
│   ├── register/
│   ├── reset-password/
│   ├── verify/
│   └── auth/callback/
│
├── (info)/                           ← dokumentacja i regulaminy
│   ├── layout.tsx                    ← tylko logo linkujące do /
│   ├── docs/
│   │   └── layout.tsx                ← sidebar (dziedzicząc z info)
│   ├── privacy-policy/
│   ├── cookies-policy/
│   ├── terms/
│   ├── terms-of-use/
│   └── gdpr/
│
├── (dashboard)/                      ← panel użytkownika (wymaga auth)
│   ├── layout.tsx                    ← DashboardHeader
│   ├── dashboard/
│   ├── account/
│   └── invite/[token]/
│
└── (whiteboard)/                     ← tablica (fullscreen)
    ├── layout.tsx
    └── whiteboard/
```

---

## Dlaczego trzy grupy zamiast jednej `(public)`

Poprzedni podział (`(public)` / `(dashboard)` / `(whiteboard)`) traktował wszystkie niezdashboardowe strony jako jednorodną całość. W praktyce strony publiczne mają trzy różne konteksty UX — każdy wymaga innego layoutu.

### `(public)` — przestrzeń marketingowa

**Zawiera:** `/` (landing), `/product`, `/news`, `/contact`

Layout: pełny **Header z mega-menu + Footer**. To strony sprzedażowe i informacyjne — użytkownik powinien mieć dostęp do pełnej nawigacji i CTA.

Dodatkowe uzasadnienie izolacji `sections/` i `_components/` w tej grupie: landing page jest przestrzenią kreatywną (kolega z zespołu może rozbudowywać sekcje niezależnie), a `_components/` (Header, Footer, mega-menus) są związane wyłącznie z tą grupą — nie są używane nigdzie indziej.

### `(auth)` — przepływ autoryzacji

**Zawiera:** `/login`, `/register`, `/reset-password`, `/verify`, `/auth/callback`

Layout: **gradient blobs + minimalny top bar** (zmiana języka po lewej, logo po prawej). Brak pełnej nawigacji — celowo.

Uzasadnienie: strony auth powinny minimalizować rozproszenie uwagi. Użytkownik ma jeden cel (zalogowanie / rejestracja) — mega-menu nawigacyjne jest tu zbędnym szumem. Top bar zawiera tylko to co niezbędne: powrót do strony głównej (logo) i zmianę języka.

Wcześniejszy problem: strony auth dziedziczyły `Header + Footer` z `(public)/layout.tsx` mimo że `AuthLayout` komponent renderował własny pełnoekranowy widok — powodowało to podwójne wrapping i obecność site Headera w DOM.

### `(info)` — treści formalne i dokumentacja

**Zawiera:** `/docs/*`, `/privacy-policy`, `/cookies-policy`, `/terms`, `/terms-of-use`, `/gdpr`

Layout: **tylko logo** linkujące do strony głównej. Brak nawigacji.

Uzasadnienie połączenia regulaminów z dokumentacją: oba typy stron mają charakter informacyjny (nie sprzedażowy), są czytane liniowo, a nie przeglądane. Mega-menu nawigacyjne odwraca uwagę od treści formalnych i prawnych. Docs ma własny sub-layout z sidebarem — zagnieżdżony pod `(info)/layout.tsx`.

---

## Nowe komponenty wydzielone przy okazji refaktoru

### `LanguageSwitcher` (`src/_new/shared/ui/language-switcher.tsx`)

Logika zmiany języka (Google Translate cookie) była wbudowana w `Header.tsx`. Wydzielona do osobnego komponentu żeby móc ją reużyć w `(auth)/layout.tsx` bez importowania całego Headera.

### `GoogleAuthButton` (`src/_new/features/auth/components/GoogleAuthButton.tsx`)

Przycisk Google OAuth z wbudowanym hookiem obsługującym popup i `postMessage`. Wydzielony z `AuthLayout` — który został w całości usunięty — ponieważ logika OAuth nie jest związana z layoutem strony. Plik zawiera zarówno hook (`useGoogleAuth`) jak i komponent — celowo, bo hook nie jest reużywany nigdzie poza tym komponentem.

### `(public)/_components/`

`Header.tsx`, `Footer.tsx` i `mega-menus/` przeniesione z `src/app/layout/` do `src/app/(public)/_components/`. Prefiks `_` oznacza folder nie-routowalny (konwencja Next.js App Router). Uzasadnienie: te komponenty są wyłączną własnością grupy `(public)` — trzymanie ich w `app/layout/` sugerowało że są globalnie współdzielone, co było mylące.

---

## Reguła przypisania strony do grupy

| Pytanie | Odpowiedź → grupa |
|---|---|
| Czy strona wymaga logowania? | Tak → `(dashboard)` lub `(whiteboard)` |
| Czy strona to narzędzie fullscreen? | Tak → `(whiteboard)` |
| Czy strona to przepływ auth? | Tak → `(auth)` |
| Czy strona to regulamin lub dokumentacja? | Tak → `(info)` |
| Pozostałe strony publiczne | → `(public)` |
