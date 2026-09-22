# Prototyp tablicy na Excalidraw + Yjs

**Status:** prototyp do decyzji, gałąź `proto/excalidraw-yjs`, PR „NIE MERGOWAĆ".
**Pytanie, na które odpowiada:** czy da się zejść z ~27 tys. linii własnego silnika tablicy
(`src/_new/features/whiteboard/`) na gotowy edytor `@excalidraw/excalidraw` (MIT) z synchronizacją
przez Yjs, nie tracąc funkcji ważnych dla korepetycji (wykres funkcji, polskie znaki, dotyk, współpraca).
**Data:** 22.09.2026. Obecna tablica NIE była ruszana.

---

## 1. Jak uruchomić (bez backendu, bez logowania)

Wymagane: Node 20+, `npm ci` w repo. Backend FastAPI, Redis i `whiteboard-sync` NIE są potrzebne.

```bash
git checkout proto/excalidraw-yjs
npm ci                                   # doinstalowuje @excalidraw/excalidraw, y-indexeddb, @hocuspocus/server, @playwright/test
npm run proto:yjs                        # terminal 1: serwer Yjs (Hocuspocus bez auth) na ws://localhost:1234
npm run proto:dev                        # terminal 2: next dev -p 3100
```

Potem otwórz w DWÓCH kartach (albo dwóch przeglądarkach):
`http://localhost:3100/proto-excalidraw/test-1?name=Patryk` i `http://localhost:3100/proto-excalidraw/test-1?name=Uczen`.
Rysuj w jednej — druga widzi zmiany, kursor i nazwę. Przycisk **f(x)** w prawym górnym rogu dodaje wykres funkcji;
zaznaczenie wykresu otwiera ten sam panel w trybie edycji wzoru.

Alternatywa dla serwera Yjs: `docker compose --profile proto up proto-yjs` (port 1235, wtedy
`NEXT_PUBLIC_PROTO_YJS_URL=ws://localhost:1235`). Nie ruszaliśmy istniejącej usługi `whiteboard-sync`.

Testy: `npm run proto:e2e` (Playwright sam podnosi oba serwery, jeśli nie działają) oraz
`npx vitest run src/_new/features/whiteboard-excalidraw scripts`.

Zmienne środowiskowe (wszystkie opcjonalne):

| Zmienna                        | Domyślnie             | Po co                                                                    |
| ------------------------------ | --------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_PROTO_YJS_URL`    | `ws://localhost:1234` | adres serwera Yjs                                                        |
| `NEXT_PUBLIC_PROTO_EXPOSE_API` | (w dev zawsze `1`)    | wystawia `window.__excalidrawAPI` i `window.__proto` (używane przez e2e) |
| `PROTO_YJS_PORT`               | `1234`                | port serwera `npm run proto:yjs`                                         |

## 2. Co zbudowano

```
src/app/(whiteboard)/proto-excalidraw/[boardId]/page.tsx   strona publiczna, next/dynamic ssr:false
src/_new/features/whiteboard-excalidraw/
  components/excalidraw-board.tsx      <Excalidraw/> + spięcie z Yjs, awareness, panel f(x), window.__proto
  components/function-panel.tsx        panel dodawania/edycji wykresu (renderTopRightUI)
  yjs/excalidraw-binding.ts            własne wiązanie Excalidraw <-> Y.Doc (+ test, 8 przypadków)
  yjs/provider.ts                      HocuspocusProvider + y-indexeddb
  yjs/awareness-collaborators.ts       awareness -> Map<SocketId, Collaborator>
  math/function-plot.ts                próbkowanie funkcji + SVG (czysta logika, + test)
  math/function-element.ts             wykres jako element `image` z customData (+ test)
scripts/proto-yjs-server.mjs           serwer Hocuspocus bez auth (npm run proto:yjs)
scripts/proto-convert-to-excalidraw.ts szkic konwersji DrawingElement[] -> Excalidraw (+ test)
e2e/proto-excalidraw*.spec.ts          Playwright: 8 testów (7 desktop + 1 dotyk Pixel 7)
playwright.config.ts                   pierwszy config Playwright w repo (tylko e2e/)
```

Razem ~2.6 tys. linii łącznie z testami i komentarzami (vs ~27 tys. obecnego silnika).

### 2.1. Wersje i zgodność

