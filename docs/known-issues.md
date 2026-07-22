# Znane problemy — backlog z priorytetem

Miejsce na realne buble znalezione w czasie pracy/testów (nie mylić z `docs/migration-status.md`, który śledzi TYLKO postęp migracji na architekturę feature-based, i z `docs/roadmap.md`, który jest o nowych funkcjach). Tu lądują rzeczy, które już DZIAŁAJĄ, ale robią coś złego albo mylącego.

Format wpisu: co się dzieje, jak to odtworzyć, co naprawdę się dzieje pod spodem (root cause), jak groźne, opcje naprawy. Priorytet ustawiany ręcznie — wysoki/średni/niski.

---

## 1. Wyścig: usunięcie elementów w momencie dołączania drugiej osoby → element "wraca", drugie usunięcie rzuca 404 (średni priorytet)

**Zgłoszone:** lipiec 2026, w czasie ręcznego testu współbieżności (dwie karty przeglądarki, F5 na jednej podczas gdy druga dołączała).

### Jak to odtworzyć

1. User A ma otwartą tablicę z ~20 zaznaczonymi elementami.
2. User B w tym samym momencie dołącza do tej samej tablicy (strona się ładuje).
3. User A usuwa zaznaczone elementy (Delete).
4. User B, gdy się doładuje, widzi te elementy z powrotem (mimo że A je usunął).
5. User A usuwa je drugi raz → w konsoli sypie się `AppError: Element nie znaleziony` (backend zwraca 404 na `DELETE /whiteboard/{board_id}/elements/{element_id}`), po jednym błędzie na element.

### Co naprawdę się dzieje (root cause)

To wyścig między trzema rzeczami, które nie są ze sobą zsynchronizowane:

1. **Usuwanie jest optymistyczne i asynchroniczne.** `engine.deleteElements()` (`src/_new/features/whiteboard/engine/use-whiteboard-engine.ts:95-125`) usuwa elementy **lokalnie natychmiast**, a dopiero potem — w tle, w paczkach po 20, z opóźnieniem 50ms między paczkami — wysyła `DELETE` do backendu dla każdego elementu. Błędy tych wywołań są tylko logowane (`.catch(console.error)`), nic nie czeka na ich zakończenie i nic nie cofa lokalnego stanu jeśli się nie uda.
2. **Nowo dołączający klient pobiera stan przez zwykłe REST `GET /whiteboard/{id}/elements`**, niezależnie od realtime. Jeśli ten request trafi do backendu **zanim** async-owe DELETE-e z punktu 1 zdążą się wykonać, User B dostaje z bazy elementy, które User A już "usunął" u siebie — bo backend jeszcze naprawdę ich nie usunął.
3. **Supabase Broadcast nie ma pamięci ani gwarancji dostarczenia spóźnionym subskrybentom.** Jeśli User A wysłał broadcast `element-deleted` zanim User B zdążył w pełni podłączyć się do kanału, User B **nigdy nie dostanie tego eventu** — jego jedynym źródłem prawdy staje się REST fetch z punktu 2, który mógł być stary.

Efekt: User B faktycznie "na chwilę" ma u siebie elementy, których User A już nie chce. Gdy User A usuwa je drugi raz, backend tym razem **faktycznie już ich nie ma** (pierwsze DELETE-e w końcu doszły) — stąd 404 "Element nie znaleziony". To nie jest utrata danych ani błąd w naszym dzisiejszym refaktorze `BoardRealtimeContext` — kod odpowiedzialny (`use-elements.ts`, `use-whiteboard-engine.ts`) nie był dziś ruszany (zweryfikowane `git diff --ignore-all-space` — zero realnych zmian).

### Jak groźne

Niskie ryzyko utraty danych (elementy naprawdę się usuwają, tylko z opóźnieniem/niespójnie widoczne między klientami). Realny problem to: mylący UX (rzeczy "wracają"), zaśmiecona konsola błędami, i to że przy większej liczbie userów dołączających w locie ten wyścig będzie się zdarzał częściej.

### Opcje naprawy (do decyzji, nic z tego jeszcze nie wdrożone)

- **A — zrób DELETE idempotentny.** Backend przy próbie usunięcia nieistniejącego elementu zwraca sukces (200/204) zamiast 404 — "usuń coś czego już nie ma" to w tym kontekście nieszkodliwy no-op, nie błąd. Najmniejsza zmiana, usuwa spam w konsoli, nie rozwiązuje samego "elementy na chwilę wracają".
- **B — wykorzystać istniejącą kolumnę `is_deleted` na `BoardElement` (soft delete).** Model już to ma (patrz `docs/architecture/backend-structure.md`), ale endpoint `DELETE /elements/{id}` wygląda na twarde usuwanie z bazy (inaczej drugie DELETE nie dostałoby 404, tylko trafiłoby na wiersz z `is_deleted=True`). Gdyby `GET /elements` filtrował po `is_deleted=False`, a DELETE tylko ustawiał flagę — nowo dołączający klient nigdy nie dostałby już usuniętego elementu przez REST, niezależnie od tego czy zdążył złapać broadcast.
- **C — kolejkowanie/replay eventów dla klienta w trakcie dołączania.** Bardziej złożone: nie wysyłać żadnych broadcastów do momentu aż nowy klient w pełni dołączy do kanału, albo dawać mu "domknięcie" przez pełny sync zamiast polegać na REST + broadcast osobno. Największy nakład pracy, najpełniejsze rozwiązanie.

Rekomendacja na pierwszy rzut oka: **B** rozwiązuje problem u źródła i korzysta z kolumny, którą już macie w bazie — ale wymaga zmiany semantyki DELETE (soft zamiast hard) i sprawdzenia czy coś innego (undo/redo, "activity history") zakłada twarde usuwanie.

### Efekt uboczny do zbadania osobno

