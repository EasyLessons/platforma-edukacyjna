# Stack technologiczny i kluczowe koncepty

Ten plik to mapa wszystkich technologii i wzorców użytych w projekcie, wraz z uzasadnieniem "dlaczego tak". Cel: ktoś (człowiek albo AI), kto wchodzi do projektu, po przeczytaniu tego pliku wie co jest czym i dlaczego, bez zgadywania.

## Frontend

**Next.js (App Router) + React 19 + TypeScript** — routing oparty o strukturę folderów w `src/app`, podzielony na Route Groups (patrz `docs/architecture/frontend-structure.md`). Server Components domyślnie, `'use client'` tylko tam gdzie potrzebny stan/interaktywność.

**Zustand** — globalny stan UI (np. store tablicy, store narzędzi). Zamiast Redux: mniej boilerplate'u, subskrypcja przez selektory (`useStore(s => s.pole)`) więc komponent re-renderuje się tylko gdy zmieni się dokładnie to pole, którego używa — nie przy każdej zmianie store'a. Zasada w projekcie: żadnego prop-drillingu, jeśli coś jest potrzebne w 3+ miejscach, idzie do store'a albo do query hooka.

**TanStack Query (React Query) v5** — pobieranie i cache'owanie danych z backendu (boardy, workspace'y, powiadomienia). Odpowiada za: cache po kluczu zapytania, automatyczne refetchowanie, invalidację cache po mutacjach (np. po utworzeniu boardu odświeża listę boardów). Provider: `src/_new/lib/query-provider.tsx`, podpięty w `src/app/layout.tsx`. **Uwaga:** ta biblioteka nie była wymieniona w README mimo że jest centralnym mechanizmem pobierania danych — poprawione w tym audycie dokumentacji.

**Axios** — klient HTTP pod spodem warstwy API (`src/_new/lib/api/client.ts`), używany zamiast natywnego `fetch` dla wygodniejszych interceptorów (np. automatyczne doklejanie access tokenu, obsługa 401 → refresh).

**Struktura feature-based (`src/_new`)** — logika biznesowa i komponenty pogrupowane per funkcja (`auth`, `board`, `notifications`, `whiteboard`, `workspace`), nie per typ pliku. `src/app` to tylko cienka warstwa routingu, która składa strony z komponentów zdefiniowanych w `src/_new/features/*`. Nazwa `_new` jest myląca (sugeruje coś tymczasowego) — jest to jednak docelowa, aktywnie używana architektura. Zmiana nazwy na coś stałego jest zaplanowana, patrz `docs/migration-status.md`.

### Wzorce projektowe w tablicy (whiteboard)

- **Command** — każda operacja na tablicy (narysowanie, przesunięcie, usunięcie) to obiekt polecenia ze swoim `execute`/`undo`. Stos historii = stos poleceń. Dzięki temu undo/redo działa jednolicie dla wszystkich narzędzi.
- **Facade (`WhiteboardEngine`)** — ukrywa przed resztą aplikacji szczegóły zapisu, rysowania i synchronizacji (broadcast) za prostymi metodami-intencjami (`addElement`, `moveElement`...).
- **Strategy + Open/Closed (rejestr narzędzi)** — każde narzędzie to osobny plik `*.tool.tsx` rejestrowany w `ALL_TOOLS`. Dodanie narzędzia = nowy plik + wpis w rejestrze, zero zmian w istniejącym kodzie. Pełna instrukcja: `docs/ai-context/whiteboard/how-to-add-tool.md`.
- **rbush (R-tree)** — przestrzenny indeks elementów na tablicy. Zamiast przeglądać liniowo wszystkie elementy żeby sprawdzić co jest pod kursorem (O(n)), rbush dzieli płaszczyznę na prostokąty i pozwala pytać "co jest w tym obszarze" w czasie O(log n). Krytyczne dla płynności przy dużej liczbie elementów na tablicy.

### Renderowanie treści matematycznej

Pipeline: `mathjs` (obliczenia/parsing wyrażeń) → `remark-math` (parsuje LaTeX w markdownie) → `rehype-katex` (renderuje do HTML) → `KaTeX` (biblioteka renderująca wzory). `react-markdown` spina to w jeden komponent. Używane w SmartSearch (szybkie wyszukiwanie i wstawianie wzorów na tablicę).

### AI Assistant

`@google/generative-ai` — oficjalny SDK do Gemini. Endpoint: `src/app/api/chat/route.ts`. Model główny `gemini-2.5-flash` z fallbackiem na `gemini-2.5-flash-lite` przy przekroczeniu limitu. Ma wbudowany rate limiting i cache odpowiedzi, ale **oba trzymane w pamięci procesu (`Map`)** — patrz uwaga w `docs/architecture/pipelines.md`, to nie przetrwa restartu ani nie działa poprawnie przy wielu instancjach serwera.

