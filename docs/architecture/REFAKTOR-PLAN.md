# Plan refaktoru struktury projektu EasyLesson

**Data:** 21.09.2026
**Baza:** `origin/main` = `437999c` (merge PR #41). Plan powstał po ponownym `git fetch`
tuż przed pisaniem; PR #40 i #41 są już w `main`, PR #39 wciąż otwarty.
**Status:** propozycja do recenzji Patryka. W tej sesji nie zmieniono ani jednej linii kodu.
**Zasada nadrzędna:** małe PR-y, każdy zielony na CI, każdy z jasnym "jak sprawdzić".
Duże przenosiny robimy przez `git mv`, żeby review pokazywał rename, nie +/- całego pliku.

---

## 0. Stan wyjściowy (zmierzony, nie z dokumentacji)

Wszystko poniżej uruchomione w osobnym worktree z `origin/main@437999c`, po `npm ci`
i z tymi samymi zaślepkami env, których używa job `backend-test` w `ci.yml`.

| Sprawdzenie                       | Wynik                                                        |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run typecheck`               | 0 błędów                                                     |
| `npm run test` (vitest)           | 38 plików, **450 testów, 450 passed**                        |
| `npm run lint` (eslint)           | 0 błędów, **135 warningów** (głównie `no-console`, 79 wystąpień `console.log`) |
| `pytest tests/` (backend)         | **334 passed**, 1811 warningów (deprecacje `datetime.utcnow`, `on_event`) |
| `ruff check .`                    | czysto                                                       |
| `npx depcruise src`               | 14 naruszeń (5 błędów w `src/test/*` i `mdx-components.tsx`, 9 warningów: sieroty + 1 cykl w `auth/api/authApi.ts`) |
| `prettier --check`                | 345 plików "do poprawy" - **fałszywy alarm lokalny** (CRLF z `core.autocrlf=true`; CI na Linuksie jest zielone) |

Rozmiar kodu (bez testów, bez `node_modules`/`.venv`/`alembic`):

| Obszar                     | Pliki | Linie      |
| -------------------------- | ----- | ---------- |
| `src/` razem               | 349   | ~51 200    |
| `src/_new/`                | -     | ~35 500    |
| `src/app/`                 | -     | ~15 300, z czego **~10 100 to komponenty, nie routing** |
| `backend/` (bez testów)    | 95    | ~5 000     |
| `whiteboard-sync/`         | 3     | 118        |

Testy: 38 plików frontend, 25 plików backend.

---

## 1. Weryfikacja dokumentacji z kodem - rozbieżności

Dokumentacja była ostatnio spójnie aktualizowana 16.09. Od tego czasu weszły PR #37, #42,
#43 (Yjs/Hocuspocus), #38 (rozbicie VoiceChatContext), #40, #41 (mobile). Każda pozycja
poniżej to rzecz, którą trzeba poprawić w docs (PR-A1), nie w kodzie.

| # | Plik docs | Co mówi doc | Co jest w kodzie |
| - | --------- | ----------- | ---------------- |
| 1 | `frontend-structure.md` | `AuthContext.tsx` leży w `src/app/context` | Przeniesiony do `src/_new/lib/auth/AuthContext.tsx` (odnotowane w `migration-status.md`, ale `frontend-structure.md`, `auth.md`, `pipelines.md`, `global-context.md` nadal podają starą ścieżkę) |
| 2 | `frontend-structure.md`, `pipelines.md`, `global-context.md` | `BoardRealtimeContext` 1245 linii, `VoiceChatContext` 1484 linie | 390 i 646 linii; VoiceChat rozbity na `src/app/context/voice-chat/` (5 hooków, 979 linii) w PR #38 |
| 3 | `frontend-structure.md` | alias `@/_new/*` | W `tsconfig.json` jest `@new/*` (i `@/*`); w kodzie równolegle 3 style: `@/_new/` (314 importów), `@new/` (31), relatywne `../` (178) |
| 4 | `frontend-structure.md` | drzewo `src/app` | Brak w docs: `(dashboard)/join/[token]`, `(whiteboard)/demo/[sessionId]`, `(info)/terms-of-use`, `src/mdx-components.tsx`; brak `features/demo`, `whiteboard/yjs`, `whiteboard/realtime`, `whiteboard/config` |
| 5 | `backend-structure.md` | istnieją `backend/auth/` i `backend/dashboard/` | **Nie istnieją.** Są za to nieopisane: `workspaces/share_links/`, `api/v1/onboarding/`, `core/presence.py` (Redis), `core/redis_client.py`, `core/rate_limit.py`, `core/email/` |
| 6 | `backend-structure.md` | 10 tabel | 12: doszły `WorkspaceShareLink` i `BoardDocument` (snapshot Y.Doc, `bytea`) |
| 7 | `backend-structure.md`, `stack.md`, `auth.md` | "requirements.txt w UTF-16", "PyJWT + python-jose do ujednolicenia" | Oba naprawione (zapisane w `migration-status.md` jako zrobione), ale sekcje "znane niespójności" w trzech plikach nadal je wymieniają |
| 8 | `stack.md`, `pipelines.md` §2 | sync tablicy = Supabase Broadcast | Za flagą `NEXT_PUBLIC_WHITEBOARD_YJS=true` działa druga ścieżka: `Y.Doc` -> `HocuspocusProvider` -> serwis `whiteboard-sync` (Node, `@hocuspocus/server`) -> `POST/GET /api/v1/whiteboard/{id}/doc` + `GET /{id}/access`. Ani Yjs, ani Hocuspocus, ani `whiteboard-sync`, ani `fractional-indexing`, ani Redis nie są wspomniane w `stack.md` |
| 9 | `stack.md` | "Supabase tylko Realtime" | Backend używa też Supabase **Storage** (bucket `board-images`, `whiteboard/storage.py`) |
| 10 | `stack.md` | docker-compose = frontend + backend | 4 serwisy: `backend`, `frontend`, `redis`, `whiteboard-sync` |
| 11 | `dashboard.md` | drzewo komponentów | Brak `WelcomeSection.tsx`, `open-workspaces-button.tsx`, `DashboardButton.tsx`, `Header/popups/*`, `join/[token]`; brak opisu share-linków; `backend/dashboard/` nie istnieje |
| 12 | `testing.md` | czerwiec 2026, ~215 testów, "realtime przez Socket.io" | 450 (vitest) + 334 (pytest) = 784; Socket.io nie ma w projekcie; brak w drzewie testów: `tests/core/`, share links, rate limit, dependencies, yjs, demo, voice chat, mobile |
| 13 | `migration-status.md` | "Rozbić VoiceChatContext (1484 linie)" - otwarte | Zrobione w PR #38, pozycja nieodhaczona; brak jakiegokolwiek wpisu o migracji Yjs |
| 14 | `canvas-architecture.md` §8, §9 | `whiteboard-canvas.tsx:743`, `eraser-tool.tsx:116` | Dziś linie 889 i 85 (treść zgodna, numery nie) |
| 15 | `known-issues.md` #1-#3 | wyścigi i limity Supabase Broadcast | Wszystkie trzy dotyczą ścieżki legacy; po przełączeniu Yjs na stałe stają się bezprzedmiotowe - trzeba to zaznaczyć, nie naprawiać |
| 16 | `ci-cd.md` | 6 jobów CI | Zgodne, ale `whiteboard-sync/` nie ma w CI żadnego kroku (ani typecheck, ani lint, ani testów) |

Rzeczy zgodne z kodem (sprawdzone): route groups, rejestr narzędzi (`ALL_TOOLS`, 11 wpisów
= docs), `ToolHostContext`, przepływ auth (cookie + rotacja refresh), format `ApiResponse`,
struktura modułów backendu (`router/schemas/service`), Google OAuth przez ID token.

---

## 2. Stan gita i praca równoległa

**Otwarte PR-y (po ponownym fetchu):**

| PR  | Gałąź                       | Dotyka                                                                                     | Wpływ na plan |
| --- | --------------------------- | ------------------------------------------------------------------------------------------ | ------------- |
| #39 | `fix/voice-mobile`          | `src/app/context/VoiceChatContext.tsx`, `voice-chat/*`, `canvas/voice-chat*.tsx`, `online-users.tsx` | **Blokuje** przenosiny voice chatu (Faza B) |
| #2  | `copilot/...`               | stary, startup DB                                                                          | do zamknięcia (pytanie P11) |
| #1  | `vercel/react-flight-...`   | stary, bump zależności                                                                     | do zamknięcia (pytanie P11) |

**Bartek (Berkel1611) - `feature/whiteboard-yjs`:** 1 commit ponad `main` (21.09):
`scripts/migrate-board-elements-to-yjs.ts` (+`pg`, `@types/pg`, `tsx` w devDependencies).
Kolejne naturalne kroki po jego stronie: uruchomienie migracji na produkcji, flaga
`NEXT_PUBLIC_WHITEBOARD_YJS` domyślnie włączona, usunięcie ścieżki legacy. Historycznie
Bartek pracuje głównie w `backend/api/v1/{boards,workspaces,auth,whiteboard}` i
`features/board`.

**Strefa zakazu do czasu zakończenia migracji Bartka** (nie ruszamy w Fazach A-B):
`whiteboard-canvas.tsx`, `hooks/use-elements.ts`, `hooks/use-yjs-board.ts`, `yjs/*`,
`realtime/*`, `api/whiteboardApi.ts`, `api/elements-api.ts`, `config/feature-flags.ts`,
`backend/api/v1/whiteboard/*`, `core/models.py` (BoardElement/BoardDocument),
`whiteboard-sync/*`, `package.json` (on dokłada zależności).

**Zamrożenie na czas PR-D1 (rename `_new`):** wymaga jednego dnia bez otwartych gałęzi
z kodem frontendu - inaczej każda otwarta gałąź dostaje konflikty w ~350 plikach.

---

## 3. Inwentaryzacja długu strukturalnego

### 3.1 Podwójna struktura `src/app` vs `src/_new`

`src/app` ma być "wyłącznie routingiem" (CLAUDE.md, `frontend-structure.md`), a mieści
~10 100 linii komponentów w 60+ plikach:

| Miejsce                                        | Pliki | Linie  | Charakter |
| ---------------------------------------------- | ----- | ------ | --------- |
| `(public)/sections/` + `product/sections/`     | 21    | ~4 300 | landing page, czysty UI, zero logiki domenowej |
| `(public)/_components/` (Header, Footer, mega-menus) | 9 | ~1 500 | nawigacja marketingowa |
| `(dashboard)/dashboard/Components/` + `Header/` | 14   | ~2 700 | **logika domenowa** (workspace sidebar, boardy, szablony, powiadomienia) - to powinno być feature |
| `(dashboard)/account/components/`              | 13    | ~2 000 | `ProfileSection` prawdziwy; `AddressBook`, `PaymentMethods`, `SecurityCenter/LoginMethods` to **makiety na `mockAddresses`/`mockActiveSessions`, bez żadnego endpointu w backendzie** (~1 700 linii) |
| `context/`                                     | 9     | ~2 400 | `BoardRealtimeContext` (390), `VoiceChatContext` (646) + `voice-chat/` (979) + testy |
| `api/chat/`, `api/contact/`                    | 6     | ~700   | Route Handlers z logiką (rate limit, cache, Gemini) w pliku trasy (`chat/route.ts` = 430 linii) |
| `src/lib/supabase.ts`                          | 1     | 100    | jedyny plik w `src/lib`, 6 importów |

### 3.2 Naruszenia granicy `_new -> app` (logika importuje z routingu)

17 importów, 3 przyczyny:

- `DashboardButton` z `src/app/(dashboard)/dashboard/Components/` importowany przez **9 modali**
  w `features/{board,workspace,notifications}` (obok istnieje `shared/ui/button.tsx` z CVA,
  157 linii - dwa systemy przycisków).
- `BoardRealtimeContext` importowany przez 5 plików `features/whiteboard`.
- `VoiceChatContext` importowany przez 3 pliki `features/whiteboard/components/canvas`.

Nic tego dziś nie pilnuje: `.dependency-cruiser.cjs` istnieje (17.3.9 w devDependencies),
ale nie ma reguły na granicę i nie jest odpalany w CI.

### 3.3 Pliki > 400 linii (bez testów, stan `437999c`)

| Linie | Plik | Uwaga |
| ----- | ---- | ----- |
| 2712 | `whiteboard/components/canvas/whiteboard-canvas.tsx` | 15 `useState`, 29 `useEffect`, 47 `useCallback`, 10 `useRef`; spina 6 hooków legacy + 2 Yjs + adaptery między nimi |
| 1906 | `whiteboard/components/toolbar/select-tool.tsx` | jeden komponent, hit-testing + uchwyty + maszyna stanów wskaźnika |
| 848 | `whiteboard/components/smartsearch/smart-search-bar.tsx` | |
| 762 | `whiteboard/components/canvas/voice-chat.tsx` | UI voice chatu w folderze canvas (PR #39 go zmienia) |
| 741 | `whiteboard/components/toolbar/function-tool.tsx` | |
| 735 | `whiteboard/components/toolbar/math-chatbot.tsx` | |
| 646 | `src/app/context/VoiceChatContext.tsx` | PR #39 go zmienia |
| 629 | `whiteboard/components/toolbar/text-tool.tsx` | |
| 612 | `whiteboard/components/toolbar/properties-panel.tsx` | |
| 576 | `whiteboard/components/layout/board-header.tsx` | |
| 571 | `whiteboard/components/panels/board-settings-panel.tsx` | |
| 543 | `whiteboard/components/toolbar/calculator-tool.tsx` | |
| 528 | `whiteboard/components/smartsearch/card-viewer.tsx` | |
| 509 | `whiteboard/hooks/use-elements.ts` | **legacy, znika po Yjs** |
| 495 | `whiteboard/components/toolbar/activity-history.tsx` | |
| 492 | `whiteboard/realtime/useElementSync.ts` | **legacy, znika po Yjs** |
| 430 | `src/app/api/chat/route.ts` | logika w pliku trasy |
| 430 | `backend/api/v1/auth/service.py` | jedyny backendowy; akceptowalny |
| 426 | `src/app/(public)/sections/PricingSection.tsx` | statyczny UI |
| 426 | `src/app/(dashboard)/dashboard/Components/workspace-sidebar.tsx` | |
| 416 | `src/app/(public)/sections/ProblemsSection.tsx` | statyczny UI |

### 3.4 Dwie równoległe ścieżki persystencji tablicy (największy dług, ale nie nasz do ruszania teraz)

| Warstwa       | Legacy (Supabase Broadcast + REST)                          | Yjs (za flagą)                                  |
| ------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| stan          | `hooks/use-elements.ts` (509)                               | `hooks/use-yjs-board.ts` (191)                  |
| historia      | `hooks/use-history.ts` + `commands/*`                       | `Y.UndoManager` w `use-yjs-board`               |
| transport     | `realtime/useElementSync.ts` (492) + `useSafeBroadcast.ts`  | `yjs/use-yjs-sync.ts` (51) + `whiteboard-sync/` |
| API           | `api/elements-api.ts` (109) **+ te same 3 funkcje zdublowane w `api/whiteboardApi.ts`** | `/doc`, `/access`                |
| backend       | `POST/GET /elements`, `DELETE /elements/{id}`, tabela `board_elements` | tabela `board_documents`             |
| spięcie       | `whiteboard-canvas.tsx` linie ~147-230 (`adaptYjsElements`, `adaptYjsHistory`) + `WHITEBOARD_YJS_ENABLED ? : ` | |

Po decyzji "Yjs na stałe" do skasowania jest ok. **1 500 linii frontendu i ~250 backendu**
oraz znane problemy #1-#3 z `known-issues.md`. To jest praca Bartka (Faza C0) - plan
tylko wskazuje zależność i to, co po niej wykonać.

### 3.5 Martwy kod i duplikaty (potwierdzone grepem)

| Co | Dowód | Linie |
| -- | ----- | ----- |
| `whiteboard/api/realtime-api.ts` | 0 importów w `src/` (`createBoardChannel`, `broadcastEvent` nieużywane) | 70 |
| `(public)/sections/AnimationShow.tsx` | **pusty plik (0 linii)**, sierota wg depcruise | 0 |
| `whiteboard/components/toolbar/tool-button.tsx` | **1 linia**, sierota wg depcruise | 1 |
| `shared/ui/user-avatar.tsx` | **pusty plik (0 linii)**; żywy jest `shared/hooks/use-user-avatar.ts` (3 importy) | 0 |
| `elements-api.ts` vs `whiteboardApi.ts` | `saveBoardElementsBatch`, `loadBoardElements`, `deleteBoardElement` zdefiniowane w obu | ~40 |
| `interface User` x2 | `shared/types/user.ts` (prawdziwy) vs `(dashboard)/account/types.ts` (szablon "ClientPanel": `firstName`, `currency`, `timezone`) | - |
| `DashboardButton` vs `shared/ui/button.tsx` | dwa systemy przycisków | 37 + 157 |
| `components/toolbar/*-tool.tsx` vs `tools/*.tool.tsx` | 11 narzędzi ma implementację w `toolbar/` i adapter w `tools/` - dwie warstwy o mylących nazwach (`toolbar/` nie zawiera paska narzędzi tylko narzędzia; pasek to `toolbar.tsx`/`toolbar-ui.tsx`) | - |
| 3 nieużywane `eslint-disable` | eslint: "Unused eslint-disable directive" | 3 |
| `NaukaNextjs/hooks-i-koncepty.md` | notatki z nauki w rootcie repo produktu | - |
| `komendy.txt` (134 linie) vs `README.md` "Manual setup" | duplikat wskazany już w audycie z lipca | - |

### 3.6 Brak testów (frontend)

Katalogi `_new` z kodem i zerem testów: `whiteboard/realtime/` (10 plików, ~1 900 linii,
w tym cała sygnalizacja presence/kursorów), `whiteboard/tools/` (18), `whiteboard/engine/`,
`whiteboard/stores/`, `whiteboard/api/`, wszystkie `*/components/` (auth 7, board 7,
workspace 10, notifications 2), `notifications/hooks/`, `shared/ui/`, `shared/hooks/`,
`lib/api/` (klient axios z interceptorami 401 -> refresh - **krytyczna ścieżka bez testu**).
`BoardRealtimeContext.tsx` - zero testów. `whiteboard-sync/` - zero testów, zero CI.

Backend: bez testów są `assets/`, `onboarding/`, `whiteboard/router.py` (tylko service),
`whiteboard/storage.py`, `share_links/router.py`.

Vitest `coverage.include` obejmuje tylko `auth`, `lib/auth`, `lib/errors` - raport pokrycia
nie mówi nic o tablicy.

### 3.7 Granica frontend <-> backend i typy wspólne

- Kontrakt = ręcznie pisane `types.ts` per feature, odwzorowujące Pydantic `schemas.py`.
  `lib/api/types.ts` ręcznie kopiuje `core/responses.py`. Nic nie wykrywa rozjazdu poza
  runtime'em. FastAPI wystawia OpenAPI za darmo; frontend go nie konsumuje.
- Backend ma 4 "warstwy wejścia": FastAPI (`/api/v1`), Next Route Handlers (`/api/chat`,
  `/api/contact`), `whiteboard-sync` (WS, deleguje auth do FastAPI przez `/access`),
  Supabase (Broadcast/Presence/Storage). Tylko pierwsza jest opisana w `backend-structure.md`.
- Backend: `datetime.utcnow` w 10 plikach (deprecacja Py3.12, 1811 warningów w pytest),
  `@app.on_event` (deprecacja FastAPI, 2 użycia), `class Config` zamiast `model_config`
  (12), FastAPI 0.104 / Starlette 0.27 / Pydantic 2.10 (stare, ale spójne).
- Alias importów: 3 style (patrz §1 poz. 3). Konwencja nazw plików w `_new`: kebab-case 92,
  camelCase 58, PascalCase 2; w `src/app` dominuje PascalCase.
- Brak barreli `index.ts` w `features/*` - każdy import sięga po ścieżkę wewnętrzną
  innego feature'a (np. `whiteboard/page.tsx` importuje 7 wewnętrznych plików z 3 feature'ów).

---

## 4. Docelowa struktura katalogów

```
src/
├── app/                         # WYŁĄCZNIE routing: page.tsx, layout.tsx, route.ts, loading/error.
│   │                            # Zero komponentów, zero hooków, zero kontekstów. Strona = import z features + JSX.
│   ├── (public)/  (auth)/  (dashboard)/  (whiteboard)/  (info)/
│   └── api/chat/route.ts        # 10-20 linii: parsuje request, woła src/server/chat
│
├── features/                    # (dziś src/_new/features) jeden folder = jedna domena
│   ├── auth/  board/  workspace/  notifications/  demo/        # bez zmian w środku
│   ├── dashboard/               # NOWY: z src/app/(dashboard)/dashboard/{Components,Header}
│   ├── account/                 # NOWY: z src/app/(dashboard)/account/components
│   ├── landing/                 # NOWY: z src/app/(public)/{sections,_components,product/sections}
│   ├── voice-chat/              # NOWY: z src/app/context/VoiceChatContext + voice-chat/* + canvas/voice-chat*.tsx
│   └── whiteboard/
│       ├── api/                 # whiteboardApi.ts, assets-api.ts (elements-api.ts znika po Yjs)
│       ├── engine/  commands/  handlers/  navigation/  selection/  elements/  stores/  types/
│       ├── tools/<name>/        # docelowo: adapter (*.tool.tsx) + komponent + properties w jednym folderze (P9)
│       ├── yjs/                 # board-doc.ts, use-yjs-sync.ts (+ use-yjs-board.ts z hooks/)
│       ├── realtime/            # BoardRealtimeProvider.tsx (z src/app/context) + presence/cursors/typing/viewport
│       ├── components/{canvas,layout,panels,smartsearch,toolbar}/
│       └── hooks/               # tylko hooki spinające komponenty; hooki wydzielone z whiteboard-canvas
│
├── lib/                         # (dziś src/_new/lib) infrastruktura bez domeny
│   ├── api/  auth/  errors/  query-provider.tsx  utils.ts
│   └── supabase/client.ts       # z src/lib/supabase.ts
│
├── shared/                      # (dziś src/_new/shared) ui/, hooks/, types/ - reużywalne między features
│
├── server/                      # NOWY: logika Route Handlerów Next (server-only)
│   ├── chat/    (rate-limit.ts, cache.ts, gemini.ts, auth.ts)
│   └── contact/
│
└── test/                        # setup, mocks (bez zmian)

backend/                         # bez zmian strukturalnych (patrz §7)
whiteboard-sync/                 # bez zmian; dostaje krok w CI
```

### Zasady (do wpisania w `frontend-structure.md` po wdrożeniu)

1. **Kierunek importów:** `app -> features -> {shared, lib}`; `features -> features` tylko
   przez `index.ts` drugiego feature'a; `features`, `shared`, `lib` **nigdy** nie importują
   z `app`. `server` importuje tylko `lib`. Pilnuje `dependency-cruiser` w CI (PR-A2).
2. **Kształt feature'a:** `api/` (funkcje wołające `apiClient`, jedna na endpoint, `*.test.ts`
   obok), `hooks/` (React Query + logika), `components/`, `types.ts` (typy domeny =
   odzwierciedlenie `schemas.py`), `index.ts` (publiczne API feature'a - tylko to, czego
   używają inne feature'y i `app`). Duże feature'y (whiteboard) mogą mieć podfoldery.
3. **Konteksty/Providery żyją w feature'ach**, nie w `app/context`. `app/layout.tsx`
   składa providery importowane z `features`/`lib`.
4. **Jeden alias:** `@/features/*`, `@/lib/*`, `@/shared/*`, `@/server/*`, `@/app/*`.
   Wewnątrz jednego feature'a dopuszczalne ścieżki relatywne w obrębie folderu.
5. **Limit pliku:** 400 linii jako próg alarmu w review (nie twardy błąd) - wyjątki
   wpisane jawnie w `known-issues.md` z uzasadnieniem.
6. **Testy obok kodu** (`*.test.ts[x]` albo `_tests/`), a `coverage.include` obejmuje
   całe `src/features` i `src/lib`.
7. **Nazwy plików:** kebab-case (decyzja P10; jeśli tak - egzekwowane tylko przy
   przenosinach, bez osobnego PR-a "rename wszystkiego").

---

## 5. Etapy - małe PR-y

Konwencja: każdy PR na osobnej gałęzi z `origin/main`, tylko `git mv` + minimalne zmiany
importów w PR-ach "przenosinowych", zero zmian zachowania w tym samym PR co przenosiny.
Weryfikacja bazowa dla **każdego** PR-a: `npm run typecheck && npm run lint && npm run test`
(+ `npm run build`, gdy ruszane są strony) i `npx depcruise src --config .dependency-cruiser.cjs`
od PR-A2. Backendowe PR-y: `ruff check . && pytest tests/ -q`.

### Faza A - można zacząć od razu (nie koliduje z #39 ani z Bartkiem)

| PR | Zakres | Pliki | Ryzyko | Jak sprawdzić, że nic nie pękło | Czas |
| -- | ------ | ----- | ------ | -------------------------------- | ---- |
| **A0** `docs/refaktor-plan` | ten plan | `docs/architecture/REFAKTOR-PLAN.md` | zero | - | zrobione |
| **A1** `docs/sync-2026-09` | poprawki wszystkich 16 rozbieżności z §1; wpis o Yjs w `stack.md`, `pipelines.md` §2, `migration-status.md`; nowa sekcja "whiteboard-sync" w `backend-structure.md`; odhaczenie VoiceChat; przeliczenie `testing.md` | `docs/**` | zero | brak (docs) | 2 h |
| **A2** `chore/arch-guard` | reguły w `.dependency-cruiser.cjs`: `no-features-to-app` (z `src/_new` do `src/app` - **error**), `no-app-cross-imports` (z `src/app/X` do `src/app/Y/Components`), wyjątki `no-orphans` dla `page/layout/route/mdx-components`; skrypt `npm run depcruise`; job `frontend-arch` w `ci.yml`. Istniejące 17 naruszeń tymczasowo w `allowed` (z komentarzem "usuwane w A3/B1/C1") | `.dependency-cruiser.cjs`, `package.json`, `.github/workflows/ci.yml` | niskie | `npm run depcruise` = 0 błędów; CI zielone | 2 h |
| **A3** `refactor/dashboard-button` | `DashboardButton` -> `shared/ui/dashboard-button.tsx` (albo warianty `dashboard-primary/secondary` w `shared/ui/button.tsx` - decyzja w review); przepięcie 11 importów; usunięcie 9 wyjątków z A2 | 12 plików | niskie | typecheck, vitest (modale mają testy hooków), wizualnie /dashboard; `depcruise` bez wyjątków DashboardButton | 1 h |
| **A4** `chore/dead-code` | usunięcie `realtime-api.ts` (70 linii, 0 importów) oraz trzech pustych stubów: `AnimationShow.tsx`, `tool-button.tsx`, `shared/ui/user-avatar.tsx`; 3 nieużywane `eslint-disable` (`select-tool.tsx`, `text-tool.tsx`, `engine/use-whiteboard-engine.ts` - po jednej linii, poza listą plików Bartka) | 7 plików | niskie | typecheck, build, `npm run lint` bez "Unused eslint-disable", `depcruise` bez sierot | 1 h |
| **A5** `refactor/feature-dashboard` | `src/app/(dashboard)/dashboard/{Components,Header}` -> `features/dashboard/components/` (`git mv`), `page.tsx` i `layout.tsx` zostają cienkie; test `workspace-sidebar-mobile.test.tsx` jedzie razem; `features/dashboard/index.ts` | 15 plików, ~2 700 linii | średnie | typecheck, vitest (test mobile sidebar), `npm run build`, ręcznie: /dashboard na desktop i 390 px (PR #41 właśnie to ruszał) | 3 h |
| **A6** `refactor/feature-account` | `account/components/{ProfileSection,Sidebar}` -> `features/account/components/`; `account/types.ts` -> `features/account/types.ts` **bez** `interface User` (użyć `shared/types/user.ts`); `AddressBook`, `PaymentMethods`, `SecurityCenter` - wg decyzji **P2** (domyślnie: przenieść do `features/account/components/_mock/` i oznaczyć w `known-issues.md` jako makiety) | 14 plików | niskie | typecheck, build, ręcznie /account (BasicInfo woła API) | 2 h |
| **A7** `refactor/feature-landing` | `(public)/sections`, `(public)/_components`, `product/sections` -> `features/landing/{sections,navigation,mega-menus}/`; `Header.tsx` używa `useAuth` - zostaje tak | 30 plików, ~5 800 linii | niskie (czysty UI) | build, ręcznie `/`, `/product`, `/news`, `/contact`, mega-menu; `npm run lint` | 2 h |
| **A8** `refactor/lib-supabase` | `src/lib/supabase.ts` -> `src/_new/lib/supabase/client.ts`; 6 importów (+2 testy); usunięcie pustego `src/lib` | 9 plików | niskie | typecheck, vitest (`VoiceChatContext.*.test` mockują ten moduł - poprawić ścieżkę w `vi.mock`) | 0,5 h |
| **A9** `refactor/server-chat` | z `src/app/api/chat/route.ts` (430) wydzielić do `src/_new/server/chat/`: `rate-limit.ts` (Map + okno), `response-cache.ts`, `gemini-client.ts` (model + fallback), istniejący `auth.ts`; `route.ts` = walidacja + orkiestracja; testy `route.test.ts`/`auth.test.ts` jadą i dostają testy jednostkowe dla rate-limitu i cache | 8 plików | średnie (testy mockują `@google/generative-ai` po ścieżce) | `npx vitest run src/app/api src/_new/server`; ręcznie Tutor AI na tablicy | 2 h |
| **A10** `refactor/backend-hygiene` | `core/time.py` z `utcnow()` (naive UTC, żeby nie zmieniać semantyki kolumn `DateTime` bez tz) i podmiana 10 plików; `lifespan` zamiast `@app.on_event`; `model_config = ConfigDict(from_attributes=True)` zamiast `class Config` (12); nowy job CI `sync-typecheck` (`npm ci && npx tsc --noEmit` w `whiteboard-sync/`) | ~25 plików backend, `ci.yml` | średnie (czas w tokenach JWT i refresh - testy `test_refresh`, `test_rate_limit` to łapią) | `pytest -q` = 334 passed, liczba warningów spada z 1811 do ~0; `ruff`; CI | 3 h |

Suma Fazy A: **~18-19 h**, 10 PR-ów. A2-A4 można zrobić jednego wieczoru; A5-A7 po jednym
na wieczór; A9-A10 niezależnie od frontendu.

### Faza B - po merge PR #39

| PR | Zakres | Pliki | Ryzyko | Jak sprawdzić | Czas |
| -- | ------ | ----- | ------ | ------------- | ---- |
| **B1** `refactor/feature-voice-chat` | `src/app/context/VoiceChatContext.tsx` -> `features/voice-chat/VoiceChatProvider.tsx`; `context/voice-chat/*` -> `features/voice-chat/{hooks,constants.ts,types.ts,media-support.ts}`; 3 testy `VoiceChatContext.*.test.tsx` jadą; `whiteboard/components/canvas/voice-chat{,-settings,-notice}.tsx` -> `features/voice-chat/components/`; `online-users.tsx` importuje z `@/features/voice-chat`; `index.ts` eksportuje `VoiceChatProvider`, `useVoiceChat`, `VoiceSettings`; usunięcie 3 wyjątków z A2 | ~15 plików, ~2 400 linii | średnie (ścieżki w `vi.mock`, PR #39 dokłada `mediaSupport.ts` i test mobile) | vitest (4 pliki testów voice), typecheck, ręcznie: dwie karty, dołączenie do voice, mute, wyjście | 3 h |

### Faza C - po migracji Bartka (Yjs domyślnie, legacy usunięte)

**C0 (Bartek, `feature/whiteboard-yjs`) - zależność, nie nasz PR.** Plan zakłada, że po C0
nie istnieją: `use-elements.ts`, `elements-api.ts`, `useElementSync.ts`, `useSafeBroadcast.ts`
(jeśli używany tylko przez sync), legacy `use-history.ts` (o ile `Y.UndoManager` pokrywa
całość - `commands/*` mogą zostać jako warstwa intencji silnika), adaptery w
`whiteboard-canvas.tsx`, flaga `WHITEBOARD_YJS_ENABLED`, 3 funkcje elementów w
`whiteboardApi.ts`, endpointy `/elements*` i (po karencji - **P4**) tabela `board_elements`.
Do uzgodnienia z Bartkiem: czy legacy kasuje on w ramach swojej gałęzi, czy ja osobnym PR-em
tuż po jego merge'u (wolę drugie - mniejszy PR u niego, a kasowanie jest mechaniczne).

| PR | Zakres | Pliki | Ryzyko | Jak sprawdzić | Czas |
| -- | ------ | ----- | ------ | ------------- | ---- |
| **C1** `refactor/board-realtime-provider` | `src/app/context/BoardRealtimeContext.tsx` -> `features/whiteboard/realtime/BoardRealtimeProvider.tsx` (krok 6 z `migration-status.md`); po C0 provider obsługuje tylko presence/kursory/typing/viewport; 5 importów + `whiteboard/page.tsx` + `demo/[sessionId]/page.tsx`; usunięcie `src/app/context` w całości; ostatnie wyjątki z A2 -> reguła na **error** | ~9 plików | średnie | typecheck, vitest, `depcruise` 0 wyjątków, ręcznie: kursory i "kto pisze" w 2 kartach, follow mode | 2 h |
| **C2** `refactor/canvas-renderer` | z `whiteboard-canvas.tsx` wydzielić `hooks/use-canvas-renderer.ts` (pętla RAF, `redrawCanvas`, `renderStateRef`, `eslint-disable` z §8 canvas-architecture jedzie razem) i `hooks/use-overlay-visibility.ts` (ukrywanie/przywracanie overlayów podczas pana, debounce) | 3 pliki, ~400 linii przeniesione | wysokie (hot-path renderu) | typecheck; test jednostkowy `use-overlay-visibility`; ręcznie: pan/zoom 60 fps, tekst/markdown overlay nie "pływa" | 3 h |
| **C3** `refactor/canvas-pan-follow` | `hooks/use-pointer-pan.ts` (MMB/PPM pan, blokada contextmenu) + `hooks/use-follow-mode.ts` | 3 pliki, ~300 linii | średnie | typecheck; ręcznie: pan PPM/MMB, follow drugiego usera | 2 h |
| **C4** `refactor/canvas-mutations` | `hooks/use-element-mutations.ts`: `handleElementUpdate`, live batch, commit po mouseup, delete zaznaczonych, "dodaj element + history" - jedno wejście dla wszystkich narzędzi | 3 pliki, ~350 linii | wysokie (każde narzędzie) | typecheck; testy z fake engine (create/update/delete wołają odpowiednie komendy); ręcznie: każde z 11 narzędzi + undo/redo | 3 h |
| **C5** `refactor/canvas-editors` | `hooks/use-table-editing.ts`, `hooks/use-text-editing.ts`, `hooks/use-asset-templates.ts` (zapis szablonów), wrappery ImageTool | 4 pliki, ~400 linii | średnie | typecheck; ręcznie: edycja komórki (Tab/Enter/Esc), edycja tekstu, zapis/wstawienie szablonu, wklejenie obrazka | 3 h |
| **C6** `refactor/select-tool-split` | z `select-tool.tsx` (1906) wydzielić czyste funkcje: `selection/hit-testing.ts`, `selection/handles.ts` (geometria uchwytów resize/rotate), `selection/transform-math.ts`; komponent zostaje maszyną stanów wskaźnika + renderem overlay (cel ≤ 700 linii); **najpierw testy** na czystych funkcjach, potem wycinanie | 5 plików | wysokie | vitest (nowe testy geometrii), ręcznie: zaznaczanie ramką, multi-select, resize z każdego uchwytu, obrót, snap | 4 h |
| **C7** `refactor/tools-colocation` (opcjonalny, **P9**) | `components/toolbar/<x>-tool.tsx` + `tools/<x>.tool.tsx` + `tools/<x>.properties.tsx` -> `tools/<x>/{component,adapter,properties}.tsx`; `toolbar.tsx`/`toolbar-ui.tsx`/`zoom-controls.tsx`/`tool-button` zostają jako pasek w `components/toolbar/` | ~35 plików (`git mv`) | średnie (dużo importów, `how-to-add-tool.md` do aktualizacji) | typecheck, vitest (`math-chatbot-demo`, `mobile-layout`), build | 3 h |

Po C2-C5 `whiteboard-canvas.tsx` ma zejść z 2712 do ok. 600-800 linii (kompozycja hooków +
JSX). Każdy z C2-C5 to osobny PR - jeśli któryś wprowadzi regresję, revert jest punktowy.

### Faza D - finał (jeden "cichy dzień" bez otwartych gałęzi frontendowych)

| PR | Zakres | Pliki | Ryzyko | Jak sprawdzić | Czas |
| -- | ------ | ----- | ------ | ------------- | ---- |
| **D1** `refactor/rename-new` | `git mv src/_new/features src/features`, `src/_new/lib -> src/lib`, `src/_new/shared -> src/shared`, `src/_new/server -> src/server`; `tsconfig.json` + `vitest.config.ts`: aliasy `@/features/*` itd., usunięcie `@new/*`; codemod (sed) `@/_new/` i `@new/` -> nowe aliasy, relatywne `../../` między feature'ami -> alias; `.dependency-cruiser.cjs`, `CLAUDE.md`, docs. **Jeden commit z przenosinami, drugi z codemodem** - review widzi rename osobno | ~350 plików | niskie technicznie, **wysokie organizacyjnie** (konflikty z każdą otwartą gałęzią) | typecheck, vitest 450, build, `depcruise`, `grep -r "_new" src` = 0; koordynacja: Bartek merguje wszystko przed, nic nie otwiera w trakcie | 2 h + ustalenie dnia |
| **D2** `docs/post-refactor` | `frontend-structure.md` = §4 tego planu, `migration-status.md` zamknięty (albo skasowany - "opisujemy stan, nie historię"), `known-issues.md` bez #1-#3, ten plan -> skrót "co zrobiono" albo usunięcie | docs | zero | - | 1 h |

### Faza E - opcjonalne, po decyzjach Patryka

| PR | Zakres | Warunek | Czas |
| -- | ------ | ------- | ---- |
| **E1** `feat/openapi-types` | `openapi-typescript` (devDependency) generuje `src/lib/api/schema.d.ts` z `backend` OpenAPI (`python -c "import json,main; print(json.dumps(main.app.openapi()))"`); `features/*/types.ts` stopniowo re-eksportują z `components['schemas']`; krok CI porównujący wygenerowany plik z zacommitowanym (rozjazd FE/BE = czerwone CI) | **P5** (nowa zależność) | 3 h |
| **E2** `refactor/presence-awareness` | presence/kursory/typing/viewport przez Hocuspocus **awareness** (wbudowane w `@hocuspocus/provider`, zero nowych zależności) zamiast Supabase Presence/Broadcast; usuwa `realtime/` (10 plików, ~1 900 linii) i zależność tablicy od Supabase (Supabase zostaje dla powiadomień i voice) | **P8**; po C1 | 6 h |
| **E3** `chore/file-naming` | kebab-case w `features/{board,workspace,auth}` (58 plików camelCase) | **P10**; najlepiej wykonać wewnątrz D1, nie osobno | 1 h |

---

## 6. Kolejność względem otwartych PR-ów i pracy Bartka

```
teraz ──► A0 (plan) ──► A1 docs ──► A2 guard ──► A3 button ──► A4 dead ──► A5 dashboard ──► A6 account ──► A7 landing ──► A8 supabase
                                          └──► A9 server/chat, A10 backend (równolegle, inne pliki)

PR #39 merge ──────────────────────────────────────────────────────────────► B1 voice-chat

Bartek: migracja danych ──► flaga ON ──► C0 usunięcie legacy ──► C1 realtime provider ──► C2..C5 canvas ──► C6 select ──► (C7)

wszystko zmergowane, dzień bez gałęzi ─────────────────────────────────────► D1 rename ──► D2 docs
```

Reguły kolizji:

- **Faza A nie dotyka** żadnego pliku z listy Bartka (§2) ani plików z PR #39. Jedyny wspólny
  punkt to `package.json` w A2 (nowy skrypt `depcruise`) - konflikt trywialny.
- **A2 wprowadza reguły jako `error` z listą wyjątków**, nie jako `warn` - inaczej nikt ich
  nie czyta. Lista wyjątków kurczy się w A3, B1, C1 i w C1 znika.
- **B1 czeka na #39**, bo #39 zmienia 7 z 15 plików, które B1 przenosi. Przenosiny przed
  merge'em #39 = konflikt "rename vs modify" po stronie Bartka lub Patryka.
- **C1-C6 czekają na C0**, bo nie ma sensu wydzielać hooków z `whiteboard-canvas.tsx`, kiedy
  ~200 jego linii (adaptery legacy/Yjs, `useElements`, `useHistory`, `useRealtime` dla
  elementów) ma zniknąć. Wydzielanie przed C0 = podwójna praca i konflikt z Bartkiem.
- **D1 jest ostatnie**, bo przemianowanie `_new` dotyka każdego pliku; robimy je raz, gdy
  wszystkie przenosiny (A5-A7, B1, C1) są już w `main`, żeby codemod objął finalny układ.
- Jeżeli Bartek zacznie C0 zanim skończy się Faza A - Faza A i tak nie koliduje; po prostu
  C1+ ruszają później. Jeżeli C0 się opóźni o tygodnie - A i B dają samodzielną wartość
  (granice, feature'y dashboard/account/landing/voice-chat), a whiteboard zostaje jak jest.

---

## 7. Co ZOSTAWIAMY świadomie (i dlaczego)

- **Backend `api/v1/<moduł>/{router,schemas,service}.py`** - spójny, testowany (334 testy),
  jedyny plik >400 linii to `auth/service.py` (430). Nie ruszamy struktury; A10 to tylko higiena.
- **`core/models.py` jako jeden plik** (243 linie, 12 modeli) - podział per plik dałby
  cykliczne importy relacji SQLAlchemy bez zysku.
- **Nazwy migracji Alembic bez prefiksu hash** (2 pliki) - kosmetyka, ryzyko przy zmianie
  nazwy pliku migracji (revision id jest w środku, nie w nazwie) nie warte zysku.
- **Architektura silnika tablicy** (Command + `WhiteboardEngine` + rejestr narzędzi +
  `ToolHostContext`) - to działa i jest udokumentowane; refaktor jej nie zmienia, tylko
  wydziela kod z god-komponentu wokół niej.
- **`eslint-disable` w `redrawCanvas`** (canvas-architecture §8) - świadomy, jedzie do
  `use-canvas-renderer.ts` w C2 bez zmian.
- **Route Groups i Next Route Handlers dla czatu/kontaktu** - proxy do Gemini z sekretem
  po stronie Next jest właściwym miejscem; przenosimy tylko logikę (A9), nie mechanizm.
- **Rate limit i cache czatu w `Map` w pamięci** - znane ograniczenie z `pipelines.md`;
  zmiana na Redis to decyzja hostingowa, nie strukturalna.
- **`eslint-config-next` wyłączony, brak mypy** - jak w `ci-cd.md`: włączenie zalałoby CI;
  osobna decyzja po refaktorze.
- **Duże, statyczne sekcje landing page (426/416 linii)** - to JSX z treścią marketingową;
  dzielenie ich na mniejsze pliki nie poprawia niczego poza statystyką.
- **`math-chatbot.tsx`, `smart-search-bar.tsx`, `function-tool.tsx`, `calculator-tool.tsx`,
  `properties-panel.tsx`, `board-header.tsx`, `board-settings-panel.tsx`** (500-850 linii)
  - kandydaci na później; nie mają wielu konsumentów i nie blokują niczego. Dzielić dopiero,
  gdy ktoś realnie w nich pracuje (zasada "refaktor przy okazji zmiany, nie dla statystyki").
- **Supabase dla powiadomień i sygnalizacji voice** - zostaje niezależnie od P8.
- **MDX w `(info)`** i `src/mdx-components.tsx` - działa, nie ma długu.

---

## 8. Kandydaci do zastąpienia gotowcem (zasada 7 i 8 z CLAUDE.md)

Nie przerabiamy przy okazji - do decyzji jako osobne pozycje:

| Własny kod | Gotowiec | Zysk / ryzyko |
| ---------- | -------- | ------------- |
| `whiteboard/realtime/{usePresence,useCursors,useTypingIndicator,useViewportTracking,useRealtimeChannel}` (~1 900 linii, 0 testów) | Hocuspocus/Yjs **awareness** (już w zależnościach) | -1 900 linii, jeden transport dla tablicy; ryzyko średnie (E2) |
| ręczne `types.ts` per feature + `lib/api/types.ts` | `openapi-typescript` z OpenAPI FastAPI | wykrywanie rozjazdu FE/BE w CI; +1 devDependency (E1) |
| `DashboardButton` + `shared/ui/button.tsx` (dwa systemy) | jeden `Button` na CVA (już jest) | -37 linii, spójność (A3) |
| `src/app/api/chat/route.ts`: własny rate limit i cache w `Map` | `@upstash/ratelimit` lub Vercel KV / Redis (już w compose) | tylko przy zmianie hostingu; dziś zostaje |
| `core/rate_limit.py` (45 linii) | `slowapi` | mały zysk, zostaje |
| `commands/*` + `use-history.ts` (własne undo/redo) | `Y.UndoManager` (już używany w `use-yjs-board`) | po C0 legacy history znika; `commands` zostają jako intencje silnika - do oceny z Bartkiem |

---

## 9. Pytania do Patryka (nie rozstrzygam sam)

- **P1. Nazwy docelowe.** `src/features` + `src/lib` + `src/shared` + `src/server` z aliasami
  `@/features/*` itd. (propozycja w §4) - czy tak? Alternatywa: `src/modules`. Czy `@new/*`
  ma zniknąć całkiem (tak proponuję)?
- **P2. Makiety w `/account`** (`AddressBook`, `PaymentMethods`, `SecurityCenter/LoginMethods`,
  ~1 700 linii na `mockAddresses`, bez backendu): usunąć z repo (historia gita je zachowa),
  zostawić jako `_mock/` w `features/account`, czy to zalążek roadmapy "subskrybent"?
  Domyślnie w A6: przenieść do `_mock/` i opisać.
- **P3. Landing page** (30 plików, ~5 800 linii): przenieść do `features/landing` (A7) czy
  jawnie zostawić w `app/(public)` jako wyjątek "prezentacyjne, bez logiki"? Proponuję
  przenieść - reguła "app = routing" bez wyjątków jest prostsza do pilnowania.
- **P4. Yjs na stałe:** kto usuwa legacy (Bartek w swojej gałęzi czy ja tuż po jego merge'u)?
  Jak długo `board_elements` i endpointy `/elements*` zostają jako kopia bezpieczeństwa po
  migracji (proponuję 2 tygodnie, potem osobny PR z migracją Alembic `drop table`)?
- **P5. `openapi-typescript`** jako nowa devDependency (E1) - zgoda? Bez tego typy FE/BE
  nadal ręczne.
- **P6. Dzień na D1 (rename `_new`).** Wymaga, żeby Bartek zmergował lub odłożył wszystko,
  co ma otwarte. Kto to ustala i kiedy?
- **P7. `NaukaNextjs/hooks-i-koncepty.md` i `komendy.txt`** w rootcie repo - przenieść poza
  repo (np. do `Studia`/notatek) i scalić `komendy.txt` z README? Proponuję tak, w A1.
- **P8. Presence/kursory przez Hocuspocus awareness** (E2) - czy w ogóle chcesz w tę stronę,
  czy Supabase Realtime ma zostać na tablicy na stałe? To decyduje, czy `realtime/` dostaje
  testy (jeśli zostaje) czy znika.
- **P9. Kolokacja narzędzi** (C7: `tools/<name>/{adapter,component,properties}`) - warte
  3 h i aktualizacji `how-to-add-tool.md`, czy zostawić dwie warstwy jak są?
- **P10. Konwencja nazw plików:** kebab-case wszędzie (jak whiteboard), czy zostawić mieszankę?
  Jeśli kebab - robię to w D1 jednym codemodem.
- **P11. Stare PR-y #1 (vercel bump) i #2 (copilot DB startup)** - zamknąć? Nie dotykam ich,
  ale wiszą jako "otwarte" i mylą przy `gh pr list`.
- **P12. Próg 400 linii** jako reguła review (miękka) - wpisać do CLAUDE.md?

---

## 10. Podsumowanie liczbowe

| Faza | PR-y | Czas (h) | Warunek startu |
| ---- | ---- | -------- | -------------- |
| A    | A1-A10 (10) | ~18-19 | teraz |
| B    | B1 (1)      | 3      | merge #39 |
| C    | C1-C6 (+C7) | 17 (+3) | C0 Bartka |
| D    | D1-D2 (2)   | 3 + ustalenie dnia | wszystko zmergowane |
| E    | E1-E3 (3, opcjonalne) | 10 | decyzje P5/P8/P10 |
| **Razem** | **19 obowiązkowych + 4 opcjonalne** | **~41 h + ~13 h opcjonalnie** | |

Efekt końcowy (bez fazy E): `src/app` ≈ 1 500 linii czystego routingu (z 15 300),
zero importów `features -> app` pilnowane przez CI, `whiteboard-canvas.tsx` ≈ 700 linii
(z 2 712), `select-tool.tsx` ≈ 700 (z 1 906), brak `src/_new`, brak `src/app/context`,
brak `src/lib`, ~1 500 linii legacy tablicy mniej (C0), 1 811 warningów backendu mniej,
dokumentacja zgodna z kodem.

---

## 11. Decyzje Patryka (21.09.2026, po recenzji)

Plan zatwierdzony. Odpowiedzi na pytania z §9:

| Pyt. | Decyzja |
| ---- | ------- |
| P1 | TAK: `src/features` + `src/lib` + `src/shared` + `src/server`, aliasy `@/features/*` itd.; alias `@new/*` znika |
| P2 | Makiety z `/account` -> `features/account/components/_mock/` + wpis w `known-issues.md` |
| P3 | TAK: landing do `features/landing` |
| P4 | NIE RUSZAĆ legacy tablicy - Patryk ustala z Bartkiem osobno |
| P5 | później |
| P6 | później (dzień na D1 do ustalenia) |
| P7 | TAK, w A1: `NaukaNextjs/` poza repo, `komendy.txt` scalone z README |
| P8 | odłożone (E2 nie wchodzi) |
| P9 | odłożone (C7 nie wchodzi) |
| P10 | kebab-case, wykonać w D1 |
| P11 | zamknąć PR #1 i #2 z komentarzem |
| P12 | TAK: próg 400 linii dopisany do `CLAUDE.md` |

PR #39 zmergowany 21.09 - Faza B odblokowana. Każdy etap idzie jako osobny PR z `origin/main`;
merguje wyłącznie Patryk.
