# Struktura frontendu

Stan obecny (nie historia zmian — historia scalona tu i usunięta jako osobne pliki, żeby nie było dwóch wersji prawdy).

## Dwie warstwy: routing (`src/app`) i logika (`src/_new`)

`src/app` odpowiada wyłącznie za routing Next.js (które URL-e istnieją, jaki layout mają) i **składa** strony z komponentów zaimportowanych z `src/_new`. Cała logika biznesowa, hooki, komunikacja z API i większość komponentów UI żyje w `src/_new/features/*` (patrz `docs/architecture/stack.md`, sekcja "Struktura feature-based").

Wyjątki, czyli kod, który wciąż żyje w `src/app` zamiast w `src/_new` (do przeniesienia, patrz `docs/migration-status.md`):
- `src/app/context/AuthContext.tsx` — globalny stan sesji (`useAuth()`), 100 linii, już korzysta z `_new/lib/auth` i `_new/features/auth/api` pod spodem, ale sam Provider nie jest w `_new`.
- `src/app/context/BoardRealtimeContext.tsx` — synchronizacja tablicy przez Supabase Realtime, **1245 linii**, wciąż w starym stylu (jeden duży plik).
- `src/app/context/VoiceChatContext.tsx` — WebRTC voice chat, **1484 linie**, jak wyżej.
- `src/lib/supabase.ts` — klient Supabase, jedyny plik w `src/lib`, w starym stylu komentarzy.

## Route Groups w `src/app`

Next.js App Router pozwala grupować trasy w foldery `(nazwa)` bez wpływu na URL — każda grupa ma własny `layout.tsx`, więc różne części aplikacji (marketing, dashboard, tablica) nie dzielą jednego layoutu i nie potrzebują ręcznej logiki "czy pokazać header".

```
src/app/
├── layout.tsx                  ← root: fonty, QueryProvider, AuthProvider
│
├── (public)/                   ← marketing / landing page — Header+Footer
│   ├── layout.tsx
│   ├── _components/             (Header, Footer, mega-menu produktowe)
│   ├── page.tsx                 (strona główna, "/")
│   ├── sections/                (sekcje landing page)
│   ├── product/, news/, contact/
│
├── (auth)/                     ← logowanie/rejestracja — gradient blobs + top bar
│   ├── login/, register/, reset-password/, verify/, auth/callback/
│
├── (dashboard)/                ← panel użytkownika — DashboardHeader
│   ├── dashboard/                (główny widok: boardy, workspace'y)
│   ├── account/                  (profil użytkownika)
│   ├── invite/[token]/           (akceptacja zaproszenia do workspace'u)
│
├── (whiteboard)/                ← fullscreen, bez header/footer
│   └── whiteboard/               (sama tablica)
│
├── (info)/                     ← dokumentacja i regulaminy, sidebar
│   └── docs/, privacy-policy/, terms/, gdpr/, cookies-policy/
│
├── api/                         ← Next.js Route Handlers (nie FastAPI!)
│   ├── chat/                     (proxy do Gemini, patrz pipelines.md)
│   └── contact/                  (formularz kontaktowy)
│
└── context/                     ← trzy pliki do migracji, patrz wyżej
```

Każda grupa ma dokładnie jeden powód do zmiany layoutu (Single Responsibility na poziomie layoutu). Header dla zalogowanych i niezalogowanych to **jeden** komponent (`Header.tsx`) — sam decyduje przez `useAuth()` co wyrenderować, żeby nie utrzymywać dwóch prawie identycznych plików (tak było wcześniej: `Header.tsx` + `AuthHeader.tsx`, ~1150 linii każdy, różniące się w ~25 miejscach — scalone).

## `src/_new/*` — logika i komponenty

```
src/_new/
├── features/
│   ├── auth/          (formularze logowania/rejestracji, hooki useLogin/useRegister, Google OAuth button)
│   ├── board/          (lista boardów, tworzenie/edycja, karty boardów)
│   ├── notifications/  (dzwoneczek powiadomień, hook useNotifications)
│   ├── whiteboard/      (silnik tablicy — engine, tools, commands, elements, stores)
│   └── workspace/       (sidebar workspace'ów, top nav)
├── lib/
│   ├── api/             (klient axios + typy odpowiedzi API)
│   ├── auth/             (przechowywanie access tokenu, tokenService)
│   ├── errors/            (AppError, errorHandler — jednolita obsługa błędów API)
│   └── query-provider.tsx (TanStack Query provider)
└── shared/
    ├── hooks/, types/, ui/ (komponenty reużywalne: przyciski, modale, itp.)
```

Alias importu: `@/_new/*` zdefiniowany w `tsconfig.json`. Po zmianie nazwy folderu (patrz roadmap) alias trzeba będzie zaktualizować w jednym miejscu.

## Reguła nawigacji dla zmian

Chcesz zmienić **jak wygląda/routuje się strona** → szukaj w `src/app`.
Chcesz zmienić **jak coś działa** (logika, dane, stan) → szukaj w `src/_new/features/<nazwa-funkcji>`.
Chcesz zmienić **coś współdzielonego między funkcjami** (przycisk, modal, hook) → `src/_new/shared`.
Trafiłeś na `src/app/context/*` albo `src/lib/supabase.ts` → to legacy do migracji, patrz `docs/migration-status.md` zanim zaczniesz tam grzebać.
