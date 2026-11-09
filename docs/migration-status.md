# Status migracji na architekturę feature-based

Żywy dokument — aktualizować przy każdym kolejnym kroku migracji. Cel: zawsze widać na pierwszy rzut oka, co JEST, a co zostało. Opisuje stan kodu (10.11.2026, `release/baseline`), nie historię — mechanizmy są opisane w `docs/architecture/*`, decyzje w `REFAKTOR-PLAN.md` i `ADR-silnik-tablicy.md`.

## Stan — co jest zrobione

**Struktura frontendu**

- `src/app` = routing w route groups `(public)`/`(auth)`/`(dashboard)`/`(whiteboard)`/`(info)` + Route Handlery `api/chat`, `api/contact`; strony składają komponenty z `src/_new` (opis: `architecture/frontend-structure.md`).
- `src/_new/features/` ma 13 feature'ów: `account`, `auth`, `board`, `board-engine`, `dashboard`, `demo`, `landing`, `notifications`, `plans`, `voice-call`, `voice-chat`, `whiteboard`, `workspace`; obok `lib/` (api, auth, errors, logger, supabase, board-cache), `shared/`, `server/` (logika `/api/chat`, `/api/turn`).
- Fazy A i B refaktoru struktury (PR #45–#56) zrobione: `AuthContext` w `lib/auth`, klient Supabase w `lib/supabase`, voice chat / panel / konto / landing jako feature'y, `dependency-cruiser` w CI (`npm run depcruise`, job `frontend-arch`).
- Jedyny plik logiki poza `src/_new`: `src/app/context/BoardRealtimeContext.tsx` — Provider presence/kursorów/typing/viewportu **starego silnika** przez Supabase Realtime (hooki w `features/whiteboard/realtime/`). Wyjątek wpisany w `.dependency-cruiser.cjs`.

**Tablica**

- **Model tablicy = Yjs/Hocuspocus na stałe, w obu silnikach.** `Y.Doc` (`features/whiteboard/yjs/board-doc.ts`), transport `HocuspocusProvider` do serwisu `whiteboard-sync/`, persystencja `GET/POST /api/v1/whiteboard/{id}/doc` w tabeli `board_documents`. Dawnej ścieżki Supabase Broadcast dla elementów już nie ma: tabela `board_elements` usunięta (migracja `d315e28cb69c_drop_board_elements_table.py`), endpointów `/elements*` nie ma w `backend/api/v1/whiteboard/router.py`, flaga `NEXT_PUBLIC_WHITEBOARD_YJS` nie istnieje w kodzie. Kopia lokalna w IndexedDB (`whiteboard/yjs/use-yjs-local-cache.ts`, `lib/board-cache/`) — `pipelines.md` §2b.
- **Silnik Excalidraw za flagą `NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw`** (`features/board-engine/`, flaga w `board-engine/config/engine-flag.ts`; każda inna wartość lub brak = stary silnik `features/whiteboard`). Zrobione etapy A, B1, B2 z `ADR-silnik-tablicy.md`: własny nagłówek/pasek/zoom (`components/excalidraw-header.tsx`, `excalidraw-vertical-toolbar.tsx`, `excalidraw-zoom-controls.tsx`), notatka Markdown/KaTeX jako `embeddable` (`elements/note.tsx`), tabela (`elements/table.ts`, `table-toolbar.tsx`), PDF jako obrazy stron (`elements/pdf.ts`, `pdf-import.tsx`), wykres f(x) jako SVG (`math/`, `components/function-panel.tsx`), obrazy w prywatnym buckecie `board-files` (`files/`, backend `whiteboard/files.py`), wspólne szablony CKE i karty wzorów przez odwołanie `tpl:` (`templates/`, `files/shared-files.ts`), panele kalkulator / SmartSearch / Tutor AI (`panels/board-panels.tsx`), współpracownicy przez awareness (`yjs/awareness-collaborators.ts`), limit elementów planu (`yjs/use-element-limit.ts` + `whiteboard-sync/src/element-limit.ts`). Fonty Excalidraw serwowane lokalnie z `/excalidraw-assets/` (kopiowane w `predev`/`prebuild` przez `scripts/copy-excalidraw-assets.mjs`).
- board-engine **reużywa** część starego silnika (importy z `features/whiteboard`: `hooks/use-whiteboard-ui-metrics`, `yjs/{use-yjs-sync,use-yjs-local-cache,sync-url}`, `types`, `elements/math-eval`, `components/toolbar/{math-chatbot,markdown-note-tool,calculator-tool}`, `components/smartsearch/*`, `components/panels/saved-assets-panel`) — to zostaje po etapie F.
- **Demo bez konta** `/demo/[sessionId]` (`features/demo/`, `app/(whiteboard)/demo/[sessionId]/page.tsx`): zawsze Excalidraw, bez zapisu w bazie; serwer `whiteboard-sync/src/demo.ts` (TTL 180 min, max 10 osób w sesji, 200 sesji, 500 elementów) — `pipelines.md` §2d.

**Backend i usługi**

- **Plany Free/Premium bez płatności** (`backend/api/v1/plans/`, `features/plans/`): tabela `user_plans`, limity w `plans/limits.py` (Free: 2 przestrzenie / 3 tablice w przestrzeni / 1000 elementów / 100 MB; Premium: bez limitów oferty, 5 GB), `GET /plans/me`, `UpgradeModal` z adresem `kontakt@easylesson.app` — `docs/plan-subskrypcje.md`.
- **Limit miejsca i rejestr plików** (`backend/api/v1/storage_quota/`): tabela `board_files` (migracja `e5b2d8a47c10`), `ensure_can_upload`/`record_upload`, job sprzątający `cleanup.py` (pętla w `lifespan`, domyślnie wyłączona: `STORAGE_CLEANUP_ENABLED=false`; ręcznie `scripts/storage_cleanup.py --dry-run`), `GET /whiteboard/storage/usage` dla kont z `CALL_ADMIN_USER_IDS`.
- **Role w przestrzeni egzekwowane w backendzie** (`workspaces/authorization.py`: `require_workspace_owner` używane w `boards/service.py`, `whiteboard/service.py`, `invites/service.py`, `share_links/service.py`); viewer dostaje `connection.readOnly` w `whiteboard-sync/src/auth.ts`.
- **Redis z łagodną degradacją** (`core/redis_client.py`, `ResilientRedis`): przy `ConnectionError`/`TimeoutError` komendy idą do `fakeredis` w pamięci procesu, Redis omijany 30 s; `GET /api/v1/health` zwraca `degraded`; aliasy `GET /health` i `/healthz` = `/api/v1/health/live` (`main.py`). Wyjątek fail-closed: `whiteboard/call_guard.py`.
- **Rozmowa przez Daily** (`features/voice-call/`, `whiteboard/call.py`, `call_guard.py`, `call_usage.py`); stary czat WebRTC (`features/voice-chat/`) tylko przy `NEXT_PUBLIC_VOICE_PROVIDER=legacy`.
- Auth: JWT wyłącznie przez `PyJWT`, `AuthContext` w `src/_new/lib/auth` (`architecture/auth.md`). Moduły backendu: `auth`, `boards`, `workspaces`, `notifications`, `whiteboard`, `assets`, `plans`, `storage_quota`, `onboarding`, `health`; `@app.on_event` zastąpione `lifespan`.
- Testy (10.11.2026): vitest 96 plików / 1004 testy, whiteboard-sync 6 plików, pytest 1426, e2e 27 (`docs/testing.md`).

## Do zrobienia — kod

- [ ] **Etap F — usunięcie starego silnika** (`ADR-silnik-tablicy.md`, decyzja 6; osobna gałąź `feat/usun-stary-silnik`, po tygodniu lekcji bez regresji od BASELINE). Warunek: flaga `excalidraw` włączona na produkcji. Zakres do ustalenia w PR: `features/whiteboard` poza modułami reużywanymi przez board-engine (lista wyżej), `src/app/context/BoardRealtimeContext.tsx` + `features/whiteboard/realtime/*` (w tym `realtime/logger.ts`), gałąź legacy w `(whiteboard)/whiteboard/page.tsx` (w tym fallback `demo-board` i cookie `demo_mode` w `src/middleware.ts` — `known-issues.md` #9), `backend/api/v1/whiteboard/storage.py` + `POST /{id}/upload-image` + publiczny bucket `board-images`, `docs/ai-context/whiteboard/*`, wpisy #1–#3 w `known-issues.md`. Wyjątek `BoardRealtimeContext` w `.dependency-cruiser.cjs` znika razem z plikiem. **Nie jest zrobione.**
- [ ] **PR-C1 z `REFAKTOR-PLAN.md` (przeniesienie `BoardRealtimeContext` do `features/whiteboard/realtime`) jest bezprzedmiotowy** — plik znika w etapie F (`REFAKTOR-PLAN.md` §8, ostatni wiersz). To samo dotyczy C2–C6 (rozbijanie `whiteboard-canvas.tsx`, `select-tool.tsx`).
- [ ] **Zmiana nazwy `src/_new`** na `src/features` + `src/lib` + `src/shared` + `src/server` (PR-D1, decyzja P1 w `REFAKTOR-PLAN.md` §11): aliasy w `tsconfig.json` (`@new/*` znika), codemod importów, jeden „cichy dzień” bez otwartych gałęzi frontendowych. Najlepiej po etapie F (mniej plików).
- [ ] **Usunięcie `features/voice-chat` i trybu `NEXT_PUBLIC_VOICE_PROVIDER=legacy`** (Xirsys, `/api/turn`, `server/turn`) osobnym PR-em po okresie stabilnej pracy na Daily (`stack.md`).
- [ ] Deprecacje backendu z PR-A10 częściowo: `lifespan` jest, `datetime.utcnow()` nadal w 12 plikach poza testami (`backend-structure.md`, „Znane niespójności”).

## Zasada

Kończysz punkt z listy „do zrobienia" → przenosisz go do „Stan" w tym samym commicie, w którym robisz zmianę. Ten plik ma być zawsze zgodny ze stanem faktycznym, nie aspiracyjnym.
