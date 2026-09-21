# Struktura frontendu

Stan obecny (nie historia zmian — historia scalona tu i usunięta jako osobne pliki, żeby nie było dwóch wersji prawdy). Plan docelowego układu (feature-based bez `_new`, `app` wyłącznie jako routing) jest w `docs/architecture/REFAKTOR-PLAN.md`.

## Dwie warstwy: routing (`src/app`) i logika (`src/_new`)

`src/app` ma odpowiadać wyłącznie za routing Next.js (które URL-e istnieją, jaki layout mają) i **składać** strony z komponentów zaimportowanych z `src/_new`. Cała logika biznesowa, hooki, komunikacja z API i większość komponentów UI żyje w `src/_new/features/*` (patrz `docs/architecture/stack.md`, sekcja "Struktura feature-based").

Wyjątki, czyli kod, który wciąż żyje w `src/app` zamiast w `src/_new` (do przeniesienia — kolejność i PR-y w `REFAKTOR-PLAN.md`, Faza A i B):

- `src/app/context/BoardRealtimeContext.tsx` — Provider synchronizacji tablicy przez Supabase Realtime (390 linii). Sama logika jest już rozbita na hooki w `src/_new/features/whiteboard/realtime/` (presence, kursory, typing, viewport, sync elementów); w `app/context` został tylko Provider spinający hooki z kanałem.
- `src/app/context/VoiceChatContext.tsx` (646 linii) + `src/app/context/voice-chat/` (hooki: `useWebRTCConnections`, `useVoiceSignaling`, `useVoiceDetection`, `mediaSupport`, `constants`, `types`) — WebRTC voice chat. Rozbity na hooki w PR #38, ale nadal poza `_new`.
- `src/lib/supabase.ts` — klient Supabase, jedyny plik w `src/lib`.
- Komponenty w `src/app/(dashboard)/dashboard/{Components,Header}`, `src/app/(dashboard)/account/components`, `src/app/(public)/{sections,_components}` — ok. 10 000 linii UI, które z punktu widzenia reguły "app = routing" powinny być feature'ami (`dashboard`, `account`, `landing`).

`AuthContext` **nie** jest już wyjątkiem — Provider sesji żyje w `src/_new/lib/auth/AuthContext.tsx` (eksport `AuthProvider`, `useAuth` przez barrel `src/_new/lib/auth`).

## Route Groups w `src/app`

Next.js App Router pozwala grupować trasy w foldery `(nazwa)` bez wpływu na URL — każda grupa ma własny `layout.tsx`, więc różne części aplikacji (marketing, dashboard, tablica) nie dzielą jednego layoutu i nie potrzebują ręcznej logiki "czy pokazać header".

```
src/app/
├── layout.tsx                  ← root: fonty, QueryProvider, AuthProvider (z src/_new/lib)
├── mdx-components.tsx          ← mapowanie komponentów dla stron MDX w (info)
│
├── (public)/                   ← marketing / landing page — Header+Footer
│   ├── layout.tsx
│   ├── _components/             (Header, Footer, mega-menus/)
│   ├── page.tsx                 (strona główna, "/")
│   ├── sections/                (sekcje landing page)
│   ├── product/ (+ sections/), news/, contact/
│
├── (auth)/                     ← logowanie/rejestracja — gradient blobs + top bar
│   ├── login/, register/, reset-password/, verify/, auth/callback/
│
├── (dashboard)/                ← panel użytkownika — DashboardHeader
│   ├── dashboard/                (główny widok: boardy, workspace'y; Components/, Header/)
│   ├── account/                  (profil użytkownika; components/)
│   ├── invite/[token]/           (akceptacja zaproszenia do workspace'u)
│   ├── join/[token]/             (dołączenie przez link udostępniania workspace'u)
│
├── (whiteboard)/               ← fullscreen, bez header/footer
│   ├── whiteboard/               (tablica zalogowanego usera; ?boardId=)
│   └── demo/[sessionId]/         (tablica demo bez konta — feature `demo`)
│
├── (info)/                     ← dokumentacja i regulaminy (MDX), sidebar
│   └── docs/, privacy-policy/, terms/, terms-of-use/, gdpr/, cookies-policy/
│
├── api/                         ← Next.js Route Handlers (nie FastAPI!)
│   ├── chat/                     (proxy do Gemini + auth przez backend, patrz pipelines.md)
│   └── contact/                  (formularz kontaktowy)
│
└── context/                     ← BoardRealtimeContext, VoiceChatContext + voice-chat/ — do migracji, patrz wyżej
```

