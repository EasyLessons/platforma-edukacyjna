# Struktura backendu

FastAPI, moduł per domenę pod `backend/api/v1/`. Każdy moduł ma ten sam kształt: `router.py` (endpointy HTTP), `schemas.py` (Pydantic — kształt request/response), `service.py` (logika biznesowa, oddzielona od routera).

## Moduły API (`backend/api/v1/`)

- **auth/** — rejestracja, logowanie, weryfikacja emaila (kod 6-cyfrowy), reset hasła, Google OAuth, refresh/logout, `/me`, wyszukiwanie userów. Pełny opis przepływu: `docs/architecture/auth.md`.
- **boards/** — CRUD boardu, dołączanie do boardu, ulubione, ustawienia boardu, lista członków boardu.
- **workspaces/** — CRUD workspace'u, `/init` (dane startowe dashboardu), ulubione, ustawienie aktywnego workspace'u, opuszczanie workspace'u. Plus podmoduły: `invites_router.py`/`invites_service.py` (zaproszenia), `members_router.py`/`members_service.py` (członkowie), `realtime.py` (wysyłanie eventów Broadcast do frontendu — patrz `pipelines.md`).
- **notifications/** — lista powiadomień, oznaczanie jako przeczytane (pojedynczo/wszystkie), usuwanie.
- **whiteboard/** — endpointy związane z elementami tablicy (`board_elements`).
- **assets/** — zapisane szablony/assety użytkownika (`saved_assets`).

Poza `api/v1/`: **backend/core/** (config, database — połączenie z Postgresem, models — wszystkie modele SQLAlchemy w jednym pliku, exceptions, logging, responses — wspólny format `ApiResponse[T]`), **backend/auth/** (niskopoziomowe funkcje JWT/hashowania używane przez `api/v1/auth`), **backend/dashboard/** (agregacja danych do widoku dashboardu).

## Model danych (`backend/core/models.py`)

10 tabel. Motyw ogólny: znormalizowane relacje tam gdzie struktura jest stała (users/workspaces/boards), JSONB tam gdzie dane są zmienne kształtem (elementy tablicy, payload powiadomień, ustawienia).

- **User** — konto. `hashed_password` nullable (bo Google OAuth nie ma hasła), `auth_provider` rozróżnia `"email"`/`"google"`. `active_workspace_id` — który workspace user ma aktualnie otwarty w UI. `is_active=False` domyślnie — aktywacja po weryfikacji emaila.
- **Workspace** — kontener na boardy. `created_by` → właściciel.
- **WorkspaceMember** — tabela łącząca User↔Workspace (many-to-many) z dodatkowymi atrybutami: `role` (`owner`/`editor`), `is_favourite`, `joined_at`.
- **Board** — należy do workspace'u. `settings` jako JSONB (elastyczna konfiguracja boardu bez migracji schematu przy każdej nowej opcji).
- **BoardUsers** — druga tabela łącząca, na poziomie boardu (nie workspace'u): kto ma dostęp do konkretnego boardu, czy jest online (`is_online`), kiedy ostatnio otwierał. Rozdzielenie dostępu workspace vs. board pozwala w przyszłości dawać dostęp do pojedynczej tablicy bez wpuszczania do całego workspace'u.
- **WorkspaceInvite** — zaproszenie z tokenem, datą wygaśnięcia, flagą użycia. Dwie osobne relacje do `User` (`invited_by`, `invited_id`) — wymaga jawnego `foreign_keys=[...]` przy każdej, bo SQLAlchemy nie zgadnie która FK do której relacji.
- **BoardElement** — pojedynczy narysowany element. `data` jako JSONB (typ zależny od `type`: "path", "rect", "text"...). `is_deleted` — soft delete, potrzebny pod undo/redo (twarde usunięcie zepsułoby historię). Jedyna tabela bez jawnej `relationship()` z powrotem do `Board` — działa przez bezpośrednie zapytania po `board_id`, ale to niespójność względem reszty modeli.
- **Notification** — generyczna: `type` + `payload` (JSONB) zamiast osobnej tabeli per typ zdarzenia. Nowy typ powiadomienia = nowa wartość `type`, zero migracji.
- **RefreshToken** — `token_hash` (nigdy plaintext), `revoked` do unieważniania przy rotacji.
- **SavedAsset** — zapisane grupy elementów tablicy (`elements_data` JSONB) + `thumbnail`.

## Testy

`backend/tests/v1/` odzwierciedla strukturę API 1:1 (folder per moduł). `conftest.py` trzyma współdzielone fixtures (baza testowa, przykładowi userzy/workspace'y/boardy). Rozdział na `test_*_router.py` (HTTP, przez `httpx`) i `test_*_service.py` (logika biznesowa bez HTTP) tam gdzie moduł jest wystarczająco złożony (boards, workspaces, notifications).

## Znane niespójności (patrz też `docs/migration-status.md`)

`requirements.txt` zapisany w UTF-16 zamiast UTF-8 — ryzyko błędu przy `pip install` zależnie od locale systemu. Dwie biblioteki JWT jednocześnie (`python-jose` + `PyJWT`) — do ujednolicenia. Kilka plików migracji Alembic ma niestandardowe nazwy (bez prefiksu hash) — kosmetyczne, nie wpływa na działanie.
