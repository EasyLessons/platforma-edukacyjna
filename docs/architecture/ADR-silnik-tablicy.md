# ADR: silnik tablicy — własny vs Excalidraw vs tldraw (+ plan płatności)

**Data:** 22.09.2026
**Status:** propozycja do decyzji Patryka i Bartka. Zero zmian w kodzie w tej sesji.
**Baza pomiarów:** `origin/main@18d7f52` (merge PR #63). Liczby z `git ls-files | xargs wc -l`,
nie z dokumentacji. Fakty o bibliotekach sprawdzone w sieci 22.09.2026 — linki przy każdym.
**Dane empiryczne:** równolegle powstaje prototyp Excalidraw + Yjs na gałęzi
`proto/excalidraw-yjs`, opisany w `docs/architecture/PROTOTYP-EXCALIDRAW.md` (na tej gałęzi;
w chwili pisania ADR dokument jeszcze nie był wypchnięty). Ten ADR NIE powiela wyników prototypu —
mówi, co prototyp ma potwierdzić, żeby rekomendacja weszła w życie (§ Warunki).

---

## 1. Kontekst

### 1.1 Co mamy (zmierzone)

`src/_new/features/whiteboard/`: **133 pliki, 27 124 linie** (z testami), z czego
**25 248 linii kodu** i 1 876 linii testów (11 plików, 157 przypadków `it(`; wg planu
refaktoru całość frontendu to 450 testów vitest, backend 334 pytest). To nie jest "~15k" z
pamięci — jest prawie dwa razy więcej.

| Obszar (bez testów)                                                    | Linie      | Co to jest                                                                        |
| ---------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `tools/` + `components/toolbar/`                                       | **9 374**  | 13 narzędzi (adapter `*.tool.tsx` + komponent `*-tool.tsx` + `*.properties.tsx`), pasek, panel właściwości, historia aktywności |
| `components/canvas/`                                                   | 3 700      | `whiteboard-canvas.tsx` (**2 712** linii — spięcie wszystkiego), siatka, kursory zdalne, snap-guides, online-users |
| `selection/` + `navigation/` + `handlers/` + `elements/`               | 3 192      | hit-testing, uchwyty, transformacje, snap, spatial index, viewport-math, rendering per typ elementu |
| `components/panels/` + `components/layout/`                            | 1 852      | ustawienia tablicy, zapisane assety, nagłówek, sidebar                            |
| `components/smartsearch/`                                              | 1 697      | SmartSearch (wyszukiwarka wzorów) + `card-viewer`                                 |
| `realtime/`                                                            | 1 659      | Supabase Broadcast: sync elementów (legacy), presence, kursory, typing, viewport   |
| `engine/` + `commands/` + `use-history` + `use-elements`               | 1 246      | fasada `WhiteboardEngine` (intencje create/update/delete + live), wzorzec Command, undo/redo "tylko moje" |
| `yjs/` + `use-yjs-board`                                               | 441        | `board-doc.ts` (Y.Map elementów), `use-yjs-sync.ts` (HocuspocusProvider), `Y.UndoManager` |
| `api/`                                                                 | 210        | REST elementów (legacy) + `/doc`, `/access`                                       |
| poza feature: `src/app/context/BoardRealtimeContext.tsx`               | 390        | legacy provider presence/kursory                                                  |

Poza frontendem: `whiteboard-sync/` (Hocuspocus, 3 pliki, ~120 linii logiki + config) i
`backend/api/v1/whiteboard/` (796 linii: `router/schemas/service/storage`; endpointy
`elements` batch/load/delete, `image` upload do Supabase Storage, `doc` POST/GET, `access`,
`settings`, `opened`).

**Model elementu** (`types/elements.ts`): unia dyskryminowana `DrawingElement` po polu `type`:
`path` (punkty + `widths[]` pressure), `shape` (rectangle/circle/triangle/line/arrow/polygon),
`text`, `function` (wyrażenie + zakresy), `image`, `pdf`, `markdown` (treść MD, flaga
`isFromChatbot`), `table` (`cells[][]`), `arrow` (z przyczepami `startAttachment/endAttachment`).
Współrzędne absolutne, `rotation` w radianach tylko na części typów.

**Undo/redo:** dwie implementacje równolegle. Legacy: `commands/*` (Create/Update/Delete/
Composite) + `use-history.ts` — stos komend bieżącego użytkownika, z wstrzykiwanym
`CommandContext` (stan React + broadcast + REST). Yjs: `Y.UndoManager(getElementsMap(doc),
{ trackedOrigins: new Set([userId]) })` — "cofnij tylko moje" za darmo.

**Dokument Yjs** (`yjs/board-doc.ts`): `Y.Doc` z root `Y.Map('elements')`, wartość =
`Y.Map` per element (pola elementu jako klucze + `_index` z `fractional-indexing`,
`_createdBy`, `_createdByName`, `_createdAt`). Transport: `HocuspocusProvider` →
`whiteboard-sync` (port 1234, `onAuthenticate` → `GET /access`, `Database` extension →
`GET/POST /doc`, snapshot `bytea` w `board_documents`). Presence/kursory nadal Supabase.
Ścieżka za flagą `NEXT_PUBLIC_WHITEBOARD_YJS`; przełączenie na stałe i migracja
`board_elements → board_documents` to praca Bartka (`feature/whiteboard-yjs`, REFAKTOR-PLAN §3.4).

### 1.2 Dlaczego w ogóle pytamy

- Patryk zdecydował (22.09), że **chce zejść z własnego silnika** — koszt utrzymania 25k linii
  przez dwuosobowy zespół studentów jest za duży względem tego, co daje.
- `known-issues.md` #1–#3 to wyścigi transportu legacy; #2 (obraz po undo jako szary blok)
  pokazuje, jak łatwo silnik rozjeżdża się na styku warstw.
- `whiteboard-canvas.tsx` ma 2 712 linii i spina 5 hooków + 2 ścieżki persystencji przez
  `adaptYjsElements/adaptYjsHistory`. Każda nowa funkcja (grupowanie, wyrównywanie, eksport
  PNG, gesty) to ręczna praca, którą gotowe silniki mają od lat.
- Równolegle Bartek kończy Yjs/Hocuspocus. **Transport i persystencja są niezależne od
  modelu elementów** — zmienia się tylko wiązanie `Y.Doc ↔ scena` (§4c). To główny powód, żeby
  decyzję podjąć teraz, zanim Faza C0 usunie legacy i zamknie schemat dokumentu.

---

## 2. Opcje

### Opcja 1 — zostać przy własnym silniku

Dokończyć Yjs (C0), skasować legacy (~1 500 linii FE + ~250 BE), dalej rozwijać ręcznie.

### Opcja 2 — `@excalidraw/excalidraw`

- **Licencja MIT** ([npm](https://www.npmjs.com/package/@excalidraw/excalidraw),
  [GitHub](https://github.com/excalidraw/excalidraw), 132 k gwiazdek, push 21.09.2026).
- **Wersja 0.18.1 z 20.04.2026** (rejestr npm) — pakiet npm wychodzi rzadko (5 miesięcy bez
  wydania), choć repo jest bardzo aktywne. Wersja 0.x = brak gwarancji semver.
- **Współpraca:** brak oficjalnego bindingu Yjs. Excalidraw daje `reconcileElements` +
  `excalidrawAPI.updateScene({ elements, captureUpdate: NEVER })` i element ma `version`,
  `versionNonce`, `index` (fractional), `isDeleted` — czyli wszystko, co trzeba, żeby napisać
  własne wiązanie z Y.Map. Społecznościowe: [`y-excalidraw`](https://github.com/RahulBadenkal/y-excalidraw)
  (MIT, 38 gwiazdek, **ostatni push 12.2024**, v2.0.12 — de facto nieutrzymywany),
  [`alkem-io/excalidraw-yjs`](https://github.com/alkem-io/excalidraw-yjs) (MIT, **hard fork**
  Excalidraw z Y.Doc jako źródłem prawdy, push 26.08.2026, 0 gwiazdek — świeży, jednoosobowy).
  Wniosek: binding piszemy sami (Y.Map + reconcile), nie bierzemy forka.
- **Custom shapes:** nie ma API własnych typów. Rozszerzalność przez `customData?:
  Record<string, any>` na każdym elemencie, element `image` (pliki w `files`), `embeddable`/
  `iframe` z `renderEmbeddable` (własny React w ramce), `frame`
  ([typy](https://github.com/excalidraw/excalidraw/blob/master/packages/element/src/types.ts)).
- **API imperatywne:** `excalidrawAPI` (`updateScene`, `getSceneElements`, `addFiles`,
  `scrollToContent`), `convertToExcalidrawElements` (skeleton → elementy), `onChange`,
  `onPointerUpdate`, `viewModeEnabled`, `UIOptions`, `renderTopRightUI`
  ([props](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props)).
- **Eksport:** `exportToCanvas/Blob/Svg/Clipboard`
  ([docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export)).
- **i18n:** `langCode="pl-PL"`, plik
  [`locales/pl-PL.json`](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/pl-PL.json)
  kompletny.
- **Touch/pen:** freedraw z `pressures[]`, gesty pinch-zoom wbudowane; to główna aplikacja
  excalidraw.com na tabletach.
- **Bundle:** wg [bundlephobia](https://bundlephobia.com/package/@excalidraw/excalidraw@0.18.1)
  główny chunk 1.12 MB / **353 kB gzip** + lazy chunki (największy 735 kB gzip — fonty,
  mermaid, ładowane na żądanie).
- **SSR:** brak — `next/dynamic(..., { ssr: false })` + `"use client"`
  ([integration](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration)). U nas
  tablica i tak jest client-only.

### Opcja 3 — tldraw SDK

- **Licencja własna, NIE open source** ([LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md),
  [community/license](https://tldraw.dev/community/license)): produkcja (HTTPS, nie-localhost,
  `NODE_ENV=production`) wymaga **klucza licencyjnego**. Hobby (niekomercyjne) = znak wodny
  "made with tldraw"; komercyjna = "value-based pricing", "talk to sales"
  ([pricing](https://tldraw.dev/pricing)). W dyskusji przy SDK 4.0 padła kwota **$6 000/rok**
  za zespół ([HN](https://news.ycombinator.com/item?id=45294916),
  [BigGo](https://finance.biggo.com/news/202509190115_tldraw_SDK_4.0_Licensing_Debate));
  tldraw deklaruje "startup pricing" po formularzu. Trial 100 dni bez karty.
- **Wersja 5.4.2 z 10.09.2026** (rejestr npm), wydania co ~miesiąc, 50 k gwiazdek.
- **Współpraca:** własne `@tldraw/sync` (Cloudflare Durable Objects albo własny backend JS —
  [docs](https://tldraw.dev/docs/sync)); Yjs przez przykład `useYjsStore`
  ([examples.tldraw.com/yjs](https://examples.tldraw.com/yjs)) — repo `tldraw/tldraw-yjs-example`
  **zwraca 404** (22.09.2026), zostają kopie społeczności. Yjs w tldraw to ścieżka
  "wspierana przykładem", nie produktem.
- **Custom shapes:** pierwszorzędne — `ShapeUtil`/`BaseBoxShapeUtil`, `component()` renderuje
  React/HTML w `HTMLContainer`, walidatory props, migracje schematu, `meta` na dane własne,
  custom tools jako `StateNode` ([shapes](https://tldraw.dev/docs/shapes)). To najlepsza z
  trzech opcji pod wykres funkcji / notatkę MD / tabelę jako natywny element.
- **API imperatywne:** `Editor` (`createShapes`, `updateShapes`, `select`, `zoomToFit`,
  `updateInstanceState({ isReadonly })`), eksport `editor.toImage()` / `exportToBlob`.
- **i18n:** [`assets/translations/pl.json`](https://github.com/tldraw/tldraw/blob/main/assets/translations/pl.json)
  istnieje (HTTP 200, pełne tłumaczenie).
- **Touch/pen:** bardzo dobre (tldraw.com jest aplikacją tabletową), gesty wbudowane.
- **Bundle:** wg [bundlephobia](https://bundlephobia.com/package/tldraw@5.4.2) **1.76 MB /
  524 kB gzip** w jednym chunku (16 zależności, m.in. TipTap do rich textu).
- **SSR:** również `ssr: false` (zależność od `window`).

---

## 3. Porównanie

### 3.1 Narzędzia matematyczne — gdzie lądują w każdej opcji

| Narzędzie (dziś)                    | Opcja 1 (własny)             | Opcja 2 (Excalidraw)                                                                                    | Opcja 3 (tldraw)                                   |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Wykres funkcji (`function-tool`, 741 l.) | element `function`      | **element `image`**: SVG renderowany z `expression` przez nasz kod (mathjs już jest), wyrażenie/zakresy w `customData`; edycja = panel boczny → podmiana pliku | **custom `ShapeUtil`** z React (interaktywny)      |
| Kalkulator (`calculator-tool`, 543 l.) | panel obok                | **panel obok** (bez zmian); "wstaw wynik" = `updateScene` z elementem `text`                           | panel obok; wynik = `createShapes` text            |
| Czat AI (`math-chatbot`, 735 l.)    | panel + element `markdown`   | **panel obok** (bez zmian); odpowiedź = `image` (MD+KaTeX → SVG) albo `text` (bez wzorów). Excalidraw nie ma MD/LaTeX | panel obok; odpowiedź = custom shape MD+KaTeX      |
| SmartSearch + `card-viewer` (1 697 l.) | panel + karta            | **panel obok** (bez zmian); karta na tablicę = `image`                                                 | panel obok; karta = `image` albo custom shape      |
| Notatka Markdown (`markdown-note-tool`) | element `markdown`       | `image` (render) **albo** `embeddable` na własny route `/embed/note/[id]` z `renderEmbeddable`         | custom shape                                       |
| Tabela (`table-tool`, 380 l.)       | element `table`              | **brak natywnej tabeli**: siatka `rectangle`+`text` (edytowalna, brzydsza) albo `image`. Regresja UX     | custom shape (HTML `<table>`)                      |
| PDF (`pdf-handler`)                 | element `pdf`                | `image` per strona (pdfjs-dist już jest) — tak robi excalidraw.com                                     | jw. albo custom shape                              |
| Pióro / kształty / tekst / strzałki / gumka | własne                | **za darmo** (freedraw z pressure, binding strzałek, gumka)                                            | za darmo                                           |
| Voice chat (`features/voice-chat`)  | niezależny                   | **bez zmian** (WebRTC + Supabase)                                                                       | bez zmian                                          |
| Demo (`features/demo`, guest)       | niezależny od silnika        | bez zmian (tożsamość gościa idzie do `onAuthenticate` Hocuspocusa tak jak dziś)                        | bez zmian                                          |
| Tryb read-only (`isReadOnly`, `read_only` z PR #68) | flaga silnika  | `viewModeEnabled` + `UIOptions`                                                                        | `updateInstanceState({ isReadonly: true })`        |
| Presence / kursory / follow (Supabase, 1 659 l.) | własne          | `onPointerUpdate` → awareness Hocuspocusa → `updateScene({ collaborators })` (Excalidraw rysuje kursory sam) | awareness → `TLInstancePresence` (rysuje sam)      |

Zasada: **panele boczne zostają jak są** (kalkulator, czat, SmartSearch, ustawienia) — to
~3 500 linii, które nie zależą od silnika. Na canvas idą tylko "wyniki" jako elementy natywne.

### 3.2 Koszt migracji (dni robocze, 1 osoba; zespół = 2 studentów na część etatu)

| Składnik                                                                 | Opcja 1 | Opcja 2 (Excalidraw) | Opcja 3 (tldraw) |
| ------------------------------------------------------------------------ | ------- | -------------------- | ---------------- |
| (a) podmiana silnika + narzędzia (panele → `updateScene`, wykres jako SVG, tabela, PDF, read-only, demo) | 0 | **12–18** | 15–22 (ShapeUtil ×4: wykres, MD, tabela, PDF + migracje schematu) |
| (b) konwersja danych (`DrawingElement` → elementy nowego silnika; skrypt jednorazowy + "konwertuj przy pierwszym otwarciu") | 0 | **3–5** | 4–6 |
| (c) wiązanie z Yjs/Hocuspocus Bartka (transport i `/doc` bez zmian; nowy `board-doc.ts` v2 + reconcile + undo + awareness kursorów) | 5–8 (C0: legacy out, migracja `board_elements`) | **4–7** | 3–5 (`useYjsStore` z przykładu) — albo 6–10 na `@tldraw/sync` i wyrzucenie Hocuspocusa |
| (d) testy/regresje (nowe testy bindingu i konwersji; ręczne 2 karty + tablet; usunięcie 11 plików testów silnika) | 2–3 | **5–8** | 5–8 |
| (e) nauka zespołu (API, model elementu, debug)                            | 0 | **2–3** (mała powierzchnia API) | 3–4 (ShapeUtil, store, signals) |
| **Razem**                                                                | **7–11** | **26–41** (≈ 6–8 tyg. przy 2 os. × pół etatu) | **30–45 + licencja** |

Uwaga do (b): dane leżą dziś w dwóch miejscach — `board_elements` (legacy, JSON per element) i
`board_documents` (snapshot Y.Doc). Konwersja czyta jedno źródło (po C0: tylko Y.Doc) i pisze
nowy klucz root (`elements_v2` / nowy `Y.Doc`), stary zostaje jako kopia zapasowa. Bez
konwersji "na żywo" w dwie strony.

### 3.3 Ryzyka

| Ryzyko                                       | Opcja 1                             | Opcja 2                                                                          | Opcja 3                                                                |
| -------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Licencja / koszt stały                       | brak                                | MIT, brak                                                                        | **$6 000/rok** lub znak wodny; klucz wygasa = tablica przestaje działać na prod; brak firmy = trudna umowa |
| Utrata funkcji                               | brak                                | **tabela**, MD/LaTeX na canvasie, interaktywny wykres (statyczny SVG)            | niewielka (custom shapes), ale rich text tldraw ≠ nasz MD              |
| Praca Bartka (Yjs/Hocuspocus)                | wykorzystana 1:1                    | transport, serwis, `/doc`, `/access`, `board_documents` **zostają**; przepisany `board-doc.ts` (~250 l.) i `use-yjs-board.ts` (191 l.) | jw., ale kusi `@tldraw/sync` = wyrzucenie Hocuspocusa                  |
| Blokada roadmapy                             | każda funkcja tablicy = ręcznie     | 6–8 tygodni bez nowych funkcji tablicy; plany/płatności (PR #68) idą równolegle  | jw. + negocjacja licencji                                              |
| Lock-in                                      | w sobie samych                      | niski: dane to JSON elementów, format `.excalidraw` otwarty; wersja 0.x może łamać API | wysoki: schemat store + migracje + licencja                            |
| Tablety / touch                              | własne gesty (`use-multi-touch-gestures`, PR #40/#41) — ciągła praca | sprawdzone na excalidraw.com; **do potwierdzenia w prototypie** na tablecie ucznia | bardzo dobre                                                           |
| Jakość odręcznego pisma (matematyka!)        | własny pen z `widths[]`             | freedraw + perfect-freehand, pressure — porównywalne                             | perfect-freehand — porównywalne                                        |
| Rozmiar bundle                               | 0 dodatkowo                         | +353 kB gzip                                                                     | +524 kB gzip                                                           |

### 3.4 Zyski (co znika, co dostajemy)

**Do usunięcia przy opcji 2** (z `wc -l`, bez testów): `tools/` + `toolbar/` bez paneli
(~6 000 z 9 374), `components/canvas/` (3 700), `selection/navigation/handlers/elements`
(3 192), `realtime/` (1 659 — po przejściu na awareness), `engine/commands/history/elements`
(1 246), `BoardRealtimeContext` (390) → **~16 000 linii kodu i 11 plików testów**. Zostają panele
(~3 500), `yjs/` w nowej wersji (~400), API (210), `whiteboard-sync`, backend.

**Za darmo w opcji 2 i 3:** undo/redo, multi-select z obrotem i grupowaniem, wyrównywanie,
kopiuj/wklej między tablicami, eksport PNG/SVG/schowek, obrazy (drag&drop, wklejanie), gesty
pinch/pan, zoom do zawartości, biblioteki kształtów, skróty, dostępność, i18n pl, tryb
ciemny, "laser pointer" (przydatny na lekcji), frames.

---

## 4. Rekomendacja

**Opcja 2 — Excalidraw.** Jednoznacznie, z warunkami poniżej.

Uzasadnienie w trzech zdaniach: (1) tldraw ma najlepsze API rozszerzeń, ale własna licencja z
opłatą rzędu $6 000/rok albo znakiem wodnym jest nie do przyjęcia dla projektu bez przychodu i
bez firmy — a klucz, który może wygasnąć na produkcji, to ryzyko operacyjne, którego własny
silnik nie ma. (2) Excalidraw jest MIT, ma pełne pl, działa na tabletach, a jego brak własnych
typów elementów da się obejść przez `image` + `customData` dla wykresów i przez pozostawienie
paneli obok canvasu — kosztem tabeli i MD na canvasie. (3) Praca Bartka nie przepada: zmienia
się tylko wiązanie `Y.Doc ↔ scena` (~450 linii), transport, serwis i persystencja zostają.

### Warunki (co musi potwierdzić prototyp `proto/excalidraw-yjs`)

1. **Binding Yjs działa z Hocuspocusem Bartka bez forka:** Y.Map elementów (JSON per element,
   nadpisywanie po `version`/`versionNonce`) → `updateScene({ elements: reconcileElements(...),
   captureUpdate: NEVER })`; dwie karty, jednoczesne przesuwanie tego samego elementu, F5 w
   trakcie — bez duplikatów i bez "wracających" elementów (known-issues #1).
2. **Undo "tylko moje"** po zdalnej zmianie nie cofa cudzych elementów (historia Excalidraw
   z `captureUpdate: NEVER` albo `Y.UndoManager` z `trackedOrigins`).
3. **Pióro na tablecie** (iPad/Android ucznia): opóźnienie i wygląd linii nie gorsze niż dziś;
   gesty pinch/pan nie kolidują z rysowaniem.
4. **Wykres funkcji jako SVG-image** edytowalny z panelu (podmiana pliku w `files`) jest
   akceptowalny UX-owo dla Patryka jako korepetytora.
5. **Konwersja próbki 10 prawdziwych tablic** (path, shape, text, function, image, arrow)
   otwiera się bez błędów; tabela i markdown mają zdefiniowaną degradację (§3.1).

Jeśli 1 albo 3 padnie — **zostajemy przy opcji 1** (dokończyć C0, ciąć legacy, nie migrować).
tldraw wraca do gry tylko, gdy pojawi się przychód, firma i budżet na licencję — wtedy jego
`ShapeUtil` rozwiązuje tabelę/MD/wykres lepiej niż Excalidraw.

### Kolejność (jeśli warunki spełnione)

1. Bartek kończy C0 (Yjs na stałe, legacy out) — schemat `board-doc.ts` v1 zostaje jako
   format źródłowy konwersji.
2. Nowy feature `features/board-engine/` (nazwa robocza) z Excalidraw za flagą
   `NEXT_PUBLIC_BOARD_ENGINE=excalidraw`; stary silnik nietknięty do końca migracji.
3. Binding + awareness kursorów (zastępuje `realtime/`), potem panele przepięte na
   `excalidrawAPI`, potem konwersja danych "przy pierwszym otwarciu" + skrypt hurtowy.
4. Dwa tygodnie równoległego działania obu silników na tych samych tablicach (read-only w
   starym), potem usunięcie starego jednym PR-em `git rm`.

---

## 5. Konsekwencje

- **Dokumentacja:** `docs/ai-context/whiteboard/*` (canvas-architecture, how-to-add-tool,
  use-canvas-wheel-spec) staje się historyczna — do usunięcia razem z silnikiem, zgodnie z
  zasadą "opisujemy stan, nie historię". `pipelines.md` §2/§2b, `stack.md`, `known-issues.md`
  #1–#3 do przepisania.
- **REFAKTOR-PLAN:** Faza C (C1–C7, w tym C7 "tools-colocation") traci sens dla starego
  silnika — nie robić C7; C1 (przenosiny `BoardRealtimeContext`) też odpada, bo plik znika.
- **Plany/limity (PR #68):** `max_elements_per_board` liczy dziś `board_elements`; po migracji
  liczy elementy Y.Doc (`isDeleted: false`) — jedna funkcja w `plans/service.py`.
- **Zależności:** +`@excalidraw/excalidraw` (MIT), bez `y-excalidraw` i bez forka; `mathjs`,
  `katex`, `pdfjs-dist`, `react-markdown` zostają (panele). Zasada 7 z CLAUDE.md spełniona:
  sprawdzone gotowce to `y-excalidraw` (nieutrzymywany od 12.2024) i `alkem-io/excalidraw-yjs`
  (hard fork, 0 gwiazdek, jednoosobowy) — oba odpadają na rzecz ~300-liniowego własnego
  bindingu na publicznym API Excalidraw.
- **Ryzyko wersji 0.x:** pinujemy dokładną wersję w `package.json`, bump tylko świadomy, z
  ręcznym testem 2 kart + tablet.
- **Zespół:** przez 6–8 tygodni tablica nie dostaje nowych funkcji; Patryk robi płatności
  (§7), Bartek binding, druga osoba panele + konwersję.

---

## 6. Pytania do Patryka i Bartka

1. **Tabela i notatka MD na canvasie** — zgoda na degradację (siatka prostokątów / obraz
   SVG) czy to funkcje krytyczne dla lekcji? Jeśli krytyczne, Excalidraw traci ~40% przewagi.
2. **Wykres funkcji jako statyczny SVG** edytowany z panelu — wystarczy, czy potrzebny
   interaktywny (przeciąganie zakresu na canvasie)?
3. **Bartek:** czy zgadzasz się, że `board-doc.ts`/`use-yjs-board.ts` zostaną przepisane na
   model Excalidraw po C0, i czy robisz binding (Ty znasz Hocuspocusa najlepiej)?
4. **Stare tablice:** konwertować wszystkie hurtowo, czy "przy pierwszym otwarciu" + stary
   silnik w trybie read-only przez okres przejściowy?
5. **Freeze funkcji tablicy** na 6–8 tygodni migracji — akceptowalny wobec roadmapy
   (plany/płatności idą równolegle, nie kolidują)?
6. **Tablet:** na jakim sprzęcie uczniowie realnie rysują (iPad z Pencil? Android?) — to
   decyduje, na czym testujemy warunek 3.

---

## 7. Płatności i plany — czego NIE piszemy sami

Kontekst: PR #68 (`feat/plans-entitlements`, `docs/plan-subskrypcje.md`) wprowadza tabelę
`user_plans` (`plan` = `free`/`premium`), limity w `plans/limits.py`, egzekwowanie w
serwisach, `GET /plans/me`, badge na froncie. Plan nadawany ręcznie SQL-em. Płatności — "później".

**Uwaga nadrzędna: Stripe w Polsce wymaga podmiotu gospodarczego.** Umowa
[Stripe Services Agreement — Poland](https://stripe.com/legal/ssa/pl): "Only businesses
(including sole proprietors) and non-profit organisations located in Poland are eligible".
Patryk nie ma jeszcze działalności. Czy **działalność nierejestrowana** (bez wpisu do CEIDG,
przychód do 75% minimalnego wynagrodzenia miesięcznie) przechodzi KYC Stripe'a jako "sole
proprietor" — blogi twierdzą, że tak, ale **nie znalazłem oficjalnego potwierdzenia Stripe'a**;
do sprawdzenia mailem do supportu przed pisaniem kodu. Bezpieczna ścieżka: JDG (ulga na start
+ zwolnienie podmiotowe z VAT do 200 tys. zł → "nievatowiec").

### Co bierzemy gotowe (Stripe)

| Potrzeba                              | Gotowiec                                                                                                    | Cena (PL, [stripe.com/pl/pricing](https://stripe.com/pl/pricing), 22.09.2026) |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Karty, BLIK, P24, 3DS, PCI            | Stripe Payments + **Checkout** (hostowana strona)                                                            | karty EOG 1,5% + 1 zł; BLIK 1,6% + 1 zł; P24 1,9% + 1 zł; karty spoza EOG 3,25% + 1 zł; +2% przewalutowanie; 0 zł stałych |
| Subskrypcje, ponawianie, proratowanie, upgrade/downgrade, okres próbny | **Stripe Billing** ([docs](https://docs.stripe.com/billing/subscriptions/build-subscriptions)) | 0,7% od wolumenu cyklicznego pay-as-you-go ([billing/pricing](https://stripe.com/en-pl/billing/pricing)) |
| Zmiana karty, anulowanie, historia płatności | **Customer Portal** ([docs](https://docs.stripe.com/customer-management))                             | w Billing (własna domena portalu +$10/mies.)                                 |
| Powiadomienia o zdarzeniach           | **Webhooki** ([docs](https://docs.stripe.com/webhooks)) — podpis weryfikowany SDK                            | 0                                                                            |
| VAT / OSS przy sprzedaży do UE        | **Stripe Tax** ([docs](https://docs.stripe.com/tax), [cennik](https://stripe.com/tax/pricing))              | 0,5% od transakcji tam, gdzie zarejestrowani; nievatowiec sprzedający w PL na razie nie potrzebuje |
| PDF "invoice" po angielsku            | **Stripe Invoicing**                                                                                        | 0,4% od opłaconej faktury                                                    |

### Polskie faktury — Stripe nie wystarczy

Stripe Invoicing generuje dokument, który **nie jest polską fakturą VAT w rozumieniu KSeF** (brak
numeracji wg polskich zasad, brak wysyłki do KSeF). Terminy KSeF
([ksef.podatki.gov.pl](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/zakres-obowiazkowego-ksef/)):
duże firmy od 1.02.2026, pozostali od 1.04.2026, najmniejsi (sprzedaż ≤ 10 tys. zł/mies.)
od 1.01.2027 — czyli EasyLesson na starcie ma odroczenie do końca 2026, ale odbiór faktur w
KSeF obowiązuje już. Sprzedaż B2C konsumentom nie wymaga faktury bez żądania; nievatowiec
wystawia fakturę "zw" (bez VAT).

Gotowce do polskich faktur ze Stripe (webhook → faktura w polskim programie → KSeF):

- **Fakturownia / inFakt / wFirma** mają API i wbudowany KSeF; łącznik ze Stripe daje
  pośrednik: [Stripto](https://stripto.pl/automatyczne-faktury-stripe) (od 19 zł/mies.),
  [Striplo](https://striplo.pl/), [Billio](https://billio.pl/). Alternatywa: własny webhook
  `invoice.paid` → `POST` do API Fakturowni (~100 linii Pythona) — to jedyne miejsce, gdzie
  własny kod ma sens, jeśli 19 zł/mies. boli.
- Wybór programu: inFakt/wFirma dają też księgowość JDG; Fakturownia ma najprostsze API.
  Decyzja Patryka po założeniu działalności.

### Co piszemy sami (i tylko to)

1. Kolumna `stripe_customer_id` w `user_plans` (albo osobna tabela `billing_customers`) +
   `stripe_subscription_id`, `current_period_end`.
2. `POST /api/v1/billing/checkout` — tworzy Checkout Session (price id z env), zwraca URL.
3. `POST /api/v1/billing/portal` — tworzy sesję Customer Portal, zwraca URL.
4. `POST /api/v1/billing/webhook` — obsługa `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   → ustawia `user_plans.plan` (`premium`/`free`) i `current_period_end`. Idempotentnie (po
   `event.id`). To jest jedyny kod, który "nadaje plan" — SQL z `plan-subskrypcje.md` zostaje
   tylko na awarie.
5. Strona cennika (`/pricing`) + przycisk "Zarządzaj subskrypcją" w `/account`.
6. Testy: webhook z podpisem (Stripe CLI `stripe trigger`), przejścia planu.

Szacunek: **3–5 dni** po założeniu konta Stripe (w tym tryb testowy bez działalności — Stripe
pozwala budować w test mode przed aktywacją konta).

### Czego NIE piszemy

Formularz karty, przechowywanie danych kart (PCI), ponawianie nieudanych płatności, proratowanie
przy zmianie planu, portal klienta, generowanie PDF faktur, liczenie VAT/OSS, obsługa
chargebacków, cykliczne maile o płatności — wszystko to Stripe Billing/Portal/Tax + program
do faktur. Jeśli ktokolwiek zaproponuje "prosty cron do subskrypcji" — odsyłać do tej sekcji.

---

## Źródła (22.09.2026)

- Excalidraw: [npm](https://www.npmjs.com/package/@excalidraw/excalidraw) (0.18.1, MIT, 20.04.2026),
  [GitHub](https://github.com/excalidraw/excalidraw), [props](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props),
  [export](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export),
  [integration/Next.js](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration),
  [pl-PL](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/pl-PL.json),
  [bundlephobia](https://bundlephobia.com/package/@excalidraw/excalidraw@0.18.1)
- Yjs + Excalidraw: [y-excalidraw](https://github.com/RahulBadenkal/y-excalidraw),
  [alkem-io/excalidraw-yjs](https://github.com/alkem-io/excalidraw-yjs),
  [dyskusja #3879](https://github.com/excalidraw/excalidraw/discussions/3879)
- tldraw: [LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md),
  [license](https://tldraw.dev/community/license), [pricing](https://tldraw.dev/pricing),
  [license key](https://tldraw.dev/sdk-features/license-key), [sync](https://tldraw.dev/docs/sync),
  [shapes](https://tldraw.dev/docs/shapes), [yjs example](https://examples.tldraw.com/yjs),
  [pl.json](https://github.com/tldraw/tldraw/blob/main/assets/translations/pl.json),
  [HN o $6k/rok](https://news.ycombinator.com/item?id=45294916),
  [bundlephobia](https://bundlephobia.com/package/tldraw@5.4.2)
- Stripe: [cennik PL](https://stripe.com/pl/pricing), [Billing](https://stripe.com/en-pl/billing/pricing),
  [Tax pricing](https://stripe.com/tax/pricing), [SSA Poland](https://stripe.com/legal/ssa/pl),
  [webhooks](https://docs.stripe.com/webhooks), [Customer Portal](https://docs.stripe.com/customer-management)
- Faktury PL: [Stripto](https://stripto.pl/automatyczne-faktury-stripe), [Striplo](https://striplo.pl/),
  [Billio](https://billio.pl/), [KSeF terminy](https://ksef.podatki.gov.pl/informacje-ogolne-ksef-20/zakres-obowiazkowego-ksef/)
