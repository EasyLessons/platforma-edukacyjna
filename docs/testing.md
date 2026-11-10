# Testy w systemie EasyLesson

**Stan:** 10.11.2026 (`release/baseline`)
**Zakres:** backend (Python/pytest) + frontend (TypeScript/Vitest) + `whiteboard-sync` (Vitest) + E2E (Playwright)

---

## Liczby (zmierzone)

| Warstwa         | Narzędzie  | Pliki | Testy | Czas pełnego przebiegu |
| --------------- | ---------- | ----- | ----- | ---------------------- |
| backend         | pytest     | 53    | 1426  | kilka minut (SQLite in-memory + fakeredis) |
| frontend        | vitest     | 96    | 1004  | ~45 s (jsdom)          |
| whiteboard-sync | vitest     | 6     | —     | sekundy (atrapa backendu + prawdziwy Hocuspocus) |
| E2E             | Playwright | 11    | 27    | minuty (pełny stos w Dockerze) |

Aktualizuj tę tabelę w PR, który zmienia liczbę plików testowych — nie "przy okazji".

---

## Struktura testów

Pełna lista to `find src backend/tests whiteboard-sync/test e2e -name '*test*'`; poniżej mapa katalogów (stan 10.11.2026).

```
backend/tests/
  conftest.py                        # wspólne fixtures (db, redis, users, workspaces, boards, invites)
  core/                              # cors, email (+escape), image_sanitizer (+formats), presence,
                                     # redis_degradation (ResilientRedis), request_id, storage (+buckets)
  v1/
    auth/                            # login, register, verify_email, password_reset, refresh,
                                     # logout, me, google_login, oauth_linking, user_identities, resend_code,
                                     # dependencies, rate_limit (+hardening), integration, avatar_upload, avatar_url
    assets/                          # test_assets.py, test_asset_limits.py
    boards/                          # test_boards_router.py, test_boards_service.py
    health/                          # /health (ok/degraded), /health/live
    notifications/                   # notifications_router/service
    onboarding/                      # test_onboarding_service.py
    plans/                           # test_plans_router.py, test_plans_service.py (limity, FOR UPDATE, grandfathering)
    storage_quota/                   # test_storage_quota.py, test_cleanup.py, test_usage.py
    whiteboard/                      # test_whiteboard_service.py (snapshot Yjs), test_whiteboard_doc_router.py
                                     # (/doc, /access, klucz serwisu), test_board_files.py (/files, quota),
                                     # test_whiteboard_call.py, _call_guard.py, _call_redteam.py (Daily; daily_fake.py)
    workspaces/                      # workspaces_router/service, members_service, invites_service,
                                     # share_links_router/service, search_users

src/
  _new/features/
    auth/          api, hooks/_tests, utils
    board/         api, hooks/_tests, utils
    board-engine/  config (engine-flag, default-fill), elements (note, table, pdf), files (board-file-sync,
                   excalidraw-file-sync, shared-files, data-url), math (function-element/plot), panels
                   (board-panels, insert), templates (catalog, insert-sheet), yjs (binding, awareness,
                   use-board-connection, use-element-limit), components (excalidraw-header)
                   -- pliki *.excalidraw.test.tsx renderują prawdziwy Excalidraw w jsdom
    dashboard/     _tests (workspace-sidebar-mobile)
    demo/          _tests/demo-page.test.tsx
    notifications/ api
    plans/         components (plan-usage-badge, upgrade-modal), hooks (use-plan), utils (plan-limit-error)
    voice-call/    daily-call-provider.test.tsx
    voice-chat/    VoiceChatContext.{test,flows.test,mobile.test,ice-restart.test}.tsx, constants.test.ts
    whiteboard/    commands/_tests, elements/math-eval, handlers, navigation, selection, hooks
                   (use-yjs-board, use-whiteboard-ui-metrics), yjs (board-doc, prewarm-sync,
                   use-yjs-local-cache, use-yjs-sync), components/toolbar/_tests
    workspace/     api, hooks/_tests
  _new/lib/
    api/           client.test.ts, client.request-id.test.ts, client.success-false.test.ts, request-id.test.ts
    auth/          tokenService.test.ts
    board-cache/   board-cache.test.ts
    errors/        AppError, errorHandler
  app/api/
    chat/{route,auth}.test.ts        # trasy Next.js (środowisko node)
    contact/route.test.ts

whiteboard-sync/test/
  auth.test.ts, viewer-readonly.test.ts, token-expiry.test.ts, database.test.ts,
  element-limit.test.ts, demo.test.ts                      # backend-mock.ts = atrapa FastAPI

e2e/
  board-engine.spec.ts, board-engine.mobile.spec.ts, board-engine-elements.spec.ts,
  board-engine-images.spec.ts, board-engine-limit.spec.ts, board-engine-panels.spec.ts,
  board-engine-templates.spec.ts, demo.spec.ts, roles.spec.ts, voice-call.spec.ts, voice-call.mobile.spec.ts
```

---