Ten sam log pokazał serię `401 Unauthorized` na starcie strony (`/me`, `/boards`, `/whiteboard/.../elements`) zanim wszystko się załadowało poprawnie — wygląda na wyścig przy starcie sesji (requesty lecą zanim token się odświeży). Nie zbadane jeszcze, prawdopodobnie osobny, niezależny temat.

---

## 2. Przesunięcie/obrót zdjęcia nie synchronizuje się w realtime — widać dopiero po F5 (wysoki priorytet)

**Zgłoszone:** lipiec 2026, produkcja (easylesson.app), w czasie ręcznego testu współbieżności.

**Ważne — to NIE jest błąd z dzisiejszego refaktoru `BoardRealtimeContext`.** User zgłosił to na `easylesson.app`, a nie na localhost, i żaden dzisiejszy commit nie został wypchnięty — czyli produkcja i tak leci na starym, sprzed-refaktoru kodzie. Sprawdziłem to wprost: `git show HEAD:src/app/context/BoardRealtimeContext.tsx` (czyli ostatnia wersja przed naszym podziałem) ma **bajt w bajt tę samą** funkcję `safeBroadcast` co dzisiejszy `useSafeBroadcast.ts` — więc błąd siedział tam już wcześniej.

### Jak to odtworzyć

1. User A i User B mają otwartą tę samą tablicę z jakimś zdjęciem na niej.
2. User A przesuwa albo obraca to zdjęcie.
3. User B u siebie **nic nie widzi** — zdjęcie zostaje na starym miejscu/kącie.
4. Dopiero po odświeżeniu strony (F5) u User B zdjęcie pokazuje się we właściwym miejscu.

### Co naprawdę się dzieje (root cause)

Dwie rzeczy nakładają się na siebie:

1. **Update elementu wysyła CAŁY obiekt, łącznie z danymi zdjęcia.** `ImageElement.src` potrafi być base64 (patrz `src/_new/features/whiteboard/types/elements.ts:94` — komentarz wprost mówi "URL lub base64"). Kiedy przesuwasz albo obracasz zdjęcie, zmienia się tylko `x`/`y`/`rotation`, ale `broadcastElementUpdated` i tak wysyła **cały element razem z base64 obrazka** (`src/app/context/BoardRealtimeContext.tsx`, funkcja `broadcastElementUpdated` → `safeBroadcast('element-updated', { element, ... })`). Renderowanie zdjęcia samo w sobie NIE potrzebuje ponownego ładowania obrazka przy samym przesunięciu (`handlers/image-handler.ts` rysuje z cache `loadedImages` na podstawie samych `x`/`y`/`rotation` elementu) — ale mimo to za każdym razem leci pełny, ciężki payload, bo update nie rozróżnia "zmieniła się tylko pozycja" od "zmieniła się treść".
2. **`safeBroadcast` nie sprawdza, czy wysyłka faktycznie się udała.** `channel.send()` z Supabase JS zwraca (nie rzuca!) status `'ok' | 'timed_out' | 'error'`. Kod w `useSafeBroadcast.ts` (i identycznie w starej wersji na produkcji) robi tylko `try { await channel.send(...); return true } catch { return false }` — **nigdy nie czyta zwróconego statusu**. Jeśli Supabase odrzuci wiadomość jako za dużą (Realtime Broadcast ma limit rozmiaru payloadu — to ten sam limit, przez który `broadcastSyncResponse` musi ciąć dane na paczki po `SYNC_CHUNK_SIZE`, patrz komentarz w `types.ts:114`), `channel.send()` **nie rzuca wyjątku**, tylko cicho zwraca `'error'`/`'timed_out'` — a nasz kod i tak zwraca `true` (sukces). Efekt: żadnego retry (bo kod myśli, że się udało), żadnego błędu w konsoli, event po prostu nigdy nie dociera do drugiego usera.

Dla zwykłych kształtów (linie, prostokąty, tekst) update jest mały i mieści się bez problemu, więc tam wszystko synchronizuje się normalnie — problem widać właśnie i tylko przy zdjęciach, bo tylko one dźwigają duży ładunek danych w `src`.

**Aktualizacja — sprawdzone w oficjalnej dokumentacji Supabase (docs.supabase.com/guides/realtime/limits, sprawdzone 22.07.2026):** limit rozmiaru payloadu Broadcast zależy od planu: **256 KB na planie Free**, 3 000 KB na Pro/Team/Enterprise. Zdjęcie zakodowane w base64 (typowe zdjęcie z telefonu, nawet skompresowane) bardzo łatwo przekracza 256 KB — więc jeśli projekt jest na planie Free, PRAWIE KAŻDY update zdjęcia przekracza limit i jest odrzucany po stronie Supabase. To też odpowiada na pytanie „czemu kiedyś działało, a teraz nie" — nie trzeba żadnej zmiany w kodzie, wystarczyło że zdjęcia w czasie używania appki zrobiły się większe (lepsze aparaty, większe pliki) albo limit planu Supabase został ostatnio wyegzekwowany surowiej. **Do sprawdzenia:** jaki plan Supabase jest używany na produkcji (Free vs Pro), i czy w Dashboard → Realtime Logs pojawiają się odrzucone wiadomości / błędy przekroczenia limitu w czasie zgłoszonych problemów.

**Aktualizacja 2 — kontrargument od usera + sprawdzone logi API (22.07.2026, ~23:14).** User wkleił małe, prawie całkiem czarne zdjęcie (mała waga pliku) — wkleiło się i przesuwanie działało. To NIE obala teorię o limicie rozmiaru — małe/proste zdjęcie (dużo czerni = świetna kompresja) może po prostu nie zbliżać się do 256 KB, więc taki test nie sprawdza tego samego przypadku co duże zdjęcie z telefonu. Sprawdziłem też wklejone logi z ostatnich ~20 minut z panelu Supabase: same `POST /realtime/v1/api/broadcast → 202` (przyjęte), zero widocznych błędów 4xx/5xx. Ale to prawdopodobnie **ogólny log API** (widać tam też `/auth/v1/health`, `/rest-admin/v1/ready`), nie ten sam co „Realtime Logs/Inspector" z dokumentacji, który pokazuje odrzucenia na poziomie fan-out do innych subskrybentów — `202` znaczy tylko „przyjąłem Twoją wiadomość", nie „na pewno dotarła do wszystkich". Zauważyłem też coś wartego sprawdzenia: kilka `GET /realtime/v1/websocket → 101` (nowe połączenie) w odstępie sekund/kilkunastu sekund (22:58:27, 22:58:28, 22:58:52, 22:59:21) — częste ponowne łączenie w krótkim czasie. To może być zwykłe (otwieranie/zamykanie kart podczas testów) albo realny sygnał niestabilności połączenia — warto zestawić te znaczniki czasu z momentem, w którym coś nie zsynchronizowało się.

