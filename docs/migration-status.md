# Status migracji na architekturę feature-based

Żywy dokument — aktualizować przy każdym kolejnym kroku migracji. Cel: zawsze widać na pierwszy rzut oka, co JEST, a co zostało. Opisuje stan kodu (10.11.2026, `release/baseline`), nie historię — mechanizmy są opisane w `docs/architecture/*`, decyzje w `REFAKTOR-PLAN.md` i `ADR-silnik-tablicy.md`.

## Stan — co jest zrobione

**Struktura frontendu**

- `src/app` = routing w route groups `(public)`/`(auth)`/`(dashboard)`/`(whiteboard)`/`(info)` + Route Handlery `api/chat`, `api/contact`; strony składają komponenty z `src/_new` (opis: `architecture/frontend-structure.md`).
- `src/_new/features/` ma 12 feature'ów: `account`, `auth`, `board`, `board-engine`, `dashboard`, `demo`, `landing`, `notifications`, `plans`, `voice-call`, `whiteboard` (panele i warstwa Yjs/REST współdzielone z board-engine), `workspace`; obok `lib/` (api, auth, errors, logger, supabase, board-cache), `shared/`, `server/` (logika `/api/chat`).
- Fazy A i B refaktoru struktury (PR #45–#56) zrobione: `AuthContext` w `lib/auth`, klient Supabase w `lib/supabase`, voice chat / panel / konto / landing jako feature'y, `dependency-cruiser` w CI (`npm run depcruise`, job `frontend-arch`).
- Poza `src/_new` nie ma logiki: `src/app/context/` nie istnieje (ostatni plik, `BoardRealtimeContext.tsx`, usunięty w etapie F); `.dependency-cruiser.cjs` nie ma wyjątków dla `src/app`.

**Tablica**

- **Model tablicy = Yjs/Hocuspocus na stałe, w obu silnikach.** `Y.Doc` (`features/whiteboard/yjs/board-doc.ts`), transport `HocuspocusProvider` do serwisu `whiteboard-sync/`, persystencja `GET/POST /api/v1/whiteboard/{id}/doc` w tabeli `board_documents`. Dawnej ścieżki Supabase Broadcast dla elementów już nie ma: tabela `board_elements` usunięta (migracja `d315e28cb69c_drop_board_elements_table.py`), endpointów `/elements*` nie ma w `backend/api/v1/whiteboard/router.py`, flaga `NEXT_PUBLIC_WHITEBOARD_YJS` nie istnieje w kodzie. Kopia lokalna w IndexedDB (`whiteboard/yjs/use-yjs-local-cache.ts`, `lib/board-cache/`) — `pipelines.md` §2b.
- **Silnik Excalidraw — jedyny silnik tablicy** (`features/board-engine/`; flaga `NEXT_PUBLIC_WHITEBOARD_ENGINE` i stary silnik usunięte w etapie F, 11.2026). Zrobione etapy A, B1, B2 z `ADR-silnik-tablicy.md`: własny nagłówek/pasek/zoom (`components/excalidraw-header.tsx`, `excalidraw-vertical-toolbar.tsx`, `excalidraw-zoom-controls.tsx`), notatka Markdown/KaTeX jako `embeddable` (`elements/note.tsx`), tabela (`elements/table.ts`, `table-toolbar.tsx`), PDF jako obrazy stron (`elements/pdf.ts`, `pdf-import.tsx`), wykres f(x) jako SVG (`math/`, `components/function-panel.tsx`), obrazy w prywatnym buckecie `board-files` (`files/`, backend `whiteboard/files.py`), wspólne szablony CKE i karty wzorów przez odwołanie `tpl:` (`templates/`, `files/shared-files.ts`), panele kalkulator / SmartSearch / Tutor AI (`panels/board-panels.tsx`), współpracownicy przez awareness (`yjs/awareness-collaborators.ts`), limit elementów planu (`yjs/use-element-limit.ts` + `whiteboard-sync/src/element-limit.ts`). Fonty Excalidraw serwowane lokalnie z `/excalidraw-assets/` (kopiowane w `predev`/`prebuild` przez `scripts/copy-excalidraw-assets.mjs`).
- board-engine **reużywa** część starego silnika (importy z `features/whiteboard`: `hooks/use-whiteboard-ui-metrics`, `yjs/{use-yjs-sync,use-yjs-local-cache,sync-url}`, `types`, `elements/math-eval`, `components/toolbar/{math-chatbot,markdown-note-tool,calculator-tool}`, `components/smartsearch/*`, `components/panels/saved-assets-panel`) — to zostaje po etapie F.
- **Demo bez konta** `/demo/[sessionId]` (`features/demo/`, `app/(whiteboard)/demo/[sessionId]/page.tsx`): zawsze Excalidraw, bez zapisu w bazie; serwer `whiteboard-sync/src/demo.ts` (TTL 180 min, max 10 osób w sesji, 200 sesji, 500 elementów) — `pipelines.md` §2d.

**Backend i usługi**

- **Plany Free/Premium bez płatności** (`backend/api/v1/plans/`, `features/plans/`): tabela `user_plans`, limity w `plans/limits.py` (Free: 2 przestrzenie / 3 tablice w przestrzeni / 1000 elementów / 100 MB; Premium: bez limitów oferty, 5 GB), `GET /plans/me`, `UpgradeModal` z adresem `kontakt@easylesson.app` — `docs/plan-subskrypcje.md`.
- **Limit miejsca i rejestr plików** (`backend/api/v1/storage_quota/`): tabela `board_files` (migracja `e5b2d8a47c10`), `ensure_can_upload`/`record_upload`, job sprzątający `cleanup.py` (pętla w `lifespan`, domyślnie wyłączona: `STORAGE_CLEANUP_ENABLED=false`; ręcznie `scripts/storage_cleanup.py --dry-run`), `GET /whiteboard/storage/usage` dla kont z `CALL_ADMIN_USER_IDS`.
- **Role w przestrzeni egzekwowane w backendzie** (`workspaces/authorization.py`: `require_workspace_owner` używane w `boards/service.py`, `whiteboard/service.py`, `invites/service.py`, `share_links/service.py`); viewer dostaje `connection.readOnly` w `whiteboard-sync/src/auth.ts`.
- **Redis z łagodną degradacją** (`core/redis_client.py`, `ResilientRedis`): przy `ConnectionError`/`TimeoutError` komendy idą do `fakeredis` w pamięci procesu, Redis omijany 30 s; `GET /api/v1/health` zwraca `degraded`; aliasy `GET /health` i `/healthz` = `/api/v1/health/live` (`main.py`). Wyjątek fail-closed: `whiteboard/call_guard.py`.
- **Rozmowa przez Daily** (`features/voice-call/`, `whiteboard/call.py`, `call_guard.py`, `call_usage.py`) — jedyny dostawca; stary czat WebRTC (`features/voice-chat/`, `/api/turn`, `NEXT_PUBLIC_VOICE_PROVIDER`) usunięty w etapie F.
- **Etap F (11.2026, gałąź `feat/usun-stary-silnik`):** stary silnik canvasowy tablicy usunięty w całości (`features/whiteboard/{components/canvas,tools,engine,handlers,selection,navigation,realtime,stores}`, stare narzędzia z `components/toolbar`, `board-header`, `use-yjs-board`/`yjs/board-doc`, `src/app/context/BoardRealtimeContext.tsx`, flaga `NEXT_PUBLIC_WHITEBOARD_ENGINE`, relikt `demo-board` + cookie `demo_mode`, backend `POST /whiteboard/{id}/upload-image` + `whiteboard/storage.py` (bucket `board-images`), zależności `rbush`, `zustand`, `fractional-indexing`, `docs/ai-context/whiteboard/*`), razem ze starym czatem WebRTC. W `features/whiteboard` zostały: panele (kalkulator, SmartSearch, Tutor AI, zapisane szablony, ustawienia), sidebar tablic, `use-whiteboard-ui-metrics`, `whiteboardApi` (ustawienia), `yjs/*`, `math-eval`, `MarkdownNoteView`, typy zapisanych szablonów.
- Auth: JWT wyłącznie przez `PyJWT`, `AuthContext` w `src/_new/lib/auth` (`architecture/auth.md`). Moduły backendu: `auth`, `boards`, `workspaces`, `notifications`, `whiteboard`, `assets`, `plans`, `storage_quota`, `onboarding`, `health`; `@app.on_event` zastąpione `lifespan`.
- Testy (10.11.2026, po etapie F): vitest 78 plików / 776 testów, whiteboard-sync 6 plików / 65 testów, pytest 1423, e2e 27 (`docs/testing.md`).

## Do zrobienia — kod

- [x] **Etap F — usunięcie starego silnika (11.2026, gałąź `feat/usun-stary-silnik`):** zrobione, zakres w sekcji „Zrobione”. PR-C1 i C2–C6 z `REFAKTOR-PLAN.md` są bezprzedmiotowe (pliki nie istnieją).
- [ ] **Zmiana nazwy `src/_new`** na `src/features` + `src/lib` + `src/shared` + `src/server` (PR-D1, decyzja P1 w `REFAKTOR-PLAN.md` §11): aliasy w `tsconfig.json` (`@new/*` znika), codemod importów, jeden „cichy dzień” bez otwartych gałęzi frontendowych. Najlepiej po etapie F (mniej plików).
- [x] **Usunięcie `features/voice-chat` i trybu `NEXT_PUBLIC_VOICE_PROVIDER=legacy`** (Xirsys, `/api/turn`, `server/turn`) — zrobione w etapie F (osobny commit `refactor(voice)`, do odrzucenia jednym revertem).
- [ ] Deprecacje backendu z PR-A10 częściowo: `lifespan` jest, `datetime.utcnow()` nadal w 12 plikach poza testami (`backend-structure.md`, „Znane niespójności”).

## Zasada

Kończysz punkt z listy „do zrobienia" → przenosisz go do „Stan" w tym samym commicie, w którym robisz zmianę. Ten plik ma być zawsze zgodny ze stanem faktycznym, nie aspiracyjnym.
