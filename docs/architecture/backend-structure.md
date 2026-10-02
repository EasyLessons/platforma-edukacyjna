# Struktura backendu

FastAPI, moduł per domenę pod `backend/api/v1/`. Każdy moduł ma ten sam kształt: `router.py` (endpointy HTTP), `schemas.py` (Pydantic — kształt request/response), `service.py` (logika biznesowa, oddzielona od routera). Routery są składane w `backend/api/v1/router.py` (`get_v1_router()`, prefix `/api/v1`) i montowane w `backend/main.py`.

## Moduły API (`backend/api/v1/`)

- **auth/** — rejestracja, logowanie, weryfikacja emaila (kod 6-cyfrowy), reset hasła, Google OAuth, refresh/logout, `/me`, `PUT /users/me`. Pełny opis przepływu: `docs/architecture/auth.md`. `dependencies.py` (`get_current_user`), `utils.py` (JWT/hashowanie). `avatar.py` — `POST /users/me/avatar` (własny router, wpięty w `api/v1/router.py`): upload awatara przez backend zamiast z przeglądarki do Supabase (SEC-03). Multipart z polem `file`, wymaga logowania, limit 10 uploadów / 10 min per użytkownik; ciało czytane strumieniowo z limitem 5 MB (413), treść sprawdzana i przekodowywana przez Pillow do WEBP 512 px (`core/image_sanitizer.py`), zapis kluczem `service_role` do bucketu `avatars` pod nazwą `uuid4` z serwera (`core/storage.py`), `avatar_url` ustawia backend, poprzedni plik jest kasowany (best-effort, tylko gdy nie wskazuje na niego inny użytkownik). Kody błędów: `INVALID_UPLOAD`, `INVALID_FILE_TYPE`, `IMAGE_TOO_LARGE` (400), `FILE_TOO_LARGE` (413), `RATE_LIMITED` (429), `STORAGE_NOT_CONFIGURED` (503), `STORAGE_UPLOAD_FAILED` (502), `STORAGE_TIMEOUT` (504).
- **boards/** — CRUD boardu, ulubione, lista userów online (`/online-users`, dane z Redis — patrz `core/presence.py`).
- **workspaces/** — CRUD workspace'u (`GET /workspaces/{id}` zwraca workspace razem z jego boardami — komponuje `BoardService`), ulubione, opuszczanie workspace'u, `authorization.py` (wspólne sprawdzanie członkostwa/roli). Podmoduły: `invites/` (zaproszenia imienne), `members/` (członkowie, role, `my-role`), `share_links/` (linki udostępniania z tokenem: tworzenie, odświeżanie, `join`, podgląd).
- **notifications/** — lista powiadomień, oznaczanie jako przeczytane (pojedynczo/wszystkie), usuwanie, `realtime.py` (wysyłanie eventów Broadcast do frontendu — patrz `pipelines.md`).
- **whiteboard/** — wszystko, co dotyczy jednej tablicy: `POST /{id}/opened` (presence), `GET/PUT /{id}/settings`, elementy w modelu legacy (`POST /{id}/elements/batch`, `GET /{id}/elements`, `DELETE /{id}/elements/{element_id}`), `POST /{id}/upload-image` (Supabase Storage, `storage.py`), oraz endpointy dla serwisu Yjs: `GET/POST /{id}/doc` (snapshot `Y.Doc` w `board_documents`) i `GET /{id}/access` (weryfikacja tokenu, dostępu i roli - `role`, `can_edit` - dla `whiteboard-sync`).
- **assets/** — zapisane szablony/assety użytkownika (`saved_assets`).
- **onboarding/** — `OnboardingService.setup_new_user()`: startowy workspace + domyślna tablica dla nowo zarejestrowanego usera (bez własnego routera, wołany z `auth`).

Poza `api/v1/`: **backend/core/** — `config.py` (Settings z `.env`), `database.py` (połączenie z Postgresem), `models.py` (wszystkie modele SQLAlchemy w jednym pliku), `exceptions.py`, `logging.py`, `responses.py` (wspólny format `ApiResponse[T]`), `presence.py` (kto jest na tablicy — sorted set w Redisie z TTL), `redis_client.py`, `rate_limit.py` (limit prób logowania/rejestracji), `storage.py` (zapis/kasowanie plików w Supabase Storage kluczem `service_role`; brak konfiguracji = 503; na razie używa go tylko upload awatara, `whiteboard/storage.py` ma własną kopię tej logiki), `image_sanitizer.py` (Pillow: tylko JPEG/PNG/WEBP rozpoznane po treści, limit 25 Mpx przeciw „decompression bomb”, przekodowanie do WEBP bez EXIF/ICC), `email/` (klient Resend + szablony `auth`/`workspace`).

Nie istnieją (mimo starszych wzmianek w docs): `backend/auth/`, `backend/dashboard/`. Dashboard nie ma osobnej warstwy agregacji — frontend składa go z `workspaces` i `boards`.

## Serwisy obok FastAPI

- **`whiteboard-sync/`** (osobny katalog w rootcie repo, Node + TypeScript, `@hocuspocus/server` + `@hocuspocus/extension-database`, 3 pliki): serwer WebSocket dla dokumentów Yjs tablicy. Nie ma własnej bazy ani własnej autoryzacji — `auth.ts` woła `GET /api/v1/whiteboard/{id}/access` z tokenem usera; backend zwraca też rolę (`role`, `can_edit`), a viewer dostaje połączenie tylko do odczytu (`connection.readOnly` w Hocuspocus - serwer odrzuca jego zmiany dokumentu, awareness działa). `database.ts` ładuje/zapisuje snapshot przez `GET/POST /api/v1/whiteboard/{id}/doc` **kluczem serwis–serwis** (nagłówek `X-Sync-Service-Token`, porównanie stało-czasowe w `api/v1/whiteboard/dependencies.py`) — token usera służy tylko w `onAuthenticate`, bo wygasa po 15 min trwającego połączenia; zapis ponawiany z backoffem (~5 min), nieudany odczyt odrzuca połączenie zamiast podać pusty dokument. Bez klucza (stare wdrożenie) zapis idzie tokenem usera; zapis tokenem viewera backend odrzuca (403). Port `1234`, env `BACKEND_URL`, `SYNC_SERVICE_TOKEN` (ta sama wartość w backendzie i w whiteboard-sync; wzór w `backend/.env.example` i `whiteboard-sync/.env.example`). Uruchamiany w `docker-compose.yml` jako serwis `whiteboard-sync`. Testy: `npm test` w `whiteboard-sync/` (vitest, `test/`: `auth.ts` z atrapą backendu + test integracyjny na prawdziwym serwerze Hocuspocus); w CI joby `sync-typecheck` i `sync-test`.
- **Redis** — serwis `redis` w compose; używany przez `core/presence.py` (online users) i `core/rate_limit.py`. Testy używają `fakeredis`.
- **Next.js Route Handlers** (`src/app/api/chat`, `src/app/api/contact`) — nie są częścią backendu FastAPI, ale też obsługują requesty (proxy do Gemini, formularz kontaktowy). `chat` uwierzytelnia przez `GET /api/v1/auth/me` na backendzie.

## Model danych (`backend/core/models.py`)

12 tabel. Motyw ogólny: znormalizowane relacje tam gdzie struktura jest stała (users/workspaces/boards), JSONB tam gdzie dane są zmienne kształtem (elementy tablicy, payload powiadomień, ustawienia).

- **User** — konto. `hashed_password` nullable (bo Google OAuth nie ma hasła), `auth_provider` rozróżnia `"email"`/`"google"`. `is_active=False` domyślnie — aktywacja po weryfikacji emaila. `avatar_url`.
- **Workspace** — kontener na boardy. `created_by` → właściciel.
- **WorkspaceMember** — tabela łącząca User↔Workspace (many-to-many) z dodatkowymi atrybutami: `role` (`owner`/`editor`), `is_favourite`, `joined_at`.
- **Board** — należy do workspace'u. `settings` jako JSONB (elastyczna konfiguracja boardu bez migracji schematu przy każdej nowej opcji).
- **BoardUsers** — druga tabela łącząca, na poziomie boardu (nie workspace'u): kto ma dostęp do konkretnego boardu, kiedy ostatnio otwierał. Rozdzielenie dostępu workspace vs. board pozwala w przyszłości dawać dostęp do pojedynczej tablicy bez wpuszczania do całego workspace'u.
- **WorkspaceInvite** — zaproszenie imienne z tokenem, datą wygaśnięcia, flagą użycia. Dwie osobne relacje do `User` (`invited_by`, `invited_id`) — wymaga jawnego `foreign_keys=[...]`.
- **WorkspaceShareLink** — link udostępniania workspace'u (token, rola nadawana przy dołączeniu, wygaśnięcie, możliwość odświeżenia tokenu).
- **BoardElement** — pojedynczy narysowany element w modelu **legacy**. `data` jako JSONB, `is_deleted` — soft delete. Jedyna tabela bez jawnej `relationship()` z powrotem do `Board`. Docelowo zastępowana przez `BoardDocument` (migracja w toku, gałąź `feature/whiteboard-yjs`).
- **BoardDocument** — jeden wiersz na tablicę: `snapshot` (`bytea`) = `Y.encodeStateAsUpdate(doc)`, `updated_at`. Zapisywany przez `whiteboard-sync` przez `POST /{id}/doc`.
- **Notification** — generyczna: `type` + `payload` (JSONB) zamiast osobnej tabeli per typ zdarzenia.
- **RefreshToken** — `token_hash` (nigdy plaintext), `revoked` do unieważniania przy rotacji.
- **SavedAsset** — zapisane grupy elementów tablicy (`elements_data` JSONB) + `thumbnail`.

## Testy

`backend/tests/v1/` odzwierciedla strukturę API (folder per moduł), `backend/tests/core/` testuje `presence` i `email`. `conftest.py` trzyma współdzielone fixtures (baza SQLite in-memory, fakeredis, przykładowi userzy/workspace'y/boardy). Rozdział na `test_*_router.py` (HTTP, przez `TestClient`) i `test_*_service.py` (logika bez HTTP) tam gdzie moduł jest wystarczająco złożony. Stan: 334 testy (21.09.2026). Bez testów: `assets/`, `onboarding/`, `whiteboard/router.py` i `storage.py`, `share_links/router.py` (service ma testy).

## Znane niespójności

- Kilka plików migracji Alembic ma nazwy bez prefiksu hash (`add_google_oauth_to_users.py`, `remove_board_mode_from_boards.py`) — kosmetyczne, revision id jest w środku pliku.
- Deprecacje: `datetime.utcnow()` (10 plików), `@app.on_event` w `main.py`, `class Config` w schematach Pydantic (12) — dają 1811 warningów w pytest; higiena zaplanowana w `REFAKTOR-PLAN.md` (PR-A10).
- Wcześniejsze wpisy o `requirements.txt` w UTF-16 i dwóch bibliotekach JWT są **nieaktualne** — naprawione (patrz `migration-status.md`).
