# Plan obserwowalności EasyLesson (błędy, logi, zdrowie usług)

**Data:** 21.09.2026
**Status:** propozycja do decyzji Patryka. Sam dokument, zero kodu.
**Zakres:** frontend Next.js (Vercel), backend FastAPI (Render), serwis `whiteboard-sync` (Hocuspocus),
voice chat (WebRTC). Poza zakresem: metryki biznesowe, APM/tracing rozproszony (na tym etapie
niepotrzebne i płatne).

---

## 0. Stan wyjściowy (zmierzony w kodzie, `origin/main@024e254`)

| Obszar | Co jest | Czego brakuje |
| --- | --- | --- |
| Backend logi | `core/logging.py`: format tekstowy `czas \| poziom \| moduł:funkcja:linia \| wiadomość` do `logs/app.log`, `logs/error.log` (dysk kontenera Render = **efemeryczny**, znika przy deployu) i na stdout (to jedyne, co widać w Render Logs) | brak `request_id`, brak JSON, brak korelacji z frontendem, brak identyfikatora usera w logach błędów |
| Backend błędy | 6 `@app.exception_handler` w `main.py` (walidacja, auth, 404, `AppException`, generyczny 500 z ręcznym CORS) | nic nie wysyła wyjątków dalej niż stdout; 500 ginie po przewinięciu logów Render |
| Backend zdrowie | tylko `GET /` → `{"message": "Education Platform API"}` (nie sprawdza bazy ani Redisa) | brak `/health` z realnym sprawdzeniem zależności, brak uptime monitora |
| Frontend błędy | 69 wywołań `console.error` w `src/`; brak `error.tsx`/`global-error.tsx` w `src/app` (jest tylko `not-found.tsx`) | błąd renderu = biały ekran bez śladu; błędy z przeglądarek uczniów nigdzie nie docierają |
| Route Handlery Next (`/api/chat`, `/api/contact`) | `console.error` + odpowiedź 500 z komunikatem | jak wyżej: log tylko w Vercel Functions Logs (retencja krótka na planie Hobby) |
| `whiteboard-sync` | 7 `console.log/error` (connect/disconnect/store) | brak health, brak metryk liczby dokumentów/połączeń, hosting jeszcze nieustalony |
| Voice chat | ~80 `console.log` z emoji w `features/voice-chat/*` (stan ICE, restart, offer/answer) — bardzo dobre jako diagnostyka **u dewelopera**, bezużyteczne u ucznia na telefonie | brak kanału, którym te zdarzenia trafiłyby do nas po fakcie |
| Sekrety/RODO w logach | logi backendu nie zawierają tokenów (sprawdzone: `auth/service.py` loguje id/e-mail, nie hasła); `request.headers` nie są logowane | brak polityki, co wolno wysłać do zewnętrznego narzędzia błędów |

Wniosek: dziś "coś się zepsuło u ucznia w czwartek wieczorem" jest **nieodtwarzalne** — nie ma ani
zapisu błędu, ani sposobu połączenia go z logiem backendu.

---

## 1. Decyzja narzędziowa: Sentry (darmowy plan) — z alternatywami

Zasada 7 z CLAUDE.md: najpierw gotowiec. Kryteria: darmowy przy naszej skali (kilkudziesięciu
użytkowników), SDK dla Next.js **i** FastAPI, source mapy, RODO do ogarnięcia w konfiguracji,
region UE.

