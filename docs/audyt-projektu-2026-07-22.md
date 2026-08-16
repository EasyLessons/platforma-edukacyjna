# Audyt projektu EasyLesson — lipiec 2026

Przegląd struktury frontendu, backendu i dokumentacji. Dla każdego znaleziska: co jest, dlaczego to problem, i rekomendowana akcja do Twojej akceptacji. Nic z tego nie zostało jeszcze ruszone.

## 1. Dokumentacja

### 1.1 Zdublowany folder dokumentacji projektu (wysoki priorytet)

Folder `EasyLesson - dokumentacja projektu` istnieje w dwóch miejscach: w root projektu i w `docs/EasyLesson - dokumentacja projektu`. Zawartość jest niemal identyczna (diagramy, screenshoty do podręcznika, plik `.tex`), ale wersja w `docs/` jest pełniejsza — ma dodatkowo skompilowany PDF i komplet screenshotów podręcznika użytkownika, których nie ma w wersji root.

**Rekomendacja:** zostawić tylko wersję w `docs/`, usunąć kopię z root. Zero ryzyka utraty danych, bo `docs/` ma nadzbiór plików.

### 1.2 `docs/ai-context/global-context.md` jest nieaktualny (wysoki priorytet)

Ten plik to prompt startowy do wklejania w rozmowy z AI — opisuje stack jako "FastAPI + Supabase (Auth & Realtime)" i wymienia jako _przyszły cel_ zbudowanie dashboardu z CRUD i "połączeniem z bazą Supabase". To już nieprawda: macie osobny dokument `auth-cookie-first-refactor.md` opisujący w pełni działającą autoryzację cookie-first z własnym JWT i refresh-tokenami w Postgresie (potwierdzone w kodzie: tabela `refresh_tokens`, `backend/auth`), a dashboard z pełnym CRUD boardów/workspace'ów już istnieje (`backend/dashboard`, `backend/api/v1/boards`, `backend/api/v1/workspaces`). Supabase w rzeczywistości jest używany wyłącznie do realtime broadcast tablicy (`src/lib/supabase.ts`), nie do auth.

Jeśli używasz tego pliku jako kontekstu startowego dla AI, obecnie wprowadza on błędne założenia o architekturze.

**Rekomendacja:** zaktualizować sekcje "Stack technologiczny" i "Następne cele" — opisać faktyczny model auth (cookie + JWT + refresh rotation) i realny zakres Supabase (tylko realtime), zaktualizować listę zrobionych/kolejnych rzeczy.

### 1.3 Pozostałe pliki w `docs/*.md` — aktualne

Sprawdziłem treść względem kodu: `app-route-groups-refactor.md`, `app-structure.md`, `header-consolidation.md`, `auth-cookie-first-refactor.md` i `docs/ai-context/whiteboard/*` zgadzają się z obecną strukturą (`src/app/(public)`, `(auth)`, `(dashboard)`, `(whiteboard)`, 11 narzędzi tablicy zgodnie z `how-to-add-tool.md`). `testing.md` też pasuje do realnej struktury `backend/tests`. Nic do zmiany.

**Rekomendacja:** brak akcji.

### 1.4 `komendy.txt` w root

Osobisty ściągawka z komend (`venv`, `npm install`, `uvicorn`). Pokrywa się w ~90% z sekcją "Manual setup" w README, które jest już bardziej kompletne (zawiera też `.env` i `alembic upgrade head`).

**Rekomendacja (niski priorytet):** usunąć albo scalić z README, żeby nie było dwóch źródeł prawdy o tym jak odpalić projekt.

## 2. Frontend (`src/`)

### 2.1 Nazwa folderu `src/_new` wprowadza w błąd (średni/wysoki priorytet)

To **nie jest** martwy kod ani porzucona migracja — sprawdziłem importy: `src/_new` (features: auth, board, notifications, whiteboard, workspace + lib/api, lib/auth, lib/errors, shared/ui) jest aktywnie używany w większości tras `src/app` (auth, dashboard, whiteboard) i ma własny alias `@/_new/*` w `tsconfig.json`. To realna, docelowa architektura feature-based, a `src/app` to już tylko cienka warstwa routingu Next.js nad nią.

