# Testy w systemie EasyLesson

**Stan:** 21.09.2026 (`origin/main@b9a0c2e`)
**Zakres:** backend (Python/pytest) + frontend (TypeScript/Vitest)

---

## Liczby (zmierzone)

| Warstwa  | Narzędzie | Pliki | Testy | Czas pełnego przebiegu |
| -------- | --------- | ----- | ----- | ---------------------- |
| backend  | pytest    | 25    | 334   | ~3 min (SQLite in-memory + fakeredis) |
| frontend | vitest    | 38    | 450   | ~35 s (jsdom)          |

Aktualizuj tę tabelę w PR, który zmienia liczbę plików testowych — nie "przy okazji".

---

## Struktura testów

```
backend/tests/
  conftest.py                        # wspólne fixtures (db, redis, users, workspaces, boards, invites)
  core/
    test_email.py
    test_presence.py                 # online users w Redisie (fakeredis)
  v1/
    auth/                            # login, register, verify_email, password_reset, refresh,
                                     # logout, me, google_login, resend_code, dependencies,
                                     # rate_limit, integration
    boards/                          # test_boards_router.py, test_boards_service.py
    workspaces/                      # workspaces_router/service, members_service,
                                     # invites_service, share_links_service, search_users
    notifications/                   # notifications_router/service
    whiteboard/                      # test_whiteboard_service.py (elementy legacy + snapshot Yjs)

src/
  _new/features/
    auth/        api/authApi.test.ts, hooks/_tests/{useLogin,useRegister,usePasswordReset,useCodeInput}, utils/validation.test.ts
    board/       api/boardApi.test.ts, hooks/_tests/{useCreateBoardForm,useEditBoardForm}, utils/helpers.test.ts
    demo/        _tests/demo-page.test.tsx
    notifications/ api/notificationApi.test.ts
    whiteboard/  commands/_tests/commands.test.ts, elements/math-eval.test.ts,
                 handlers/handler-utils.test.ts, navigation/viewport-math.test.ts,
                 selection/snap-utils.test.ts, hooks/use-yjs-board.test.ts,
                 hooks/use-whiteboard-ui-metrics.test.ts, yjs/board-doc.test.ts,
                 components/toolbar/_tests/{math-chatbot-demo,mobile-layout}.test.tsx
    workspace/   api/{workspaceApi,inviteApi,memberApi,shareLinkApi}.test.ts,
                 hooks/_tests/{useCreateWorkspaceForm,useEditWorkspaceForm,useWorkspaceMembers}
  _new/lib/
    auth/tokenService.test.ts, errors/{AppError,errorHandler}.test.ts
  app/api/
    chat/{route,auth}.test.ts        # trasy Next.js (środowisko node)
    contact/route.test.ts
  app/context/
    VoiceChatContext.test.tsx, VoiceChatContext.flows.test.tsx, VoiceChatContext.mobile.test.tsx,
    voice-chat/mediaSupport.test.ts
  app/(dashboard)/dashboard/Components/_tests/workspace-sidebar-mobile.test.tsx
```

---

## Poziomy testowania

| Poziom              | Narzędzie                        | Zakres                               |
| ------------------- | -------------------------------- | ------------------------------------ |
| Jednostkowy         | pytest / Vitest                  | serwisy, hooki, narzędzia pomocnicze, model Y.Doc |
| Integracyjny (HTTP) | FastAPI TestClient / Vitest node | routery REST, trasy Next.js API      |
| Komponentowy        | Vitest + Testing Library (jsdom) | voice chat (mocki kanału i RTCPeerConnection), układ mobilny, demo |

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

## Gdzie NIE ma testów (frontend)

Katalogi z kodem i zerem testów — kolejność wg ryzyka:

1. `src/_new/lib/api/` — klient axios z interceptorem 401 → refresh (krytyczna ścieżka).
2. `src/_new/features/whiteboard/realtime/` — 10 hooków Supabase Realtime (presence, kursory, typing, sync elementów), ~1 900 linii.
3. `src/app/context/BoardRealtimeContext.tsx`.
4. `src/_new/features/whiteboard/{tools,engine,stores,api}/`.
5. Wszystkie `components/` w `auth`, `board`, `workspace`, `notifications`; `shared/ui`, `shared/hooks`.
6. `whiteboard-sync/` — zero testów i zero kroku w CI.

Backend bez testów: `assets/`, `onboarding/`, `whiteboard/router.py`, `whiteboard/storage.py`, `share_links/router.py`.

`vitest.config.ts` → `coverage.include` obejmuje tylko `auth`, `lib/auth`, `lib/errors` — raport pokrycia nic nie mówi o tablicy. Rozszerzenie zaplanowane w `docs/architecture/REFAKTOR-PLAN.md`.

---

## Znane ograniczenia

- Brak testów E2E (wymagają działającego Dockera z pełnym środowiskiem: backend, redis, whiteboard-sync).
- Brak testów WebSocket dla synchronizacji tablicy (Supabase Realtime w ścieżce legacy, Hocuspocus w ścieżce Yjs) — trudne do izolacji; model `Y.Doc` jest testowany jednostkowo (`yjs/board-doc.test.ts`).
- `pytest-asyncio` 0.21.1 ma bug z `@pytest_asyncio.fixture` w trybie STRICT — testy integracyjne backendowe używają synchronicznego `TestClient` zamiast async httpx.
- Lokalnie na Windows `prettier --check` może zgłaszać setki plików przez `core.autocrlf=true` (CRLF) — CI na Linuksie jest miarodajne.
