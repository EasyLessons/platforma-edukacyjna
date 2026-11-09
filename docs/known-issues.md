# Znane problemy — backlog z priorytetem

Miejsce na realne buble znalezione w czasie pracy/testów (nie mylić z `docs/migration-status.md`, który śledzi TYLKO postęp migracji na architekturę feature-based, i z `docs/roadmap.md`, który jest o nowych funkcjach). Tu lądują rzeczy, które już DZIAŁAJĄ, ale robią coś złego albo mylącego.

Format wpisu: co się dzieje, jak to odtworzyć, co naprawdę się dzieje pod spodem (root cause), jak groźne, opcje naprawy. Priorytet ustawiany ręcznie — wysoki/średni/niski.

---

## 4. Nowy workspace/tablica nie pojawiają się bez F5 — dwa niezależne miejsca z brakującą inwalidacją cache React Query (wysoki priorytet — częste, codzienne akcje)

**Zgłoszone:** 23.07.2026, produkcja (easylesson.app), ręczny test. Dwa osobne, ale identyczne w naturze objawy:

1. Zaakceptowanie zaproszenia do workspace z panelu powiadomień — nowy workspace nie pojawia się na liście, dopóki nie zrobi się F5.
2. Utworzenie nowej tablicy z szablonu (sekcja "Szablony" na dashboardzie) i powrót do listy tablic w danym workspace — nowa tablica nie pojawia się, dopóki nie zrobi się F5.

### Co naprawdę się dzieje (root cause)

Apka używa React Query jako współdzielonego cache'u danych (`workspaceKeys.list()`, `boardKeys.workspace(id)` — patrz `hooks/useWorkspaces.ts`/`hooks/useBoard.ts`). Każda mutacja (tworzenie/edycja/usuwanie) ma w `onSuccess` wywołanie `queryClient.invalidateQueries(...)`, które każe React Query odświeżyć dane WSZĘDZIE, gdzie są aktualnie wyświetlane — niezależnie od tego, który komponent trzyma jaki lokalny stan. To działa poprawnie tam, gdzie się z tego korzysta. Problem: znalazłem dwa miejsca, które to omijają.

1. **Panel powiadomień (`NotificationPanel`) dostawał `onWorkspacesRefresh` jako prop z `DashboardHeader`, a `DashboardHeader` dostawał `refreshWorkspaces` jako prop z `layout.tsx` (`src/app/(dashboard)/layout.tsx`).** Ten layout renderuje `<DashboardHeader />` **bez żadnych propsów** — więc `refreshWorkspaces` w `DashboardHeader.tsx` zawsze spadał na domyślną wartość `async () => {}` (cichy no-op). `dashboard/page.tsx` ma swoją WŁASNĄ, działającą kopię `refreshWorkspaces` z `useWorkspaces()`, ale nigdy jej nie przekazuje do headera (bo header żyje w layoucie o poziom wyżej, nie na samej stronie) — więc ta prawdziwa funkcja i tak nigdzie nie docierała do panelu powiadomień. Efekt: kliknięcie "Akceptuj" faktycznie akceptowało zaproszenie w bazie (stąd toast sukcesu), ale nigdy nie mówiło React Query "odśwież listę workspace'ów".
2. **Tworzenie tablicy z szablonu (`TemplateSection.tsx`, funkcja `createAndOpenBoard`) woła gołą funkcję API `createBoard()` z `board/api/boardApi.ts` bezpośrednio**, zamiast przez `useBoards()` (hook z `useMutation`, którego `onSuccess` robi `queryClient.invalidateQueries({ queryKey: boardKeys.workspace(workspace_id) })` — patrz `hooks/useBoard.ts`). Zwykłe tworzenie tablicy przez modal w `BoardsSection.tsx` idzie przez `useBoards()` poprawnie i działa bez zarzutu — tylko ścieżka "z szablonu" ma osobną, niezależną implementację, która nigdy nie dotyka cache'u.