| Opcja | Za | Przeciw | Werdykt |
| --- | --- | --- | --- |
| **Sentry (SaaS, plan Developer, region EU)** | 5 000 błędów/mies., 10 000 performance spans, 50 replays; oficjalne SDK `@sentry/nextjs` (wrapuje client, server, edge, Route Handlers, `global-error`) i `sentry-sdk[fastapi]`; source mapy przez wizard; `send_default_pii=False` domyślnie; data scrubbing po stronie serwera; retencja 90 dni; region **EU (Frankfurt)** do wyboru przy tworzeniu organizacji | zewnętrzny procesor danych (trzeba wpisać do rejestru czynności/polityki prywatności); limit 5k błędów — pętla błędów u jednego ucznia może go zjeść w dzień (rozwiązanie: `beforeSend` + sample rate, patrz §2) | **rekomendacja** |
| GlitchTip (self-hosted, kompatybilny z SDK Sentry) | te same SDK, dane u nas, bez limitów | trzeba hostować (Postgres + Redis + worker) — kolejna rzecz do utrzymania, koszt VPS ~20 zł/mies. i nasz czas; brak replays | plan B, jeśli RODO/zaufanie wykluczy SaaS |
| Highlight.io / Bugsink / własny endpoint `/api/errors` | Highlight: darmowy plan podobny do Sentry, mniej dojrzały SDK FastAPI; Bugsink: lekki self-host; własny endpoint: zero zależności | własny endpoint = pisanie własnego Sentry (grupowanie, deduplikacja, source mapy) — dokładnie to, czego zasada 7 zabrania | odrzucone |
| Vercel Logs + Render Logs "jak jest" | zero pracy | brak błędów z przeglądarki, retencja godzin/dni, brak grupowania, brak alertów | to jest stan obecny |

**Uzasadnienie jednym zdaniem:** Sentry ma jedyne utrzymywane SDK, które obsługują obie nasze
warstwy (App Router Next 16 + FastAPI) i dają korelację frontend→backend przez nagłówki
`sentry-trace`/`baggage` za darmo — a to jest 80 % wartości całego planu.

---

## 2. RODO: co wolno wysłać poza serwer, a czego nie

Dane, które mamy: e-maile i nazwy użytkowników (uczniowie, w tym niepełnoletni), treść tablic
(zadania, notatki), treść pytań do Tutora AI, tokeny sesji, adresy IP. Sentry (SaaS) to procesor
danych osobowych → umowa DPA (Sentry ma standardową, akceptowana w panelu), wpis w polityce
prywatności, region EU.

Twarde reguły do wpisania w konfigurację **przed** pierwszym wysłanym zdarzeniem:

1. **Zero tokenów.** `Authorization`, cookie `refresh_token`, `NEXT_PUBLIC_*_KEY`, `access_token`
   w URL/body — filtrowane w `beforeSend` (frontend) i `before_send` (backend) + `denyUrls`/`ignoreErrors`
   dla znanych szumów. Sentry domyślnie maskuje pola `password`, `secret`, `token`, ale nasz
   `apiClient` trzyma token w nagłówku — nagłówki nie są wysyłane przy `sendDefaultPii: false`,
   a i tak dopisujemy jawne czyszczenie (belt and braces).
2. **Użytkownik = tylko `user.id`** (liczba). Bez e-maila, bez username w `setUser`. Do odnalezienia
   ucznia po id wystarczy nasz backend.
3. **Bez treści tablicy i bez treści pytań do AI** w breadcrumbach i `extra`. Breadcrumby z
   `console` i `fetch` zostają, ale z wyciętym body (Sentry nie wysyła body fetch domyślnie; nasz
   `console.log` z voice chatu loguje tylko id/stany — OK). Dla `/api/chat` logujemy długość
   pytania i model, nie tekst.
4. **Bez IP** — `sendDefaultPii: false` po obu stronach (Sentry nie zapisuje wtedy IP klienta).
5. **Session Replay: wyłączony** na start. Nagrania ekranu ucznia z tablicą to najbardziej wrażliwa
   rzecz w całym systemie; jeśli kiedyś włączymy — tylko `maskAllText: true, blockAllMedia: true`
   i tylko `replaysOnErrorSampleRate` (a nie sesje), po osobnej decyzji.
6. **Retencja:** 90 dni w Sentry (plan Developer). W polityce prywatności: "dane diagnostyczne
   o błędach (identyfikator konta, typ urządzenia, ślad błędu) przechowywane 90 dni w UE".
7. **Backend `before_send`:** usuwa `request.data` dla endpointów auth (`/login`, `/register`,
   `/reset-password`, `/verify-*`) i `whiteboard/*/doc` (snapshot Y.Doc = treść tablicy).

Checklist prawny dla Patryka (nie kod): DPA z Sentry zaakceptowana, region EU, wpis w polityce
prywatności, informacja w rejestrze czynności (jeśli prowadzony).

---

## 3. Docelowa architektura

