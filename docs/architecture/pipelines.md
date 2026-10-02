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

Wymaganie twarde (Patryk, 02.10.2026): **żadnych rachunków — nikt nie może przepalić darmowej puli Daily** (10 000 minut uczestnika / mies., potem płatne bez twardego limitu po stronie Daily). Kod: `backend/api/v1/whiteboard/` — `call.py` (przepływ, pokój, token), `call_guard.py` (limity lokalne w Redis), `call_usage.py` (zużycie z Daily, endpoint admina), `daily_client.py` (transport HTTP).

```
Przeglądarka → POST /api/v1/whiteboard/{board_id}/call (JWT usera, bez body)
  1. JWT + zweryfikowany e-mail (get_current_user; niezweryfikowany = 403)
  2. członkostwo w workspace tablicy (zapytania SQL w threadpoolu, sesja oddana do puli) — brak = 404, zero wywołań Daily
  3. CALL_ENABLED=false → 503 VOICE_DISABLED;  pusty DAILY_API_KEY → 503 VOICE_NOT_CONFIGURED   (zero wywołań HTTP)
  4. rate limit w Redis: 10/min na użytkownika, 30/h na IP → 429 RATE_LIMITED;  awaria Redis → 503 VOICE_GUARD_UNAVAILABLE
  5. zużycie miesiąca: GET api.daily.co/v1/meetings (cache 5 min) + rezerwacje trwających pokoi
       ≥ DAILY_MONTHLY_MINUTES_CAP → 429 VOICE_MONTHLY_LIMIT;  nie da się ustalić → 503 VOICE_USAGE_UNAVAILABLE
  6. GET /rooms/<prefix>-board-<id>
       dołączający (editor/viewer, właściciel spoza CALL_ALLOWED_USER_IDS): pokój aktywny i zgodny z wymogami
         → token;  inaczej 409 VOICE_CALL_NOT_STARTED (403 VOICE_CREATE_NOT_ALLOWED dla właściciela spoza listy) — zero zapisów w Daily
       tworzący (twórca workspace'u z rolą owner): brak pokoju / wygasa / niezgodny → budżet dzienny (429 VOICE_USER_LIMIT)
         → próg miesięczny z nowym pokojem → sprzątanie wygasłych pokoi → POST /rooms;  pokój kończy się za < 15 min → przedłużenie
  7. POST /meeting-tokens → 200 { room_url, token, expires_at }   (Cache-Control: no-store)

GET /api/v1/whiteboard/call/usage — tylko id z CALL_ADMIN_USER_IDS (domyślnie nikt, 403): stan, zużycie, próg, liczba pokoi.
```

**Model zagrożeń i co na niego odpowiada**

| Zagrożenie | Zabezpieczenia |
| --- | --- |
| (a) ktoś zakłada konta / przejmuje konto i odpala rozmowy | pokój tworzy tylko twórca workspace'u ze zweryfikowanym e-mailem, opcjonalnie tylko id z `CALL_ALLOWED_USER_IDS`; dzienny budżet tworzącego `CALL_USER_DAILY_MINUTES_CAP` (jeden aktywny pokój na tworzącego, rezerwacja PRZED wywołaniem Daily); próg miesięczny; rate limit; `CALL_ENABLED=false` wyłącza wszystko natychmiast |
| (b) ktoś wielokrotnie używa / rozdaje tokeny | token ważny 5 min i tylko na wejście, przypięty do jednego pokoju (`room_name`), pokój prywatny z `max_participants` (domyślnie 4) — rozdany token nie wpuści więcej osób naraz niż limit pokoju; `eject_after_elapsed` kończy pobyt najpóźniej z `exp` pokoju |
| (c) zapomniane lub celowo wiszące pokoje | `exp` ≤ 3 h (sufit w kodzie) + `eject_at_room_exp`; dołączający nie przesuwa `exp`; przedłużenie tylko przez tworzącego i tylko z budżetu; wygasłe pokoje kasowane przy tworzeniu nowego; trwające pokoje liczone do progu miesięcznego w najgorszym przypadku (pełny pokój do `exp`) |
| (d) wyciek `DAILY_API_KEY` | **omija backend — żaden z powyższych bezpieczników wtedy nie działa.** Klucz jest tylko w env backendu, nie trafia do odpowiedzi ani logów (test przeszukuje wszystkie odpowiedzi i logi). Jedyna obrona po wycieku: rotacja klucza (niżej) i ustawienia konta Daily |

