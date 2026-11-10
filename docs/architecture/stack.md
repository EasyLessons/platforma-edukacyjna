# Stack technologiczny i kluczowe koncepty

Ten plik to mapa wszystkich technologii i wzorców użytych w projekcie, wraz z uzasadnieniem "dlaczego tak". Cel: ktoś (człowiek albo AI), kto wchodzi do projektu, po przeczytaniu tego pliku wie co jest czym i dlaczego, bez zgadywania. Wersje: `package.json`, `whiteboard-sync/package.json`, `backend/requirements.txt` (stan 10.11.2026, `release/baseline`).

## Frontend

**Next.js 16 (App Router) + React 19 + TypeScript** — routing oparty o strukturę folderów w `src/app`, podzielony na Route Groups (patrz `docs/architecture/frontend-structure.md`). Server Components domyślnie, `'use client'` tylko tam gdzie potrzebny stan/interaktywność.

**TanStack Query (React Query) v5** — pobieranie i cache'owanie danych z backendu (boardy, workspace'y, powiadomienia, plan użytkownika). Odpowiada za: cache po kluczu zapytania, automatyczne refetchowanie, invalidację cache po mutacjach (np. po utworzeniu boardu odświeża listę boardów). Provider: `src/_new/lib/query-provider.tsx`, podpięty w `src/app/layout.tsx`.

**Axios** — klient HTTP pod spodem warstwy API (`src/_new/lib/api/client.ts`), używany zamiast natywnego `fetch` dla wygodniejszych interceptorów (automatyczne doklejanie access tokenu, obsługa 401 → refresh, nagłówek `X-Request-ID` odbijany przez backend w błędach — `lib/api/request-id.ts`).

**Struktura feature-based (`src/_new`)** — logika biznesowa i komponenty pogrupowane per funkcja (`account`, `auth`, `board`, `board-engine`, `dashboard`, `demo`, `landing`, `notifications`, `plans`, `voice-call`, `voice-chat`, `whiteboard`, `workspace`), nie per typ pliku. `src/app` to tylko cienka warstwa routingu, która składa strony z komponentów zdefiniowanych w `src/_new/features/*`. Nazwa `_new` jest myląca (sugeruje coś tymczasowego) — jest to jednak docelowa, aktywnie używana architektura. Zmiana nazwy na stałą jest zaplanowana (PR-D1), patrz `docs/migration-status.md`.

### Silnik tablicy: Excalidraw za flagą

**`@excalidraw/excalidraw` 0.18.1 (MIT)** — jedyny silnik tablicy (`src/_new/features/board-engine/`; własny silnik canvasowy i flaga `NEXT_PUBLIC_WHITEBOARD_ENGINE` zniknęły w etapie F, 11.2026). Decyzja i uzasadnienie (własny silnik vs Excalidraw vs tldraw): `docs/architecture/ADR-silnik-tablicy.md`. Zasady z ADR, tak jak są w kodzie `features/board-engine/`:

- **Excalidraw renderuje płótno; dookoła są nasze panele.** Własny nagłówek, pionowy pasek narzędzi i zoom (`components/excalidraw-header.tsx`, `excalidraw-vertical-toolbar.tsx`, `excalidraw-zoom-controls.tsx`), motyw w kolorach EasyLesson (`excalidraw-theme.css`), panele kalkulator / SmartSearch / Tutor AI w slocie `topRightExtra` (`panels/board-panels.tsx`).
- **Notatka Markdown/KaTeX = element `embeddable`** z linkiem `easylesson:note`, treść w `customData.content`, render przez `renderEmbeddable` (`elements/note.tsx`; react-markdown + remark-math + rehype-katex). Ograniczenie Excalidraw: eksport PNG/SVG rysuje embeddable jako zastępczy prostokąt.
- **Tabela = grupa prostokątów-komórek** z natywnymi etykietami i `customData.table-cell`, mini-pasek +/- wiersz/kolumna (`elements/table.ts`, `table-toolbar.tsx`), limit 20 × 20.
- **PDF = strony renderowane w przeglądarce (`pdfjs-dist` 5.x, worker z naszego bundla, nie z CDN) do JPEG i wstawiane jako elementy `image`** w jednej grupie (`elements/pdf.ts`, `pdf-import.tsx`; do 20 MB, 20 stron, 1440 px).
- **Wykres f(x) = statyczny SVG** jako element `image` z plikiem w `files` + `customData` (`math/function-element.ts`, `function-plot.ts`, panel `components/function-panel.tsx`); dzięki temu skaluje się bez strat i eksportuje do PNG/SVG.
- **Fonty lokalnie, nie z CDN** — `scripts/copy-excalidraw-assets.mjs` kopiuje je przy `predev`/`prebuild` do `public/excalidraw-assets/` (w `.gitignore`), a `window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/'` (`components/excalidraw-whiteboard.tsx`). Szkoły bywają offline / za filtrem.
- **Obrazy tablicy w prywatnym buckecie `board-files`** przez backend (`files/`, `backend/api/v1/whiteboard/files.py`), wspólne szablony CKE i karty wzorów jako pliki statyczne wstawiane przez odwołanie `tpl:<ścieżka>` (`templates/`, `files/shared-files.ts`) — nie kopiowane do Storage, nie liczą się do limitu miejsca. Przepływ: `pipelines.md` §2c.
- **Współpraca przez Yjs/Hocuspocus** (niżej): `yjs/use-board-connection.ts`, `excalidraw-binding.ts` (scena ↔ `Y.Map` `excalidraw-elements`), kursory i lista osób z awareness (`yjs/awareness-collaborators.ts`), limit elementów planu (`yjs/use-element-limit.ts`, serwer `whiteboard-sync/src/element-limit.ts`).

Moduły dawnego `features/whiteboard`, które board-engine nadal używa (SmartSearch, kalkulator, Tutor AI, `MarkdownNoteView`, zapisane szablony, ustawienia tablicy, sidebar tablic, `use-whiteboard-ui-metrics`, `yjs/*`), zostały w `features/whiteboard` jako współdzielone panele i warstwa Yjs/REST - reszta (własny silnik canvasowy: Command/Facade/rejestr narzędzi, rbush, Supabase presence) została usunięta w etapie F (11.2026).

### Renderowanie treści matematycznej

Pipeline: `mathjs` (obliczenia/parsing wyrażeń) → `remark-math` (parsuje LaTeX w markdownie) → `rehype-katex` (renderuje do HTML) → `KaTeX` (`katex` 0.16, biblioteka renderująca wzory). `react-markdown` (+ `remark-gfm`) spina to w jeden komponent. Używane w SmartSearch (szybkie wyszukiwanie i wstawianie wzorów na tablicę), w notatce Markdown/KaTeX i w odpowiedziach Tutora AI.

### AI Assistant

`@google/generative-ai` — oficjalny SDK do Gemini. Endpoint: `src/app/api/chat/route.ts` (cienki handler), logika w `src/_new/server/chat/`. Model główny `gemini-2.5-flash` z fallbackiem na `gemini-2.5-flash-lite` przy przekroczeniu limitu. Ma wbudowany rate limiting i cache odpowiedzi, ale **oba trzymane w pamięci procesu (`Map`)** — patrz uwaga w `docs/architecture/pipelines.md`, to nie przetrwa restartu ani nie działa poprawnie przy wielu instancjach serwera.

### Realtime i komunikacja

**Yjs + Hocuspocus (`whiteboard-sync/`) — model i synchronizacja tablicy.** Stan tablicy to dokument CRDT `Y.Doc` (`yjs` 13.6; `Y.Map` `excalidraw-elements`, `board-engine/yjs/excalidraw-binding.ts`), synchronizowany przez `HocuspocusProvider` (`@hocuspocus/provider` 2.15; adres z `NEXT_PUBLIC_WHITEBOARD_SYNC_URL`, domyślnie `ws://localhost:1234` — `features/whiteboard/yjs/sync-url.ts`) z serwisem `whiteboard-sync` (Node, `@hocuspocus/server` + `@hocuspocus/extension-database`), który deleguje autoryzację i persystencję do FastAPI (`GET /whiteboard/{id}/access`, `GET/POST /whiteboard/{id}/doc`, tabela `board_documents`). Dlaczego CRDT: konflikty przy równoczesnej edycji rozwiązuje model danych, nie ręczna logika broadcastów (dawna ścieżka Supabase Broadcast nie istnieje: tabela `board_elements` usunięta migracją `d315e28cb69c`, kod w etapie F). Kopia lokalna dokumentu w IndexedDB (`y-indexeddb`, `yjs/use-yjs-local-cache.ts`, `lib/board-cache/`) — `pipelines.md` §2b. Serwer egzekwuje też rolę viewer (`connection.readOnly`), limit elementów planu i sesje demo bez konta (`whiteboard-sync/src/{auth,element-limit,demo}.ts`).