## Poziomy testowania

| Poziom              | Narzędzie                        | Zakres                               |
| ------------------- | -------------------------------- | ------------------------------------ |
| Jednostkowy         | pytest / Vitest                  | serwisy, hooki, narzędzia pomocnicze, model Y.Doc |
| Integracyjny (HTTP) | FastAPI TestClient / Vitest node | routery REST, trasy Next.js API      |
| Komponentowy        | Vitest + Testing Library (jsdom) | voice chat (mocki kanału i RTCPeerConnection), układ mobilny, demo, panele i elementy board-engine na prawdziwym Excalidraw (`*.excalidraw.test.tsx`) |
| E2E                 | Playwright (`e2e/`)              | tablica na Excalidraw za flagą: współpraca dwóch osób, viewer, role, f(x), eksport PNG, dotyk, fonty bez CDN, obrazy w Storage, szablony, limit elementów, demo bez konta, rozmowa Daily bez klucza, nagłówki bezpieczeństwa (CSP bez naruszeń) |

---

## Wzorce

### Backend

Każdy test integracyjny używa bazy SQLite in-memory wstrzykiwanej przez `dependency_overrides[get_db]`. Token JWT tworzony jest bezpośrednio przez `create_access_token` bez przechodzenia przez endpoint `/login`. Redis podmieniony na `fakeredis`.

```python
@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()

def make_auth_headers(user_id: int) -> dict:
    token = create_access_token({"sub": str(user_id)}, settings.secret_key, settings.algorithm)
    return {"Authorization": f"Bearer {token}"}
```

Fixtures współdzielone (`conftest.py`): `db_session`, `test_user`, `test_user2`, `test_user3`, `test_workspace`, `test_workspace2`, `shared_workspace`, `test_board`, `test_invite`, `expired_invite`.

Backend czyta `Settings` z `backend/.env`. Bez tego pliku (np. świeży worktree) pytest pada na starcie — wtedy wyeksportuj te same zaślepki, których używa job `backend-test` w `.github/workflows/ci.yml`.

### Frontend — API routes

Trasy Next.js testowane są w środowisku `node` (nie `jsdom`). Zewnętrzne zależności mockowane przez `vi.mock`.

```ts
// @vitest-environment node
vi.mock('@google/generative-ai', () => {
  function MockGoogleGenerativeAI() {
    return { getGenerativeModel: vi.fn().mockReturnValue({ generateContent: mockFn }) };
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});
```

Plik `src/test/setup.ts` owinięty warunkami `typeof window !== 'undefined'`, żeby nie crashował w środowisku node. Mocki współdzielone: `src/test/mocks/` (apiClient, authContext, fixtures).

---

## Uruchamianie

```bash
# Wszystkie testy backendowe
cd backend
.venv\Scripts\python.exe -m pytest tests/ -v

# Tylko testy routerów (integracyjne)
.venv\Scripts\python.exe -m pytest tests/v1/boards/test_boards_router.py tests/v1/workspaces/test_workspaces_router.py tests/v1/notifications/test_notifications_router.py -v

# Wszystkie testy frontendowe
npm run test            # = vitest run

# Jeden plik
npx vitest run src/app/api/chat/route.test.ts
```

---

## E2E (Playwright) - tablica na Excalidraw

`e2e/*.spec.ts` + `playwright.config.ts`. Testują tablicę z `NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw` na pełnym
stosie: backend (seed `backend/scripts/seed_e2e.py`: właściciel, edytor i viewer w jednym workspace), prawdziwy
`whiteboard-sync` z autoryzacją, frontend. Serwery startuje Playwright (`webServer`), bazę i Redisa - Docker.
Stan aplikacji czytają przez `window.__boardEngine` (wystawiane tylko przy `NEXT_PUBLIC_E2E=1`).