```
przeglądarka (Next client)          Vercel (Next server / Route Handlers)        Render (FastAPI)
──────────────────────────          ─────────────────────────────────────        ────────────────
@sentry/nextjs client               @sentry/nextjs server + edge                 sentry-sdk[fastapi]
 ├─ global-error.tsx / error.tsx     ├─ withSentry na /api/chat, /api/contact    ├─ FastApiIntegration
 ├─ beforeSend: scrub tokenów        ├─ propaguje sentry-trace/baggage do FastAPI ├─ request_id middleware
 ├─ user: { id }                     │   (fetch w server/chat/auth.ts)            ├─ JSON logi (structlog)
 └─ apiClient: X-Request-Id ────────────────────────────────────────────────────►├─ X-Request-Id echo w odpowiedzi
                                                                                 └─ GET /health {db, redis, supabase}
                                                                                          ▲
                                                                                          │ co 5 min
                                                                                   UptimeRobot / Better Stack (darmowy)
whiteboard-sync (Node)                                                                    │
 ├─ @sentry/node (ten sam projekt "backend", tag service=whiteboard-sync)                 │
 ├─ pino JSON logi (documentName, userId, event)                                          │
 └─ GET /health (Hocuspocus ma wbudowany endpoint HTTP) ◄──────────────────────────────────┘
```

Zasady:
- **Jeden `request_id` na żądanie**, generowany na froncie (`crypto.randomUUID()`) w interceptorze
  `apiClient`, wysyłany jako `X-Request-Id`, echo w odpowiedzi, w każdym logu backendu tego żądania
  i w zdarzeniu Sentry jako tag. Gdy front nie przyśle — backend generuje sam (middleware).
- **Logi = JSON, jedna linia, do stdout.** Render i Vercel zbierają stdout; pliki `logs/*.log` znikają
  (patrz §0). Pola stałe: `ts`, `level`, `logger`, `msg`, `request_id`, `user_id` (gdy jest),
  `path`, `method`, `status`, `duration_ms`.
- **Sentry = błędy i wyjątki**, nie logi. Do Sentry idzie: każdy nieobsłużony wyjątek, każdy 500,
  jawne `capture_exception` w miejscach "to nie powinno się zdarzyć" (np. `whiteboard/storage.py`
  gdy Supabase Storage odrzuci upload). **Nie idzie:** 4xx (401/403/404/422) — to szum.
- **Korelacja:** SDK Sentry samo propaguje `sentry-trace` z klienta przez Route Handler do FastAPI
  (fetch jest instrumentowany), więc błąd 500 na backendzie jest widoczny z frontowego zdarzenia.
  `request_id` to nasza niezależna, tańsza kopia tej korelacji w zwykłych logach.

---

## 4. Etapy (małe PR-y, każdy zielony na CI)

