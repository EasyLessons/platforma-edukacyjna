# Testy w systemie EasyLesson

**Data:** czerwiec 2026
**Zakres:** backend (Python/pytest) + frontend (TypeScript/Vitest)

---

## Struktura testów

```
backend/tests/
  conftest.py                        # wspólne fixtures (db, users, workspaces, boards)
  v1/
    auth/                            # testy modułu autentykacji (~70 testów)
      test_login.py
      test_register.py
      test_verify_email.py
      test_password_reset.py
      test_refresh.py
      test_check_user.py
      test_logout.py
      test_me.py
      test_google_login.py
      test_search_users.py
      test_resend_code.py
      test_integration.py
    boards/
      test_boards_router.py          # testy HTTP routera (~10 testów)
      test_boards_service.py         # testy logiki biznesowej
    workspaces/
      test_workspaces_router.py      # testy HTTP routera (~12 testów)
      test_workspaces_service.py
      test_members_service.py
      test_invites_service.py
    notifications/
      test_notifications_router.py   # testy HTTP routera (~8 testów)
      test_notifications_service.py
    whiteboard/
      test_whiteboard_service.py

src/
  _new/features/
    auth/
      api/authApi.test.ts
      hooks/                         # useLogin, useRegister, usePasswordReset, ...
      utils/validation.test.ts
    board/
      api/boardApi.test.ts
      hooks/                         # useCreateBoardForm, useEditBoardForm
      utils/helpers.test.ts
    workspace/
      api/workspaceApi.test.ts
      api/inviteApi.test.ts
      api/memberApi.test.ts
      hooks/                         # useCreateWorkspaceForm, useEditWorkspaceForm, useWorkspaceMembers
    notifications/
      api/notificationApi.test.ts
    whiteboard/
      commands/_tests/commands.test.ts
      elements/math-eval.test.ts
      handlers/handler-utils.test.ts
      navigation/viewport-math.test.ts
      selection/snap-utils.test.ts
  _new/lib/
    tokenService.test.ts
    AppError.test.ts
    errorHandler.test.ts
  app/api/
    chat/route.test.ts               # testy trasy Next.js (9 testów)
    contact/route.test.ts            # testy trasy Next.js (8 testów)
```

---

## Poziomy testowania

| Poziom | Narzędzie | Zakres |
|---|---|---|
| Jednostkowy | pytest / Vitest | serwisy, hooki, narzędzia pomocnicze |
| Integracyjny (HTTP) | FastAPI TestClient / Vitest node | routery REST, trasy Next.js API |

---

## Wzorce

### Backend

Każdy test integracyjny używa bazy SQLite in-memory wstrzykiwanej przez `dependency_overrides[get_db]`. Token JWT tworzony jest bezpośrednio przez `create_access_token` bez przechodzenia przez endpoint `/login`.

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

Plik `src/test/setup.ts` owinięty warunkami `typeof window !== 'undefined'`, żeby nie crashował w środowisku node.

---

## Uruchamianie

```bash
# Wszystkie testy backendowe
cd backend
.venv\Scripts\python.exe -m pytest tests/ -v

# Tylko testy routerów (integracyjne)
.venv\Scripts\python.exe -m pytest tests/v1/boards/test_boards_router.py tests/v1/workspaces/test_workspaces_router.py tests/v1/notifications/test_notifications_router.py -v

# Wszystkie testy frontendowe
npx vitest run

# Tylko API routes
npx vitest run src/app/api/chat/route.test.ts src/app/api/contact/route.test.ts
```

---

## Pokrycie

| Moduł | Jednostkowe | Integracyjne | Łącznie |
|---|---|---|---|
| Autentykacja | ~40 | ~30 | ~70 |
| Przestrzenie robocze | ~15 | 12 | ~27 |
| Tablice | ~10 | 10 | ~20 |
| Powiadomienia | ~8 | 8 | ~16 |
| Chat API | — | 9 | 9 |
| Contact API | — | 8 | 8 |
| Narzędzia i hooki | ~50 | — | ~50 |
| Tablica interaktywna | ~15 | — | ~15 |
| **Razem** | **~138** | **~77** | **~215** |

---

## Znane ograniczenia

- Brak testów E2E (wymagają działającego Dockera z pełnym środowiskiem)
- Brak testów WebSocket dla tablicy interaktywnej (realtime przez Socket.io — trudne do izolacji)
- `pytest-asyncio` 0.21.1 ma bug z `@pytest_asyncio.fixture` w trybie STRICT — testy integracyjne backendowe używają synchronicznego `TestClient` zamiast async httpx