**Punkty zlecenia 1–10**

1. **Kto zaczyna**: zalogowany, zweryfikowany e-mail, członek tablicy. Tworzy tylko właściciel przestrzeni (`Workspace.created_by` + rola `owner`). `CALL_ALLOWED_USER_IDS` (id po przecinku): niepusta = tworzą tylko wymienieni; wartość nie do sparsowania = nikt (fail closed, log ERROR, start backendu bez zmian). Pozostali tylko dołączają do istniejącego, niewygasłego pokoju.
2. **Wyłącznik**: `CALL_ENABLED` (domyślnie `true`; wartość nierozpoznana = wyłączone).
3. **Próg miesięczny z prawdziwego zużycia**: `GET /meetings` z `timeframe_start` = początek miesiąca (UTC), wszystkie strony (`starting_after`), suma `participants[].duration` (każdy uczestnik zaokrąglony w górę do minuty). Do tego szacunek trwających rozmów: nasze pokoje z rejestru w Redis × `max_participants` × czas do `exp`, a trwające spotkania w pokojach spoza rejestru × szczyt uczestników × 3 h. Cache 5 min w Redis (gdy Redis nie działa — w pamięci procesu). Próg `DAILY_MONTHLY_MINUTES_CAP` (domyślnie 8000, sufit w kodzie 9500). Brak odpowiedzi, błąd HTTP, nieoczekiwany kształt, niepełna albo stojąca paginacja = brak tokenu; nieudane pobranie pamiętane 30 s.
4. **Budżet dzienny tworzącego**: `CALL_USER_DAILY_MINUTES_CAP` (domyślnie 240 min czasu pokoju na dobę UTC, sufit 1440). Licznik w Redis na użytkownika, nie na tablicę: nowy pokój na innej tablicy kasuje poprzedni; niewykorzystany czas wraca do budżetu tylko, gdy Daily potwierdzi (`GET /rooms/<nazwa>/presence`), że skasowany pokój był pusty. Skasowanie pokoju poza nami i przedłużanie nie zerują licznika. Awaria Redis albo uszkodzony licznik = odmowa.
5. **Pokój**: `privacy: private`, `max_participants` z `CALL_MAX_PARTICIPANTS` (domyślnie 4, sufit 20), `exp` = teraz + `DAILY_ROOM_TTL_MINUTES` (sufit 3 h), `eject_at_room_exp: true`, `enable_knocking: false`, `enable_dialout: false`, `enable_transcription_storage: false`, `permissions.canAdmin: false`. Nagrywanie, live streaming i SIP/dial-in nie mają w API wartości „off” — są wyłączone, dopóki nie ustawi się `enable_recording` / `streaming_endpoints` / `sip`, a pokój z którąkolwiek z tych właściwości (także `auto_transcription_settings`, `auto_start_transcription`, `dialin`) nie dostaje tokenu. Gdy Daily odrzuci właściwość albo utworzy pokój bez wymaganych ustawień — pokój jest kasowany, 502, żadnej próby z uboższym zestawem. Istniejący pokój niespełniający wymogów: tworzący zastępuje go nowym, dołączający dostaje odmowę. Limit 50 pokoi konta: pokoje na żądanie, przy tworzeniu kasowane do 5 wygasłych (liczone próby; przed `DELETE` ponowny `GET`, odświeżony pokój zostaje); limit pokoi / 402 = 503 `VOICE_PROVIDER_LIMIT` + log ERROR.
6. **Token**: `room_name` zawsze, `user_id` / `user_name` z konta, `exp` = 5 min (nie później niż `exp` pokoju), `eject_after_elapsed` = czas do `exp` pokoju minus 5 min (≤ 3 h) — nikt nie zostaje po `exp` pokoju. **`is_owner: false` dla wszystkich** (decyzja ostrzejsza niż zlecenie: właściciel spotkania może uruchomić płatny streaming i transkrypcję); tworzący dostaje tylko `permissions.canAdmin: ["participants"]` (wyciszanie, wypraszanie). `enable_recording` nieustawione, `enable_recording_ui: false`. Token i klucz nigdy w logach.
7. **Rate limit**: `core/rate_limit.enforce_rate_limit`, 10/min na użytkownika i 30/h na IP, liczony po sprawdzeniu członkostwa. **Awaria Redis = odmowa (503)** — inaczej niż w reszcie aplikacji (fail-open): bez Redis nie działają też budżet dzienny i rejestr pokoi, więc nie umiemy ograniczyć kosztów; brak rozmowy jest tańszy niż rachunek, a tablica działa dalej. Ryzyko: klasa za jednym NAT-em (szkoła, akademik) dzieli limit 30 wywołań/h na IP — każde kliknięcie „Rozmowa” i każde ponowne dołączenie to jedno wywołanie; przy ~4 osobach wystarcza z zapasem, przy problemach z łączem i wielu ponownych wejściach limit może się skończyć (429, znika po godzinie).
8. **Tylko audio domyślnie**: `start_video_off: true` w pokoju i tokenie; kamera na życzenie, liczy się do tych samych minut.
9. **Klucz**: test `TestKeyNeverLeaks` szuka klucza w odpowiedziach obu endpointów (sukces, każdy błąd, admin) i w logach; fragmenty odpowiedzi Daily trafiają do logu przycięte, bez klucza i bez długich ciągów bez spacji. Adres pokoju z odpowiedzi Daily przechodzi tylko jako dokładnie `https://<subdomena>.daily.co/<nazwa pokoju>` (allowlista znaków, bez parsera URL).
10. **Widoczność**: `GET /api/v1/whiteboard/call/usage` dla id z `CALL_ADMIN_USER_IDS` (projekt nie ma roli admina; pusta = nikt): `state` (`enabled` / `disabled` / `not_configured` / `limit` / `unknown`), `used_minutes`, `reserved_minutes`, `planned_minutes`, `cap_minutes`, `rooms_count`, `active_rooms`. Każde wydanie tokenu zostawia log INFO z aktualnym zużyciem (bez tokenu).

