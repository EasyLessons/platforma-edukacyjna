# Plany Free / Premium (bez płatności)

Stan na 15.10.2026. Przeróbka PR #68 wg decyzji A, B i C Patryka z 01.10.2026
(`EasyLesson-plany-i-role.md`). Płatności (Stripe) — później; na razie plan nadaje się ręcznie
w bazie. Role w przestrzeni (decyzja B) opisuje `docs/architecture/backend-structure.md`.

## Model danych

Tabela **`user_plans`** (`backend/api/v1/plans/models.py`, migracja `c4a9e1f27b3d_user_plans`,
`down_revision = d315e28cb69c`):

| kolumna      | typ                                 | uwagi                 |
| ------------ | ----------------------------------- | --------------------- |
| `user_id`    | int, PK, FK → `users.id` (CASCADE)  |                       |
| `plan`       | varchar(20), CHECK `free`/`premium` | server_default `free` |
| `updated_at` | datetime                            |                       |

**Brak wiersza = plan `free`** — migracja nie robi backfillu i nie dotyka istniejących danych.
Osobna tabela zamiast kolumny w `users`, bo `core/models.py` jest w strefie pracy nad Yjs;
model rejestruje import w `alembic/env.py` i `tests/conftest.py`.

### Nadanie Premium bez UI

```sql
INSERT INTO user_plans (user_id, plan, updated_at)
VALUES (<id_usera>, 'premium', NOW())
ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', updated_at = NOW();

-- powrót na free:
DELETE FROM user_plans WHERE user_id = <id_usera>;
```

## Limity — jedno miejsce

`backend/api/v1/plans/limits.py` (`PlanLimits`, `PLAN_LIMITS`). `None` = bez limitu. Liczby Free
można nadpisać zmiennymi środowiskowymi (`PLAN_FREE_MAX_WORKSPACES`,
`PLAN_FREE_MAX_BOARDS_PER_WORKSPACE`, `PLAN_FREE_MAX_ELEMENTS`).

| limit                      | Free | Premium |
| -------------------------- | ---- | ------- |
| `max_own_workspaces`       | 2    | —       |
| `max_boards_per_workspace` | 3    | —       |
| `max_elements_per_board`   | 1000 | —       |
| `ai_chat_daily`            | —    | —       |

Członkostwo w cudzych przestrzeniach jest bez limitu. Ostrzeżenie „tablica się zapełnia" przy
80% limitu elementów (`ELEMENTS_WARN_RATIO`) — UI w PR 3. `ai_chat_daily` zarezerwowane.

## Zasady liczenia

- **Przestrzenie:** `workspaces.created_by = user`; limit wg planu tego użytkownika.
- **Tablice:** liczba tablic w DANEJ przestrzeni (`boards.workspace_id`), niezależnie od
  `boards.created_by`; limit wg planu **właściciela przestrzeni** i sprawdzany zawsze. Plan
  Premium po stronie tworzącego nie podnosi limitu cudzej przestrzeni Free.
- **Grandfathering:** limity sprawdzane WYŁĄCZNIE przy tworzeniu (`used >= limit` → 403). Zasoby
  ponad limitem (np. 15 tablic w przestrzeni po zmianie planu) zostają i działają: lista, odczyt,
  zmiana nazwy, usunięcie. Nowy powstanie po zejściu poniżej limitu albo po Premium. Badge pokazuje
  wtedy np. „7/3" na czerwono. Migracja nie dotyka danych.
- **Elementy:** liczone z dokumentu Excalidraw w Y.Doc (`excalidraw-elements`,
  `isDeleted !== true`), nie z bazy — egzekwuje `whiteboard-sync` (sekcja niżej).

## Gdzie egzekwowane (backend)

`PlanService` (`backend/api/v1/plans/service.py`) wołany z serwisów:

| akcja                | miejsce                                      | efekt                                                              |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| tworzenie przestrzeni | `workspaces/service.py` → `create_workspace` | `403` `PLAN_LIMIT_WORKSPACES`, `data: {limit, used}`               |
| tworzenie tablicy    | `boards/service.py` → `create_board`         | `403` `PLAN_LIMIT_BOARDS`, `data: {limit, used, workspace_id}`     |

Kolejność w `create_board`: najpierw rola (owner przestrzeni, zwykłe 403), potem limit.
`PlanLimitError` (`core/exceptions.py`, status 403) trafia przez handler `AppException`, kod w
polu `code` odpowiedzi `ApiResponse`.

### Wyścig równoległych żądań

Przed `count` blokujemy wiersz nadrzędny (`SELECT ... FOR UPDATE` na `Workspace` przy tablicach,
na `User` przy przestrzeniach) w tej samej transakcji; blokada trzymana do `commit()` w serwisie.
Dwa równoległe `POST /boards` przy stanie 2/3 nie dadzą 4. SQLite w testach ignoruje
`FOR UPDATE`, więc współbieżności nie da się tam przetestować — zachowanie opisane i sprawdzone
przez lekturę kodu. Constraint/trigger w bazie odrzucony: limit zależy od planu.

