# Struktura frontendu

Stan obecny (nie historia zmian — historia scalona tu i usunięta jako osobne pliki, żeby nie było dwóch wersji prawdy). Plan docelowego układu (feature-based bez `_new`, `app` wyłącznie jako routing) jest w `docs/architecture/REFAKTOR-PLAN.md`.

## Dwie warstwy: routing (`src/app`) i logika (`src/_new`)

`src/app` ma odpowiadać wyłącznie za routing Next.js (które URL-e istnieją, jaki layout mają) i **składać** strony z komponentów zaimportowanych z `src/_new`. Cała logika biznesowa, hooki, komunikacja z API i większość komponentów UI żyje w `src/_new/features/*` (patrz `docs/architecture/stack.md`, sekcja "Struktura feature-based").

Jedyny wyjątek, czyli kod, który wciąż żyje w `src/app` zamiast w `src/_new` (PR-C1 w `REFAKTOR-PLAN.md`, po migracji tablicy na Yjs):

- `src/app/context/BoardRealtimeContext.tsx` — Provider synchronizacji tablicy przez Supabase Realtime (390 linii). Sama logika jest już rozbita na hooki w `src/_new/features/whiteboard/realtime/` (presence, kursory, typing, viewport, sync elementów); w `app/context` został tylko Provider spinający hooki z kanałem.

Zrobione we wrześniu 2026 (PR #47–#56): `AuthContext` → `src/_new/lib/auth`, klient Supabase → `src/_new/lib/supabase/client.ts` (folder `src/lib` nie istnieje), voice chat → `features/voice-chat`, komponenty panelu/konta/landingu → `features/{dashboard,account,landing}`, logika `/api/chat` → `src/_new/server/chat`. Strony w `src/app` importują wyłącznie przez barrele `index.ts` tych feature'ów.

## Route Groups w `src/app`

Next.js App Router pozwala grupować trasy w foldery `(nazwa)` bez wpływu na URL — każda grupa ma własny `layout.tsx`, więc różne części aplikacji (marketing, dashboard, tablica) nie dzielą jednego layoutu i nie potrzebują ręcznej logiki "czy pokazać header".

```
src/app/
├── layout.tsx                  ← root: fonty, QueryProvider, AuthProvider (z src/_new/lib)
├── mdx-components.tsx          ← mapowanie komponentów dla stron MDX w (info)
│
├── (public)/                   ← marketing / landing page — Header+Footer z features/landing
│   ├── layout.tsx
│   ├── page.tsx                 (strona główna, "/")
│   ├── product/, news/, contact/
│
├── (auth)/                     ← logowanie/rejestracja — gradient blobs + top bar
│   ├── login/, register/, reset-password/, verify/, auth/callback/
│
├── (dashboard)/                ← panel użytkownika — DashboardHeader z features/dashboard
│   ├── dashboard/                (page.tsx + dashboard-theme.css; komponenty w features/dashboard)
│   ├── account/                  (page.tsx; komponenty w features/account)
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
│   ├── chat/                     (cienki handler; logika w src/_new/server/chat, patrz pipelines.md)
│   └── contact/                  (formularz kontaktowy)
│
└── context/                     ← tylko BoardRealtimeContext — do migracji (PR-C1), patrz wyżej
```

Każda grupa ma dokładnie jeden powód do zmiany layoutu (Single Responsibility na poziomie layoutu). Header dla zalogowanych i niezalogowanych to **jeden** komponent (`Header.tsx`) — sam decyduje przez `useAuth()` co wyrenderować.

## `src/_new/*` — logika i komponenty

```
src/_new/
├── features/
│   ├── account/        (panel konta: Sidebar, ProfileSection; components/_mock/ = makiety bez backendu, known-issues #5)
│   ├── auth/           (formularze logowania/rejestracji, hooki useLogin/useRegister, Google OAuth button)
│   ├── board/          (lista boardów, tworzenie/edycja, karty boardów)
│   ├── dashboard/      (układ panelu: sidebar workspace'ów, sekcje boardów, nagłówek z popupami)
│   ├── demo/           (tablica demo bez konta: tożsamość gościa, sesja demo, CTA na landingu)
│   ├── landing/        (strona marketingowa: sections/, navigation/ (Header, Footer, mega-menus), product/)
│   ├── notifications/  (dzwoneczek powiadomień, hook useNotifications)
│   ├── voice-chat/     (VoiceChatProvider, hooki WebRTC/sygnalizacji, iceRestart, components/ panelu rozmowy)
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
│   ├── supabase/       (client.ts — klient Supabase Realtime)
│   ├── query-provider.tsx (TanStack Query provider)
│   └── utils.ts        (cn)
├── server/             # logika Route Handlerów Next (server-only, bez React)
│   └── chat/           (rate-limit, response-cache, prompt, gemini, auth dla /api/chat)
└── shared/
    ├── hooks/, types/, ui/ (komponenty reużywalne: przyciski, modale, tooltip, avatar)
```

Aliasy importu (`tsconfig.json`): `@/*` → `src/*`, `@new/*` → `src/_new/*`. W kodzie funkcjonują równolegle trzy style (`@/_new/...`, `@new/...`, ścieżki relatywne) — ujednolicenie jest zaplanowane razem ze zmianą nazwy `_new` (`REFAKTOR-PLAN.md`, PR-D1).

## Reguła nawigacji dla zmian

Chcesz zmienić **jak wygląda/routuje się strona** → szukaj w `src/app`.
Chcesz zmienić **jak coś działa** (logika, dane, stan) → szukaj w `src/_new/features/<nazwa-funkcji>`.
Chcesz zmienić **coś współdzielonego między funkcjami** (przycisk, modal, hook) → `src/_new/shared`.
Trafiłeś na `src/app/context/BoardRealtimeContext.tsx` → to ostatni plik legacy, patrz `REFAKTOR-PLAN.md` (PR-C1) zanim zaczniesz tam grzebać.
Zmieniasz logikę Route Handlera (`/api/chat`) → `src/_new/server/chat`, nie `src/app/api`.
Pracujesz nad synchronizacją tablicy → sprawdź najpierw flagę `NEXT_PUBLIC_WHITEBOARD_YJS` (`features/whiteboard/config/feature-flags.ts`): są dwie ścieżki (legacy Supabase Broadcast i Yjs/Hocuspocus), opis w `pipelines.md` §2.

## Granice importów

Zasada: `app → _new/features → _new/{shared,lib,server}`. Kod w `_new` nie importuje z `src/app`; route group nie importuje z innej route group; `shared`/`lib` nie zależą od `features`. Pilnuje `npm run depcruise` (dependency-cruiser, job `frontend-arch` w CI, konfiguracja `.dependency-cruiser.cjs`). Pozostałe, jawnie wpisane wyjątki: `BoardRealtimeContext` (do PR-C1) i `lib/auth/AuthContext → features/auth/api/authApi` (do osobnego małego PR-a).

## Limit rozmiaru pliku

Próg alarmowy w review: **400 linii**. Plik powyżej progu nie jest błędem, ale w PR trzeba napisać jednym zdaniem, dlaczego nie da się go podzielić (albo że podział jest zaplanowany). Aktualna lista plików nad progiem: `REFAKTOR-PLAN.md` §3.3.
