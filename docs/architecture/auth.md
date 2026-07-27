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

1. `AuthProvider` (`src/app/context/AuthContext.tsx`) montuje się i wywołuje `GET /me` z access tokenem z pamięci.
2. Jeśli 200 — user zalogowany, dane usera w stanie `AuthContext`.
3. Jeśli 403 (token wygasł/nie istnieje) — próba `POST /refresh` z refresh_token cookie. Backend rotuje token, zwraca nowy access token.
4. Jeśli refresh też się nie powiedzie — `isLoggedIn = false`, strony wymagające zalogowania przekierowują na `/login`.

Frontend: `src/app/context/AuthContext.tsx` (Provider + `useAuth()`) woła funkcje z `src/_new/lib/auth` (przechowywanie access tokenu) i `src/_new/features/auth/api/authApi.ts` (`getCurrentUser`, `logoutUser`).
Backend: `backend/api/v1/auth/router.py` — endpointy `/register`, `/verify-email`, `/resend-code`, `/login`, `/check-user`, `/search-users`, `/request-password-reset`, `/verify-reset-code`, `/reset-password`, `/google-login`, `/google-callback`, `/users/me` (PUT), `/refresh`, `/me` (GET), `/logout`.

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

`Authlib` po stronie backendu. Flow: `GET /google-login` (przekierowanie do Google) → `GET /google-callback` (Google odsyła z kodem, backend wymienia go na dane usera, tworzy/loguje konto, ustawia cookies) → frontend `src/app/(auth)/auth/callback/page.tsx` (`useAuthCallback` z `src/_new/features/auth/hooks`) odbiera i kończy logowanie po stronie klienta.

## Znane do zrobienia

Patrz `docs/migration-status.md`: przeniesienie `AuthContext` do `src/_new`, ujednolicenie bibliotek JWT po stronie backendu (`python-jose` vs `PyJWT`).