**Supabase (Realtime + Storage, NIE Auth!)** — Realtime po stronie frontendu (client: `src/_new/lib/supabase/client.ts`, klucz anon): powiadomienia (Broadcast z backendu, `notifications/realtime.py`) i zmiany ról (`postgres_changes` na `workspace_members` w stronie tablicy). Kursory i obecność na tablicy idą przez awareness Hocuspocusa, nie przez Supabase. Storage wyłącznie po stronie backendu (klucz `service_role`): **prywatny** bucket `board-files` na obrazy tablicy Excalidraw (`backend/api/v1/whiteboard/files.py` — plik wydaje tylko backend po sprawdzeniu członkostwa; `pipelines.md` §2c) i bucket `avatars` na awatary (`backend/api/v1/auth/avatar.py` + `backend/core/storage.py`). Dawny publiczny bucket `board-images` (stary silnik) nie ma już kodu — do ręcznego skasowania w Supabase. Frontend nie pisze do Storage. Auth jest własne (patrz niżej).

**Redis** — presence na tablicy (`backend/core/presence.py`, sorted set z TTL), rate limit auth, kody weryfikacyjne, liczniki plików tablicy, bezpiecznik rozmów Daily, blokada i raport jobu sprzątającego. Usługa pomocnicza, nie krytyczna: przy awarii połączenia `core/redis_client.py` (`ResilientRedis`) przełącza te ścieżki na pamięć procesu (`fakeredis`, ten sam API i TTL-e) i omija Redis przez 30 s, a `GET /api/v1/health` zgłasza `degraded`; wyjątek fail-closed: `whiteboard/call_guard.py` (szczegóły: `backend-structure.md`). `REDIS_URL` w formacie redis-py: `redis://[:haslo@]host:port/db` albo `rediss://` (TLS, np. Upstash). W testach `fakeredis`.

**Daily (rozmowa przy tablicy; `@daily-co/daily-js`, Daily Prebuilt w iframe)** — gotowa usługa WebRTC (TURN, reconnect, jakość po stronie Daily), wybrana 02.10.2026 zamiast własnego czatu głosowego (audio, kamera na życzenie). Backend (`backend/api/v1/whiteboard/call.py`, `POST /api/v1/whiteboard/{id}/call`) tworzy prywatny pokój tablicy i wydaje meeting token przez REST API Daily zwykłym `httpx` — bez SDK; klucz `DAILY_API_KEY` zna tylko backend (Render). Frontend: `features/voice-call` — jedyny dostawca (własny czat WebRTC usunięty w etapie F). `@daily-co/daily-react` celowo nie jest używany (własnego UI rozmowy nie budujemy). Opis: `pipelines.md` par. 5 (backend 5a, frontend 5c).

**MDX** (`@next/mdx`, `@mdx-js/*`) — strony treści mieszające markdown z komponentami React (`src/mdx-components.tsx`, sekcja `(info)`).

### Warstwa stylów

`class-variance-authority` + `clsx` + `tailwind-merge` — standardowy zestaw do budowania komponentów z wariantami (styl zbliżony do shadcn/ui) bez konfliktów klas Tailwind. `sonner` — toasty/powiadomienia UI. `lucide-react` — ikony. Tailwind CSS v4 jako silnik stylów.

## Backend

**FastAPI + Pydantic v2** — framework HTTP + walidacja/serializacja danych wejścia-wyjścia przez schematy Pydantic (`schemas.py` w każdym module API). Wersja FastAPI/Starlette: patrz `backend/requirements.txt` (podniesienie major opisane w `ZALEZNOSCI-2026-09.md`). Start i zamykanie przez `lifespan` (w nim pętla jobu sprzątającego).

**SQLAlchemy 2.0 (ORM) + Alembic (migracje)** — modele w `backend/core/models.py` (+ `api/v1/plans/models.py`, `api/v1/storage_quota/models.py`), migracje w `backend/alembic/versions/`. Każda zmiana schematu bazy = nowy plik migracji, nigdy ręczna zmiana produkcyjnej bazy. Na Renderze `Procfile` odpala `alembic upgrade head` przed `uvicorn`.

