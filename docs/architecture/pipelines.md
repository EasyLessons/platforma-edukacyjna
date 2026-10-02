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

```
Przeglądarka → POST /api/v1/whiteboard/{board_id}/call (JWT usera, bez body)
  → rate limit per użytkownik (30/min, po autoryzacji, fail-open przy awarii Redis)
  → WhiteboardService.create_call: członkostwo w workspace tablicy (każda rola, także viewer); brak = 404, zero wywołań Daily
  → backend/api/v1/whiteboard/call.py (klucz DAILY_API_KEY tylko tutaj; pusty = 503 VOICE_NOT_CONFIGURED, zero wywołań HTTP):
      1. POST api.daily.co/v1/rooms/<prefix>-board-<id>  {properties:{exp}}      — przesunięcie wygasania pokoju
         brak pokoju (404 albo 400 "not found") → sprzątanie wygasłych pokoi innych tablic z naszym prefiksem
           (GET /rooms, a przed każdym DELETE ponowny GET /rooms/<nazwa> — kasujemy tylko, gdy pokój NADAL jest wygasły)
         → POST /rooms {name, privacy:"private", properties:{exp, eject_at_room_exp, start_video_off, ...}}
         → 400 przy tworzeniu (wyścig dwóch osób) → GET /rooms/<nazwa>
         → pokój istnieje, ale wygasł i nie dał się odświeżyć → DELETE własnego pokoju + ponowne POST /rooms (raz)
      2. POST /meeting-tokens {properties:{room_name, user_name, user_id, exp, is_owner, start_video_off, eject_at_token_exp:false}}
  → 200 { room_url, token, expires_at }   (Cache-Control: no-store)
```

- **Pokój**: prywatny (wejście tylko z tokenem, bez knockingu), nazwa deterministyczna `<DAILY_ROOM_PREFIX>-board-<id>`, wygasa `DAILY_ROOM_TTL_MINUTES` (domyślnie 180) po OSTATNIM wywołaniu endpointu i wtedy rozłącza uczestników (`eject_at_room_exp`) — bezpiecznik kosztów i limitu pokoi konta (50), wymaganie twarde zlecenia 02.10. Skutek: rozmowa, w której przez 3 h nikt nie dołączył ponownie, zostaje zakończona; niepotwierdzone, czy przesunięcie `exp` dociera do osób już będących w rozmowie (jeśli nie — każdy jest rozłączany najpóźniej 3 h po własnym wejściu i musi kliknąć „Rozmowa” ponownie). Adres pokoju bierzemy z odpowiedzi Daily, ale tylko w postaci `https://<subdomena>.daily.co/<nazwa pokoju>` (inny host, port, userinfo albo ścieżka = 502); pokój, który nie jest prywatny, nie dostaje tokenu (502).
- **Token**: zawsze z `room_name` (token bez niego otwiera każdy pokój domeny), `user_name` = nazwa z EasyLesson (bez znaków sterujących/niewidocznych, do 64 znaków), `user_id`, `is_owner` tylko dla roli `owner`, ważny 1 h. `exp` tokenu ogranicza tylko moment wejścia — trwającej rozmowy nie przerywa (`eject_at_token_exp: false`). Domyślnie samo audio (`start_video_off: true`).
- **Błędy** (format `ApiResponse`, `code`): `VOICE_NOT_CONFIGURED` 503, `VOICE_PROVIDER_ERROR` 502 (błąd sieci, 5xx, 401/403 = zły klucz, nieoczekiwane 4xx, 429 po jednym ponowieniu), `VOICE_PROVIDER_TIMEOUT` 504 (timeout 8 s na wywołanie), `RATE_LIMITED` 429, `NOT_FOUND` 404. Treść błędu Daily zostaje w logu serwera (przycięta, bez klucza); klucz i token nigdy nie trafiają do logów ani odpowiedzi błędu.
- **Jeszcze nie ma**: licznika minut w miesiącu z limitem `DAILY_MONTHLY_MINUTES_CAP` (zlecenie 02.10) — osobny PR.

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