**Kody błędów `POST /{id}/call`** (format `ApiResponse`, pole `code`)

| HTTP | `code` | Kiedy | Ponowić? |
| --- | --- | --- | --- |
| 401 | `AUTH_ERROR` | brak / zły JWT | po zalogowaniu |
| 403 | `AUTH_ERROR` | konto bez zweryfikowanego e-maila (`VOICE_EMAIL_NOT_VERIFIED` z samego serwisu) | nie |
| 404 | `NOT_FOUND` | brak tablicy albo brak członkostwa | nie |
| 403 | `VOICE_CREATE_NOT_ALLOWED` | właściciel spoza `CALL_ALLOWED_USER_IDS`, a rozmowa nie trwa | nie |
| 409 | `VOICE_CALL_NOT_STARTED` | dołączający, a nauczyciel nie zaczął rozmowy (albo pokój wygasa / nie spełnia wymogów) | tak, gdy nauczyciel zacznie |
| 429 | `RATE_LIMITED` | 10/min na użytkownika albo 30/h na IP | tak, po chwili |
| 429 | `VOICE_USER_LIMIT` | dzienny budżet tworzącego wyczerpany | jutro (UTC) |
| 429 | `VOICE_MONTHLY_LIMIT` | „Limit rozmów w tym miesiącu wyczerpany” | w następnym miesiącu |
| 502 | `VOICE_PROVIDER_ERROR` | Daily: sieć, 5xx, 401/403 (zły klucz), odrzucona właściwość, 429 po jednym ponowieniu | tak |
| 503 | `VOICE_DISABLED` | `CALL_ENABLED=false` | nie |
| 503 | `VOICE_NOT_CONFIGURED` | pusty `DAILY_API_KEY` | nie |
| 503 | `VOICE_GUARD_UNAVAILABLE` | Redis niedostępny albo uszkodzony licznik | tak, po chwili |
| 503 | `VOICE_USAGE_UNAVAILABLE` | nie udało się wiarygodnie odczytać zużycia z Daily | tak, po ~30 s |
| 503 | `VOICE_PROVIDER_LIMIT` | limit pokoi konta Daily albo 402 (płatność) | nie — sprawdzić panel Daily |
| 504 | `VOICE_PROVIDER_TIMEOUT` | timeout 8 s na wywołanie Daily | tak |