**PostgreSQL (Neon, serverless)** — baza produkcyjna. Bez lokalnego Postgresa w development — łączysz się przez `DATABASE_URL` do instancji Neon (w E2E i docker-compose: lokalny Postgres).

**Autoryzacja: JWT cookie-first z rotacją refresh tokenów** — pełny opis w `docs/architecture/auth.md`. JWT przez `PyJWT` (jedyna biblioteka JWT w projekcie). Limit prób logowania/rejestracji w Redisie (`core/rate_limit.py`).

**passlib + bcrypt** — hashowanie haseł użytkowników.

**Authlib** — obsługa Google OAuth (logowanie przez Google; front używa `@react-oauth/google`).

**Resend** — wysyłka maili transakcyjnych z backendu (kody weryfikacyjne, reset hasła, zaproszenia; `core/email/`). Formularz kontaktowy na froncie (`/api/contact`) woła REST Resend bezpośrednio z Route Handlera (`RESEND_API_KEY` w env Next, odbiorca `CONTACT_TO_EMAIL`, domyślnie `kontakt@easylesson.app`).

**Pillow** — sprawdzanie i przekodowanie obrazów (awatary, pliki tablicy) do WEBP (`core/image_sanitizer.py`).

**httpx** — klient HTTP backendu (Supabase Storage, Daily, Google); w testach klient do FastAPI.

**Plany i limity** — `api/v1/plans/` (`limits.py` = jedyne miejsce z liczbami, nadpisywalne env `PLAN_FREE_*`/`PLAN_PREMIUM_*`), egzekwowanie przy tworzeniu przestrzeni/tablic (`FOR UPDATE` przeciw wyścigowi), limit elementów w `whiteboard-sync`. Opis: `docs/plan-subskrypcje.md`.

**Storage quota i sprzątanie** — `api/v1/storage_quota/`: rejestr `board_files`, limit miejsca na konto właściciela przestrzeni (Free 100 MB / Premium 5 GB), job `cleanup.py` (pętla w `lifespan`, domyślnie wyłączona `STORAGE_CLEANUP_ENABLED=false`, ręcznie `scripts/storage_cleanup.py --dry-run`), podgląd zajętości `GET /whiteboard/storage/usage` dla `CALL_ADMIN_USER_IDS`. Opis: `plan-subskrypcje.md`, „Miejsce na pliki”.

**pytest + pytest-asyncio + httpx + fakeredis** — testy backendu; `fakeredis` jest też zależnością produkcyjną (magazyn awaryjny `ResilientRedis`).

## Infrastruktura

**Docker + docker-compose** — uruchomienie całości (frontend + backend + redis + whiteboard-sync) lokalnie jednym poleceniem, patrz `docker-compose.yml` i `README.md`; `docker-compose.e2e.yml` daje Postgres + Redis pod testy E2E.

**Usługi zewnętrzne** (wszystkie konfigurowane przez zmienne środowiskowe — `.env.example`, `backend/.env.example`, `whiteboard-sync/.env.example`): **Vercel** (frontend, auto-deploy z GitHuba), **Render** (backend FastAPI, `backend/Procfile`: `alembic upgrade head && uvicorn ...`; deploy po zielonym CI — `ci-cd.md`), **whiteboard-sync** (Node, `whiteboard-sync/Procfile` `npm start` + `Dockerfile`; wg `known-issues.md` #7 i `pipelines.md` §2d działa na Renderze — w repo nie ma konfiguracji hostingu), **Neon** (Postgres), **Supabase** (Storage + Realtime powiadomień/presence starego silnika), **Redis** (w kodzie tylko `REDIS_URL`; dostawca produkcyjny — Upstash wg notatek operacyjnych, nie z kodu), **Resend** (e-mail), **Daily** (rozmowa), **Xirsys** (TURN/STUN, tylko tryb `legacy`), **Gemini API** (Tutor AI). Domeny: `easylesson.app` (front; w domyślnym `ALLOWED_ORIGINS` w `core/config.py` są `https://easylesson.app` i `https://www.easylesson.app`), `api.easylesson.app` (backend — adres z konfiguracji Vercel/Render, nie z kodu; `cookie_domain` w `core/config.py` jest domyślnie puste, produkcyjna wartość `.easylesson.app` ustawiana w env).
