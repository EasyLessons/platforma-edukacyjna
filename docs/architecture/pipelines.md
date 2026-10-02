# Pipeliny — jak dane przepływają przez system

Dla każdej ważnej operacji: skąd do dokąd leci dane, i które pliki ruszać przy zmianie. Cel: przy zgłoszeniu buga albo nowej funkcji od razu wiadomo w którym miejscu łańcucha szukać.

## 1. Logowanie / sesja

```
UI (LoginForm, src/_new/features/auth/components/loginForm.tsx)
  → useLogin hook (src/_new/features/auth/hooks/useLogin.ts)
  → authApi.ts (POST /login)
  → backend/api/v1/auth/router.py → service.py
  → sprawdzenie hasła (passlib/bcrypt) → wystawienie access token (JWT) + refresh token (cookie HttpOnly)
  → AuthContext.login() (src/_new/lib/auth/AuthContext.tsx) zapisuje access token in-memory
  → redirect na /dashboard
```

Pełny opis stanów i rotacji tokenów: `docs/architecture/auth.md`.

## 2. Synchronizacja tablicy (realtime, client-to-client)

```
User A rysuje na Canvas
  → WhiteboardEngine (facade, src/_new/features/whiteboard/engine) wykonuje Command
  → element dodany lokalnie (optymistycznie, natychmiastowy feedback)
  → BoardRealtimeContext (src/app/context/BoardRealtimeContext.tsx) wysyła Broadcast
    przez Supabase (kanał "board:{board_id}")
  → User B/C na tej samej tablicy odbierają event przez Supabase Realtime
  → element dodawany do ich lokalnego stanu (bez przeładowania strony)
  → osobno: zmiana persystowana do Postgresa przez backend/api/v1/whiteboard
    (żeby przetrwała reload/nowego usera dołączającego później)
```

Presence (kto jest online na tablicy, kursory innych userów) — ten sam kanał Supabase, mechanizm Presence zamiast Broadcast.

Powyższe to ścieżka **legacy** (aktywna, gdy `NEXT_PUBLIC_WHITEBOARD_YJS` nie jest `true`). Logika broadcastu elementów siedzi w `src/_new/features/whiteboard/realtime/useElementSync.ts`, stan w `hooks/use-elements.ts`, REST w `api/elements-api.ts`; `BoardRealtimeContext` (390 linii, `src/app/context`) tylko spina hooki z kanałem.

### 2b. Synchronizacja tablicy — ścieżka Yjs (za flagą `NEXT_PUBLIC_WHITEBOARD_YJS=true`)

```
User A rysuje na Canvas
  → WhiteboardEngine wykonuje Command → mutacja Y.Doc (hooks/use-yjs-board.ts → yjs/board-doc.ts)
  → HocuspocusProvider (yjs/use-yjs-sync.ts) wysyła update CRDT po WebSocket
    do serwisu whiteboard-sync (whiteboard-sync/src/index.ts, port 1234)
  → whiteboard-sync przy pierwszym połączeniu z dokumentem:
      · onAuthenticate: GET /api/v1/whiteboard/{id}/access z tokenem usera (auth.ts)
      · Database.fetch: GET /api/v1/whiteboard/{id}/doc → snapshot z tabeli board_documents (database.ts)
  → serwis rozsyła update do pozostałych klientów tego dokumentu (User B/C)
  → Database.store (debounce Hocuspocusa): POST /api/v1/whiteboard/{id}/doc → snapshot do Postgresa
```

Presence/kursory/typing/follow nadal idą przez Supabase (pkt 2) — Yjs zastępuje tylko synchronizację i persystencję elementów. Undo/redo w tej ścieżce to `Y.UndoManager`. Migracja danych `board_elements → board_documents` i wyłączenie ścieżki legacy: gałąź `feature/whiteboard-yjs`.

#### Kopia lokalna (IndexedDB) i edycja offline

Każda prawdziwa tablica zalogowanego użytkownika ma kopię `Y.Doc` w IndexedDB przeglądarki (`y-indexeddb`), baza `easylesson-wb-v{CACHE_VERSION}-u{userId}-b{boardId}`. Demo i goście — bez kopii.

```
Wejście na tablicę
  → useYjsLocalCache (yjs/use-yjs-local-cache.ts): IndexeddbPersistence wczytuje kopię do Y.Doc
      (timeout 1,5 s — bez odpowiedzi IndexedDB działamy bez kopii)
  → dopiero potem useYjsSync łączy HocuspocusProvider (enabled = isReady)
      provider wysyła wektor stanu, serwer odsyła tylko różnicę; lokalne zmiany offline idą w tej samej wymianie
  → każda zmiana Y.Doc (lokalna i z serwera) zapisuje się też do IndexedDB (kompaktowanie co 500 wpisów)
```

- **Kolejność jest krytyczna**: provider wysyła na serwer każdą aktualizację, której nie jest źródłem. Połączony przed wczytaniem kopii wysyłałby całą kopię przy każdym wejściu.
- **Treść z kopii jest widoczna od razu** (overlay tylko, gdy nie ma ani kopii, ani synchronizacji); edycja działa także bez połączenia. Status: `StatusIndicators` („Synchronizacja…”, „Offline”).
- **Rejestr i limity** (`src/_new/lib/board-cache/board-cache.ts`, localStorage, bez treści): 10 tablic (LRU) i 14 dni od ostatniego otwarcia; nigdy nie usuwamy bieżącej tablicy ani tablic `dirty` (lokalne zmiany niepotwierdzone przez serwer — `unsyncedChanges` providera).
- **Czyszczenie**:
  - ręczne wylogowanie → wszystkie kopie (przy `dirty` najpierw ostrzeżenie),
  - wymuszone wylogowanie (odrzucony refresh) → wszystkie poza `dirty`,
  - zalogowanie innego konta → kopie innych użytkowników (także `dirty`),
  - odmowa dostępu (`access-denied` z whiteboard-sync albo 403/404 z `GET /boards/{id}`) → kopia tej tablicy.