| PR | Zakres | Pliki | Zależności | Jak sprawdzić | Czas |
| --- | --- | --- | --- | --- | --- |
| **O1** `feat/backend-health` | `GET /health` → `{status, db: ok/fail, redis: ok/fail, supabase_storage: ok/skipped, version}` z timeoutami 2 s (nie wolno, żeby health wisiał); status 503 gdy `db` lub `redis` padnie; osobno lekki `GET /health/live` (bez zależności) do liveness | `backend/api/v1/health/router.py`, `core/database.py` (ping), `core/redis_client.py` (ping), test `tests/v1/health/test_health.py` | brak | `curl /api/v1/health` lokalnie; test z podmienionym `get_db` na wyjątek → 503 | 2 h |
| **O2** `feat/request-id-logs` | middleware `X-Request-Id` (Starlette `BaseHTTPMiddleware` albo `asgi-correlation-id` — gotowiec, 1 zależność, robi dokładnie to: nagłówek → contextvar → filtr logowania → echo); `core/logging.py` → JSON przez `python-json-logger` (albo `structlog`, ale to większa zmiana stylu) tylko dla stdout, pliki `logs/*.log` do usunięcia (efemeryczne, patrz §0); `user_id` do contextu w `get_current_user` | `backend/core/logging.py`, `backend/main.py`, `backend/core/request_context.py`, `requirements.txt`, testy middleware | brak | `pytest`; ręcznie: `curl -H "X-Request-Id: abc"` → odpowiedź ma ten sam nagłówek, log JSON ma `"request_id":"abc"` | 3 h |
| **O3** `feat/frontend-request-id` | interceptor `apiClient`: `X-Request-Id = crypto.randomUUID()` per żądanie; `mapAxiosError` dokłada `requestId` do `AppError` (żeby toast "Ups" mógł pokazać "kod błędu: abc123" — uczeń go przepisze, my znajdziemy w logach); to samo w `server/chat/auth.ts` (fetch do backendu przekazuje id z requestu) | `src/_new/lib/api/client.ts`, `src/_new/lib/errors/*`, `src/_new/server/chat/auth.ts`, testy | O2 (echo) | vitest na interceptorze (mock adapter sprawdza nagłówek); ręcznie: DevTools → Network → nagłówek w żądaniu i odpowiedzi | 2 h |
| **O4** `feat/sentry-backend` | `sentry-sdk[fastapi]` (gotowiec), init w `main.py` z `environment` (`production`/`preview`/`development` z `ENV`), `release` = SHA z Render (`RENDER_GIT_COMMIT`), `send_default_pii=False`, `traces_sample_rate=0` (na start tylko błędy), `before_send` z §2 pkt 7, tag `request_id` z contextvar; DSN przez env `SENTRY_DSN` (pusty = SDK wyłączone, więc lokalnie i w CI nic nie leci) | `backend/main.py`, `backend/core/observability.py`, `requirements.txt`, `.env.example`, `ci.yml` (bez zmian — DSN pusty) | O2 (tag request_id) | `pytest` (DSN pusty); na Render preview: wywołać celowo `/api/v1/__boom` (tymczasowy endpoint tylko w `ENV!=production`) → zdarzenie w Sentry z tagiem `request_id`, bez nagłówka Authorization w zdarzeniu | 2 h |
| **O5** `feat/sentry-frontend` | `@sentry/nextjs` przez `npx @sentry/wizard` (generuje `sentry.client/server/edge.config.ts`, `instrumentation.ts`, `global-error.tsx`, upload source map na Vercel); `beforeSend` z §2, `sendDefaultPii: false`, `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0`, `tracesSampleRate: 0.1` (żeby propagacja do backendu działała, ale tanio), `setUser({ id })` z `AuthContext`; `error.tsx` w `(dashboard)` i `(whiteboard)` (przyjazny ekran + przycisk "spróbuj ponownie", nie biały ekran); `ignoreErrors` dla szumu przeglądarek (`ResizeObserver loop`, `NotAllowedError` z autoplay — ten mamy obsłużony w UI) | `next.config.ts`, `sentry.*.config.ts`, `src/app/global-error.tsx`, `src/app/(dashboard)/error.tsx`, `src/app/(whiteboard)/error.tsx`, `src/_new/lib/auth/AuthContext.tsx` (setUser), `package.json`, `.env.example` (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` tylko w Vercel) | O3 (request_id jako tag), decyzja P-O1 | `npm run build` z pustym DSN (SDK no-op); na Vercel preview: przycisk testowy w `/account` (tylko `NODE_ENV!=production`) rzuca błąd → zdarzenie z source mapą i `user.id`; sprawdzić w zdarzeniu, że nie ma `Authorization` ani e-maila | 3 h |
| **O6** `feat/voice-chat-diagnostics` | zamiana ~80 `console.log` w `features/voice-chat` na `voiceLog(event, data)` (własny cienki logger, 30 linii — nie ma gotowca dla "logger z buforem w pamięci", a to jest cała funkcja): w dev = `console.log` jak dziś; w prod = ring buffer ostatnich 200 zdarzeń w pamięci + breadcrumb Sentry (kategoria `voice`); przy `capture` (np. połączenie nie wstało po 3 próbach, `getUserMedia` odrzucone, ICE `failed` bez odzyskania w 30 s) — bufor dokleja się jako `extra.voiceTimeline`; lista zdarzeń w §5 | `features/voice-chat/voice-log.ts`, wszystkie pliki voice (mechaniczna podmiana), testy: bufor i maskowanie | O5 | vitest: bufor 200, brak PII w zdarzeniach (tylko id, stany, typy kandydatów); ręcznie: tryb samolotowy 40 s → zdarzenie `voice.ice_unrecovered` z timeline | 3 h |
| **O7** `feat/sync-observability` | `whiteboard-sync`: `pino` (JSON) zamiast `console.log`, `@sentry/node` (ten sam projekt co backend, tag `service`), `GET /health` (Hocuspocus: `server.hocuspocus.getConnectionsCount()` + `getDocumentsCount()` w odpowiedzi), `SENTRY_DSN` z env | `whiteboard-sync/src/*.ts`, `package.json` serwisu, `docker-compose.yml` (env) | O4 (projekt Sentry istnieje) | `npx tsc --noEmit` w serwisie (job `sync-typecheck` z #55); `curl :1234/health` | 2 h |
| **O8** `docs/uptime-alerts` | konfiguracja poza kodem: UptimeRobot (50 monitorów free, co 5 min) albo Better Stack (10 monitorów, co 3 min, ładniejsze status page) na `https://api…/api/v1/health`, `https://easylesson.app/`, `wss://…sync…/health` (HTTP); alert e-mail + (opcjonalnie) Telegram; w Sentry: alert "nowy typ błędu w production" + "więcej niż 20 zdarzeń/h" → e-mail; runbook w `docs/architecture/observability.md` (co robić, gdy `/health` = 503: `redis` → sprawdzić Upstash/Render Redis, `db` → Neon status) | `docs/architecture/observability.md` (nowy, docelowy opis stanu — ten plan wtedy znika, zgodnie z zasadą "docs opisują stan, nie historię") | O1, O5 | ręczny test: zatrzymać lokalnie Redis → `/health` 503 → alert w ciągu ≤ 10 min | 1 h + konta |

Suma: **~18 h** pracy + założenie kont (Sentry, UptimeRobot) i decyzje z §6.
Kolejność bez blokad: O1 i O2 od razu (backend, niezależne od Bartka — nie dotykają `whiteboard/*`,
`models.py`); O3 równolegle; O4/O5 po decyzji P-O1; O6 po O5; O7 po O4; O8 na końcu.

Koszt miesięczny przy naszej skali: **0 zł** (Sentry Developer, UptimeRobot Free, pino/structlog
open source). Pierwszy próg płatny: Sentry Team 26 USD/mies. — dopiero gdy przekroczymy 5 000
błędów/mies., co przy poprawnym `ignoreErrors` i sample rate nie powinno się zdarzyć.

---

## 5. Voice chat — jakie zdarzenia logować (i jakie NIE)

Dziś logi voice są `console.log` z emoji (ok. 80 miejsc) — świetne w DevTools, niewidoczne po
fakcie. Docelowo `voiceLog(event, fields)` z listy poniżej; wszystko bez PII (tylko `userId`
liczbowe, stany, typy).

**Zdarzenia cyklu życia (breadcrumby, nie błędy):**

| Zdarzenie | Pola | Po co |
| --- | --- | --- |
| `voice.join_attempt` | `boardId`, `settings: {echoCancellation, noiseSuppression, pushToTalk}` | ile prób kończy się sukcesem |
| `voice.mic_granted` / `voice.mic_denied` | `errorName` (NotAllowedError/NotFoundError/NotReadableError), `trackSettings: {echoCancellation, sampleRate, channelCount}` — **to jest test B z diagnozy echa**, wreszcie zbierany automatycznie | diagnoza echa i odmów mikrofonu na telefonach |
| `voice.channel_subscribed` / `voice.channel_failed` | `status`, `durationMs` | problemy z Supabase Realtime |
| `voice.peer_create` | `remoteUserId`, `isInitiator`, `attempt` | |
| `voice.ice_candidate` | `type` (host/srflx/relay), `protocol` — **tylko typ, bez adresu IP z kandydata** | czy TURN działa (brak `relay` = brak Xirsys na prod, DECYZJE D1) |
| `voice.ice_state` / `voice.connection_state` | `remoteUserId`, `state`, `sinceLastChangeMs` | timeline przerw |
| `voice.ice_restart` | `remoteUserId`, `initiator: true/false`, `result` | czy #49 działa w terenie |
| `voice.offer_glare` | `remoteUserId`, `yielded` | częstość kolizji |
| `voice.audio_blocked` / `voice.audio_resumed` | — | iOS autoplay |
| `voice.leave` | `durationMs`, `peersMax` | średni czas rozmowy |

**Zdarzenia-błędy (do Sentry `captureMessage` z `extra.voiceTimeline` = ostatnie 200 breadcrumbów):**

- `voice.connect_failed_final` — 3 nieudane próby `createPeerConnection` z tym samym peerem,
- `voice.ice_unrecovered` — `failed` lub `disconnected` > 30 s bez powrotu do `connected`,
- `voice.mic_denied` z `NotReadableError` (mikrofon zajęty — u ucznia zwykle inna karta/aplikacja),
- `voice.channel_failed`,
- każdy `catch` w `useWebRTCConnections`/`useVoiceSignaling`, który dziś tylko `console.error`.

**Czego nie logować:** SDP (zawiera adresy IP i fingerprinty), pełnych kandydatów ICE (IP),
nazw użytkowników, nazw urządzeń audio (`enumerateDevices` — model telefonu/słuchawek to
identyfikacja), treści `voice-*` payloadów poza polami wymienionymi wyżej.

---

## 6. Pytania do Patryka (nie rozstrzygam sam)

- **P-O1. Sentry SaaS (EU) czy self-host GlitchTip?** Rekomendacja: Sentry Developer, region EU,
  bo koszt utrzymania GlitchTipu (VPS + Postgres + aktualizacje) jest większy niż nasz zysk z
  "danych u siebie" przy polityce z §2 (do Sentry i tak nie idą ani e-maile, ani treści).
- **P-O2. Kto zakłada konto Sentry i na czyj e-mail** (organizacja EasyLessons, projekty `frontend`,
  `backend`; Bartek jako członek)? Tokeny `SENTRY_DSN` (Render, Vercel) i `SENTRY_AUTH_TOKEN`
  (tylko Vercel, do source map) wpisujesz Ty — ja nie dotykam sekretów.
- **P-O3. Session Replay:** zgadzasz się, że na start **wyłączony** (§2 pkt 5)? Włączenie to
  osobna decyzja z wpisem w polityce prywatności.
- **P-O4. Uptime: UptimeRobot (prostszy, 50 monitorów) czy Better Stack (status page dla
  użytkowników, 10 monitorów)?** Rekomendacja: UptimeRobot na start; status page dopiero, gdy
  będą płacący użytkownicy.
- **P-O5. Alerty dokąd?** E-mail wystarczy? Telegram/Discord webhook to +15 min konfiguracji.
- **P-O6. Logi JSON: `python-json-logger` (1 zależność, format handlera, zero zmian w wywołaniach
  `logger.info`) czy `structlog` (ładniejsze API `log.info("event", key=value)`, ale przepisanie
  ~40 wywołań)?** Rekomendacja: `python-json-logger` teraz, `structlog` nigdy albo przy dużym
  refaktorze backendu.
- **P-O7. `request_id` w toaście błędu dla ucznia** ("Ups, coś poszło nie tak. Kod: a1b2c3") —
  chcesz to w UI? Bez tego korelacja działa tylko dla nas (Sentry), ale uczeń nie ma czego nam
  przepisać.
- **P-O8. Retencja i polityka prywatności:** kto aktualizuje `privacy-policy` w `(info)` o wpis
  o danych diagnostycznych (90 dni, UE, Sentry jako procesor)? Mogę przygotować draft w osobnym
  PR-ze docs, ale treść prawna to Twoja decyzja.
- **P-O9. `whiteboard-sync` — gdzie będzie hostowany?** Od tego zależy, czy O7 dostaje Sentry +
  health w tym samym stylu co Render (Procfile już jest) i czy uptime monitor ma co pingować.

---

## 7. Co świadomie pomijamy (na teraz)

- Tracing/APM (`traces_sample_rate` > 0.1, OpenTelemetry) — przy kilkudziesięciu użytkownikach
  nie ma czego optymalizować na podstawie tracingu; wchodzi dopiero z metrykami biznesowymi.
- Metryki Prometheus/Grafana — wymagają własnego hostingu; `/health` + Sentry + Render/Vercel
  wykresy CPU/pamięci wystarczą.
- Logi audytowe (kto co zmienił na tablicy) — to funkcja produktu, nie obserwowalność.
- Alertowanie na progi biznesowe (spadek liczby logowań) — po metrykach.
- Session Replay — patrz §2 pkt 5 i P-O3.
