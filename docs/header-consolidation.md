# Scalenie `Header` i `AuthHeader` — konsolidacja komponentów

**Data:** maj 2026  
**Zakres:** `src/app/layout/Header.tsx`, `src/app/layout/AuthHeader.tsx`, `src/app/(public)/layout.tsx`

---

## Problem

Aplikacja miała dwa osobne pliki headera: `Header.tsx` (dla niezalogowanych) i `AuthHeader.tsx` (dla zalogowanych). Oba liczyły po ~1150 linii i różniły się **tylko w ~25 miejscach** — reszta była kopią 1:1.

Duplikowane fragmenty:
- logika scroll (`scrolledPastHero`, `isHeroSectionActive`)
- `handleLanguageChange` i efekt odczytu cookie języka
- `getMenuButtonClass`, `headerBgClass`
- 4 kompletne mega menu (Produkt, Kursy, Cennik, Aktualności) — po ~200 linii każde
- cały mobile header poza jednym przyciskiem

Jedyne realne różnice:

| Miejsce | Niezalogowany | Zalogowany |
|---|---|---|
| Mobile logo link | `/` | `/dashboard` |
| Przycisk obok hamburgera | Zaloguj się → `/login` | Panel → `/dashboard` |
| Ostatnia pozycja mobile menu | Zarejestruj się | Wyloguj się |
| Desktop prawa strona | Zaloguj + Zarejestruj się | Witaj username + Panel + Wyloguj |
| `id` selecta językowego | `lang-select` | `auth-lang-select` (obejście konfliktu DOM) |

Dodatkowy problem: `(public)/layout.tsx` był oznaczony jako `'use client'` wyłącznie po to, żeby wywołać `useAuth()` i zdecydować który header wyrenderować. Oznaczało to, że cały layout publiczny — wraz z `Footer` — był niepotrzebnie Client Component.

---

## Rozwiązanie

### 1. Jeden plik `Header.tsx`

`Header` wywołuje `useAuth()` wewnętrznie i sam decyduje co renderować:

```tsx
const { isLoggedIn, logout, user } = useAuth();
```

Warunkowe fragmenty są minimalne — trzy bloki `{isLoggedIn ? ... : ...}` w miejscach gdzie faktycznie się różnią. Mega menu i cała logika scroll pozostają bez zmian, bez duplikacji.

### 2. `(public)/layout.tsx` jako Server Component

Po przeniesieniu logiki auth do samego headera, layout publiczny nie potrzebuje już żadnych hooków:

```tsx
// przed
'use client';
const { isLoggedIn } = useAuth();
return <>{isLoggedIn ? <AuthHeader /> : <Header />}...</>

// po
return <><Header />...</>
```

Usunięcie `'use client'` z layoutu oznacza, że granica klient/serwer przesuwa się głębiej — do `Header`, który i tak musi być Client Component ze względu na scroll i stan mega menu. `Footer` pozostaje Server Component.

### 3. Usunięcie martwego kodu

- `AuthHeader.tsx` — usunięty (zastąpiony przez scalony `Header`)
- `ad.tsx` — usunięty (komponent zwracał `null`, nie był używany poza layoutem)

---

## Efekt

- **~1150 linii mniej** w codebase (usunięty `AuthHeader.tsx`)
- `(public)/layout.tsx` jest Server Component — szybszy TTFB dla stron publicznych
- Każda zmiana w headerze (nowy link w menu, zmiana stylu) wymaga edycji **jednego pliku**
- Konflikt `id="auth-lang-select"` znika — jeden select, jeden id
