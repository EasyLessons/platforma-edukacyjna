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
`PLAN_FREE_MAX_BOARDS_PER_WORKSPACE`, `PLAN_FREE_MAX_ELEMENTS`, `PLAN_FREE_MAX_STORAGE_MB`,
`PLAN_PREMIUM_MAX_STORAGE_MB`).

| limit                      | Free | Premium |
| -------------------------- | ---- | ------- |
| `max_own_workspaces`       | 2    | —       |
| `max_boards_per_workspace` | 3    | —       |
| `max_elements_per_board`   | 1000 | —       |
| `max_storage_bytes`        | 100 MB | 5 GB  |
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
- **Miejsce na pliki:** suma `board_files.size_bytes` (bez wierszy z `deleted_at`) po `owner_id` =
  właściciel przestrzeni; limit wg jego planu. Szczegóły: sekcja „Miejsce na pliki" niżej.
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

## Miejsce na pliki (decyzja Patryka, 12.10.2026)

Limit na KONTO właściciela przestrzeni: Free 100 MB, Premium 5 GB. Rozszerza miękką quotę tablicy
z PR #106 (300 plików / 100 MB na tablicę, licznik w Redis — zostaje jako druga, lokalna zapora).

- **Rejestr `board_files`** (`backend/api/v1/storage_quota/`, migracja `e5b2d8a47c10`): jeden wiersz
  na obiekt `board-files/{board_id}/{file_name}` (`board_id`, `owner_id`, `file_name`, `size_bytes`,
  `created_at`, `deleted_at`). Bez kluczy obcych — rejestr ma przeżyć usunięcie tablicy, przestrzeni
  i konta (pliki kasowane po okresie karencji). Zapis wiersza następuje po udanym zapisie w Storage.
- **Dwa sprawdzenia uploadu** (`whiteboard/files.py`): wstępne PRZED czytaniem ciała (konto już na
  limicie → od razu `403 PLAN_LIMIT_STORAGE`, bez 5 MB w RAM) i autorytatywne PO zapisie w Storage
  (suma pod `FOR UPDATE` na wierszu właściciela + rozmiar po przekodowaniu; nie mieści się →
  obiekt jest kasowany, `403 PLAN_LIMIT_STORAGE`, `data: {limit_bytes, used_bytes}`).
- **Blokada tylko dodawania.** Przeglądanie, pobieranie, edycja i usuwanie działają na limicie;
  konto ponad limitem (np. po spadku z Premium) niczego nie traci, tylko nie dokłada.
- **Zwalnianie miejsca:** usunięcie tablicy albo przestrzeni oznacza wiersze `deleted_at` — przestają
  liczyć się do limitu od razu, a pliki znikają ze Storage po 30 dniach (job sprzątający, niżej).
  Plik usunięty z tablicy jako element zostaje — cofnięcie może go przywrócić.
- **Pliki sprzed migracji** nie mają wierszy w rejestrze, więc nie liczą się do limitu, dopóki job
  sprzątający (pierwszy przebieg) nie dopisze ich przy porównaniu bucketu z rejestrem.
- **Nie liczą się:** wspólne szablony (arkusze CKE, karty wzorów — `tpl:` w `Y.Doc`, nie są w
  Storage), awatary (`avatars`, 5 MB WEBP 512 px na konto) i stary silnik (`board-images`).
- Front: `GET /plans/me` zwraca `limits.max_storage_bytes` i `usage.storage_bytes`; błąd uploadu
  `PLAN_LIMIT_STORAGE` pokazuje komunikat (`excalidraw-file-sync.ts`), a `UpgradeModal` zna ten kod.

### Sprzątanie (job cykliczny)

`backend/api/v1/storage_quota/cleanup.py`, decyzje Patryka z 12.10.2026. Pętla w `lifespan`
(`main.py`) sprawdza co godzinę, czy minęły 24 h od ostatniego przebiegu (raport w Redis
`storage_cleanup:last_report`, więc restart procesu nie uruchamia go od nowa), pierwszy start 10 min po
uruchomieniu. Jeden przebieg naraz (blokada `storage_cleanup:lock`). Kroki, każdy w osobnym
`try/except`:

1. **Rejestr = bucket** — pliki z `board-files` bez wiersza są dopisywane (właściciel z przestrzeni;
   brak tablicy → od razu `deleted_at`), wiersze bez obiektu (starsze niż 1 h) znikają.
2. **Zniknięte tablice** — wiersze tablic, których nie ma w `boards` (kaskady, usunięte konta), dostają `deleted_at`.
3. **Sieroty** — plik starszy niż 7 dni, którego nazwy nie ma w `board_documents.snapshot` swojej
   tablicy, dostaje `deleted_at`. Odwołanie = nazwa `<32 hex>.webp` w bajtach snapshotu (Yjs trzyma
   ją jako zwykły tekst UTF-8; sprawdzone na prawdziwym `Y.encodeStateAsUpdate`).
4. **Skasowanie** — `deleted_at` starsze niż 30 dni: snapshot sprawdzany PONOWNIE (plik, do którego jest
   odwołanie, wraca do użycia i nie jest kasowany), reszta znika ze Storage i z rejestru. Błąd Storage
   = wpis zostaje do następnego przebiegu.
5. **Awatary-sieroty** — obiekty `avatars/` bez żadnego `users.avatar_url`, starsze niż 7 dni.
6. **Baza** — powiadomienia przeczytane >30 dni i wszystkie >90 dni; zaproszenia i linki zaproszeniowe
   30 dni po terminie (linki także 30 dni po odwołaniu).

Bezpieczniki: nic nie jest kasowane od razu (najpierw `deleted_at`, 30 dni na pomyłkę); krok, który
oznaczyłby ponad połowę plików (min. 20), jest pomijany i trafia do `errors` raportu; nieudane
listowanie Storage nigdy nie znaczy „plików nie ma". Wspólne szablony, pliki starego silnika
(`board-images`) i dokumenty Yjs nie są ruszane. Za „stare pliki" uznajemy tylko sieroty i pliki
usuniętych tablic — plik z żywej tablicy nie jest kasowany z powodu wieku.

Konfiguracja (env, wartości domyślne w `core/config.py`): `STORAGE_CLEANUP_ENABLED` (domyślnie `true`;
`false` wyłącza pętlę), `STORAGE_CLEANUP_INTERVAL_HOURS` (24), `STORAGE_CLEANUP_INITIAL_DELAY_MINUTES` (10).
Ręcznie: `python scripts/storage_cleanup.py --dry-run` (z `backend/`) — raport JSON bez żadnego zapisu;
bez `--dry-run` robi to samo co pętla. Pierwszy przebieg na produkcji: najpierw `--dry-run`.

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
- Scenariusz e2e „1001. element odrzucony, gumka działa" (wymaga drugiej tablicy w seedzie).
- Płatności (Stripe), nadawanie planu z UI.
