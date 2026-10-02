# Architektura autoryzacji

Stan obecny + zaplanowane rozszerzenie o subskrypcje. To jest jedna z najważniejszych ścieżek w aplikacji — dotyka niemal każdego requestu, więc każda zmiana tutaj wymaga zrozumienia całego przepływu poniżej, nie tylko lokalnego fragmentu.

## Model sesji (obecny stan)

Cookie-first, dwa tokeny o różnym czasie życia i różnym miejscu przechowywania:

```
PRZEGLĄDARKA
│
├─ access_token   — tylko in-memory (zmienna JS, nie localStorage, nie cookie)
│                    • żyje do odświeżenia strony / wylogowania
│                    • niedostępny dla ataku XSS przez localStorage, bo go tam nie ma
│                    • znika po hard reload → odnawiany automatycznie przez refresh_token
│
└─ refresh_token  — HttpOnly cookie (ustawiany przez backend, `Set-Cookie`)
                     • niedostępny dla JS (ochrona przed odczytem przez XSS)
                     • wysyłany automatycznie przez przeglądarkę przy każdym request do API
                     • ważny 7 dni, rotowany przy każdym użyciu (stary unieważniany w bazie,
                       nowy wystawiany) — ponowne użycie starego tokenu = 401
```

**Dlaczego tak:** access token w localStorage (stary model, już nieaktualny) był czytelny dla każdego skryptu JS na stronie — jeden podatny pakiet npm i token wyciekał. Refresh token jako HttpOnly cookie nie jest czytelny przez JS w ogóle, więc nawet przy XSS atakujący nie ukradnie długożyjącego tokenu.

## Bootstrap sesji (co się dzieje przy wejściu na stronę)

1. `AuthProvider` (`src/_new/lib/auth/AuthContext.tsx`) montuje się i wywołuje `GET /me` z access tokenem z pamięci.
2. Jeśli 200 — user zalogowany, dane usera w stanie `AuthContext`.
3. Jeśli 403 (token wygasł/nie istnieje) — próba `POST /refresh` z refresh_token cookie. Backend rotuje token, zwraca nowy access token.
4. Jeśli refresh też się nie powiedzie — `isLoggedIn = false`, strony wymagające zalogowania przekierowują na `/login`.

Frontend: `src/_new/lib/auth/AuthContext.tsx` (Provider + `useAuth()`, eksport przez barrel `src/_new/lib/auth`) woła funkcje z `src/_new/lib/auth` (przechowywanie access tokenu) i `src/_new/features/auth/api/authApi.ts` (`getCurrentUser`, `logoutUser`).
Backend: `backend/api/v1/auth/router.py` — endpointy `/register`, `/verify-email`, `/resend-code`, `/login`, `/request-password-reset`, `/verify-reset-code`, `/reset-password`, `/google` (POST), `/users/me` (PUT), `/refresh`, `/me` (GET), `/logout`.

## Dwa stany aplikacji: zalogowany / niezalogowany

To rozróżnienie jest wpięte na kilku poziomach jednocześnie, nie w jednym miejscu — ważne żeby przy zmianie ruszyć wszystkie:

1. **Routing** — `(public)`, `(auth)` dostępne bez logowania; `(dashboard)`, `(whiteboard)` wymagają `isLoggedIn` (sprawdzane w layoutach tych grup, przekierowanie na `/login` jeśli brak sesji).
2. **UI** — `Header.tsx` (`src/app/(public)/_components/Header.tsx`) sam odpytuje `useAuth()` i renderuje inny zestaw przycisków/menu w zależności od stanu — nie ma osobnego komponentu na "zalogowany" i "niezalogowany" (scalone w ramach `header-consolidation`, patrz `docs/migration-status.md` — historia tej zmiany).
3. **Backend** — `Depends(get_current_user)` na endpointach wymagających zalogowania; brak/nieważny token → 401/403.

## Planowane: poziom subskrybenta (jeszcze nie zaimplementowane)