**Rewizja pewności:** teoria o limicie rozmiaru payloadu zostaje jako prawdopodobna dla DUŻYCH zdjęć, ale nie tłumaczy sama w sobie problemów z małymi elementami — najpewniejszy sposób żeby to rozstrzygnąć ostatecznie: powtórzyć dokładnie ten scenariusz, który nie zadziałał (to samo duże zdjęcie, dwie karty), z otwartą kartą DevTools → Network → WS na obu, i sprawdzić czy wiadomość w ogóle wychodzi i czy druga karta ją dostaje. To da pewną odpowiedź zamiast kolejnej hipotezy z kodu/logów.

**Aktualizacja 3 — realny dowód złapany w DevTools (22.07.2026, ~23:38), nie tylko teoria.** User złapał zakładkę Network → WS → Messages na obu kartach jednocześnie, przefiltrowane do `element`. Wynik: na karcie A (wysyłającej) widać **6 wysłanych** `element-created` (strzałka w górę, rozmiary 328-729 bajtów — małe, zwykłe elementy, NIE duże zdjęcie). Na karcie B (odbierającej) widać w tym samym oknie czasowym **tylko 5 odebranych**. Jedna wiadomość zniknęła po drodze — i to przy payloadzie rzędu kilkuset bajtów, więc to zdecydowanie NIE jest kwestia przekroczenia limitu 256 KB.

**To zmienia priorytet przyczyny:** skoro giną nawet małe wiadomości, to najbardziej prawdopodobny winowajca to nie rozmiar payloadu, tylko to co opisano w sekcji "co się dzieje pod spodem" wyżej — `ack: false` w konfiguracji kanału (`useRealtimeChannel.ts`, `supabase.channel(..., { config: { broadcast: { self: false, ack: false } } })`) w połączeniu z tym, że `safeBroadcast` nie sprawdza faktycznego statusu wysyłki. Z `ack: false` klient WYSYŁA i od razu uznaje to za sukces, nie czekając na żadne potwierdzenie od serwera — więc jeśli wiadomość zgubi się gdziekolwiek po drodze (przeciążenie, chwilowy problem z siecią/serwerem, cokolwiek), apka nigdy się o tym nie dowie i nie spróbuje ponownie. Rozmiar zdjęć (Aktualizacja 1) to dodatkowy, pogłębiający czynnik dla dużych plików, ale NIE jest to główna przyczyna — główna przyczyna to fundamentalny brak potwierdzenia dostarczenia przy zwykłym, nawet małym broadcastcie.

**To podnosi priorytet naprawy A z listy opcji wyżej** (włączyć realną weryfikację czy broadcast się udał) — i sugeruje rozważenie `ack: true` w konfiguracji kanału (Supabase wtedy faktycznie czeka na potwierdzenie serwera zanim `channel.send()` się rozwiąże), co dałoby `safeBroadcast` prawdziwą informację do podjęcia decyzji o retry, zamiast ślepego zakładania sukcesu.

### Jak groźne

Wysoki priorytet mimo braku utraty danych — bo to psuje codzienne używanie tablicy z obrazkami (typowy element lekcji: wklejone zdjęcie, diagram, skan). User myśli że coś się nie zapisało, odświeża, dopiero wtedy widzi zmianę — słaby UX i brak zaufania do narzędzia.

### Opcje naprawy (do decyzji, nic z tego jeszcze nie wdrożone)

- **A — napraw wykrywanie błędu: sprawdzaj zwrócony status z `channel.send()`.** Traktuj `'error'`/`'timed_out'` tak samo jak wyjątek (czyli `success = false`), żeby istniejący mechanizm retry (3 próby) w ogóle się uruchamiał. Mała zmiana, ale **sama w sobie nie wystarczy** — jeśli payload jest za duży, retry wyśle dokładnie ten sam za duży payload i też oberwie błędem. Naprawia wykrywanie, nie naprawia przyczyny.
- **B — nie wysyłaj `src` przy zwykłym update pozycji/rotacji (rekomendowane).** Rozdziel "zmieniła się geometria" (x/y/width/height/rotation) od "zmieniła się treść" (src) — przy przesunięciu/obrocie broadcastuj tylko lekki obiekt z geometrią + `id`, a odbiorca robi merge do istniejącego elementu (który już ma `src` z wcześniejszego załadowania) zamiast nadpisywać całość. Realnie usuwa przyczynę — payload update przestaje być ciężki niezależnie od rozmiaru zdjęcia.
- **C — przestań trzymać zdjęcia jako base64 w `src`, wrzucaj je do Supabase Storage / assetów backendu i trzymaj tylko URL.** Backend już ma do tego model `SavedAsset` (patrz `docs/architecture/backend-structure.md`). To najpełniejsze rozwiązanie — mniejsze payloady wszędzie (broadcast, baza, REST), ale największy nakład pracy (upload flow, migracja istniejących zdjęć w bazie z base64 na URL).

Rekomendacja: **A + B razem** jako najbliższy, praktyczny krok — A żeby błędy przestały być ukryte, B żeby update zdjęcia w ogóle przestał być ciężki. C to dobry kierunek docelowy, ale osobny, większy projekt.

