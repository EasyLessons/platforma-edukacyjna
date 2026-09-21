# Plany Free / Premium (podstawa, bez płatności)

Stan na 22.09.2026 (PR `feat/plans-entitlements`). Płatności (Stripe) — później; na razie plan
nadaje się ręcznie w bazie. Decyzje Patryka: dwa plany (`free` / `premium`), limity w jednym
miejscu, egzekwowanie na backendzie w warstwie service.

## Model danych

Tabela **`user_plans`** (`backend/api/v1/plans/models.py`, migracja `c4a9e1f27b3d_user_plans`):

| kolumna      | typ                                  | uwagi                              |
| ------------ | ------------------------------------ | ---------------------------------- |
| `user_id`    | int, PK, FK → `users.id` (CASCADE)   |                                    |
| `plan`       | varchar(20), CHECK `free`/`premium`  | server_default `free`              |
| `updated_at` | datetime                             |                                    |

**Brak wiersza = plan `free`.** Dlatego migracja nie robi backfillu i nie dotyka istniejących
użytkowników.

Dlaczego osobna tabela, a nie kolumna w `users`: `backend/core/models.py` jest w strefie
równoległej pracy nad Yjs (Bartek) — osobny moduł i osobna tabela dają zero konfliktów w modelach
i w migracjach Alembic. Model jest rejestrowany w `Base.metadata` przez import w
`alembic/env.py` i `tests/conftest.py` (bez tego autogenerate/`create_all` by go nie widziały).

### Nadanie Premium bez UI

```sql
INSERT INTO user_plans (user_id, plan, updated_at)
VALUES (<id_usera>, 'premium', NOW())
ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', updated_at = NOW();

-- powrót na free:
DELETE FROM user_plans WHERE user_id = <id_usera>;
```

## Limity — jedno miejsce

`backend/api/v1/plans/limits.py` (`PlanLimits`, `PLAN_LIMITS`). `None` = bez limitu.

| limit                    | Free | Premium |
| ------------------------ | ---- | ------- |
| `max_own_workspaces`     | 1    | —       |
| `max_boards`             | 3    | —       |
| `max_elements_per_board` | 300  | —       |
| `ai_chat_daily`          | —    | —       |

`ai_chat_daily` jest zarezerwowane na przyszłość (nigdzie nie egzekwowane).

## Gdzie egzekwowane (backend)

`PlanService` (`backend/api/v1/plans/service.py`) wołany z serwisów:

| akcja                        | miejsce                                          | efekt                                                                  |
| ---------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| tworzenie workspace'u        | `workspaces/service.py` → `create_workspace`     | `403` + `code: PLAN_LIMIT_WORKSPACES`, `data: {limit, used}`           |
| tworzenie tablicy            | `boards/service.py` → `create_board`             | `403` + `code: PLAN_LIMIT_BOARDS`, `data: {limit, used}`               |
| szczegóły tablicy            | `boards/service.py` → `get_board`                | `read_only: true`, `read_only_reason: "PLAN_LIMIT_ELEMENTS"`           |

Wyjątek `PlanLimitError` (`core/exceptions.py`, status 403) — obsługiwany przez ogólny handler
`AppException` w `main.py`, kod trafia do pola `code` w `ApiResponse`.

Zasady liczenia:

- **own_workspaces** — workspace'y, których user jest twórcą (`workspaces.created_by`).
  Starter workspace z onboardingu liczy się jako ten jeden darmowy.
- **boards** — tablice utworzone przez usera **w jego własnych workspace'ach**. Tablice tworzone
  w cudzych workspace'ach (jako editor) nie liczą się do limitu twórcy i nie są sprawdzane.
  Konsekwencja (świadoma, do ewentualnej zmiany): editor może tworzyć tablice w workspace'ie
  użytkownika Free bez limitu — nie wliczają się ani jemu, ani właścicielowi.
- **elementy** — nieusunięte wiersze `board_elements` (model legacy). Limit obowiązuje wg planu
  **właściciela workspace'u** tablicy. Liczone tylko w `GET /boards/{id}` (nie na liście — N zapytań).
- Istniejące zasoby ponad limitem **zostają**: użytkownik z 5 tablicami nadal je otwiera i edytuje,
  tylko nie utworzy szóstej. Tablica >300 elementów jest tylko do odczytu, ale nie znika.

## API

`GET /api/v1/plans/me` (router `backend/api/v1/plans/router.py`, zarejestrowany w `api/v1/router.py`):

```json
{
  "plan": "free",
  "limits": { "max_own_workspaces": 1, "max_boards": 3, "max_elements_per_board": 300, "ai_chat_daily": null },
  "usage": { "own_workspaces": 1, "boards": 2 }
}
```

`GET /api/v1/boards/{id}` dostał pola `read_only: bool` i `read_only_reason: "PLAN_LIMIT_ELEMENTS" | null`.