W przyszłości dojdzie trzeci stan poza zalogowany/niezalogowany: **subskrybent** (użytkownik płacący za dodatkowe funkcje). To wymaga zaplanowania już teraz, żeby późniejsze wdrożenie nie wymagało przebudowy modelu auth od zera:

- **Model danych:** najprościej dodać `subscription_tier` (np. `"free"` / `"pro"`) i `subscription_expires_at` bezpośrednio do tabeli `User`, albo osobną tabelę `Subscription` (user_id, plan, status, current_period_end) jeśli przewidujecie integrację z płatnym providerem (Stripe itp.) i historię płatności — osobna tabela jest bezpieczniejszym wyborem, bo subskrypcja ma własny cykl życia (odnowienie, anulowanie, płatność nieudana) niezależny od konta usera.
- **Warstwa autoryzacji (nie tylko uwierzytelniania):** obecny `get_current_user` odpowiada na pytanie "kim jesteś", subskrypcja wymaga drugiej warstwy "na co cię stać" — osobna zależność FastAPI, np. `get_current_subscriber`, którą dokłada się do endpointów wymagających płatnego planu, bez zmiany istniejącej logiki logowania.
- **Frontend:** `AuthContext`/`useAuth()` będzie musiał zwracać też `subscriptionTier` (albo osobny hook `useSubscription()`, jeśli info ma być pobierane osobno/rzadziej niż sesja) — routing i UI (dashboard, whiteboard) będą warunkować niektóre funkcje po tym polu tak samo jak dziś warunkują po `isLoggedIn`.
- **Gdzie to wpiąć:** ten dokument + `docs/roadmap.md` mają być zaktualizowane w momencie startu prac nad subskrypcjami — do tego czasu to jest tylko zarezerwowane miejsce w architekturze, nic więcej.

## Google OAuth

Google Identity Services (`@react-oauth/google`) po stronie frontendu — brak redirectu, brak backendowej wymiany kodu. Flow: frontend renderuje natywny przycisk Google (`GoogleOAuthButton`, `src/_new/features/auth/components/googleOAuthButton.tsx`), po zalogowaniu dostaje podpisany ID token bezpośrednio od Google i jednym `POST /api/v1/auth/google` wysyła go do backendu. Backend weryfikuje podpis/`aud`/`iss` lokalnie (`google.oauth2.id_token.verify_oauth2_token`, bez sieciowego round-tripu do Google) w `AuthService._verify_google_credential` (`backend/api/v1/auth/service.py`), następnie znajduje/tworzy usera (`_find_or_create_google_user`) i zwraca zwykły `AuthResponse` + refresh cookie, tak samo jak `login`/`verify-email`.

## CORS, proxy i rate limit (audyt 2026-09: SEC-04, SEC-06, SEC-14, SEC-21, SEC-25)

**CORS** — jedno źródło prawdy: `backend/core/cors.py` (`CorsPolicy`), używane przez `CORSMiddleware` i przez handler 500 w `main.py`. Refresh cookie idzie z `allow_credentials=True`, więc każdy dopuszczony origin może zawołać `POST /auth/refresh` i przeczytać access token — dlatego:

- originy to **jawna lista** z env `ALLOWED_ORIGINS` (przecinki; wpisy z `*` są odrzucane). Domyślnie: `https://easylesson.app`, `https://www.easylesson.app`, `https://platforma-edukacyjna-five.vercel.app` (domena przypisana do projektu Vercel) oraz `http://localhost:3000` i `http://localhost:8000`. Produkcja działa bez ustawiania env.
- regex `ALLOWED_ORIGIN_REGEX` jest **domyślnie pusty (wyłączony)**. Preview Vercela nazywają się `platforma-edukacyjna-<hash>-easylessons-projects.vercel.app` i `platforma-edukacyjna-git-<gałąź>-easylessons-projects.vercel.app`, ale wolną subdomenę `*.vercel.app` o takim kształcie może przypisać do swojego projektu dowolne konto Vercela, więc sufiks zespołu nie jest dowodem pochodzenia. Skutek: preview nie rozmawia z produkcyjnym API (logowanie na preview nie zadziała). Kto świadomie chce to włączyć, ustawia na Render np. `ALLOWED_ORIGIN_REGEX=https://platforma-edukacyjna-[a-z0-9-]+-easylessons-projects\.vercel\.app` (dopasowanie `fullmatch`) — bezpieczniej jest wpisać konkretny adres preview do `ALLOWED_ORIGINS` albo testować preview z własnym backendem.
- metody: `GET, POST, PUT, PATCH, DELETE, OPTIONS`; nagłówki żądania: `Authorization`, `Content-Type`, `X-Request-ID` (tyle wysyła `src/_new/lib/api/client.ts`); `X-Request-ID` jest też w `expose_headers`. **Nowy własny nagłówek wysyłany z przeglądarki do backendu trzeba dopisać do `ALLOWED_HEADERS` w `core/cors.py`**, inaczej preflight zwróci 400.

**IP klienta za proxy** — Render terminuje TLS przed uvicornem, więc bez nagłówków proxy `request.client.host` to adres proxy i rate limit miałby jeden kubełek na wszystkich. `main.py` dodaje `ProxyHeadersMiddleware` (z uvicorna) — w kodzie, żeby działało niezależnie od komendy startowej w panelu Render; `backend/Procfile` ma dodatkowo `--proxy-headers --forwarded-allow-ips='*'`. Zaufane adresy proxy: env `FORWARDED_ALLOW_IPS`; pusty = `*` na Render (wykrywane po env `RENDER`, serwis jest osiągalny tylko przez proxy Render), poza Render `127.0.0.1`. Ryzyko przy `*`: uvicorn bierze **pierwszy** wpis `X-Forwarded-For`, a ten klient może sfałszować, jeśli brzeg sieci dopisuje adres zamiast nadpisywać nagłówek — atakujący ominie wtedy limit per IP (limit per identyfikator, np. per login/e-mail, zostaje). Domknięcie: env `CLIENT_IP_HEADER` (np. `CF-Connecting-IP`) — gdy ustawiony i obecny w żądaniu, `core/rate_limit.get_client_ip` bierze IP z niego. Włączać dopiero po potwierdzeniu, że nagłówek dociera do aplikacji i jest nadpisywany przez brzeg.

**Rate limit** (`core/rate_limit.py`) — klucze per IP i opcjonalnie per pole z body. Złe body (niepoprawny JSON, lista zamiast obiektu) nie wywraca zależności: klucz per identyfikator jest pomijany, a 422 zwraca walidacja. Limity per IP mają też `POST /refresh` (300/min), `POST /logout` (60/min) i `PUT /users/me` (30/min) — te trzy z `fail_open=True` (awaria Redis nie blokuje odświeżania sesji); endpointy logowania/rejestracji zostają fail-closed (503). Znane ograniczenie: klucz per identyfikator pozwala zablokować cudze konto 10 nieudanymi logowaniami na 5 min — zaakceptowane.

**`avatar_url`** (`api/v1/auth/avatar_url.py`) — tylko `https`, maks. 500 znaków, host z allowlisty: host z `SUPABASE_URL` (ścieżka `/storage/v1/object/public/...`) albo `lh3.googleusercontent.com`. **Logowanie hasłem na konto Google bez hasła** zwraca 401 „Błędny login lub hasło" (wcześniej 500).

## Znane do zrobienia

Nic otwartego po stronie architektury auth: `AuthContext` jest już w `src/_new/lib/auth`, backend używa wyłącznie `python-jose`. Rate limit logowania/rejestracji: `backend/core/rate_limit.py` (Redis). Token usera jest też akceptowany przez `whiteboard-sync` (weryfikacja przez `GET /api/v1/whiteboard/{id}/access`) i przez Route Handler `/api/chat` (weryfikacja przez `GET /api/v1/auth/me`) — obie usługi delegują do tego samego `get_current_user`.