**Aktualizacja 4 — potwierdzenie na żywo + pierwsza naprawa wdrożona (22.07.2026).** User potwierdził scenariusz jeszcze raz narzędziem wycinania: mały, prosty zrzut (mało danych po kompresji) synchronizuje się normalnie; większy zrzut całego ekranu — nie, dopóki nie zrobi się F5. To ostatecznie potwierdza całość: giną i małe wiadomości (Aktualizacja 3, przez `ack:false`) i duże obrazy nie mieszczą się w limicie (Aktualizacja 1/2).

**Wdrożone teraz (Opcja A + nowy krok D):**
- `useRealtimeChannel.ts` — `broadcast.ack` zmienione z `false` na `true`. Kanał teraz faktycznie czeka na potwierdzenie serwera zamiast zakładać sukces od razu.
- `useSafeBroadcast.ts` — `sendMessage()` czyta zwrócony status (`'ok' | 'timed_out' | 'error'`) zamiast tylko łapać wyjątek. Tylko `status === 'ok'` liczy się jako sukces — dzięki temu istniejący mechanizm retry (3 próby) faktycznie się uruchamia zamiast być martwym kodem, i błędy trafiają do `logWarn` zamiast ginąć po cichu.
- **Nowy krok D (kompresja obrazka przed wstawieniem)** — `elements/image-compress.ts` (nowy plik): skaluje obrazek do max 1600px na dłuższym boku i przekodowuje na JPEG jakość 0.82 ZANIM stanie się elementem na tablicy. Podpięte we wszystkich 3 miejscach, gdzie obrazek wchodzi na tablicę: wklejanie ze schowka (`handleOsClipboardPaste` w `whiteboard-canvas.tsx`), przeciągnij-i-upuść (tamże), i przycisk Upload (`image-tool.tsx`). To atakuje przyczynę u źródła zamiast tylko naprawiać wykrywanie błędu — typowy zrzut ekranu czy zdjęcie z telefonu powinno teraz zmieścić się pod limitem w zdecydowanej większości przypadków.

**Status:** zweryfikowane `npx tsc --noEmit` (zero nowych błędów). **NIE zweryfikowane jeszcze na żywo** (dwie karty + DevTools tak jak poprzednio) — to następny krok przed uznaniem za naprawione.

**Aktualizacja 5 — wdrożona też Opcja B (22.07.2026), z myślą o skalowaniu przy wielu userach.** User poprosił wprost, żeby nie kończyć na łataniu wykrywania błędu, tylko naprawić architekturę tak, żeby zwykłe przesunięcie/obrót NIE wysyłało całego zdjęcia — bo przy większej liczbie userów sam rozmiar/częstotliwość wiadomości stanie się problemem niezależnie od limitu Supabase.

Zrobione:
- **`realtime/types.ts`** — nowy typ `ElementBroadcastPayload` (`DistributivePartial<DrawingElement> & {id, type}` — zwykły `Partial<>` nie zadziałałby poprawnie na unii 9 różnych typów elementów, patrz komentarz w kodzie). `element-updated`/`elements-batch` w `BoardEvent` używają teraz tego typu zamiast pełnego `DrawingElement`. `elements-batch` ma nowe pole `geometryOnly?: boolean`.
- **`BoardRealtimeContext.tsx`** — nowa funkcja `stripHeavyFields()`: dla zdjęć usuwa `src` z payloadu PRZED wysyłką. Użyta w `broadcastElementUpdated` (zawsze) i `broadcastElementsBatch` (tylko gdy wołający jawnie poda `geometryOnly=true`). `element-created` NIE jest tym objęty — tam `src` musi dojść, bo odbiorca nie ma go jeszcze wcale.
- **`use-whiteboard-engine.ts`** — `updateElementsLive` (live drag wielu zaznaczonych elementów) woła teraz `broadcastElementsBatch(updated, true)` zamiast `broadcastElementsBatch(updated)`.
- **`whiteboard-canvas.tsx`** — odbiorca (`onRemoteElementUpdated`, `onElementsUpdated`) teraz SCALA przychodzące (potencjalnie niepełne) dane z lokalną kopią elementu (`{...existing, ...incoming}`) zamiast nadpisywać go w całości — inaczej update bez `src` skasowałby zdjęcie u odbiorcy. Element, o którym odbiorca jeszcze nic nie wie (rzadki wyścig sieciowy) przy `geometryOnly=true` jest pomijany zamiast tworzony jako zepsuty (bez danych) — prawdziwy komplet dotrze przez `element-created` albo `sync-response`.

Efekt: przesunięcie/obrót/resize zdjęcia wysyła teraz kilkadziesiąt bajtów (same liczby) zamiast całego base64. Skaluje się niezależnie od tego ilu userów jest na tablicy naraz, bo rozmiar wiadomości przestaje zależeć od rozmiaru zdjęcia.

Zweryfikowane `npx tsc --noEmit` — zero błędów. **Wciąż nie zweryfikowane na żywo** (dwie karty, przesunięcie dużego zdjęcia + sprawdzenie Network → WS → Messages, że payload jest teraz mały).

Opcja C (prawdziwy upload do storage zamiast base64 w `src`) zostaje w planach jako dalsze, największe wzmocnienie — nie jest jeszcze zrobiona.

**Aktualizacja 7 — po włączeniu `ack:true` widać PRAWDZIWĄ skalę problemu: to nie tylko zdjęcia (22.07.2026).** Po wdrożeniu `ack:true` konsola pokazała lawinę `status "error"`/`"timed out"` dla WSZYSTKICH typów wiadomości — `cursor-moved`, `viewport-changed`, `element-updated`, `elements-batch`, `element-created`, nie tylko dla zdjęć. To ważna zmiana obrazu sytuacji: wcześniej (z `ack:false`) te same porażki działy się po cichu, więc wyglądało jakby problem dotyczył tylko dużych zdjęć — teraz widać, że kanał realtime ogólnie jest przeciążony.