## Frontend — `src/_new/features/plans/`

- `api/plans-api.ts` — `fetchMyPlan()`.
- `hooks/use-plan.ts` — `usePlan()` / `useEntitlements()` (TanStack Query, klucz `['plans','me']`):
  `plan`, `limits`, `usage`, `isPremium`, `canCreateBoard`, `canCreateWorkspace`, `refresh()`.
  Przed załadowaniem `canCreate*` = `true` (UI nie blokuje na podstawie braku danych — źródłem
  prawdy jest 403 z backendu).
- `utils/plan-limit-error.ts` — `getPlanLimitCode(err)` / `isPlanLimitError(err)` po `AppError.code`.
- `components/plan-usage-badge.tsx` — „2/3 tablice" obok „Nowa tablica" (`dashboard/BoardsSection`).
- `components/upgrade-modal.tsx` — „Przejdź na Premium": tekst, korzyści, „Zamknij"; przycisk
  „Chcę Premium" renderuje się tylko gdy ustawione `NEXT_PUBLIC_PREMIUM_INTEREST_URL`
  (mailto lub link do formularza). Otwierany po 403 `PLAN_LIMIT_*` w `BoardsSection`
  (tablice) i `workspace-sidebar` (workspace'y) oraz z banera na tablicy.
- `components/read-only-banner.tsx` — baner na stronie tablicy, gdy `read_only === true`.

### Tryb tylko do odczytu na tablicy

`src/app/(whiteboard)/whiteboard/page.tsx` po `fetchBoardById` ustawia `planReadOnly` i:

1. renderuje `ReadOnlyBanner` (+ `UpgradeModal` z `reason="PLAN_LIMIT_ELEMENTS"`),
2. przekazuje do `WhiteboardCanvas` `userRole="viewer"` — canvas już dziś traktuje viewera jako
   tryb bez narzędzi (tylko `pan`), więc blokada narzędzi działa **bez zmian w
   `whiteboard-canvas.tsx`** (strefa Bartka).

Flaga jest liczona przy wejściu na tablicę. Jeśli tablica przekroczy limit w trakcie sesji,
blokada pojawi się dopiero po odświeżeniu — domknięcie serwerowe poniżej.

## TODO — domknięcie serwerowe w `whiteboard-sync` (strefa Bartka, tylko opis)

Dziś limit elementów jest egzekwowany wyłącznie przez flagę w API + rolę `viewer` na froncie.
Klient z własnym kodem może nadal wysyłać update'y Yjs. Do zrobienia po stronie Hocuspocus
(`whiteboard-sync/src/index.ts`), gdy Bartek będzie miał wolne okno:

1. W `onAuthenticate` (`auth.ts`) — `GET /api/v1/whiteboard/{id}/access` mógłby dodatkowo zwracać
   `max_elements` (limit wg planu właściciela workspace'u; `null` = bez limitu) i zapisywać go
   w `context` połączenia.
2. Hook `beforeHandleMessage` (albo `onChange`) — po zaaplikowaniu update'u policzyć elementy
   w `Y.Doc` (mapa/array elementów) i jeśli `count > max_elements`, odrzucić wiadomość
   (rzucić wyjątek w `beforeHandleMessage` → Hocuspocus nie zaaplikuje update'u) lub ustawić
   połączenie jako `readOnly` (`connection.readOnly = true`).
3. Alternatywnie, prościej: w `onAuthenticate` ustawić `connection.readOnly = true`, gdy
   `count(elements) > max_elements` już w momencie wejścia — wtedy Hocuspocus sam odrzuca
   update'y od tego klienta.
4. Przy tablicach na Yjs elementy nie trafiają do `board_elements`, więc `PlanService.
   count_board_elements()` (liczący z tej tabeli) trzeba wtedy zastąpić liczeniem ze snapshotu
   `board_documents` (dekodowanie `Y.Doc` po stronie Pythona) lub endpointem po stronie
   `whiteboard-sync`. Do decyzji przy migracji na Yjs.

## Migracja na produkcji

`backend/Procfile` na Renderze to `web: alembic upgrade head && uvicorn ...`, więc po merge'u do
`main` migracja wykona się **automatycznie przy deployu**. Ręcznie (np. gdyby deploy padł na
migracji): `cd backend && alembic upgrade head` z produkcyjnym `DATABASE_URL` w środowisku.
Migracja tylko tworzy pustą tabelę `user_plans`; jest odwracalna
(`alembic downgrade 0059c60824f3`).

## Testy

- pytest: `backend/tests/v1/plans/` (service + router) — limity free, premium bez limitu,
  `read_only` przy >300 elementach, `GET /plans/me`, kody 403.
- vitest: `src/_new/features/plans/**/*.test.ts[x]` — hook (mock `apiClient`), badge, modal,
  baner, util.