### Onboarding i ścieżki, których dziś nie ma

- **Onboarding** (`create_starter_workspace` + `create_starter_board`) nie woła limitów; starter
  liczy się do limitu (nowy user startuje z 1/2 i 1/3). Test: `TestOnboarding`.
- **Przyjęcie zaproszenia / share-link** tworzy tylko członkostwo `editor` — bez limitu.
- **Duplikowanie, przenoszenie tablicy, import, transfer własności przestrzeni** nie istnieją.
  Każda przyszła taka ścieżka MUSI wołać `ensure_can_create_board(docelowa_przestrzeń)`, a transfer
  własności sprawdzić limit przyjmującego.
- **Downgrade Premium → Free:** nic nie znika (grandfathering).

## API

`GET /api/v1/plans/me` (plan ZALOGOWANEGO):

```json
{
  "plan": "free",
  "limits": {
    "max_own_workspaces": 2,
    "max_boards_per_workspace": 3,
    "max_elements_per_board": 1000,
    "ai_chat_daily": null
  },
  "usage": { "own_workspaces": 1, "boards_by_workspace": { "12": 2 } }
}
```

`boards_by_workspace` obejmuje tylko własne przestrzenie (pusta przestrzeń = 0). Kody 403:
`PLAN_LIMIT_WORKSPACES`, `PLAN_LIMIT_BOARDS`; `PLAN_LIMIT_ELEMENTS` zarezerwowany dla komunikatu
klienta.

## Frontend (`src/_new/features/plans/`)

- `usePlan()` / `useEntitlements()` — plan, limity, `boardsIn(id)`, `canCreateBoardIn(id)`,
  `canCreateWorkspace`, `refresh()` (inwalidacja po utworzeniu/usunięciu).
- `PlanUsageBadge` — „2/3 tablice" (`workspaceId` własnej przestrzeni) lub „1/2 przestrzenie".
  Dla cudzej przestrzeni nic nie renderuje (limit liczy się u właściciela).
- `UpgradeModal` — otwierany po 403 `PLAN_LIMIT_*` w `BoardsSection`, `TemplateSection`
  i `workspace-sidebar`. Bez płatności; opcjonalny link `NEXT_PUBLIC_PREMIUM_INTEREST_URL`.
- Brak trybu „cała tablica tylko do odczytu po przekroczeniu" — zdecydowano, że limit elementów
  blokuje tylko dodawanie nowych.

## Limit elementów (whiteboard-sync, PR 3)

- Backend zwraca `element_limit` (plan właściciela przestrzeni; `null` = bez limitu) w
  `GET /whiteboard/{id}/access` (dla serwera synchronizacji) i `GET /boards/{id}` (dla UI).
- `whiteboard-sync/src/element-limit.ts`: serwer PRZYJMUJE update i w `observe` mapy
  `excalidraw-elements` cofa nadmiar tombstonem (`isDeleted: true`, `version + 1`, `versionNonce: 0`)
  z originem = połączenie sprawcy. Liczą się tylko elementy, które „stały się żywe": edycja,
  przesuwanie, gumka i undo usunięcia w granicach limitu przechodzą zawsze. Wartości-śmieci
  (`Y.Map`, tablica, liczba) ponad limitem są usuwane, nie zamieniane w tombstone.
- Próg to `max(limit, liczba żywych przy załadowaniu)` - tablica już ponad limitem nie traci
  danych, ale nie rośnie. Limit siedzi w kontekście połączenia (zero stanu współdzielonego),
  więc zmiana planu działa po ponownym połączeniu.
- `beforeHandleMessage` odrzucony: rzut zamyka połączenie, a wiadomości nie da się pominąć.
- Nigdy `readOnly` z powodu planu. Stary silnik (klucz `elements`) bez limitu - limit działa
  przy `NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw`.
- Obejście `POST /doc`: gdy `SYNC_SERVICE_TOKEN` jest ustawiony, zapis snapshotu z JWT dostaje 403
  (GET zostaje). **Klucz musi być ustawiony w backendzie ORAZ w whiteboard-sync** - inaczej zapisy
  sync spadają na token usera i dostają 403.
- Front: `useElementLimit` - baner od 80% i 100%; przy 100% narzędzia rysujące wracają do
  zaznaczania (gumka, hand, lasso, laser zostają).
- Ryzyka: odrzucony element mruga i znika; limit liczy wpisy, nie bajty (limit rozmiaru dokumentu
  i pliki to osobne zadanie); praca offline ponad limit jest cofana po reconnect.

## Do zrobienia

- Limity techniczne Premium (10 000 elementów, rozmiar snapshotu/update, pula Storage, fair use,
  dzienny limit AI) - liczby do zmierzenia; limit miejsca na pliki i sprzątanie (dopisek 12.10).
- Płatności (Stripe), nadawanie planu z UI.