User potwierdził: projekt jest na **planie Free** w Supabase. Limity na tym planie (patrz wpis #2, Aktualizacja 1): **100 wiadomości/sekundę na CAŁY projekt** (nie na tablicę, nie na usera — na WSZYSTKO naraz), 20 wiadomości presence/s. Kursor myszy sam w sobie leciał 20x/s NA KAŻDEGO aktywnego usera — przy 2-3 testujących osobach to już 40-60/s tylko na kursory, zanim doliczy się viewport, update elementów, itd. Do tego `ack:true` podwaja ruch (każda wiadomość czeka na potwierdzenie serwera) — a nieudane `element-*` broadcasty same się ponawiają (3 próby), co przy realnym przeciążeniu dokłada RUCH zamiast pomagać (błędne koło: porażka → retry → więcej ruchu → więcej porażek).

**Zrobione teraz:** `THROTTLE_MS.CURSOR_MOVE` z 50ms na 120ms (`realtime/constants.ts`) — z 20 pozycji kursora/s na ~8/s na usera, największa dotychczasowa "podłoga" ruchu w tle, bez zauważalnej utraty płynności.

**Uczciwie, czego to NIE rozwiązuje:** 100 wiadomości/s na CAŁY projekt to twardy limit planu — żadna optymalizacja kodu tego nie ominie, tylko zmniejsza jak szybko się w niego wbijamy. Przy realnym użyciu z wieloma jednoczesnymi userami (o co pytał user, myśląc o przyszłości) ten limit i tak w końcu zostanie osiągnięty. To już nie jest pytanie "jak zoptymalizować kod", tylko **decyzja biznesowa: czy/kiedy przejść na plan Pro** (500 wiadomości/s, 5x więcej), bo sam kod nie da rady obejść twardego limitu planu.

**Możliwy związek z rozjechanymi ramkami zaznaczenia zgłoszonymi w tej samej sesji testów:** user zauważył też, że obwódka zaznaczenia/uchwyty resize nie pasują do faktycznej pozycji zdjęcia po resize. Prawdopodobnie to DALSZY SKUTEK tego samego przeciążenia (wiadomości gubione/dochodzące poza kolejnością pod wielkim retry-stormem), a nie nowy, osobny błąd w logice scalania (Opcja B) — do potwierdzenia po ograniczeniu ruchu w tle, zanim zaczniemy szukać oddzielnej przyczyny.

**Aktualizacja 6 — ta sama dziura w konwersji PDF→obrazki (22.07.2026).** User potwierdził na żywo, że zdjęcia już działają — ale zauważył, że PDF nie synchronizuje się do drugiej osoby. Trafna intuicja: PDF w tym kodzie jest konwertowany strona-po-stronie na zwykłe elementy `type: 'image'` (`convertPDFToImages` w `image-tool.tsx`, i analogiczny kod w drag&drop w `whiteboard-canvas.tsx`) — więc podlega dokładnie tej samej naprawie co zwykłe zdjęcia. Problem: konwersja renderuje stronę PDF w pełnej rozdzielczości (skala 2x) i zapisuje jako JPEG 0.9, ale zapomniałem podpiąć tam `compressImageDataUrl` — strona PDF (szczególnie z dużą ilością tekstu/grafik) łatwo przekracza limit tak samo jak nieskompresowane zdjęcie. Naprawione: `compressImageDataUrl` podpięty w obu miejscach konwersji PDF→obrazek (przycisk Upload i drag&drop). Zweryfikowane `npx tsc --noEmit` — zero błędów.

**Aktualizacja 8 — czysty restart obalił teorię przeciążenia, znaleziona prawdziwa przyczyna: sama kompresja nie wystarczała, wdrożona Opcja C (23.07.2026).** Na moją prośbę user zrobił pełny czysty restart (zamknięte wszystkie karty, zrestartowany dev server, dwie świeże karty) żeby odróżnić "zombie połączenia z długiej sesji testów" od realnego problemu. Wynik: **problem wystąpił identycznie od razu**, już przy PIERWSZYM broadcastcie `element-created` po połączeniu (zero ruchu w tle wcześniej) — status `"error"`, 3/3 próby nieudane. To ostatecznie obala teorię przeciążenia ruchem z Aktualizacji 7 (przy zerowym ruchu nie ma czego przeciążać) i teorię zombie-połączeń (restart niczego nie zmienił).

Kluczowa obserwacja z tych samych logów: `element-updated`/`elements-batch` (geometria BEZ `src`, dzięki Opcji B z Aktualizacji 5) przechodziły bezbłędnie cały czas. Padał WYŁĄCZNIE `element-created` dla obrazów — czyli jedyna wiadomość, która wciąż niesie pełny base64. To potwierdza to, co odrzuciliśmy zbyt wcześnie w Aktualizacji 2: **kompresja (1600px, JPEG 0.82) zmniejszała szansę na przekroczenie limitu 256 KB/wiadomość, ale jej nie eliminowała** — prawdziwe zdjęcia z telefonu i renderowane strony PDF (dużo szczegółów → gorsza kompresja JPEG) regularnie i tak go przekraczały. Tłumaczy to komplet objawów z całej tej sesji: mały czarny obrazek z Aktualizacji 2 się mieścił, 241 KB zdjęcie z telefonu po kompresji nadal nie, PDF (45 KB oryginał, ale renderowany w skali 2x do rastra) też nie.

**Wdrożona Opcja C (ostateczne rozwiązanie, patrz opcje naprawy wyżej) — obraz w ogóle nie jedzie przez Realtime Broadcast:**
- **Backend, nowy plik `backend/api/v1/whiteboard/storage.py`** — `upload_board_image()`: uploaduje bajty obrazu do Supabase Storage (bucket `board-images`, publiczny) kluczem `service_role` (ten sam już używany w `realtime.py`, omija RLS — autoryzację i tak sprawdzamy wcześniej przez nasz JWT). Zwraca publiczny URL. Walidacja typu (tylko jpeg/png/webp) i rozmiaru (max 15 MB — to bezpiecznik, nie limit Realtime).
- **Backend, nowy endpoint `POST /api/v1/whiteboard/{board_id}/upload-image`** (`router.py` + `service.py`) — sprawdza dostęp do tablicy (`_check_access`, ten sam co reszta endpointów elementów) przed uploadem.
- **Frontend, `elements/image-compress.ts`** — nowa funkcja `compressAndUploadImage()`: kompresuje (jak dotąd) I uploaduje wynik przez nowy endpoint, zwraca `{url, width, height}` zamiast `{dataUrl, width, height}`.
- **Frontend, `api/whiteboardApi.ts`** — nowa funkcja `uploadBoardImage()` (multipart/form-data przez `apiClient`).
- Podmienione wszystkie 4 miejsca tworzenia obrazu (dotąd używały samej kompresji): `whiteboard-canvas.tsx` (paste ze schowka, drag&drop obrazka, drag&drop PDF strona-po-stronie) i `image-tool.tsx` (upload z dysku, PDF strona-po-stronie) — wszystkie teraz wołają `compressAndUploadImage(..., boardId)` i wpisują zwrócony `url` do `element.src` zamiast base64.
- `boardId` doprowadzony do `ImageTool` przez nowe pole `boardId` w `ToolHostContextValue` (`tool-host-context.tsx`) — wcześniej ten kontekst go nie niósł, bo nie było potrzeby.

Efekt: `element-created` dla obrazu waży teraz kilkadziesiąt-kilkaset bajtów (same współrzędne + URL) niezależnie od rozdzielczości oryginalnego zdjęcia/PDF-u — nigdy nie zbliża się do limitu 256 KB. Jako efekt uboczny: rekordy `BoardElement.data` w bazie (Neon/Postgres) też będą teraz dużo lżejsze (URL zamiast base64), i dogrywanie całej tablicy nowemu userowi (`sync-response`) też przestaje przenosić megabajty base64.

**Zweryfikowane:** `npx tsc --noEmit` scoped na zmienione pliki — zero błędów (pełny `tsc` na całym projekcie w tej sesji regularnie przekraczał limit czasu narzędzia, niezależnie od tego; nie udało się zweryfikować całego projektu na raz, tylko dotknięte pliki + ich bezpośredni graf importów). `python -m py_compile` na zmienionych plikach backendu — bez błędów składni.

**Potwierdzone na żywo (23.07.2026) — na ŚWIEŻEJ tablicy (id 332, bez historii wcześniejszych testów):** user wkleił zdjęcie i PDF na dwóch kartach — zero statusów `"error"` w konsoli, wszystkie `element-created` (typ image) poszły bez porażki, `sync-response` też przeszedł bezbłędnie. Naprawa działa.

**Osobno potwierdzona teoria o "zatrutej" starej tablicy (322, "test1"):** na TEJ tablicy `sync-response` nadal kończył się `status "error"` (patrz wyżej) — bo zawiera elementy-obrazy utworzone PRZED tą naprawą, z pełnym base64 w `data.src` w bazie. `sync-response` musi wysłać komplet danych nowemu userowi (nie może użyć geometryOnly), więc paczka z takim starym elementem nadal przekracza 256 KB. To NIE nowy błąd — to stary dług z czasu przed naprawą, siedzący w konkretnych wierszach `board_elements` tej jednej tablicy. Do posprzątania: usunąć na tablicy 322 elementy-obrazy sprzed naprawy (select + delete) albo po prostu przestać jej używać do testów.

**Dopisek — sprzątanie Storage (23.07.2026), na pytanie usera "czy to się nie zapcha".** Sam upload bez kasowania oznaczałby, że Storage rośnie w nieskończoność — każdy usunięty z tablicy obrazek zostawałby tam na zawsze jako plik-sierota. Dopisane: `storage.py` → `delete_board_image()` (kasuje jeden plik po URL, wołane z `WhiteboardService.delete_element()` gdy usuwany element jest typu `image`) i `delete_board_folder()` (kasuje CAŁY folder `{board_id}/` naraz — listuje przez Storage API i kasuje jednym requestem, wołane z `BoardService.delete_board()` przy usunięciu całej tablicy). Oba best-effort (nie blokują głównej operacji, tylko logują warning przy porażce). `delete_element` musiał zmienić się z `def` na `async def` — zaktualizowany call site w `router.py` i 3 testy w `test_whiteboard_service.py` (dodane `@pytest.mark.asyncio` + `await`). Zweryfikowane `py_compile` — bez błędów składni; pytest nie był dostępny w tym środowisku do faktycznego uruchomienia testów, więc **testy nie zostały uruchomione na żywo w tej sesji** — do zrobienia jako część weryfikacji przed commitem.

Sprawdziłem, czy "Wyczyść tablicę" i multi-select delete też są objęte: `clearCanvas`/`deleteSelectedElements` → `engine.deleteElements()` (`use-whiteboard-engine.ts`) → woła `deleteElementDirectly()` per ID w paczkach po 20 — czyli przechodzi przez ten sam `DELETE /elements/{id}`, jest objęte.

Uczciwie: to WCIĄŻ nie jest pełne sprzątanie na zawsze — gdyby w przyszłości ktoś dodał funkcję "podmień obraz" (nadpisz istniejący element bez przechodzenia przez delete) albo skasowałby całą tablicę bezpośrednio w bazie z pominięciem `BoardService.delete_board()`, pliki zostałyby sierotami. Do rozważenia na przyszłość: okresowe zadanie porządkujące (cron) porównujące zawartość bucketu z faktycznymi `src` w bazie i kasujące różnicę — nie zrobione teraz, bo user pytał konkretnie o bieżący mechanizm, nie o pełną gwarancję na zawsze.

**Aktualizacja 9 — 🐛 REGRESJA znaleziona przez usera: sprzątanie Storage z Aktualizacji 8 psuło undo (23.07.2026).** Zgłoszony scenariusz: user A usuwa zdjęcie/stronę PDF, potem robi Ctrl+Z (undo) — zamiast zdjęcia wraca **szary/pusty blok**. Co ciekawe, user B (druga osoba na tej samej tablicy) widzi to samo usunięcie+undo poprawnie — i odwrotnie, gdy to B usuwa i cofa, wtedy B widzi szary blok, a A widzi poprawnie.

Root cause: `WhiteboardService.delete_element()` (Aktualizacja 8) kasował plik ze Storage OD RAZU przy `DELETE /elements/{id}`. Ale undo w tym kodzie (`DeleteElementsCommand.undo()` → `createEffect()`, `commands/command-effects.ts`) po prostu przywraca element z DOKŁADNIE TYM SAMYM `src` (URL) co wcześniej — nie uploaduje niczego na nowo, bo nie ma po co (element wygląda tak samo). Problem: plik pod tym URL-em był już bezpowrotnie skasowany, więc przeglądarka próbuje załadować obrazek, dostaje 404 ze Storage, i renderuje szary/pusty placeholder zamiast obrazka.

Asymetria między A i B (dlaczego tylko osoba, która SAMA usunęła, widziała problem) tłumaczy się różnicą w lokalnym cache zdekodowanych obrazków (`loadedImages` w silniku tablicy): usuwający czyści wpis dla tego elementu od razu (`loadedImages.delete(e.id)` w `use-whiteboard-engine.ts`), więc po undo musi na nowo pobrać obrazek z sieci — i wtedy trafia na 404. Druga osoba nigdy nie czyściła swojego cache dla tego elementu, więc po powrocie elementu nadal renderuje wcześniej załadowaną, zdekodowaną bitmapę z pamięci, bez żadnego zapytania sieciowego — stąd u niej wygląda, jakby nic się nie stało.

**Naprawione — opóźnione kasowanie z rewalidacją, zamiast natychmiastowego:**
- `WhiteboardService.delete_element()` wrócił do bycia zwykłym `def` (nie `async def`) — nie kasuje już niczego synchronicznie. Zamiast tego, dla elementu typu `image`, planuje `background_tasks.add_task(_cleanup_image_after_delay, src)` (FastAPI `BackgroundTasks`, nowy parametr metody).
- Nowa funkcja `_cleanup_image_after_delay()` (`service.py`): czeka `IMAGE_DELETE_GRACE_PERIOD_SECONDS = 90` sekund (margines na "usuń i zaraz cofnij"), otwiera WŁASNĄ, krótkotrwałą sesję bazy (`SessionLocal()` z `core/database.py` — nie tę z requestu, żeby nie trzymać połączenia do Neon otwartego przez 90s bez potrzeby), sprawdza czy ten sam URL (`BoardElement.data["src"].astext == src`) nadal występuje GDZIEKOLWIEK w bazie — jeśli tak (bo ktoś zrobił undo), **pomija kasowanie**. Dopiero jeśli URL naprawdę nigdzie już nie występuje, woła `delete_board_image()`.
- `router.py`: endpoint `DELETE /elements/{element_id}` dostaje `background_tasks: BackgroundTasks` i przekazuje do serwisu; wywołanie `service.delete_element(...)` już bez `await` (funkcja sync).
- 3 testy w `test_whiteboard_service.py` wrócone do sync (bez `@pytest.mark.asyncio`/`await`) — nie przekazują `background_tasks`, więc sprzątanie Storage jest w nich pomijane (`background_tasks is not None` guard).

**Uczciwie:** 90 sekund to pragmatyczny margines na typowe "usuń, zaraz się rozmyślę", NIE pełne rozwiązanie na dowolnie odległy w czasie undo (np. ktoś usuwa obrazek, zamyka kartę na godzinę, wraca i robi undo — plik już zniknie). Pełne rozwiązanie wymagałoby miękkiego usuwania (`is_deleted` już istnieje jako kolumna w `BoardElement`, ale nie jest jeszcze używana do tego celu) i osobnego, okresowego sprzątania zamiast kasowania "na już" — świadomie odłożone, żeby nie rozdymać tej naprawy ponad to, czego realnie potrzeba teraz.

Zweryfikowane `python -m py_compile` na zmienionych plikach — bez błędów składni. **Nie zweryfikowane jeszcze na żywo** (test: usuń zdjęcie, Ctrl+Z w ciągu kilku sekund, sprawdź czy wraca poprawnie u obu userów) — do zrobienia po restarcie backendu.

---

## 3. Resize/przesuwanie "nie trafia" — szczególnie zaraz po akcji na zdjęciu (wysoki priorytet, przyczyna NIE potwierdzona w 100%)

**Zgłoszone:** lipiec 2026, ręczny test. Dwa powiązane objawy zgłoszone przez usera:
1. Uchwyty do resize "jakoś dziwnie nie trafiają" — kiedyś działało normalnie.
2. Konkretny, powtarzalny scenariusz: przesuwanie notatki działa OK (widać zmianę u obu userów). Ale jak najpierw zrobi się coś ze zdjęciem, a POTEM spróbuje się coś przesunąć — **pierwsza próba nic nie robi** (brak ruchu), dopiero kolejna działa.

**Uczciwie: w odróżnieniu od wpisów #1 i #2, tego NIE udało mi się potwierdzić przez odtworzenie na żywo ani testem — to najlepsza hipoteza z czytania kodu, nie stuprocentowy pewnik.** Opisuję poniżej co sprawdziłem, co wykluczyłem, i co zostało jako najbardziej prawdopodobny winowajca.

### Co sprawdziłem i wykluczyłem

- **Skalowanie DPI/retina (`devicePixelRatio`) między pozycją myszy a rysowaniem canvasu** — sprawdzone w `whiteboard-canvas.tsx` (`updateSize`, linia ~796): `canvasWidth`/`canvasHeight` (stan Reacta używany wszędzie do liczenia pozycji) to zawsze piksele CSS, canvas ma osobno przeskalowany bufor. Spójne, bez błędu.
- **Przesunięcie nakładki (overlay) względem kontenera canvasu po dodaniu paska bocznego** — w commicie `e312152` ("UI whiteboard", 14.03.2026, dodanie sidebar/workspace-icon-strip) ktoś już to naprawił: wszystkie miejsca w `select-tool.tsx`, które liczą pozycję kliknięcia z `e.clientX`/`e.clientY`, odejmują `rect.left`/`rect.top` nakładki. Sprawdziłem wszystkie 6 miejsc w obecnym kodzie — wszystkie poprawne, spójne.
- **Rotacja kształtów (`shape`) a bounding box do resize** — `ShapeHandler.getBoundingBox()` faktycznie ignoruje rotację (w przeciwieństwie do `image`/`text`/`pdf`, które liczą obrócony AABB). ALE sprawdziłem historię: to nie jest regresja — kształty od zawsze "zapiekają" obrót bezpośrednio we współrzędnych (`startX/startY/endX/endY`), z jawnym komentarzem w starym kodzie „🚫 Usunięte: rotation dla shape". Czyli to nie jest to, co się ostatnio zepsuło.
- **`isGestureActive`** (flaga blokująca narzędzia podczas gestu) — sprawdzone w `use-multi-touch-gestures.ts`: dotyczy WYŁĄCZNIE gestów dotykowych (2+ palce), nie myszy. Nie pasuje do scenariusza z myszą na desktopie.

### Najbardziej prawdopodobny winowajca (niepotwierdzone na 100%)

`select-tool.tsx` ma jeden duży `useEffect` (podłącza globalne nasłuchy `window.pointermove`/`pointerup` na czas przeciągania/resize/rotacji), którego tablica zależności wygląda tak:

```
[isResizing, isDragging, isRotating, resizeHandle, resizeOriginalBox,
 canvasWidth, canvasHeight, onElementsUpdate, onOperationFinish,
 elements, selectedIds, onActiveGuidesChange]
```

Problem: `elements` to CAŁA tablica wszystkich elementów na tablicy. Zmienia referencję przy KAŻDEJ zmianie JAKIEGOKOLWIEK elementu — także takiej, która przychodzi z realtime od drugiego usera, i także "ogonów" Twojej WŁASNEJ poprzedniej akcji (np. retry broadcastu zdjęcia ze 100ms/200ms opóźnieniem — patrz wpis #2 wyżej). Kiedy `elements` się zmienia, React **odpina i podpina od nowa** te globalne nasłuchy `pointermove`/`pointerup` — nawet jeśli akurat w tym momencie zaczynasz zupełnie nowe przeciągnięcie czymś innym.

To pasuje bardzo dobrze do zgłoszonego scenariusza: akcja na zdjęciu jest "cięższa" (duży payload, retry w tle po 100-200ms z wpisu #2, asynchroniczne `loadImage`) — więc `elements` zmienia się jeszcze przez chwilę PO tym jak skończyłeś operację na zdjęciu. Jeśli w tym właśnie momencie klikniesz i zaczniesz przesuwać notatkę, React może akurat przez ułamek sekundy odbudowywać te nasłuchy — pierwszy ruch myszką "przepada" (nasłuch jeszcze nie podłączony), dopiero kolejna próba łapie go poprawnie.

**Druga, równie prawdopodobna wersja — powiązana z limitem Supabase z wpisu #2:** dokumentacja Supabase (patrz wpis #2) mówi wprost: „Connections will be disconnected if your project is generating too many messages per second" (limit na planie Free: **100 wiadomości/sekundę**; presence: **20/sekundę**). 3 próby broadcastu tego samego zdjęcia (pierwsza + 2 retry po 100/200ms z `useSafeBroadcast`) plus normalny ruch kursora/presence od kilku userów może realnie podbić licznik wiadomości/sekundę w krótkim oknie czasowym. Gdyby Supabase przez to na chwilę zerwał połączenie (`tenant_events`), pierwsza akcja PO takim zerwaniu (zanim `supabase-js` zdąży się automatycznie przełączyć z powrotem) naturalnie „nic by nie zrobiła" — dokładnie jak zgłoszono.

### Jak groźne

Wysoki priorytet — to psuje codzienne używanie (resize, przesuwanie), sprawia wrażenie że aplikacja "się gubi", i akurat najbardziej rzuca się w oczy przy zdjęciach (najcięższe elementy).

### Rekomendacja naprawy

Przepisać ten `useEffect` tak, żeby zależał TYLKO od `[isResizing, isDragging, isRotating]` — a `elements`, `selectedIds`, `onElementsUpdate` itd. czytać przez `ref` (dokładnie ten sam wzorzec "świeża referencja bez re-triggera efektu", którego dziś użyliśmy w `useRealtimeChannel`/`registerListenersRef` przy podziale `BoardRealtimeContext`). Wtedy globalne nasłuchy zostają podłączone przez cały czas trwania gestu, niezależnie od tego co się dzieje gdzie indziej na tablicy.

### Jak to zweryfikować przed naprawą

Nie miałem jak odtworzyć tego na żywo w tej sesji. Zanim to naprawimy na pewno, warto:
1. Dodać tymczasowy `console.log` w cleanup i na starcie tego `useEffect`, żeby zobaczyć czy faktycznie odpina/podpina się w trakcie normalnego użytkowania (nie tylko w teorii).
2. Sprawdzić, czy problem znika, jeśli zrobisz dokładnie ten sam scenariusz (zdjęcie → potem przesunięcie) ale wolniej, z przerwą 1-2 sekund między akcjami (jeśli zniknie — to potwierdza teorię o wyścigu w czasie, a nie inny błąd).

---

## Zasada

Nowy błąd znaleziony w czasie pracy/testów → nowy wpis tutaj, w tym samym formacie (odtworzenie, root cause, opcje naprawy), z priorytetem. Jak coś zostanie naprawione, wpis przenosimy na dół pod `## Naprawione` (do stworzenia gdy pierwszy taki przypadek się pojawi) zamiast kasować — żeby było widać historię.