### Realtime i komunikacja

**Supabase (Realtime + Storage, NIE Auth!)** — Broadcast + Presence po stronie frontendu (client: `src/lib/supabase.ts`): powiadomienia, kursory/presence/typing na tablicy, sygnalizacja voice chatu i — w ścieżce legacy — synchronizacja elementów tablicy. Storage po stronie backendu (bucket `board-images`, `backend/api/v1/whiteboard/storage.py`) na obrazy wklejane na tablicę. Auth jest własne (patrz wyżej).

**Yjs + Hocuspocus (`whiteboard-sync/`)** — nowy model tablicy, wdrażany za flagą `NEXT_PUBLIC_WHITEBOARD_YJS=true`. Stan tablicy to dokument CRDT `Y.Doc` (`src/_new/features/whiteboard/yjs/board-doc.ts`, kolejność elementów przez `fractional-indexing`, undo/redo przez `Y.UndoManager`), synchronizowany przez `HocuspocusProvider` (`yjs/use-yjs-sync.ts`, env `NEXT_PUBLIC_WHITEBOARD_SYNC_URL`, domyślnie `ws://localhost:1234`) z serwisem `whiteboard-sync` (Node, `@hocuspocus/server`), który deleguje autoryzację i persystencję do FastAPI (`GET /whiteboard/{id}/access`, `GET/POST /whiteboard/{id}/doc`, tabela `board_documents`). Dlaczego CRDT: konflikty przy równoczesnej edycji rozwiązuje model danych, nie ręczna logika broadcastów (patrz `known-issues.md` #1–#3 — problemy ścieżki legacy, które w Yjs nie istnieją). Migracja `board_elements → board_documents` w toku (gałąź `feature/whiteboard-yjs`).

**Redis** — presence na tablicy (`backend/core/presence.py`, sorted set z TTL) i rate limit auth. W testach `fakeredis`.

**WebRTC (Xirsys jako TURN/STUN provider)** — połączenia głosowe peer-to-peer między użytkownikami na tej samej tablicy, sygnalizacja przez Supabase Broadcast.

**PDF.js (`pdfjs-dist`)** — odczyt/renderowanie PDF-ów w przeglądarce (materiały wgrywane na tablicę).

**MDX** — strony treści mieszające markdown z komponentami React (prawdopodobnie sekcja `(info)/docs`).

### Warstwa stylów

`class-variance-authority` + `clsx` + `tailwind-merge` — standardowy zestaw do budowania komponentów z wariantami (styl zbliżony do shadcn/ui) bez konfliktów klas Tailwind. `sonner` — toasty/powiadomienia UI. Tailwind CSS v4 jako silnik stylów.

## Backend

**FastAPI + Pydantic v2** — framework HTTP + walidacja/serializacja danych wejścia-wyjścia przez schematy Pydantic (`schemas.py` w każdym module API).

**SQLAlchemy 2.0 (ORM) + Alembic (migracje)** — modele w `backend/core/models.py`, migracje w `backend/alembic/versions/`. Każda zmiana schematu bazy = nowy plik migracji, nigdy ręczna zmiana produkcyjnej bazy.

**PostgreSQL (Neon, serverless)** — baza produkcyjna. Bez lokalnego Postgresa w development — łączysz się przez `DATABASE_URL` do instancji Neon.

**Autoryzacja: JWT cookie-first z rotacją refresh tokenów** — pełny opis w `docs/architecture/auth.md`. JWT przez `python-jose` (jedyna biblioteka JWT w projekcie). Limit prób logowania/rejestracji w Redisie (`core/rate_limit.py`).

**passlib + bcrypt** — hashowanie haseł użytkowników.

**Authlib** — obsługa Google OAuth (logowanie przez Google).

**Resend** — wysyłka maili transakcyjnych (kody weryfikacyjne, reset hasła).

**pytest + pytest-asyncio + httpx** — testy backendu, `httpx` jako klient do testowania endpointów FastAPI bez realnego serwera.

## Infrastruktura

**Docker + docker-compose** — uruchomienie całości (frontend + backend + redis + whiteboard-sync) lokalnie jednym poleceniem, patrz `docker-compose.yml` i `README.md`.

**Neon (Postgres serverless)**, **Supabase (Realtime + Storage)**, **Redis**, **Resend (email)**, **Xirsys (WebRTC TURN/STUN)**, **Gemini API** — usługi zewnętrzne, wszystkie konfigurowane przez zmienne środowiskowe (`.env.local`, `backend/.env`). Backend deployowany na Render, frontend na Vercel (patrz `ci-cd.md`); `whiteboard-sync` ma `Procfile`/`Dockerfile`, hosting do ustalenia.
