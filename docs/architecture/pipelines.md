# Pipeliny — jak dane przepływają przez system

Dla każdej ważnej operacji: skąd do dokąd leci dane, i które pliki ruszać przy zmianie. Cel: przy zgłoszeniu buga albo nowej funkcji od razu wiadomo w którym miejscu łańcucha szukać.

## 1. Logowanie / sesja

```
UI (LoginForm, src/_new/features/auth/components/loginForm.tsx)
  → useLogin hook (src/_new/features/auth/hooks/useLogin.ts)
  → authApi.ts (POST /login)
  → backend/api/v1/auth/router.py → service.py
  → sprawdzenie hasła (passlib/bcrypt) → wystawienie access token (JWT) + refresh token (cookie HttpOnly)
  → AuthContext.login() (src/app/context/AuthContext.tsx) zapisuje access token in-memory
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

**Do zapamiętania:** to jest jeden z trzech dużych legacy plików (`BoardRealtimeContext`, 1245 linii) — patrz `docs/migration-status.md`.

## 3. Powiadomienia (np. zaproszenie do workspace'u)

To jest inny pipeline niż tablica: tu event **inicjuje backend**, nie frontend drugiego usera.

```
User A zaprasza User B do workspace'u
  → POST /workspaces/{id}/invites (backend/api/v1/workspaces/invites_router.py)
  → invites_service.py: tworzy wiersz WorkspaceInvite (token, expires_at) w Postgresie
  → tworzy wiersz Notification (type="invite", payload={workspace_id, inviter_name, invite_token...})
  → wywołuje broadcast_notification() (backend/api/v1/workspaces/realtime.py)
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
UI chatu (whiteboard) → POST /api/chat (src/app/api/chat/route.ts, Next.js Route Handler — NIE FastAPI)
  → sprawdzenie rate limitu (Map w pamięci, per IP: 20 req/min, blokada 2 min po przekroczeniu)
  → sprawdzenie cache odpowiedzi (Map w pamięci, TTL 30 min)
  → jeśli brak w cache: wywołanie Gemini (@google/generative-ai), model gemini-2.5-flash,
    fallback na gemini-2.5-flash-lite przy przekroczeniu limitu
  → zapis do cache, zwrot odpowiedzi do UI
```

**Ograniczenie architektoniczne do znajomości:** rate limiting i cache trzymane są w zwykłym `Map` w pamięci procesu Next.js. Działa poprawnie tylko dopóki appka działa na jednej, długo żyjącej instancji serwera. Jeśli kiedyś przejdziecie na wdrożenie serverless/edge (wiele instancji, cold starty) albo horizontal scaling — ten mechanizm przestanie działać poprawnie (każda instancja ma swoją osobną mapę) i trzeba będzie przenieść na współdzielony store (np. Redis). Nie problem dziś, ale ważne żeby wiedzieć zanim ktoś zmieni sposób hostingu.

## 5. Voice chat (WebRTC)

```
User dołącza do tablicy → VoiceChatContext (src/app/context/VoiceChatContext.tsx, 1484 linie)
  → sygnalizacja (wymiana SDP/ICE candidates) przez Supabase Broadcast (ten sam mechanizm co pkt 2)
  → połączenie peer-to-peer między przeglądarkami po ustaleniu ścieżki przez Xirsys (TURN/STUN)
  → audio leci bezpośrednio między klientami, nie przez backend
```

## 6. SmartSearch (wyszukiwanie wzorów)

```
User wpisuje zapytanie → lokalne przeszukanie bazy wzorów (mathjs/predefiniowana lista)
  → wynik renderowany przez pipeline KaTeX (patrz stack.md, sekcja "Renderowanie treści matematycznej")
  → wybrany wzór wstawiany jako element na tablicę (ten sam mechanizm co pkt 2 — zwykły element typu "formula")
```

## Zasada ogólna

Każdy nowy pipeline (nowa duża funkcja przekraczająca jeden request-response) powinien dostać tu swoją sekcję w tym samym PR/commicie co implementacja — inaczej ten plik zacznie się rozjeżdżać dokładnie tak jak `global-context.md` się rozjechał.