W obu przypadkach dane w bazie są od razu poprawne (żadnej utraty danych) — user po prostu nawiguje do nowej tablicy/workspace'u i widzi ją poprawnie tam, ale wracając do listy nie widzi jej, bo lista czyta ze STAREGO zapamiętanego stanu React Query, którego nikt nie kazał odświeżyć.

### Jak groźne

Wysoki priorytet mimo że to "tylko" UI (bez utraty danych) — bo to dwie z najczęstszych, najbardziej podstawowych akcji w apce (dołączanie do workspace'u, tworzenie tablicy), i user myśli że coś nie zadziałało/zniknęło.

### Naprawione

- **`DashboardHeader.tsx`** — dodane wywołanie `useWorkspaces()` bezpośrednio w komponencie; `refreshWorkspaces` z propsów (`refreshWorkspacesProp`) jest teraz tylko opcjonalnym nadpisaniem, z realnym fallbackiem zamiast cichego no-opa. Ponieważ `useWorkspaces()` czyta/pisze do tego samego globalnego `queryClient` (owiniętego w `QueryProvider` w `src/app/layout.tsx`, ponad całą apką) co `dashboard/page.tsx`, wywołanie stąd poprawnie odświeża dane wszędzie.
- **`TemplateSection.tsx`** — po udanym `createBoard(...)` dodane jawne `queryClient.invalidateQueries({ queryKey: boardKeys.workspace(workspaceId) })` (ten sam klucz, którego używa `useBoards`), zanim nastąpi `router.push()` do nowej tablicy. Zaimportowany `useQueryClient` i `boardKeys` z `hooks/useBoard.ts`.

Zweryfikowane: `npx tsc --noEmit` scoped na oba zmienione pliki — zero błędów. **Nie zweryfikowane jeszcze na żywo** (wymaga wdrożenia na produkcję — patrz uwaga o niewypchniętych commitach w tej samej sesji) — do przetestowania po `git push`: zaproś kogoś do workspace'u i sprawdź czy lista odświeża się bez F5 po akceptacji; utwórz tablicę z szablonu i sprawdź czy pojawia się na liście bez F5 po powrocie do dashboardu.

**Stan 10.11.2026 (`release/baseline`):** obie poprawki są w kodzie — `src/_new/features/dashboard/components/header/DashboardHeader.tsx` woła `useWorkspaces()` i używa `refreshWorkspacesProp ?? refreshWorkspacesFallback` (linie 50–51), `src/_new/features/dashboard/components/TemplateSection.tsx` robi `queryClient.invalidateQueries({ queryKey: boardKeys.workspace(workspaceId) })` po utworzeniu tablicy (linia 207). Potwierdzenia na żywo (produkcja, dwie karty) nie ma w żadnym zapisie — wpis zostaje jako „naprawione w kodzie, niezweryfikowane ręcznie”; brak też testu automatycznego na ten scenariusz.

---

## 5. Makiety w panelu konta: adresy, płatności, bezpieczeństwo — bez backendu (niski priorytet, świadome)

**Zgłoszone:** 21.09.2026, przy inwentaryzacji do `architecture/REFAKTOR-PLAN.md` (decyzja P2).

### Co się dzieje

W `/account` sekcje „Adresy”, „Płatności” i „Bezpieczeństwo” (`AddressBook`, `PaymentMethods`, `SecurityCenter` w `src/_new/features/account/components/_mock/`, ~1 700 linii) wyglądają jak działające, ale to makiety: dane pochodzą z tablic `mock*` w komponentach, żaden endpoint FastAPI ich nie obsługuje, nic nie jest zapisywane, a po odświeżeniu strony wszystko wraca do stanu początkowego.

### Jak groźne

Myli usera (może sądzić, że zapisał kartę/adres). Nie psuje niczego innego.

### Decyzja

Zostają w folderze `_mock/` jako zalążek przyszłych sekcji konta (opis w `README.md` obok). Realna funkcja = endpointy + `api/` + hooki w `features/account` i usunięcie `_mock/`. Do tego czasu: nie rozbudowywać makiet.

## 6. Warningi ESLint: zostało 16 (niski priorytet)

**Zgłoszone:** 22.09.2026, PR `chore/logger-no-console`.

**Stan 10.11.2026 (po etapie F, gałąź `feat/usun-stary-silnik`):** `npm run lint` = 0 błędów, **16 warningów** (na `release/baseline` 49; 33 zniknęły razem ze starym silnikiem i starym czatem). Wszystkie 16 to `react-hooks/exhaustive-deps`: `useNotifications.tsx` (3), `whiteboard/page.tsx` (2), `useWorkspaces.ts` (2), `smart-search-bar.tsx` (2), `useBoard.ts` (2), po 1: `useWorkspaceMember.ts`, `useWorkspaceInvite.ts`, `useEditWorkspaceForm.ts`, `calculator-tool.tsx`, `useEditBoardForm.ts`, `board-engine/components/function-panel.tsx`. Podział niżej pochodzi z 22.09 (historyczny).

### Co się dzieje

`npm run lint` miał 134 warningi (84 × `no-console`, 49 × `exhaustive-deps`, 1 nieużyta dyrektywa). W tym PR `console.log` poza strefą Yjs poszły przez `createLogger` (`src/_new/lib/logger.ts`, opis w `architecture/frontend-structure.md` → „Logowanie”), martwe logi diagnostyczne usunięte, a trzy miejsca wypisywały dane wrażliwe (odpowiedź Xirsys z loginem/hasłem TURN w `voice-chat/constants.ts`, `formData` z e-mailem w `account/.../BasicInfo.tsx`, cały wiersz `workspace_members` w `app/(whiteboard)/whiteboard/page.tsx`) — zredukowane do statusów/liczników. Efekt uboczny: `debug`/`info` są w `NODE_ENV=test` cicho, więc flake vitesta `EnvironmentTeardownError: Closing rpc while "onUserConsoleLog" was pending` z testów voice-chat nie ma już źródła (pełny `npm run test` po zmianie: 549 passed, bez błędu).

### Co zostaje i dlaczego

- **Strefa `feature/whiteboard-yjs` (Bartek), 33 warningi:** `whiteboard-canvas.tsx` (29 × `exhaustive-deps` + 1 nieużyty `eslint-disable`), `realtime/logger.ts` (2 × `no-console` — mini-logger legacy, do zastąpienia `createLogger` w PR-C1), `realtime/useSafeBroadcast.ts` (1). Nie ruszać do czasu merge'u gałęzi Yjs.
- **Poza strefą, 19 × `exhaustive-deps`:** `useNotifications.tsx` (3), `board/hooks/useBoard.ts` (2), `toolbar/eraser-tool.tsx` (2), `toolbar/pan-tool.tsx` (2), `workspace/hooks/useWorkspaces.ts` (2), po 1: `useEditBoardForm.ts`, `voice-chat/useVoiceSignaling.ts`, `smart-search-bar.tsx`, `calculator-tool.tsx`, `function-tool.tsx`, `useEditWorkspaceForm.ts`, `useWorkspaceInvite.ts`, `useWorkspaceMember.ts`. Każdy wymaga osobnej decyzji (dodanie zależności do `useEffect`/`useCallback` zmienia, kiedy efekt się odpala — to zmiana logiki, nie kosmetyka), więc świadomie poza PR-em „logger”.

### Opcje

Osobny PR per feature, każdy warning z uzasadnieniem: albo brakująca zależność naprawdę powinna tam być, albo `useRef`/`useEffectEvent` zamiast `eslint-disable`. Nie wyciszać hurtowo dyrektywą.

## 7. Kopie lokalne tablic (IndexedDB) — konsekwencje operacyjne (średni priorytet, świadome)

**Zgłoszone:** 29.09.2026, PR `feat/whiteboard-local-cache`.

### Co się dzieje

Przeglądarki trzymają kopie tablic w IndexedDB (opis: `architecture/pipelines.md` §2b, „Kopia lokalna”). CRDT scala kopię klienta z serwerem przy każdym połączeniu, więc stan serwera nie jest już jedynym źródłem prawdy dla zmian, które klient ma lokalnie. Dotyczy **obu** silników — Excalidraw też używa `useYjsLocalCache` (`board-engine/yjs/use-board-connection.ts`), więc wpis zostaje po etapie F.

### Skutki

1. **Przywrócenie tablicy z backupu częściowo się cofa.** Klient, który ma w kopii nowsze elementy, przy następnym połączeniu wyśle je z powrotem na serwer. Dotyczyło to już wcześniej otwartych kart; kopia lokalna rozszerza to na karty zamknięte (do 14 dni).
2. **Zalogowanie innego konta na tej samej przeglądarce usuwa niewysłane zmiany poprzedniego użytkownika** (`sweepForeignBoardCaches`) — świadomie, bezpieczeństwo danych ważniejsze.
3. **Wylogowanie, gdy tablica jest otwarta w innej karcie**: usunięcie bazy czeka, aż ta karta zostanie zamknięta (blokada IndexedDB, w konsoli ostrzeżenie `usunięcie … czeka na zamknięcie innej karty`).

### Procedura: przywracanie tablicy z backupu

1. Podbić `CACHE_VERSION` w `src/_new/lib/board-cache/board-cache.ts` i wdrożyć frontend — każdy klient przy następnym logowaniu/otwarciu tablicy usunie stare kopie.
2. Wstrzymać whiteboard-sync (Render → Suspend), żeby dokument w pamięci Hocuspocusa nie nadpisał przywróconego.
3. Przywrócić wiersz `board_documents`, wznowić whiteboard-sync.
4. Otwarte w tym czasie karty nadal mają starą wersję w pamięci — jeśli to istotne, poprosić użytkowników tablicy o przeładowanie przed kontynuowaniem pracy.

## 8. Stopka landingu: placeholderowy telefon, prawdopodobnie nieistniejące linki social (niski priorytet, treść)

**Aktualizacja 10.11.2026 (release/baseline):** link `/faq` poprawiony na `/docs/faq` (commit `f9cf610`); `/api/contact` przepisany (commit `ebb75b7`): mail jako `text` z `reply_to` nadawcy, nadawca `EasyLesson <onboarding@resend.dev>`, limit per IP, honeypot — nadawca z własnej domeny wymaga weryfikacji domeny w Resend (Patryk). Telefon i linki social nadal do decyzji.

**Zgłoszone:** 10.11.2026, audyt `release/baseline`.

### Co się dzieje

`src/_new/features/landing/navigation/Footer.tsx`: `href="tel:+48123456789"` (linia 86) to numer-wypełniacz; linki social `https://youtube.com/@easylesson`, `https://instagram.com/easylesson`, `https://facebook.com/easylesson` (linie 39–64) prawdopodobnie nie prowadzą do istniejących profili (nie da się tego sprawdzić w kodzie — do potwierdzenia przez Patryka); link `href="/faq"` (linia 194) prowadzi do 404, bo FAQ jest pod `/docs/faq` (`src/app/(info)/docs/faq/page.tsx`). Adres e-mail `kontakt@easylesson.app` jest poprawny i spójny z `/contact`, stronami prawnymi i `UpgradeModal`. Pokrewne: formularz `/api/contact` (`src/app/api/contact/route.ts`) wysyła maile z nadawcą `Acme <onboarding@resend.dev>` (domyślny nadawca testowy Resend) i tytułem o „Dziale Sprzedaży” — do podmiany na zweryfikowaną domenę `easylesson.app`.

### Jak groźne

Użytkownik dzwoni donikąd albo trafia na 404 — psuje wiarygodność strony, nie dotyka danych.

### Opcje

Usunąć telefon (albo wstawić prawdziwy), usunąć linki do profili, które nie istnieją, zmienić `/faq` na `/docs/faq`. Zmiana czysto treściowa, bez ryzyka.

## 10. Telefon: nagłówek tablicy Excalidraw nie ma logo ani przycisku powrotu — w demo brak drogi na landing (NAPRAWIONE 10.11.2026)

**Zgłoszone:** 10.11.2026, audyt `release/baseline`. **Naprawione** tego samego dnia (commit `3a15d49`): w gałęzi phone lewa karta ma kompaktowy przycisk z logo (`data-testid="header-home-button"`, prowadzi do `homeHref`) obok przycisku sidebara. Zweryfikowane vitest + typecheck; bez osobnego testu e2e (do dopisania w `demo.spec.ts`/`board-engine.mobile.spec.ts`). Opis pierwotny poniżej.

### Co się dzieje

`src/_new/features/board-engine/components/excalidraw-header.tsx`, lewy górny róg (linie 155–168): przy `metrics.isPhoneLayout` renderowany jest wyłącznie przycisk sidebara (i tylko gdy strona poda `onSidebarToggle`); karta z logo i linkiem `homeHref` (`/` dla demo, panel dla zalogowanego — linie 80–81, 170–172) jest tylko w gałęzi desktop. Na `/demo/<id>` na telefonie nie ma więc żadnego elementu prowadzącego z powrotem na landing — zostaje gest „wstecz” przeglądarki.

### Jak groźne

Gość testujący demo z telefonu nie ma w aplikacji drogi do rejestracji/landingu; zalogowany ma sidebar, więc u niego to tylko brak logo.

### Opcje

W gałęzi phone dodać kompaktowy przycisk z logo/strzałką prowadzący do `homeHref` (obok przycisku sidebara, a w demo zamiast niego). Test: `e2e/board-engine.mobile.spec.ts` / `e2e/demo.spec.ts`.

## 11. Strony prawne: różne nazwy podmiotu („EasyLesson.pl” vs „Easylesson Sp. z o.o.”) (średni priorytet, do potwierdzenia przez Patryka)

**Zgłoszone:** 10.11.2026, audyt `release/baseline`.

### Co się dzieje

`src/app/(info)/terms/page.tsx` linia 16 mówi o „Platformie Edukacyjnej **EasyLesson.pl**”, a `src/app/(info)/privacy-policy/page.tsx` (linie 16, 302) o administratorze „**Easylesson Sp. z o.o.**”. W kodzie nie ma źródła prawdy o podmiocie; wg `ADR-silnik-tablicy.md` §7 Patryk nie ma jeszcze działalności, więc spółka z o.o. w polityce prywatności jest najpewniej szablonem. Powiązane: SEC-17 w `docs/security/AUDYT-2026-09.md` (polityka nie wymienia procesorów: Gemini, Supabase, Resend, Daily).

### Jak groźne

Niespójne dane podmiotu w dokumentach prawnych; nie dotyka działania aplikacji.

### Opcje

Patryk ustala właściwą nazwę podmiotu i domenę; jedna poprawka w obu plikach (plus `terms-of-use`, `gdpr`, `cookies-policy` do przejrzenia pod tym kątem).

## 12. Sekcja cennika na landingu obiecuje co innego niż robi produkt (średni priorytet, treść vs kod)

**Zgłoszone:** 10.11.2026, audyt `release/baseline`.

### Co się dzieje

`src/_new/features/landing/sections/PricingSection.tsx`: trzy plany („Starter”, „Premium”, „Inteligentny Korepetytor” — linie 152–182), przyciski „Kup plan Premium” / „Kup plan AI Tutor” prowadzące do `/register?plan=...`, „3 aktywne tablice jednocześnie” (linia 14), „Przełączaj miesięcznie lub rocznie” (linia 119). Kod ma dwa plany `free`/`premium` bez płatności (`backend/api/v1/plans/limits.py`), a limity Free to 2 przestrzenie / 3 tablice **na przestrzeń** / 1000 elementów / 100 MB; parametr `?plan=` nie jest nigdzie obsługiwany (żadnego `searchParams.get('plan')` w `(auth)/register` ani `features/auth`); Premium nadaje się ręcznie SQL-em (`docs/plan-subskrypcje.md`). Te same linki `/register?plan=...` są też w `landing/navigation/mega-menus/PricingMegaMenu.tsx`.

### Jak groźne

Użytkownik klika „Kup” i trafia na zwykłą rejestrację; obietnice z landingu nie mają pokrycia. Nie dotyka danych.

### Opcje

Do czasu płatności (Stripe, `roadmap.md`): sekcja z dwoma planami (Free z realnymi limitami, Premium „wkrótce / napisz na kontakt@easylesson.app”) albo ukrycie cennika. Treść do decyzji Patryka.

## Naprawione (10.11.2026, audyt przed BASELINE na `release/baseline`)

Krótkie wpisy — pełny opis w komunikatach commitów.

- **„Moje Szablony” na tablicy Excalidraw** otwierało `SavedAssetsPanel` starego silnika: przeciągnięcie zasobu nic nie robiło (Excalidraw nie obsługuje tego dropu), a nic na Excalidraw nie tworzyło zasobów. Przycisk i panel usunięte z tablicy (`3a15d49`); kod panelu zostaje do etapu F. Decyzja produktowa: czy zastąpić biblioteką Excalidraw (`UIOptions`/`updateLibrary`).
- **„Test głosu” w menu ⋮ nagłówka** pokazywał fałszywy toast „Mikrofon działa prawidłowo” bez żadnego testu — usunięte (`3a15d49`).
- **Ustawienie tablicy „Toolbar” (`toolbar_visible`) było ignorowane** na Excalidraw — teraz chowa własny pionowy pasek (`3a15d49`).
- **Kotwica `/#pricing`** (menu użytkownika, nagłówek tablicy, Tutor AI) nie działała, bo sekcja cennika miała `id="pakiet-premium"` — id zmienione na `pricing`, stopka i regulamin zaktualizowane (`f9cf610`).
- **Panel konta „Edytuj / Zapisz zmiany”** nic nie zapisywało (`TODO` w kodzie; `PUT /users/me` przyjmuje tylko `avatar_url`) — formularz usunięty, pola tylko do odczytu, etykieta „Nazwa użytkownika” (`98edabd`). Edycja nazwy = nowa funkcja (endpoint), decyzja produktowa.
- **`/api/contact`** bez limitu, walidacji długości i z HTML-em od nadawcy w mailu (SEC-08) — patrz #8 (`ebb75b7`).
- **Gość bez konta był wyrzucany z landingu na `/login`** (także `/register`, `/reset-password`, `/docs`, `/product`, strony prawne): `AuthProvider` w root layoucie woła `/auth/me`, 401 → nieudany refresh → `logoutAndRedirect`, a lista ścieżek publicznych znała tylko `/login`, `/rejestracja` (nieistniejąca trasa), `/auth`, `/demo`. Zalogowani tego nie widzieli. Teraz publiczne = wszystko poza `/dashboard` i `/whiteboard` (jak `matcher` w `middleware.ts`), e2e sprawdza `/`, `/register`, `/docs/faq` (`cd48f0b`).
- **CSP blokowałaby wideo hero landingu** (`media-src` bez hosta R2 z `HeroSection.tsx`/`ProductHero.tsx`) — host dopisany, e2e landingu pod CSP (`204259b`).
- **`/whiteboard` bez `?boardId=` otwierało relikt `demo-board`** (dawny wpis #9): strona przekierowuje teraz na `/dashboard` (także przy nieliczbowym id), a `src/middleware.ts` nie zna już ciasteczka `demo_mode` (etap F, gałąź `feat/usun-stary-silnik`).

## Zasada

Nowy błąd znaleziony w czasie pracy/testów → nowy wpis tutaj, w tym samym formacie (odtworzenie, root cause, opcje naprawy), z priorytetem. Jak coś zostanie naprawione, wpis przenosimy na dół pod `## Naprawione` (do stworzenia gdy pierwszy taki przypadek się pojawi) zamiast kasować — żeby było widać historię.