- **Brak sieci ≠ wylogowanie**: refresh bez odpowiedzi albo z 5xx rzuca `RefreshUnavailableError` (`lib/auth/refresh-error.ts`) — błąd sieci, sesja zostaje. Wylogowanie tylko przy odmowie serwera (4xx).
- **Powody odmowy z whiteboard-sync** (`whiteboard-sync/src/auth.ts`): `token-expired` (refresh + ponowienie), `server-unavailable` (ponowienie z odstępem 2/5/10/30 s), `access-denied` (koniec + usunięcie kopii). Hocuspocus po odmowie rozłącza się na stałe — ponawia `useYjsSync`.
- **Obrazy offline**: upload do Storage wymaga sieci → `ImageUploadOfflineError` i toast; reszta tablicy działa.
- **`CACHE_VERSION`** (`board-cache.ts`) to wyłącznik awaryjny: podbicie + deploy = klienci usuwają stare kopie (patrz `known-issues.md` #7).

### 2c. Obrazy tablicy — silnik Excalidraw (za flagą `NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw`)

Obraz wklejony lub wrzucony na tablicę Excalidraw **nie trafia do `Y.Doc` jako dataURL** (snapshot `board_documents` puchł) — plik leży w Supabase Storage, w dokumencie jest samo odwołanie. Stary silnik (`upload-image`, publiczny bucket `board-images`) działa jak dotąd.

```
User A wkleja / wrzuca obraz (Excalidraw sam zmniejsza do 1440 px, odrzuca > 4 MB)
  → obraz widać lokalnie od razu; element-obraz NIE idzie do Y.Doc (files/board-file-sync.ts: shareable)
  → POST /api/v1/whiteboard/{id}/files (multipart, pole `file`)             backend: whiteboard/files.py
      · can_edit (viewer 403, nie-członek 404), limit 5 MB czytany strumieniowo (413)
      · typ po TREŚCI, przekodowanie do WEBP max 1600 px (core/image_sanitizer.py; GIF → pierwsza klatka)
      · zapis kluczem service_role do PRYWATNEGO bucketu `board-files` pod `{board_id}/{uuid hex}.webp`
        (nazwa z serwera; bucket tworzony przy pierwszym uploadzie - core/storage.py: ensure_bucket)
  → wpis w Y.Map `excalidraw-files`: { id, mimeType, created, ref: { v: 1, name: "<32 hex>.webp" } }
  → dopiero teraz element-obraz trafia do Y.Doc (whiteboard-sync rozsyła go jak każdy inny)
User B (także viewer) dostaje wpis z `ref`
  → GET /api/v1/whiteboard/{id}/files/{name} przez apiClient (token; backend sprawdza członkostwo
    i wydaje plik z prywatnego bucketu: image/webp, nosniff, Cache-Control: private)
  → blob → dataURL tylko w pamięci karty → api.addFiles
```

- **Format wpisu pliku** (`yjs/excalidraw-binding.ts`): odwołanie `{ id, mimeType, created, ref: { v: 1, name } }` albo inline `{ id, mimeType, dataURL, created }`. Czytane są **oba** — inline zostaje dla SVG wykresów f(x), tablic bez serwera (demo, gość) i wpisów sprzed tej zmiany.
- **`ref.name` pochodzi od innych edytorów**, więc przed wstawieniem do adresu jest sprawdzane wzorcem `^[0-9a-f]{32}\.webp$` (front: `files/board-file-api.ts`, backend: `files.py`). Ścieżkę w buckecie backend składa z `board_id` z URL-a, dla którego sprawdził dostęp — nie da się sięgnąć po plik innej tablicy.
- **Błędy wysyłki**: sieć/5xx/429 → 3 ponowienia (1 s, 3 s, 8 s); potem (albo od razu przy 400/403/409/413) element jest usuwany lokalnie i pojawia się komunikat. Bez sieci plik czeka na zdarzenie `online`. Pliki z odbioru nie są wysyłane ponownie.
- **Storage niedostępny**: brak `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` albo bucketu nie da się utworzyć → `503 STORAGE_NOT_CONFIGURED`; front zapisuje wtedy obraz po staremu (dataURL w `Y.Doc`) i loguje błąd. Backend **nigdy** nie przełącza się na bucket publiczny. Wtedy trzeba ręcznie utworzyć prywatny bucket `board-files` (Supabase → Storage).
- **Bucket istnieje, ale jest publiczny** (np. utworzony ręcznie): przed pierwszym uploadem w procesie backend pyta `GET /storage/v1/bucket/board-files` (`core/storage.py: _bucket_is_public`). `public: true` → log ERROR + ten sam `503 STORAGE_NOT_CONFIGURED` (ponowne sprawdzenie najwcześniej po 60 s, więc po przestawieniu bucketu na prywatny upload wraca bez restartu). `public: false` jest pamiętane do końca procesu. Gdy samego sprawdzenia nie da się wykonać (sieć, 5xx), upload **nie** jest blokowany, a sprawdzenie powtarza się przy następnym.
- **Limity uploadu** (`whiteboard/files.py`, wszystko PRZED czytaniem ciała): 60/min na IP i 30/min na konto (`429 RATE_LIMITED`); najwyżej 4 uploady w toku w procesie (`503 UPLOAD_BUSY`) i 2 na konto (`429 TOO_MANY_UPLOADS`), oba z `Retry-After` — to ogranicza z góry szczyt pamięci (ok. 4 × 15 MB + jedno dekodowanie ~145 MB) i kolejkę przed semaforem dekodowania wspólnym z awatarami. Front wysyła najwyżej 2 obrazy naraz i traktuje 429/503 jako błąd przejściowy (ponowienia). Pobieranie: 600/min na konto. Limity w Redis są fail-open.
- **Quota tablicy (miękka)**: 300 plików / 100 MB na tablicę → `409 BOARD_FILE_QUOTA_EXCEEDED` (komunikat na froncie, bez ponowień). Licznik siedzi w Redis (`board_files:{id}:count|bytes`), rośnie po udanym zapisie i znika przy usunięciu tablicy.
- **SVG**: inline zostają tylko SVG wykresów f(x) (id pliku `fn-<hash>`). SVG wklejony przez użytkownika na tablicy z serwerem jest odrzucany z komunikatem (backend przyjmuje wyłącznie rastry); na tablicy demo/gościa zostaje inline jak dotąd.
- **Usunięcie tablicy** kasuje folder `{board_id}/` w `board-files` (`boards/service.py` → `files.delete_board_files`, listowanie stronami po 1000).

Znane ograniczenia:

- **Sieroty**: plik skasowanego elementu zostaje w Storage do usunięcia tablicy (cofnięcie / tombstone mogą przywrócić element, więc plików nie kasujemy pojedynczo).
- **Sieroty po usunięciu całego workspace'u**: `DELETE /workspaces/{id}` kasuje tablice kaskadą w bazie i **nie** woła `delete_board_files` (ani `delete_board_folder` starego silnika) — foldery `{board_id}/` tych tablic zostają w `board-files`. Bucket jest prywatny, a `board_id` nie jest używane ponownie, więc pliki są niedostępne, ale zajmują miejsce; do sprzątnięcia ręcznie albo osobnym zadaniem (lista `board_id` przed kaskadą + `delete_board_files` dla każdej).
- **Quota tablicy nie jest rozliczeniem**: po utracie danych Redis licznik startuje od zera, równoległe uploady mogą przekroczyć limit o kilka plików, a awaria Redis wyłącza limit. Nie ma limitu łącznego na konto ani workspace.
- **Limit uploadów w toku jest na proces**: zakłada jeden proces backendu (to samo założenie co semafor dekodowania w `auth/avatar.py`); przy wielu workerach każdy miałby własny licznik.
- **Flaga `public` bucketu jest sprawdzana raz na proces**: przestawienie działającego bucketu na publiczny zostanie wykryte dopiero po restarcie backendu.
- **Zamknięcie karty przed końcem wysyłki** = obraz przepada (istniał tylko lokalnie, nie było go jeszcze w `Y.Doc`).
- **Brak leniwej migracji**: stare wpisy z dataURL zostają w dokumencie; nowe obrazy idą już do Storage.
- **Brak limitu rozmiaru snapshotu** po stronie `/doc` i `whiteboard-sync`; front tylko loguje ostrzeżenie, gdy plik inline > 200 KB.
- Ruch obrazów idzie przez backend (proxy), nie bezpośrednio ze Storage; przeglądarka trzyma plik w prywatnym cache.

## 3. Powiadomienia (np. zaproszenie do workspace'u)

To jest inny pipeline niż tablica: tu event **inicjuje backend**, nie frontend drugiego usera.

```
User A zaprasza User B do workspace'u
  → POST /workspaces/{id}/invites (backend/api/v1/workspaces/invites/router.py)
  → invites/service.py: tworzy wiersz WorkspaceInvite (token, expires_at) w Postgresie
  → tworzy wiersz Notification (type="invite", payload={workspace_id, inviter_name, invite_token...})
  → wywołuje broadcast_notification() (backend/api/v1/notifications/realtime.py)
    → uderza w Supabase REST API (/realtime/v1/api/broadcast)
    → Supabase pushuje event przez WebSocket na kanał "notifications:{user_b_id}"
  → frontend User B: useNotifications hook (src/_new/features/notifications) odbiera event
    natychmiast (bez pollingu) i pokazuje badge/toast
  → User B klika → GET /invite/{token} (src/app/(dashboard)/invite/[token]/page.tsx)
    → akceptacja: POST akceptujący, tworzy WorkspaceMember, oznacza invite jako used
```

Kanały są per-user (`notifications:{user_id}`) — jeden user nie widzi eventów innego.

## 4. AI Assistant (chat)

```
UI chatu (whiteboard, math-chatbot.tsx) → POST /api/chat z nagłówkiem Authorization: Bearer <access token>
  (przy 401 czat raz odświeża token i ponawia — jak interceptor apiClient)
  → Next.js Route Handler src/app/api/chat/route.ts — NIE FastAPI (cienki handler; logika w src/_new/server/chat)
  → sprawdzenie rate limitu (Map w pamięci, per IP: 20 req/min, blokada 2 min po przekroczeniu)
  → uwierzytelnienie (src/_new/server/chat/auth.ts): token przekazany do GET /api/v1/auth/me
    na backendzie — ta sama weryfikacja co get_current_user (podpis, wygaśnięcie, is_active)
    · 401/403/404 z backendu → 401 "unauthorized"
    · backend nieosiągalny / 5xx / timeout 5 s → 503 "auth_unavailable" (fail closed — NIE wpuszczamy)
  → walidacja body
  → sprawdzenie cache odpowiedzi (Map w pamięci, TTL 30 min) — cache jest ZA bramką
  → jeśli brak w cache: wywołanie Gemini (@google/generative-ai), model gemini-2.5-flash,
    fallback na gemini-2.5-flash-lite przy przekroczeniu limitu
  → zapis do cache, zwrot odpowiedzi do UI
```

**Adres backendu z serwera Next:** `auth.ts` używa `BACKEND_INTERNAL_URL`, a gdy jest pusty — `NEXT_PUBLIC_API_URL`. Na Vercelu wystarcza ten drugi (publiczny adres backendu). W docker-compose nie: tam `NEXT_PUBLIC_API_URL=http://localhost:8000`, a z wnętrza kontenera frontendu `localhost` to sam frontend — dlatego compose ustawia `BACKEND_INTERNAL_URL=http://backend:8000`. Bez tego czat w Dockerze zwraca 503.

**Ograniczenie architektoniczne do znajomości:** rate limiting i cache trzymane są w zwykłym `Map` w pamięci procesu Next.js. Działa poprawnie tylko dopóki appka działa na jednej, długo żyjącej instancji serwera. Jeśli kiedyś przejdziecie na wdrożenie serverless/edge (wiele instancji, cold starty) albo horizontal scaling — ten mechanizm przestanie działać poprawnie (każda instancja ma swoją osobną mapę) i trzeba będzie przenieść na współdzielony store (np. Redis). Nie problem dziś, ale ważne żeby wiedzieć zanim ktoś zmieni sposób hostingu.

## 5. Voice chat (WebRTC)

Dwie ścieżki: **Daily** (decyzja 02.10.2026, docelowa — backend opisany w 5a; frontend w osobnym PR) i dotychczasowy własny WebRTC + Xirsys (opis niżej, zostaje do czasu usunięcia).

### 5a. Rozmowa przez Daily — backend

Wymaganie twarde (Patryk, 02.10.2026): **żadnych rachunków — nikt nie może przepalić darmowej puli Daily** (10 000 minut uczestnika / mies., potem płatne bez twardego limitu po stronie Daily). Zasada przy każdej wątpliwości: **fail closed** (brak rozmowy jest tańszy niż rachunek). Kod: `backend/api/v1/whiteboard/` — `call.py` (przepływ, pokój, token), `call_guard.py` (limity lokalne w Redis: rate limit, blokada tworzącego, budżet dzienny, rejestr pokoi), `call_usage.py` (zużycie z Daily, próg miesięczny, endpoint admina), `daily_client.py` (transport HTTP).

**Krok 1 przed wpisaniem `DAILY_API_KEY` na produkcji: ustaw `CALL_ALLOWED_USER_IDS` na swoje id użytkownika** (i `CALL_ADMIN_USER_IDS`, żeby widzieć zużycie). Pusta lista = pokoje może tworzyć KAŻDY właściciel przestrzeni (tak chce zlecenie; backend loguje wtedy WARNING przy pierwszym użyciu). Dopiero potem klucz.

```
Przeglądarka → POST /api/v1/whiteboard/{board_id}/call (JWT usera, bez body)
  1. JWT + zweryfikowany e-mail (get_current_user; niezweryfikowany = 403)
  2. członkostwo w workspace tablicy (zapytania SQL w threadpoolu, sesja oddana do puli) — brak = 404, zero wywołań Daily
  3. CALL_ENABLED=false → 503 VOICE_DISABLED;  pusty / nienadający się do nagłówka DAILY_API_KEY → 503 VOICE_NOT_CONFIGURED
  4. rate limit 10/min na użytkownika (każde żądanie) → 429 RATE_LIMITED;  awaria Redis → 503 VOICE_GUARD_UNAVAILABLE

  DOŁĄCZAJĄCY (editor / viewer / właściciel spoza CALL_ALLOWED_USER_IDS) — zero zapisów w Daily:
  5. pokój tablicy w rejestrze (Redis)?  brak → 409 VOICE_CALL_NOT_STARTED;  kończy się za < 6 min → 409 VOICE_CALL_ENDING
     (odmowa LOKALNA: zero wywołań Daily, nie zużywa limitu IP;  właściciel spoza listy: 403 VOICE_CREATE_NOT_ALLOWED)
  6. próg miesięczny (niżej) → 429 VOICE_MONTHLY_LIMIT / 503 VOICE_USAGE_UNAVAILABLE
  7. GET /rooms/<prefix>-board-<id>: pokój musi spełniać wymogi, inaczej 409
  8. limit 30/h na IP (liczy wydane tokeny) → POST /meeting-tokens → 200 { room_url, token, expires_at }

  TWORZĄCY (twórca workspace'u z rolą owner, dopuszczony przez CALL_ALLOWED_USER_IDS):
  5. limit 30/h na IP (liczy próby tworzenia) → blokada na tworzącego (jedna operacja naraz; równoległe żądanie
     czeka do 10 s, potem 429 VOICE_CALL_BUSY) → próg miesięczny
  6. rozliczenie zakończonych pokoi tworzącego (budżet dzienny);  żywy pokój na INNEJ tablicy jest kończony
  7. pokój tej tablicy: brak / wygasa / niezgodny → nowy;  zgodny bez naszego wpisu → przejęcie (płatne z budżetu);
     pusty i starszy niż 10 min → rozliczony i zastąpiony nowym;  kończy się za < 15 min → przedłużenie
     Nowy pokój: wpis do budżetu i rejestru PRZED wywołaniem Daily → ponowne sprawdzenie progu → sprzątanie → POST /rooms;
     nieudane tworzenie kasuje pokój (best effort) i cofa wpisy tylko, gdy pokoju na pewno nie ma
  8. POST /meeting-tokens → 200 { room_url, token, expires_at }   (Cache-Control: no-store)

GET /api/v1/whiteboard/call/usage — tylko id z CALL_ADMIN_USER_IDS (domyślnie nikt, 403): stan, zużycie, rezerwacje, próg, liczba pokoi.
```

**Model zagrożeń i co na niego odpowiada**

| Zagrożenie | Zabezpieczenia |
| --- | --- |
| (a) ktoś zakłada konta / przejmuje konto i odpala rozmowy | pokój tworzy tylko twórca workspace'u ze zweryfikowanym e-mailem, tylko id z `CALL_ALLOWED_USER_IDS` (gdy ustawiona); blokada na tworzącego = najwyżej jeden żywy pokój naraz; dzienny budżet `CALL_USER_DAILY_MINUTES_CAP`; próg miesięczny z rezerwacją pełnego czasu życia pokoju; rate limit; `CALL_ENABLED=false` wyłącza wszystko natychmiast |
| (b) ktoś wielokrotnie używa / rozdaje tokeny | token ważny 5 min i tylko na wejście, przypięty do jednego pokoju (`room_name`), pokój prywatny z `max_participants` (domyślnie 4) — rozdany token nie wpuści więcej osób naraz niż limit pokoju, a cały pokój (czas życia × limit osób) jest z góry odjęty od puli miesięcznej; `eject_after_elapsed` kończy pobyt najpóźniej z `exp` pokoju; nikt nie jest adminem ani właścicielem spotkania |
| (c) zapomniane lub celowo wiszące pokoje | `exp` ≤ 3 h (sufit w kodzie, domyślnie 90 min) + `eject_at_room_exp`; dołączający nie przesuwa `exp`; przedłużenie tylko przez tworzącego i tylko z budżetu; wygasłe pokoje kasowane przy tworzeniu nowego; każdy pokój liczony do progu w najgorszym przypadku (pełny pokój od utworzenia do `exp`) |
| (d) wyciek `DAILY_API_KEY` | **omija backend — żaden z powyższych bezpieczników wtedy nie działa.** Klucz jest tylko w env backendu (`SecretStr`: nie ma go w `repr(Settings)`), nie trafia do odpowiedzi ani logów (test przeszukuje wszystkie odpowiedzi i logi). Jedyna obrona po wycieku: rotacja klucza (niżej) i ustawienia konta Daily |

**Punkty zlecenia 1–10**

1. **Kto zaczyna**: zalogowany, zweryfikowany e-mail, członek tablicy. Tworzy tylko właściciel przestrzeni (`Workspace.created_by` + rola `owner`). `CALL_ALLOWED_USER_IDS` (id po przecinku): niepusta = tworzą tylko wymienieni; puste segmenty (`"1,"`) są pomijane; każdy niepusty segment nie do sparsowania (albo sama interpunkcja) = nikt (fail closed, log ERROR, start backendu bez zmian). Pusta = każdy właściciel + WARNING w logu. Pozostali tylko dołączają do pokoju z rejestru.
2. **Wyłącznik**: `CALL_ENABLED` (domyślnie `true`; wartość nierozpoznana = wyłączone).
3. **Próg miesięczny** `DAILY_MONTHLY_MINUTES_CAP` (domyślnie 8000, sufit w kodzie 9500). Token (także dla dołączającego) jest wydawany tylko, gdy `zużycie + rezerwacje ≤ próg`:
   - **zużycie** — `GET /meetings` od początku miesiąca (UTC), strony czytane **do pustej strony** (pole `total_count` nie kończy czytania; służy tylko do wykrycia braków), suma `participants[].duration`, każdy uczestnik zaokrąglony w górę do minuty. Spotkanie trwające: na uczestnika `max(duration, teraz − join_time)`. Pusta lista uczestników przy `duration` spotkania > 0: `duration × max(szczyt, limit osób)`. Cache 5 min w Redis (bez Redis — w pamięci procesu); wpis cache z wartością ujemną, nieliczbową, z przyszłości albo o złym kształcie jest odrzucany.
   - **rezerwacje** — każdy pokój z rejestru (`call:rooms`) rezerwuje **pełny czas życia (od utworzenia do `exp`) × `max_participants`** przez cały czas istnienia i jeszcze **30 min karencji** po swoim końcu. Ta część nie zależy od tego, czy Daily raportuje czasy na bieżąco, czy dopiero po wyjściu uczestników. Pokój skasowany jako potwierdzenie pusty kończy rezerwację w chwili skasowania (+ karencja); skasowany z ludźmi w środku albo znikający poza nami — rezerwuje do pierwotnego `exp`. Minuty policzone dwa razy (zużycie + rezerwacja tego samego pokoju) to świadome zawyżenie.
   - **poza rejestrem** — pokoje tablic widoczne w `GET /rooms`, których nie ma w rejestrze (utrata danych Redis): czas życia wg Daily × limit osób (bez `exp`: 3 h); trwające spotkania w obcych pokojach: szczyt uczestników × 3 h.
   - Nowy pokój jest wpisywany do rejestru przed sprawdzeniem progu („zapisz, potem sprawdź”), więc równolegli tworzący nie przekroczą progu razem.
   - Brak odpowiedzi, błąd HTTP, nieoczekiwany kształt (także `Infinity` / `NaN`), powtórzone id, za dużo stron, niedostępna lista pokoi, nieprzewidziany wyjątek = brak tokenu (503); nieudane pobranie pamiętane 30 s.
   - **Najgorszy przypadek** (test `TestWorstCaseMonth`: 12 kont tworzy pokoje bez przerwy przez 30 h, każdy pokój pełny od utworzenia do `exp`, trzy warianty raportowania Daily — na bieżąco, `duration` 0 do wyjścia, spotkanie widoczne dopiero 20 min po końcu): **7920 minut uczestnika** przy progu 8000 — zapas 2080 minut do darmowej puli. Granica wynika z konstrukcji: pokój powstaje tylko, gdy cała jego rezerwacja mieści się pod progiem.
4. **Budżet dzienny tworzącego** `CALL_USER_DAILY_MINUTES_CAP` (domyślnie 240 min na dobę UTC, sufit 1440) — liczy **realny czas rozmów**, nie rezerwacje:
   - żywy pokój obciąża budżet całym swoim czasem (rezerwacja przy tworzeniu; reszta budżetu mniejsza niż czas pokoju = krótszy pokój; mniej niż 10 min = 429),
   - pokój zakończony jako **potwierdzenie pusty** (`GET /rooms/<nazwa>/presence`: tworzący zaczyna rozmowę na innej tablicy albo klika „Rozmowa” na tej samej, gdy pokój starszy niż 10 min stoi pusty) — obciążenie spada do czasu od utworzenia do tej chwili (minimum 1 min),
   - pokój zakończony (wygasły, skasowany), po 30 min karencji — obciążenie spada do sumy czasów spotkań w tym pokoju wg `GET /meetings?room=…`; rozliczenie może obciążenie tylko zmniejszyć, robi się raz, a trwające spotkanie / błąd Daily / brak `duration` zostawia pełne obciążenie,
   - budżet to **suma wpisów pokoi** tworzącego (`call:owner:<id>`), nie licznik — zwrotu nie da się wziąć dwa razy; wszystko dzieje się pod blokadą na tworzącego. Do 40 pokoi na dobę.
   - Przykład: 4 lekcje po 60 min z przerwami mieszczą się w 240 min (test `TestHonestTeacherBudget`); pokoje trzymane pełne do `exp` wyczerpują budżet po 240 min realnego czasu. Więcej lekcji dziennie = podnieś `CALL_USER_DAILY_MINUTES_CAP`.
   - Awaria Redis albo uszkodzony zapis = odmowa.
5. **Pokój**: `privacy: private`, `max_participants` z `CALL_MAX_PARTICIPANTS` (domyślnie 4, sufit 20), `exp` = teraz + `DAILY_ROOM_TTL_MINUTES` (domyślnie 90, sufit 3 h), `eject_at_room_exp: true`, `enable_knocking: false`, `enable_dialout: false`, `enable_transcription_storage: false`, `permissions.canAdmin: false`. Nagrywanie, live streaming i SIP/dial-in nie mają w API wartości „off” — są wyłączone, dopóki nie ustawi się `enable_recording` / `streaming_endpoints` / `sip`, a pokój z którąkolwiek z tych właściwości (także `auto_transcription_settings`, `auto_start_transcription`, `dialin`) albo z `permissions.canAdmin` innym niż `false` / pusta lista nie dostaje tokenu. Gdy Daily odrzuci właściwość albo utworzy pokój bez wymaganych ustawień — pokój jest kasowany, 502, żadnej próby z uboższym zestawem. Istniejący pokój niespełniający wymogów: tworzący zastępuje go nowym, dołączający dostaje odmowę. Limit 50 pokoi konta: pokoje na żądanie, przy tworzeniu kasowane do 5 wygasłych dawniej niż 30 min (liczone próby; przed `DELETE` ponowny `GET`, odświeżony pokój zostaje); limit pokoi / 402 = 503 `VOICE_PROVIDER_LIMIT` + log ERROR.
6. **Token**: `room_name` zawsze, `user_id` / `user_name` z konta, `exp` = 5 min (nie później niż `exp` pokoju), `eject_after_elapsed` = czas do `exp` pokoju minus 5 min (≤ 3 h) — nikt nie zostaje po `exp` pokoju. **`is_owner: false` i `permissions.canAdmin: false` dla wszystkich, także tworzącego** (decyzja ostrzejsza niż zlecenie: właściciel / admin spotkania może uruchomić płatny streaming i transkrypcję albo nadać uprawnienia innym; dokumentacja Daily nie rozstrzyga, co dokładnie może admin z `["participants"]`). Skutek: nauczyciel nie wycisza ani nie wyprasza uczestników z poziomu Daily. `enable_recording` nieustawione, `enable_recording_ui: false`. Token i klucz nigdy w logach.
7. **Rate limit** (`core/rate_limit.enforce_rate_limit`, po sprawdzeniu członkostwa):
   - `ratelimit:voice_call:user:<id>` — 10/min, **każde** żądanie (także tanie odmowy) — ochrona przed zalewem,
   - `ratelimit:voice_call:ip:<ip>` — 30/h, tylko **próby tworzenia i wydane tokeny**. Uczniowie czekający na nauczyciela za tym samym NAT-em (409, zero wywołań Daily) nie zużywają go, więc nie blokują nauczycielowi startu,
   - `ratelimit:voice_usage:user:<id>` — 10/min, endpoint admina (osobny kubełek).
   - **Awaria Redis = odmowa (503)** — inaczej niż w reszcie aplikacji: bez Redis nie działają budżet, blokada i rejestr pokoi, więc nie umiemy ograniczyć kosztów. Ryzyko: klasa za jednym NAT-em dzieli 30 wejść do rozmowy na godzinę (każde ponowne dołączenie to jedno wejście).
8. **Tylko audio domyślnie**: `start_video_off: true` w pokoju i tokenie; kamera na życzenie, liczy się do tych samych minut.
9. **Klucz**: `DAILY_API_KEY` to `SecretStr` (czytany tylko przez `call_guard.daily_api_key()`); test `TestKeyNeverLeaks` szuka klucza w odpowiedziach obu endpointów (sukces, każdy błąd, admin) i w logach; fragmenty odpowiedzi Daily trafiają do logu przycięte, bez klucza i bez długich ciągów bez spacji; treść nieprzewidzianego wyjątku transportu nie jest logowana. Adres pokoju z odpowiedzi Daily przechodzi tylko jako dokładnie `https://<subdomena>.daily.co/<nazwa pokoju>`.
10. **Widoczność**: `GET /api/v1/whiteboard/call/usage` dla id z `CALL_ADMIN_USER_IDS` (projekt nie ma roli admina; pusta = nikt): `state` (`enabled` / `disabled` / `not_configured` / `limit` / `unknown`), `used_minutes` (wg Daily), `reserved_minutes`, `planned_minutes` (to porównujemy z progiem), `cap_minutes`, `rooms_count`, `active_rooms`. Każde wydanie tokenu zostawia log INFO z aktualnym zużyciem (bez tokenu).

**Kody błędów `POST /{id}/call`** (format `ApiResponse`, pola `code` i `error`)

| HTTP | `code` | Komunikat (`error`) | Kiedy | Ponowić? |
| --- | --- | --- | --- | --- |
| 401 | `AUTH_ERROR` | — | brak / zły JWT | po zalogowaniu |
| 403 | `AUTH_ERROR` | — | konto bez zweryfikowanego e-maila (`VOICE_EMAIL_NOT_VERIFIED` „Potwierdź adres e-mail, aby korzystać z rozmów” z samego serwisu) | nie |
| 404 | `NOT_FOUND` | — | brak tablicy albo brak członkostwa | nie |
| 403 | `VOICE_CREATE_NOT_ALLOWED` | To konto nie może jeszcze rozpoczynać rozmów | właściciel spoza `CALL_ALLOWED_USER_IDS`, a rozmowa nie trwa | nie |
| 409 | `VOICE_CALL_NOT_STARTED` | Rozmowa jeszcze się nie zaczęła - poczekaj na nauczyciela | dołączający, a pokoju tablicy nie ma w rejestrze (albo pokój nie spełnia wymogów) | tak, gdy nauczyciel zacznie |
| 409 | `VOICE_CALL_ENDING` | Rozmowa właśnie się kończy - poproś nauczyciela o rozpoczęcie nowej | dołączający, pokój wygasa za mniej niż 6 min | tak, gdy nauczyciel kliknie „Rozmowa” |
| 429 | `RATE_LIMITED` | Zbyt wiele prób, spróbuj ponownie później. | 10/min na użytkownika albo 30/h na IP | tak, po chwili (IP: do godziny) |
| 429 | `VOICE_CALL_BUSY` | Rozmowa jest właśnie uruchamiana - spróbuj ponownie za chwilę | inne żądanie tego samego tworzącego trwa dłużej niż 10 s | tak, po kilku sekundach |
| 429 | `VOICE_USER_LIMIT` | Dzienny limit rozmów dla tego konta został wyczerpany | dzienny budżet tworzącego (albo 40 pokoi na dobę) | jutro (UTC) albo po rozliczeniu poprzedniej rozmowy (~30 min) |
| 429 | `VOICE_MONTHLY_LIMIT` | Limit rozmów w tym miesiącu wyczerpany | zużycie + rezerwacje ponad próg | po zakończeniu trwających rozmów albo w następnym miesiącu |
| 502 | `VOICE_PROVIDER_ERROR` | Rozmowa jest chwilowo niedostępna, spróbuj ponownie za chwilę | Daily: sieć, 5xx, 401/403 (zły klucz), odrzucona właściwość, 429 po jednym ponowieniu | tak |
| 503 | `VOICE_DISABLED` | Rozmowy głosowe są chwilowo wyłączone | `CALL_ENABLED=false` | nie |
| 503 | `VOICE_NOT_CONFIGURED` | Rozmowy głosowe są chwilowo wyłączone | pusty albo niepoprawny `DAILY_API_KEY` | nie |
| 503 | `VOICE_GUARD_UNAVAILABLE` | Rozmowa jest chwilowo niedostępna, spróbuj ponownie za chwilę | Redis niedostępny albo uszkodzony zapis | tak, po chwili |
| 503 | `VOICE_USAGE_UNAVAILABLE` | Nie udało się sprawdzić limitu rozmów, spróbuj ponownie za chwilę | nie udało się wiarygodnie odczytać zużycia / listy pokoi z Daily | tak, po ~30 s |
| 503 | `VOICE_PROVIDER_LIMIT` | Rozmowa jest chwilowo niedostępna (limit konta rozmów) | limit pokoi konta Daily albo 402 (płatność) | nie — sprawdzić panel Daily |
| 504 | `VOICE_PROVIDER_TIMEOUT` | Połączenie z usługą rozmów przekroczyło limit czasu, spróbuj ponownie | timeout 8 s na wywołanie Daily albo 90 s na całą operację tworzącego | tak |

`GET /call/usage`: 401, 403 `FORBIDDEN`, 429 `RATE_LIMITED`, 503 `VOICE_GUARD_UNAVAILABLE`; niedostępne Daily nie jest błędem — `state: "unknown"`.

**Niepotwierdzone założenia o Daily — sprawdź przy pierwszym użyciu z prawdziwym kluczem**

1. **`GET /meetings?ongoing=true` w trakcie rozmowy**: czy trwające spotkanie jest na liście i co mają `duration` / `join_time` uczestników. Kod działa w obu wariantach (rezerwacja pokoju nie zależy od tej odpowiedzi), ale `used_minutes` w `GET /call/usage` w trakcie rozmowy pokaże, który wariant jest prawdziwy.
2. **Opóźnienie raportu**: po zakończeniu rozmowy sprawdź, po ilu minutach spotkanie pojawia się w `GET /meetings` z pełnym `duration`. Założenie: **najpóźniej po 25 min** (karencja 30 min − cache 5 min). Jeśli trwa to dłużej — podnieś `RESERVATION_GRACE_SECONDS` w `call_guard.py`; od tego zależy też rozliczanie budżetu dziennego.
3. **Pula minut odnawia się kalendarzowo** (1. dnia miesiąca, UTC) — tak liczymy; jeśli Daily liczy od dnia założenia konta, próg trzeba liczyć w tym samym oknie (panel Daily → Usage).
4. **Zaokrąglanie**: czy Daily rozlicza każde wejście uczestnika z dokładnością do sekundy, czy zaokrągla w górę do minuty. Rezerwacja (czas życia × limit osób) zakłada sumowanie sekund; przy zaokrąglaniu każdego wejścia seria bardzo krótkich wejść kosztowałaby więcej, niż rezerwujemy (wtedy widać to w `used_minutes` — obniż próg).
5. `max_participants` i `eject_at_room_exp` są egzekwowane przez Daily (sprawdzamy, że pokój je ma, nie że działają) — na teście wejdź piątą osobą i poczekaj na `exp`.
6. Czy `DELETE` pokoju rozłącza trwającą rozmowę i czy przesunięcie `exp` dociera do osób w rozmowie — kod nie zakłada żadnego z nich (pokój skasowany z ludźmi w środku rezerwuje do pierwotnego `exp`; uczestnika kończy `eject_after_elapsed` z jego tokenu).
7. Kody i kształty odpowiedzi: brak pokoju 404 / 400, duplikat nazwy, limit pokoi, maksymalny `limit` w `/meetings`, w jakiej postaci `POST` / `GET /rooms` zwraca `permissions.canAdmin` — obsługujemy w obu wariantach albo fail closed. Gdyby pierwsze kliknięcie „Rozmowa” dało 502, a w logu było „utworzony pokój … nie spełnia wymogów (…)”, to Daily zwraca którąś właściwość w innym kształcie, niż zakładamy — nazwa w nawiasie mówi którą.

**Rotacja `DAILY_API_KEY`** (po każdym podejrzeniu wycieku): panel Daily → Developers → wygeneruj nowy klucz (potrafi to tylko właściciel domeny) → wklej w Render jako `DAILY_API_KEY` → redeploy backendu → kliknij „Rozmowa” na tablicy i sprawdź `GET /call/usage`. W razie wątpliwości najpierw `CALL_ENABLED=false`. Dokumentacja Daily nie mówi, co dzieje się ze starym kluczem po wygenerowaniu nowego — po rotacji sprawdź, że stary nie działa. Po wycieku przejrzyj też listę pokoi i nagrań w panelu (pokoje założone cudzym kluczem nie mają naszego prefiksu).

**Panel Daily — co ustawić** (stan dokumentacji i cennika z 02.10.2026)

- Potwierdzone: 10 000 darmowych minut / mies., konto zakłada się bez karty; po przekroczeniu puli rozliczenie pay-as-you-go ($0,004 / min wideo, $0,00099 / min audio); **Daily Video nie ma twardego limitu wydatków** (limit wydatków istnieje tylko dla Pipecat Cloud).
- Niepotwierdzone: czy konto bez podpiętej karty po wyczerpaniu puli blokuje rozmowy, czy nalicza dług; czy panel ma alert billingowy. **Zalecenie: nie podpinać karty do konta Daily** i sprawdzić w panelu (Billing), czy jest alert / limit — jeśli jest, ustawić alert na $1.
- Jedyną twardą granicą kosztów po naszej stronie jest próg z pkt 3; przy wycieku klucza (d) nie działa.

**Znane ograniczenia**: (1) Uczestnik jest rozłączany najpóźniej z `exp` pokoju z chwili swojego wejścia — po przedłużeniu pokoju klika „Rozmowa” ponownie; lekcja dłuższa niż `DAILY_ROOM_TTL_MINUTES` (90 min) wymaga kliknięcia „Rozmowa” przez nauczyciela w ostatnich 15 min albo większej wartości env. (2) Utrata danych Redis: budżety dzienne zaczynają od zera, a uczniowie nie dołączą, dopóki nauczyciel nie kliknie „Rozmowa” (przejęcie pokoju); próg miesięczny dalej działa (zużycie z Daily + pokoje z listy Daily), niepoliczone zostają tylko pokoje zakończone w ostatnich 30 min przed utratą. (3) Rezerwacja i zużycie tego samego pokoju liczą się podwójnie do końca karencji, więc blisko progu odmowa przychodzi wcześniej niż przy dokładnym liczeniu. (4) Budżet dzienny tworzącego po rozliczeniu opiera się na spotkaniach z Daily (założenie 2 wyżej); próg miesięczny od tego nie zależy. (5) Rozmiar: `call.py` przekracza 400 linii (przepływ tworzącego jest jedną transakcją na budżecie i rejestrze) — podział na moduł pokoju i moduł tworzącego jest kandydatem do refaktoru.

### 5b. Własny WebRTC + Xirsys (legacy)

```
User dołącza do tablicy → VoiceChatProvider (src/_new/features/voice-chat/VoiceChatContext.tsx + hooki obok:
  useVoiceSignaling — kanał i zdarzenia voice-*, useWebRTCConnections — RTCPeerConnection per user,
  useVoiceDetection — wskaźnik "mówi", mediaSupport — wykrywanie braku wsparcia/HTTPS)
  → sygnalizacja (wymiana SDP/ICE candidates) przez Supabase Broadcast (ten sam mechanizm co pkt 2)
  → lista ICE: getIceServers() (features/voice-chat/constants.ts) → GET /api/turn z Authorization: Bearer <access token>
      → Route Handler src/app/api/turn/route.ts (logika: src/_new/server/turn/get-ice-servers.ts)
      → brak nagłówka Bearer = 401 od razu → token sprawdzany przez GET /api/v1/auth/me (fail-closed, jak /api/chat)
      → rate limit per użytkownik (60/min, liczony PO autoryzacji)
      → serwer woła Xirsys sekretem z env XIRSYS_* i oddaje STUN + krótkotrwałe poświadczenia TURN (Cache-Control: no-store)
  → połączenie peer-to-peer między przeglądarkami po ustaleniu ścieżki przez Xirsys (TURN/STUN)
  → audio leci bezpośrednio między klientami, nie przez backend
```

**Sekret Xirsys żyje tylko na serwerze (audyt SEC-05).** Przeglądarka nigdy nie woła API Xirsys ani nie zna `XIRSYS_IDENT/SECRET/CHANNEL` — dostaje wyłącznie poświadczenia TURN ważne ok. 60 s (klient trzyma je w pamięci 20 s, żeby seria `RTCPeerConnection` przy dołączaniu = jedno żądanie). Każdy problem po drodze (brak tokenu, 401/429/503, brak konfiguracji, awaria Xirsys) kończy się listą awaryjną STUN + publiczny OpenRelay — voice działa, tylko gorzej przez restrykcyjny NAT; szczegóły błędu Xirsys zostają w logu serwera. Tryb demo nie montuje `VoiceChatProvider`, więc nie korzysta z `/api/turn`. Przejściowo serwer czyta też stare `NEXT_PUBLIC_XIRSYS_*` (żaden kod kliencki już się do nich nie odwołuje, więc nie trafiają do bundla) — do usunięcia po rotacji sekretu.

**Limit per użytkownik, nie per IP.** Klasa siedzi za jednym NAT-em, więc licznik per IP liczony przed autoryzacją pozwalałby niezalogowanemu z tej samej sieci (pętla żądań bez tokenu) odciąć wszystkim TURN. Żądania bez tokenu / ze złym tokenem nie zużywają niczyjego limitu i nie docierają do Xirsys.

**Region TURN.** `global.xirsys.net` dobiera serwery TURN wg położenia wołającego, a wołającym jest funkcja serwerowa (na Vercel domyślnie `iad1`, USA), nie przeglądarka ucznia. Jeśli w odpowiedzi `/api/turn` hosty TURN nie są europejskie: ustaw region funkcji projektu na europejski (Vercel → Settings → Functions) albo `XIRSYS_API_HOST` na regionalny host Xirsys (akceptowane tylko `*.xirsys.net` / `*.xirsys.com`).

## 6. SmartSearch (wyszukiwanie wzorów)

```
User wpisuje zapytanie → lokalne przeszukanie bazy wzorów (mathjs/predefiniowana lista)
  → wynik renderowany przez pipeline KaTeX (patrz stack.md, sekcja "Renderowanie treści matematycznej")
  → wybrany wzór wstawiany jako element na tablicę (ten sam mechanizm co pkt 2 — zwykły element typu "formula")
```

## Zasada ogólna

Każdy nowy pipeline (nowa duża funkcja przekraczająca jeden request-response) powinien dostać tu swoją sekcję w tym samym PR/commicie co implementacja — inaczej ten plik zacznie się rozjeżdżać dokładnie tak jak `global-context.md` się rozjechał.