- `@excalidraw/excalidraw` **0.18.1** (2026-04-20). peerDeps `react ^17||^18||^19` — React 19.1 i Next 16.3 działają
  **bez `--legacy-peer-deps`**. Pakiet jest ESM-only, wymaga `import '@excalidraw/excalidraw/index.css'`
  i ładowania przez `next/dynamic({ ssr: false })` (moduł czyta `window` przy imporcie — issue excalidraw#9907;
  Turbopack w Next 16 działa poprawnie z tym wzorcem, sprawdzone w dev i w `next build`).
- Fonty Excalidraw pobierają się z CDN (`esm.sh`) — na produkcji do samodzielnego hostowania
  (`window.EXCALIDRAW_ASSET_PATH`; uwaga: issue #11639 mówi, że w 0.18.1 część fontów i tak idzie z CDN).
- Trzy poprawki konfiguracji potrzebne, żeby narzędzia repo „widziały" Excalidraw:
  `vitest.config.ts` (alias `roughjs/bin/*` -> `.js`, `server.deps.inline`, stub Canvas/FontFace w
  `src/test/setup-canvas-stub.ts`), `.dependency-cruiser.cjs` (warunek `production` w `conditionNames`, bo
  `./index.css` jest eksportowane tylko pod `development`/`production`).

### 2.2. Ocena `y-excalidraw` i wybór własnego wiązania

| Kryterium                                | `y-excalidraw` 2.0.12                                                                         | Wynik  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| Ostatnie wydanie                         | 2024-12-10 (21 miesięcy temu); ostatni commit tego dnia                                       | słabo  |
| Licencja / gwiazdki                      | MIT / 38 gwiazdek, 1 autor                                                                    | słabo  |
| Wspiera Excalidraw 0.18?                 | peerDep `^0.17.6`; typy importowane ze ścieżek 0.17                                           | NIE    |
| Otwarte issue                            | #11 (frames -> crash), #12 (`langCode` -> błędy), bez odpowiedzi                              | słabo  |
| Forki                                    | `@timephy/y-excalidraw`, `@mizuka-wu/y-excalidraw` (0 gwiazdek, peer `^0.18.0`, drobne łatki) | ryzyko |
| `updateScene` bez `captureUpdate: NEVER` | zdalne zmiany wpadają do lokalnego undo                                                       | błąd   |

Wniosek: nie ma utrzymywanego gotowca. Sam „gotowiec" ma ~2 pliki, a jego sedno robi Excalidraw
sam: **`reconcileElements`** (eksportowane z pakietu) + `updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER })`

- `collaborators` w `updateScene` — dokładnie tak działa oficjalna kolaboracja (excalidraw-app/collab).
  Nasze wiązanie (`yjs/excalidraw-binding.ts`, 170 linii z komentarzami):

* `Y.Map<id, element JSON>` — jeden wpis na element (Excalidraw traktuje element jako niemutowalną całość
  z `version`/`versionNonce`; granularność per pole nic nie daje, a kosztuje).
* lokalne -> Y.Doc: `onChange` (throttle 50 ms) -> zapis tylko elementów z nowszą `version` (echo po
  `updateScene` nie generuje zapisów — pokryte testem).
* Y.Doc -> lokalne: `observe` tylko dla transakcji z obcym `origin` -> `reconcileElements` -> `updateScene(NEVER)`.
* Usunięcia = `isDeleted: true` (tombstone, jak w Excalidraw); `gcDeleted(olderThanMs)` do sprzątania.
* Pliki (obrazy, SVG wykresów) w osobnej `Y.Map<fileId, BinaryFileData>`; `addFiles` po stronie odbiorcy.
* Awareness (`y-protocols`): `{user, pointer, button, selectedElementIds}` -> `updateScene({collaborators})`;
  Excalidraw sam rysuje kursory z nazwą i listę osób.
* Undo/redo: natywne Excalidraw (lokalne, „cofnij tylko moje") — zdalne zmiany są poza historią dzięki `NEVER`.
  Nie używamy `Y.UndoManager` — to celowe, bo Excalidraw ma własny model historii oparty o `Store`.

Transport: `@hocuspocus/provider` (już w deps repo, ten sam co w `whiteboard-sync`) + `y-indexeddb`
(persystencja w przeglądarce, tablica wraca po restarcie serwera).

## 3. Co sprawdzono (pkt 4 zadania) — z dowodem

Wszystkie punkty niżej mają test w `e2e/proto-excalidraw.spec.ts` / `.mobile.spec.ts` — 8/8 zielone
(Chromium 153 headless, ~52 s). Wynik `npx playwright test`: `8 passed`.

| Sprawdzenie                                        | Wynik     | Dowód / uwagi                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rysuj prostokąt w A -> widoczny w B                | DZIAŁA    | test 1; ten sam `id`, `width` zgodna                                                                                                                                                                                                                                                                                                                                                                                 |
| Przesuń w A -> pozycja w B                         | DZIAŁA    | test 1; `x/y` zgodne co do 1 px                                                                                                                                                                                                                                                                                                                                                                                      |
| Usuń w A -> `isDeleted` w B                        | DZIAŁA    | test 1; element znika z `getSceneElements()`, zostaje tombstone                                                                                                                                                                                                                                                                                                                                                      |
| Ctrl+Z w A -> wraca w B                            | DZIAŁA    | test 1; liczniki `{live, deleted}` w Y.Doc identyczne po obu stronach                                                                                                                                                                                                                                                                                                                                                |
| Awareness (kursory, lista osób)                    | DZIAŁA    | test 1: `peers() === 1`; wizualnie: kursor z nazwą i kolor, licznik `online · N` w prawym górnym rogu                                                                                                                                                                                                                                                                                                                |
| Wykres funkcji w A -> w B z plikiem SVG            | DZIAŁA    | test 2; `files[fileId].mimeType === 'image/svg+xml'`, `customData.kind === 'function'`                                                                                                                                                                                                                                                                                                                               |
| Polskie znaki („zażółć gęślą jaźń")                | DZIAŁA    | test 3; `element.text` odczytany 1:1. Font Excalifont ma polskie glify (renderuje bez fallbacku)                                                                                                                                                                                                                                                                                                                     |
| Kółko freedraw + element w środku -> klik w środek | **UWAGA** | test 4: (a) prostokąt BEZ wypełnienia: klik w środek **nie zaznacza niczego** (Excalidraw hit-testuje przezroczyste kształty tylko po obrysie; freedraw tylko po linii); (b) prostokąt Z wypełnieniem: zaznacza prostokąt, nie kółko; (c) klik w linię kółka zaznacza kółko. Inaczej niż u nas (bbox) — dla ucznia może być zaskoczeniem, ale to standard Excalidraw i da się obejść ustawiając domyślne wypełnienie |
| Warstwy Ctrl+] / Ctrl+[                            | DZIAŁA    | test 5; kolejność w tablicy i fractional `index` zmieniają się; w panelu jest też sekcja „Warstwy"                                                                                                                                                                                                                                                                                                                   |
| Grupowanie Ctrl+G                                  | DZIAŁA    | test 6; oba elementy dostają ten sam `groupIds[0]`                                                                                                                                                                                                                                                                                                                                                                   |
| Dotyk (Pixel 7, rysowanie palcem)                  | DZIAŁA    | test mobile; `touchStart/Move/End` przez CDP -> element `freedraw` z >5 punktami. Pinch-zoom nie testowany (Excalidraw wspiera natywnie)                                                                                                                                                                                                                                                                             |
| Cofanie (Ctrl+Z / przyciski)                       | DZIAŁA    | test 1 + wizualnie przyciski w lewym dolnym rogu                                                                                                                                                                                                                                                                                                                                                                     |
| Eksport PNG (`exportToBlob`)                       | DZIAŁA    | test 7; blob > 1 KB. Wbudowany też eksport SVG/PNG/clipboard z menu                                                                                                                                                                                                                                                                                                                                                  |
| Język UI `pl-PL`                                   | DZIAŁA    | zrzut: „Prostokąt — R lub 2", „Biblioteka", podpowiedzi po polsku                                                                                                                                                                                                                                                                                                                                                    |
| Persystencja bez backendu                          | DZIAŁA    | `y-indexeddb`: po restarcie `proto:yjs` tablica wraca z przeglądarki (sprawdzone ręcznie w smoke)                                                                                                                                                                                                                                                                                                                    |
| SSR / Next 16 / React 19 / Turbopack               | DZIAŁA    | `next build` przechodzi (z placeholderami `NEXT_PUBLIC_SUPABASE_*` jak w CI), strona `ƒ /proto-excalidraw/[boardId]`                                                                                                                                                                                                                                                                                                 |

### 3.1. Rozmiar bundla (production build, `next start`, zmierzony przez Playwright — bajty skryptów+CSS faktycznie pobranych przez stronę)

| Strona                   | Razem raw | Razem gzip | Tylko ta strona (raw / gzip) | Co w tym siedzi                                                        |
| ------------------------ | --------- | ---------- | ---------------------------- | ---------------------------------------------------------------------- |
| `/proto-excalidraw/[id]` | 2 782 KB  | **807 KB** | 1 329 KB / 402 KB            | Excalidraw (584 + 519 KB JS, 139 KB CSS), yjs/hocuspocus, mathjs       |
| `/whiteboard` (obecna)   | 2 579 KB  | **725 KB** | 1 125 KB / 320 KB            | silnik (508 + 258 + 217 KB), pdfjs, katex/markdown, mathjs, voice-chat |
| `/demo/[sessionId]`      | 2 522 KB  | ~700 KB    | —                            | jak wyżej bez voice-chat                                               |

Wspólne dla obu: 1 454 KB raw / 405 KB gzip (React, Next, Supabase, tailwind). Wniosek: Excalidraw
jest o ~80 KB gzip cięższy od obecnego silnika **bez** pdfjs/katex — po dołożeniu narzędzi mat.
i PDF do wersji Excalidraw różnica urośnie do ~150–200 KB gzip. Akceptowalne, ale nie „za darmo".
Uwaga: Turbopack w Next 16 nie drukuje tabeli rozmiarów „First Load JS" w `next build`, stąd pomiar
przez przeglądarkę.

### 3.2. Luki i ograniczenia znalezione po drodze

1. **Zaznaczanie po obrysie** (patrz tabela) — zmiana nawyku vs obecna tablica.
2. **Wykres nie jest „żywy"** — to SVG o stałej rozdzielczości 400×400 px (skaluje się bezstratnie jako
   wektor, ale siatka/etykiety nie przeliczają się przy zoomie sceny). Edycja wzoru = nowy plik SVG.
3. **Stare pliki SVG zostają w `Y.Map` plików** po edycji wzoru (id = hash treści; potrzebne GC albo
   liczenie referencji przy zapisie do bazy).
4. **Fonty z CDN** — do samodzielnego hostowania przed produkcją (offline w szkole).
5. **Excalidraw ma własne UI** (toolbar, menu, panel właściwości) — nasz język wizualny (Tailwind,
   ikony lucide) da się nałożyć tylko przez CSS variables/klasy `.excalidraw`, nie przez podmianę komponentów.
   `UIOptions` pozwala wyłączać elementy, `renderTopRightUI`/`Footer`/`MainMenu` dodają własne.
6. **Brak elementu PDF** — trzeba renderować strony przez pdfjs do obrazów (`image`) albo `embeddable`.
7. **Undo** jest lokalne per klient (jak dziś w ścieżce Yjs Bartka) — OK, ale trzeba to wiedzieć.
8. **Nie testowano**: >2 klientów jednocześnie, tablice >1000 elementów, rozłączenie i ponowne złączenie
   (Yjs to obsługuje z definicji, ale nie było w e2e), Safari/iOS.

## 4. Mapowanie danych (pkt 5)

Typy z `src/_new/features/whiteboard/types/elements.ts` -> element Excalidraw. Szkic w
`scripts/proto-convert-to-excalidraw.ts` (`convertBoard(elements) -> { elements, files, skipped }`,
test na path/shape/text/arrow/table/function/pdf — 4 testy, zielone). Nie uruchamiano na żadnej bazie.

| Nasz typ                          | Element Excalidraw                                                | Co się traci / uwagi                                                                                       |
| --------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `path` (pióro)                    | `freedraw` (`points` względem `x,y`, `pressures` z `widths`)      | nic istotnego; `bbox` wyliczany na nowo; `opacity` 0–1 -> 0–100                                            |
| `shape.rectangle`                 | `rectangle`                                                       | `fill: boolean` -> `backgroundColor` (kolor obrysu) — brak osobnego koloru wypełnienia w naszym modelu     |
| `shape.circle`                    | `ellipse`                                                         | —                                                                                                          |
| `shape.triangle`                  | `line` zamknięta (4 punkty)                                       | Excalidraw nie ma trójkąta; wypełnienie działa dla zamkniętej linii                                        |
| `shape.polygon` (n boków)         | `line` zamknięta (n+1 punktów)                                    | jak wyżej; `sides` ginie jako parametr (kształt zostaje)                                                   |
| `shape.line` / `shape.arrow`      | `line` / `arrow`                                                  | —                                                                                                          |
| `arrow` (z attachmentami)         | `arrow` z `points` (controlPoints), `start/end: { id }`           | `side` przyczepu ginie (Excalidraw sam liczy punkt na obrysie); `arrowType: 'smooth'` -> `roundness`       |
| `text`                            | `text`                                                            | `fontFamily` -> najbliższy z 3–5 fontów Excalidraw; `fontWeight/fontStyle` NIE istnieją (tylko przez font) |
| `image` (dataURL)                 | `image` + plik w `files`                                          | —                                                                                                          |
| `image` (URL Supabase)            | `image` ze `status: 'pending'` + `customData.sourceUrl`           | plik trzeba pobrać osobnym krokiem migracji i dodać do `files`                                             |
| `function`                        | `image` (SVG) + `customData { kind: 'function', spec }`           | stara funkcja nie ma pozycji (rysowana w (0,0) sceny) — układamy obok siebie; edycja przez panel f(x)      |
| `table`                           | siatka `rectangle` z `label` (tekst w kontenerze) w jednej grupie | **nie ma edycji „jak tabela"** (dodaj wiersz, scal) — patrz pkt 5; komórki edytowalne jak zwykły tekst     |
| `markdown`                        | `rectangle` z `label` (surowy MD) + `customData.content`          | **rendering markdown/KaTeX ginie** — patrz pkt 5                                                           |
| `pdf`                             | `skipped`                                                         | do zrobienia: strony -> obrazy (pdfjs, już w deps) albo `embeddable` z URL                                 |
| (metadane `_createdBy`, `_index`) | `index` (fractional) natywnie; autor -> `customData.createdBy`    | ActivityHistory potrzebuje autora — Excalidraw go nie trzyma, więc `customData`                            |

Kierunek odwrotny (Excalidraw -> nasz model) nie jest potrzebny: po migracji źródłem prawdy jest
`Y.Doc` z elementami Excalidraw, a snapshot zapisuje `whiteboard-sync` przez `/doc` bez zmian.

## 5. Narzędzia, których Excalidraw nie ma (pkt 6)

Szacunki w godzinach pracy agenta (noc) + przeglądu Patryka.

| Narzędzie (obecne linie)                         | Jak podłączyć w Excalidraw                                                                                                                                                                                                                                                                                                                          | Praca                 | Ryzyko            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------- |
| Wykres funkcji (741 + 50)                        | ZROBIONE w prototypie: `image` SVG + `customData` + panel w `renderTopRightUI`. Do dorobienia: podgląd na żywo, styl linii, przenoszenie starego UI (suwaki)                                                                                                                                                                                        | 4–6 h                 | niskie            |
| Tabela (380 + 259 + 47)                          | **Opcja A (zalecana):** grupa `rectangle`+`label` (jak w konwersji) + własny mini-toolbar przy zaznaczonej grupie (dodaj/usuń wiersz, kolumnę) przez `renderTopRightUI` i `customData.table`. **Opcja B:** `embeddable` z własnym React (iframe na `/embed/table?id=`) — edycja bogatsza, ale iframe nie eksportuje się do PNG i nie działa offline | A: 10–14 h; B: 8–10 h | średnie           |
| Notatka markdown / KaTeX (326)                   | `embeddable` + `renderEmbeddable` (Excalidraw pozwala zwrócić własny React zamiast iframe!) -> `react-markdown` + `rehype-katex` w elemencie; treść w `customData.content`, edycja w panelu bocznym (`Sidebar`). Eksport PNG: rasteryzacja przez `html-to-image` do `image` na żądanie                                                              | 8–12 h                | średnie (eksport) |
| Kalkulator (543)                                 | to nie jest element tablicy — panel w `Sidebar` (Excalidraw eksportuje `Sidebar`, `Footer`, `MainMenu`); wynik „wstaw na tablicę" = `text` element. Kod kalkulatora przenosi się prawie 1:1                                                                                                                                                         | 3–4 h                 | niskie            |
| Czat matematyczny (735)                          | jak wyżej: `Sidebar` (dokowany, `dockedSidebarBreakpoint`) z obecnym komponentem; odpowiedź AI -> notatka markdown (element `embeddable`) albo `text`                                                                                                                                                                                               | 4–6 h                 | niskie            |
| Smart search / karty (848+528+240+76)            | panel w `Sidebar` lub `Footer`; „wstaw kartę" -> `image` (obraz karty) albo `embeddable` (viewer). `card-viewer` przenosi się bez zmian                                                                                                                                                                                                             | 4–6 h                 | niskie            |
| Historia aktywności (495)                        | autor w `customData.createdBy` (ustawiany w `pushLocal` po stronie klienta) + `Sidebar`; lista z `Y.Map`                                                                                                                                                                                                                                            | 3–4 h                 | niskie            |
| Online users / kursory (358+171)                 | ZROBIONE natywnie przez `collaborators` (kursor z nazwą, lista w prawym górnym rogu, podążanie za użytkownikiem `onUserFollow`)                                                                                                                                                                                                                     | 0–2 h                 | —                 |
| PDF (osobny typ)                                 | strony -> obrazy przez pdfjs (już w deps) przy wstawianiu; nawigacja stron = kolejne `image` w `frame`                                                                                                                                                                                                                                              | 6–8 h                 | średnie           |
| Panel właściwości, mini-toolbar tekstu (612+169) | natywne w Excalidraw (kolor, grubość, styl, opacity, warstwy, wyrównanie) — kasujemy                                                                                                                                                                                                                                                                | 0 h                   | —                 |
| Ustawienia tablicy, nagłówek, sidebar (1 852)    | zostają nasze (Tailwind) nad/obok `<Excalidraw>`; `UIOptions` ukrywa dublujące się menu                                                                                                                                                                                                                                                             | 4–6 h                 | niskie            |

Razem narzędzia: **~50–70 h agenta** + ~15–20 h przeglądu.

## 6. Szacunek pełnej migracji (pkt 7)

Założenia: praca nocna agenta w małych PR-ach (jak REFAKTOR-PLAN), Patryk przegląda rano; Bartek
równolegle kończy Yjs/Hocuspocus dla obecnego silnika.

| Etap                                                                                                                                                              | Agent (h)                            | Przegląd Patryka (h) | Uwagi                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------- | ---------------------------------------- |
| A. Silnik + UI: `/whiteboard` i `/demo` na `ExcalidrawBoard`, nagłówek/sidebar/ustawienia, role viewer/editor (`viewModeEnabled`), grid, motyw, hostowanie fontów | 30–40                                | 8–10                 | prototyp pokrywa ~40 % tego              |
| B. Narzędzia matematyczne i pozostałe (tabela z pkt 5)                                                                                                            | 50–70                                | 15–20                | największa niepewność: tabela i markdown |
| C. Konwersja danych: skrypt na `board_elements` -> snapshot Y.Doc (`/doc`), pobranie obrazów z Supabase, próba na kopii bazy, raport `skipped`                    | 15–20                                | 4–6                  | szkic już jest; PDF osobno               |
| D. Yjs/Hocuspocus po stronie Bartka                                                                                                                               | 6–10                                 | 2–4 (+ czas Bartka)  | **przenosi się 1:1** — patrz niżej       |
| E. Testy/E2E: Playwright dla tablicy (współpraca, dotyk, eksport), vitest dla wiązania i konwersji, CI job                                                        | 15–20                                | 4–6                  | Playwright już skonfigurowany            |
| F. Usunięcie starego kodu + dokumentacja (`docs/ai-context/whiteboard/*`, pipelines §2, known-issues #1–#3)                                                       | 10–15                                | 4–6                  | dopiero po tygodniu na produkcji z flagą |
| **Razem**                                                                                                                                                         | **125–175 h** (ok. 4–6 tygodni nocy) | **37–52 h**          |                                          |

### 6.1. Praca Bartka (Hocuspocus, auth, persystencja `/doc`) — czy przenosi się 1:1?

**Tak.** `whiteboard-sync/` nie zna modelu elementów: `onAuthenticate` sprawdza token i dostęp do
tablicy w FastAPI, `Database` extension zapisuje/odczytuje binarny snapshot `Y.Doc` przez
`GET/POST /whiteboard/{id}/doc`. Prototyp używa tego samego `@hocuspocus/provider` i tego samego
protokołu — różni się tylko zawartość `Y.Doc` (`Y.Map` `excalidraw-elements` zamiast `elements`
z `DrawingElement`). Zmiana po stronie Bartka to wyłącznie:
(1) klient: `useYjsBoard`/`board-doc.ts` (390 linii) zastąpione przez `excalidraw-binding.ts`;
(2) nazwa dokumentu: dziś `documentName = boardId` (liczba) — prototyp używa `proto-excalidraw:<id>`,
do ujednolicenia; (3) migracja snapshotów w `/doc` (etap C). `Y.UndoManager` z „cofnij tylko moje"
odpada na rzecz natywnego undo Excalidraw (ten sam efekt dzięki `captureUpdate: NEVER`).

### 6.2. Ile linii zniknie

`git ls-files src/_new/features/whiteboard | xargs wc -l` = **27 124** linii (w tym 1 876 testów).
Voice chat (5 011 linii) jest osobnym feature'em i **nie** wchodzi w rachunek.

| Zostaje (przeniesione, nie skasowane)                                                                                  | Linie                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| narzędzia mat.: function-tool (UI do przepisania, logika już wyjęta), calculator, math-chatbot, smartsearch, math-eval | ~3 970 (po przepisaniu do Sidebar/paneli realnie ~2 500) |
| markdown-note + table (UI do przepisania na Excalidraw)                                                                | ~1 070 (realnie ~800)                                    |
| layout/panels (board-header, sidebar, settings, icon strip)                                                            | ~1 850                                                   |
| realtime/yjs/api (Bartek; `useElementSync` legacy do skasowania)                                                       | ~1 200 z 2 340                                           |
| activity-history, online-users (częściowo — kursory natywne)                                                           | ~500 z 850                                               |
| **Suma zostaje**                                                                                                       | **~6 900**                                               |

**Znika: ~20 000 linii** (silnik canvas 2 712, tools/handlers/selection/navigation/engine/hooks
~9 000, toolbar UI ~4 000, rendering, clipboard, history, viewport, spatial-index, snap, testy tych
modułów ~1 500) + 390 linii `BoardRealtimeContext` + Supabase Broadcast (known-issues #1–#3 przestają
istnieć). Dochodzi: ~2 600 linii prototypu + ~3 000 linii nowych paneli/narzędzi. **Bilans netto ok. −15 000 linii**
własnego kodu, a to, co zostaje, to głównie UI paneli, nie geometria/hit-testing/rendering.

## 7. Rekomendacja: **TAK, WARUNKOWO**

Prototyp potwierdza wszystko, co blokowałoby decyzję: współpraca Yjs działa z gotowym
`reconcileElements`, polskie znaki i dotyk działają, wykres funkcji da się zrobić jako element,
praca Bartka przenosi się bez zmian w serwerze. Koszt ~4–6 tygodni nocy + ~45 h przeglądu, zysk
−15 tys. linii własnego silnika, zero własnego hit-testingu/renderingu/undo i darmowe funkcje
(warstwy, grupy, wyrównanie, eksport, biblioteka kształtów, laser, linki, frames).

Warunki, bez których NIE zaczynać:

1. **Decyzja o tabeli i notatce markdown** (pkt 5, opcje A/B) — to jedyne dwa narzędzia, których
   Excalidraw nie odtwarza natywnie; Patryk wybiera, czy wystarczy „grupa prostokątów + mini-toolbar"
   (prosto, eksportuje się) czy `embeddable` z własnym React (bogato, słabszy eksport).
2. **Akceptacja zaznaczania po obrysie** (albo domyślne wypełnienie kształtów w naszej konfiguracji) i
   wyglądu UI Excalidraw (własne skórowanie tylko przez CSS variables).
3. **Bartek kończy Hocuspocus + `/doc`** na obecnym silniku PRZED etapem A — wtedy etap D to
   tylko podmiana wiązania. Migracja nie może iść równolegle z jego pracą w tych samych plikach.
4. **Flaga `NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw`** i obie tablice żyją obok siebie do końca
   etapu E; stary kod znika dopiero po tygodniu bez regresji (etap F).
5. **Test konwersji na kopii produkcyjnej bazy** (etap C) z raportem `skipped` — jeśli >5 % elementów
   nie przechodzi (PDF-y, stare formaty), najpierw naprawić konwersję.
6. Samodzielne hostowanie fontów Excalidraw przed wypuszczeniem (szkoły bez dostępu do CDN).

Jeśli Patryk odrzuca warunek 2 (UI musi wyglądać jak dziś), rekomendacja zmienia się na **NIE** —
walka z UI Excalidraw kosztuje więcej niż utrzymanie własnego silnika.