Każda grupa ma dokładnie jeden powód do zmiany layoutu (Single Responsibility na poziomie layoutu). Header dla zalogowanych i niezalogowanych to **jeden** komponent (`Header.tsx`) — sam decyduje przez `useAuth()` co wyrenderować.

## `src/_new/*` — logika i komponenty

```
src/_new/
├── features/
│   ├── auth/           (formularze logowania/rejestracji, hooki useLogin/useRegister, Google OAuth button)
│   ├── board/          (lista boardów, tworzenie/edycja, karty boardów)
│   ├── demo/           (tablica demo bez konta: tożsamość gościa, sesja demo, CTA na landingu)
│   ├── notifications/  (dzwoneczek powiadomień, hook useNotifications)
│   ├── whiteboard/     (silnik tablicy)
│   │   ├── api/         (whiteboardApi, assets-api, elements-api — REST do backendu)
│   │   ├── commands/    (Command pattern: create/update/delete, composite)
│   │   ├── components/  (canvas/, layout/, panels/, smartsearch/, toolbar/)
│   │   ├── config/      (feature-flags.ts — m.in. NEXT_PUBLIC_WHITEBOARD_YJS)
│   │   ├── elements/    (rendering, kompresja obrazów, math-eval, tabele)
│   │   ├── engine/      (WhiteboardEngine — fasada)
│   │   ├── handlers/    (rendering per typ elementu)
│   │   ├── hooks/       (use-viewport, use-elements, use-history, use-selection, use-realtime, use-yjs-board, ...)
│   │   ├── navigation/  (viewport-math, spatial-index/rbush)
│   │   ├── realtime/    (hooki Supabase Realtime: kanał, presence, kursory, typing, viewport, sync elementów)
│   │   ├── selection/   (snap)
│   │   ├── stores/      (tool-store — Zustand)
│   │   ├── tools/       (rejestr narzędzi: *.tool.tsx adaptery + ToolHostContext)
│   │   ├── types/
│   │   └── yjs/         (board-doc — model Y.Doc, use-yjs-sync — Hocuspocus provider)
│   └── workspace/      (sidebar workspace'ów, zaproszenia, członkowie, linki udostępniania)
├── lib/
│   ├── api/            (klient axios + typy odpowiedzi API)
│   ├── auth/           (AuthContext/AuthProvider, tokenStore, tokenService)
│   ├── errors/         (AppError, errorHandler — jednolita obsługa błędów API)
│   ├── query-provider.tsx (TanStack Query provider)
│   └── utils.ts        (cn)
└── shared/
    ├── hooks/, types/, ui/ (komponenty reużywalne: przyciski, modale, tooltip, avatar)
```

Aliasy importu (`tsconfig.json`): `@/*` → `src/*`, `@new/*` → `src/_new/*`. W kodzie funkcjonują równolegle trzy style (`@/_new/...`, `@new/...`, ścieżki relatywne) — ujednolicenie jest zaplanowane razem ze zmianą nazwy `_new` (`REFAKTOR-PLAN.md`, PR-D1).

## Reguła nawigacji dla zmian

Chcesz zmienić **jak wygląda/routuje się strona** → szukaj w `src/app`.
Chcesz zmienić **jak coś działa** (logika, dane, stan) → szukaj w `src/_new/features/<nazwa-funkcji>`.
Chcesz zmienić **coś współdzielonego między funkcjami** (przycisk, modal, hook) → `src/_new/shared`.
Trafiłeś na `src/app/context/*` albo `src/lib/supabase.ts` → to legacy do migracji, patrz `docs/migration-status.md` i `REFAKTOR-PLAN.md` zanim zaczniesz tam grzebać.
Pracujesz nad synchronizacją tablicy → sprawdź najpierw flagę `NEXT_PUBLIC_WHITEBOARD_YJS` (`features/whiteboard/config/feature-flags.ts`): są dwie ścieżki (legacy Supabase Broadcast i Yjs/Hocuspocus), opis w `pipelines.md` §2.

## Granice importów

Zasada: `app → _new/features → _new/{shared,lib}`. Kod w `_new` nie powinien importować z `src/app`. Dziś ta reguła jest łamana w 17 miejscach (`DashboardButton` z `app/(dashboard)`, oba konteksty z `app/context`) — usuwane w PR-ach A3, B1, C1 planu; pilnowanie przez `dependency-cruiser` w CI wchodzi w PR-A2.

## Limit rozmiaru pliku

Próg alarmowy w review: **400 linii**. Plik powyżej progu nie jest błędem, ale w PR trzeba napisać jednym zdaniem, dlaczego nie da się go podzielić (albo że podział jest zaplanowany). Aktualna lista plików nad progiem: `REFAKTOR-PLAN.md` §3.3.