`GET /call/usage`: 401, 403 `FORBIDDEN`, 429 `RATE_LIMITED`, 503 `VOICE_GUARD_UNAVAILABLE`; niedostępne Daily nie jest błędem — `state: "unknown"`.

**Rotacja `DAILY_API_KEY`** (po każdym podejrzeniu wycieku): panel Daily → Developers → wygeneruj nowy klucz (potrafi to tylko właściciel domeny) → wklej w Render jako `DAILY_API_KEY` → redeploy backendu → kliknij „Rozmowa” na tablicy i sprawdź `GET /call/usage`. W razie wątpliwości najpierw `CALL_ENABLED=false`. Dokumentacja Daily nie mówi, co dzieje się ze starym kluczem po wygenerowaniu nowego — po rotacji sprawdź, że stary nie działa. Po wycieku przejrzyj też listę pokoi i nagrań w panelu (pokoje założone cudzym kluczem nie mają naszego prefiksu).

**Panel Daily — co ustawić** (stan dokumentacji i cennika z 02.10.2026)

- Potwierdzone: 10 000 darmowych minut / mies., konto zakłada się bez karty; po przekroczeniu puli rozliczenie pay-as-you-go ($0,004 / min wideo, $0,00099 / min audio); **Daily Video nie ma twardego limitu wydatków** (limit wydatków istnieje tylko dla Pipecat Cloud).
- Niepotwierdzone: czy konto bez podpiętej karty po wyczerpaniu puli blokuje rozmowy, czy nalicza dług; czy panel ma alert billingowy. **Zalecenie: nie podpinać karty do konta Daily** i sprawdzić w panelu (Billing), czy jest alert / limit — jeśli jest, ustawić alert na $1.
- Jedyną twardą granicą kosztów po naszej stronie jest próg z pkt 3; przy wycieku klucza (d) nie działa.

**Znane ograniczenia**: (1) kody i kształty odpowiedzi Daily, których dokumentacja nie potwierdza (brak pokoju 404 / 400, duplikat nazwy, limit pokoi, maksymalny `limit` w `/meetings`, czy `DELETE` pokoju rozłącza trwającą rozmowę, czy przesunięcie `exp` dociera do osób w rozmowie), obsługujemy w obu wariantach albo fail closed. (2) Uczestnik jest rozłączany najpóźniej z `exp` pokoju z chwili swojego wejścia — po przedłużeniu pokoju klika „Rozmowa” ponownie. (3) Utrata danych Redis zeruje budżety dzienne i rejestr pokoi; próg miesięczny dalej liczy się z Daily. (4) Budżet dzienny liczy czas pokoju, nie minuty uczestników (240 min pokoju × 4 osoby = do 960 minut uczestnika). (5) Zużycie z Daily może być opóźnione do 5 min (cache) — stąd rezerwacje i zapas 2000 minut do darmowej puli.

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