Problem jest wyłącznie nazewniczy: `_new` sugeruje coś tymczasowego/w budowie, co myli przy onboardingu i utrwala wrażenie "rozjazdu", mimo że architektura jest w porządku. To jest dokładnie to uczucie, o którym pisałeś na początku.

**Rekomendacja:** zmienić nazwę `src/_new` na docelową, np. `src/features` (lub `src/core`), zaktualizować `tsconfig.json` (alias `@/_new/*` → `@/features/*`) i wszystkie importy. To operacja mechaniczna (find & replace na ścieżkach importów), ale dotyka ~120 plików, więc do zrobienia jako jeden dedykowany commit, najlepiej z pomocą skryptu, nie ręcznie.

### 2.2 `src/lib/supabase.ts` — legacy plik w starym stylu, ale żywy

Jedyny plik w `src/lib`. Używany w 4 miejscach (`BoardRealtimeContext`, `VoiceChatContext`, whiteboard page, `BasicInfo.tsx`) plus w dwóch miejscach wewnątrz `src/_new`. Styl pisania (duże bannery-komentarze z emoji) wyraźnie odstaje od czystego stylu plików w `src/_new/lib`.

**Rekomendacja (niski priorytet, po 2.1):** przenieść do `src/features/shared/lib/supabase.ts` (albo odpowiednik po zmianie nazwy z 2.1) i doczyścić komentarze do stylu reszty `_new`, żeby całość `src/lib` przestała istnieć jako osobny, niespójny katalog.

### 2.3 Pusty, martwy folder `src/app/dashboard`

To pozostałość po refaktorze na route groups (`f8f07b9 refactor(frontend): reorganize app into route groups`) — realna trasa dashboardu to teraz `src/app/(dashboard)/dashboard`. Folder `src/app/dashboard` jest całkowicie pusty (0 plików), nie jest przez nic importowany ani routowany.

**Rekomendacja:** usunąć folder. Zero ryzyka, jest pusty.

## 3. Backend

### 3.1 Struktura — solidna, bez większych zastrzeżeń

`backend/api/v1` (auth, boards, workspaces, notifications, whiteboard, assets), `backend/core` (config, database, models, exceptions, logging, responses), `backend/dashboard`, `backend/auth`, migracje w `alembic/versions`, testy w `backend/tests/v1` odzwierciedlające strukturę API 1:1. To jest czytelny, konwencjonalny układ FastAPI — nie widzę tu potrzeby reorganizacji.

### 3.2 Ważne koncepty w bazie danych

Schemat w `backend/core/models.py` (10 tabel) — warto żebyś miał to w głowie jako mapę domeny:

- **User** — konto użytkownika. Obsługuje zarówno logowanie hasłem, jak i Google OAuth (`hashed_password` nullable, `google_id`, `auth_provider`).
- **Workspace / WorkspaceMember** — workspace to kontener na boardy, `WorkspaceMember` to tabela łącząca (many-to-many User↔Workspace) z rolą (`owner`/`editor`). Klasyczny wzorzec join table z dodatkowymi atrybutami relacji (rola, `is_favourite`, `joined_at`).
- **Board / BoardUsers** — board (tablica) należy do workspace'u. `BoardUsers` to druga tabela łącząca — śledzi kto ma dostęp do konkretnego boardu, czy jest online (`is_online`) i kiedy ostatnio otwierał (`last_opened`). To rozdzielenie (dostęp na poziomie workspace vs. na poziomie boardu) to sensowny projekt, jeśli chcecie kiedyś dawać dostęp do pojedynczej tablicy bez wpuszczania do całego workspace'u.
- **BoardElement** — pojedynczy element narysowany na tablicy (path, rect, text...). Dane trzymane w kolumnie `JSONB` (`data`) zamiast osobnych kolumn na typ — to świadomy wybór "schema-on-read": elastyczność kosztem braku walidacji na poziomie bazy. Ma `is_deleted` (soft delete) zamiast twardego usuwania, co ma sens pod undo/redo. Warto wiedzieć: ta tabela jako jedyna nie ma zdefiniowanej relacji SQLAlchemy (`relationship`) z powrotem do `Board` — działa, bo zapytania idą raczej po `board_id` bezpośrednio, ale to niespójność względem reszty modeli, gdzie relacje są wszędzie jawne.
- **WorkspaceInvite** — zaproszenia z tokenem, datą wygaśnięcia i flagą użycia. Ma dwie osobne relacje do `User` (`invited_by`, `invited_id`) — to wzorzec "dwie FK do tej samej tabeli", trzeba pamiętać o jawnym `foreign_keys=[...]` przy każdej, inaczej SQLAlchemy nie wie którą użyć (macie to zrobione poprawnie).
- **Notification** — generyczna tabela powiadomień z `type` + `payload` (JSONB) zamiast osobnej tabeli na każdy typ zdarzenia. Dobrze się skaluje przy dodawaniu nowych typów powiadomień bez migracji schematu.
- **RefreshToken** — trzyma tylko hash tokenu (`token_hash`), nigdy plaintext, plus `revoked` do unieważniania przy rotacji. To dokładnie odpowiada opisowi w `auth-cookie-first-refactor.md`.
- **SavedAsset** — zapisane szablony/grupy elementów tablicy użytkownika, też jako JSONB.

Ogólny motyw: dużo świadomego użycia JSONB tam, gdzie struktura danych jest zmienna (elementy tablicy, payload powiadomień, ustawienia boardu) i klasyczne znormalizowane tabele tam, gdzie relacje są stałe (users, workspaces, boards). To dobry, przemyślany kompromis, nie coś do poprawiania.

**Rekomendacja:** rozważyć dodanie `relationship("Board", back_populates=...)` do `BoardElement` dla spójności z resztą modeli — kosmetyczne, niski priorytet, nie blokuje niczego.

### 3.3 Nazewnictwo plików migracji Alembic jest niespójne (niski priorytet)

Większość plików w `alembic/versions` ma format `<hash>_<opis>.py` (auto-generowany), ale dwa (`add_google_oauth_to_users.py`, `remove_board_mode_from_boards.py`) nie mają prefiksu hash w nazwie pliku. Nie wpływa to na działanie (Alembic trzyma się `revision`/`down_revision` w treści pliku, nie nazwy), ale utrudnia skanowanie wzrokiem chronologii migracji.

**Rekomendacja:** kosmetyczna, można zostawić — realnie nie warto ręcznie przepisywać nazw plików migracji ze względu na ryzyko pomyłki w referencjach.

### 3.4 Lokalne artefakty w `backend/` (niski priorytet, nie trafiają do gita)

`backend/.venv`, `backend/__pycache__`, `backend/logs/*.log` — wszystkie poprawnie objęte `.gitignore` (`.venv/`, `__pycache__/`, `*.log`), więc to nie problem repozytorium, tylko lokalny bałagan na dysku. Wspominam tylko dlatego, że pytałeś o "wszystko na odpowiednim miejscu" — jeśli chcesz, mogę je skasować lokalnie, ale odtworzą się przy następnym `pip install`/uruchomieniu serwera.

**Rekomendacja:** brak akcji potrzebnej — to nieszkodliwe.

## Podsumowanie priorytetów

Wysoki priorytet: 1.1 (duplikat docs), 1.2 (nieaktualny global-context.md), 2.1 (przemianowanie `src/_new`).
Średni: 2.2 (przeniesienie supabase.ts), 2.3 (pusty folder — trywialne, ale szybkie).
Niski/kosmetyczny: 1.4, 3.2 (relacja BoardElement), 3.3 (nazwy migracji), 3.4 (lokalne artefakty).

Daj znać które punkty mam wdrożyć — mogę iść po kolei i pokazywać diff/wynik przed każdym kolejnym.