Role: `e2e/roles.spec.ts` (editor nie tworzy tablicy i dostaje 403 na zaproszenia/share-link/zmianę nazwy, viewer
403 na upload; owner widzi „Nowa tablica"). Viewer bez prawa zapisu na tablicy: `board-engine.spec.ts`.
Limit elementów planu Free: `e2e/board-engine-limit.spec.ts` (własna tablica tworzona przez API i usuwana na końcu;
800 elementów -> ostrzeżenie „800/1000", 1000 -> blokada narzędzi rysujących, 1001. element - z UI i z obejściem UI -
nie zostaje u obu osób, po usunięciu elementu można znów dodawać).
Nagłówki bezpieczeństwa (SEC-16): `e2e/security-headers.spec.ts` - odpowiedź `/login` (CSP, HSTS, Permissions-Policy,
X-Frame-Options, bez X-XSS-Protection) i API (nosniff, `no-store` na `/api/v1/auth/*`), a na tablicy (rysowanie, notatka KaTeX,
PDF, obraz, f(x), Tutor AI, kalkulator) i w demo zero zdarzeń `securitypolicyviolation` i zero „Refused to …” w konsoli.
Lokalnie frontend e2e to `next dev`, więc CSP ma dodatkowo `'unsafe-eval'` (React Refresh); w CI (`next build`) sprawdzana jest
CSP produkcyjna bez niego. Źródło nagłówków: `src/_new/lib/security-headers.ts`.

```bash
docker compose -f docker-compose.e2e.yml up -d     # Postgres :55432 + Redis :56379
npm --prefix whiteboard-sync ci                    # raz
# PowerShell: $env:E2E_PYTHON="$PWD\backend\.venv\Scripts\python.exe"
E2E_PYTHON=backend/.venv/Scripts/python.exe npm run test:e2e
docker compose -f docker-compose.e2e.yml down -v   # sprzątanie
```

- Frontend musi być na porcie **3000** (tylko ten `localhost` jest w CORS backendu). Gdy 3000 jest zajęty, ustaw
  np. `E2E_FRONTEND_PORT=3210` - Chromium dostaje wtedy `--disable-web-security` (tylko lokalnie).
- Backend (8210) i whiteboard-sync (1294) są na nietypowych portach, a `reuseExistingServer` jest domyślnie wyłączone,
  żeby Playwright nie "pożyczył" cudzego serwera bez seeda. Ponowne użycie działających serwerów: `E2E_REUSE=1`.
- Supabase Storage w E2E to atrapa w pamięci `e2e/fake-storage.mjs` (port 8211, `E2E_STORAGE_PORT`), startowana jako
  osobny `webServer`; backend dostaje `SUPABASE_URL` wskazujący na nią i rozmawia z nią jak z prawdziwym Storage
  (w kodzie backendu nie ma trybu testowego). Test obrazów: `e2e/board-engine-images.spec.ts`; stan atrapy: `GET /__state`.
  Broadcast powiadomień z backendu trafia w atrapę i dostaje 404 (best-effort, testy tego nie sprawdzają).
- Backend limituje logowanie (10 prób / 5 min na login) - helpery logują każdego użytkownika raz na przebieg.
  Przy częstych lokalnych powtórkach: `docker compose -f docker-compose.e2e.yml exec redis redis-cli FLUSHALL`.

---

## Gdzie NIE ma testów (frontend)

Katalogi z kodem i zerem testów — kolejność wg ryzyka:

1. `src/_new/features/whiteboard/realtime/` (presence, kursory, typing starego silnika przez Supabase) i `src/app/context/BoardRealtimeContext.tsx` — legacy, znikają w etapie F; nie dopisywać testów.
2. `src/_new/features/whiteboard/{tools,engine,stores,api}/` — stary silnik, jak wyżej.
3. Wszystkie `components/` w `auth`, `board`, `workspace`, `notifications`; `shared/ui`, `shared/hooks`.
4. `src/_new/features/dashboard/components/` poza testem mobilnego sidebara (m.in. scenariusz z `known-issues.md` #4 — odświeżanie list bez F5 — nie ma testu).

Ma testy (zmiana od 21.09): `src/_new/lib/api/` (klient axios: interceptor 401 → refresh, `success:false`, `X-Request-ID`), `whiteboard-sync/` (6 plików + joby CI `sync-typecheck`/`sync-test`), `features/board-engine`, `features/plans`.

Backend bez testów routera: `whiteboard/storage.py` i `POST /{id}/upload-image` (legacy, etap F). `assets/`, `onboarding/`, `share_links/router.py`, `whiteboard/router.py` (`/doc`, `/access`, `/files`, `/call`) mają testy.

`vitest.config.ts` → `coverage.include` obejmuje `src/_new/features/**` i `src/_new/lib/**` (bez `_mock/`).

---

## Znane ograniczenia

- E2E pokrywają tylko tablicę na Excalidraw (za flagą); stary silnik, logowanie przez Google, dashboard i stary czat głosowy nie mają testów E2E. Rozmowa na Daily (`e2e/voice-call*.spec.ts`) jest sprawdzana bez klucza (503 `VOICE_NOT_CONFIGURED` → komunikat „Rozmowa chwilowo niedostępna.”, brak ramki; owner i viewer) i z atrapą odpowiedzi (`page.route`) — prawdziwego połączenia z Daily testy nie nawiązują; to zostaje testem ręcznym na dwóch urządzeniach.
- Synchronizacja tablicy po WebSocket jest testowana tylko po stronie serwera (`whiteboard-sync/test/*` na prawdziwym Hocuspocusie z atrapą backendu) i w E2E (dwie przeglądarki); hooki klienta (`use-yjs-sync`, `use-board-connection`) mają testy jednostkowe z mockiem providera; presence starego silnika przez Supabase Realtime — bez testów (legacy).
- `pytest-asyncio` 0.21.1 ma bug z `@pytest_asyncio.fixture` w trybie STRICT — testy integracyjne backendowe używają synchronicznego `TestClient` zamiast async httpx.
- Lokalnie na Windows `prettier --check` może zgłaszać setki plików przez `core.autocrlf=true` (CRLF) — CI na Linuksie jest miarodajne.
