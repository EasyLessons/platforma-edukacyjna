# REFAKTORYZACJA TABLICY — PLIK ROBOCZY (dla Copilota)

> Branch: `refactor/tablica`
> Aktualizuj ten plik po każdym etapie.

---

## OBECNA STRUKTURA (src/app/tablica/)

```
tablica/
├── page.tsx                      [304 linii]  — entry point, robi joinBoard, loadBoard, ustawia role/workspaceId
├── components/
│   ├── BoardHeader.tsx           [454 linii]  — nagłówek tablicy (nazwa, udostępnianie, export)
│   └── HomeButton.tsx            [109 linii]  — przycisk powrotu
├── whiteboard/
│   ├── WhiteboardCanvas.tsx      [4173 linii] ← GŁÓWNY POTWÓR (do rozbicia)
│   ├── types.ts                  [203 linii]  — typy: DrawingElement, Point, ViewportTransform etc.
│   ├── rendering.ts              [784 linii]  — funkcja drawElement() na canvas
│   ├── viewport.ts               [282 linii]  — pan/zoom/momentum logika viewportu
│   ├── utils.ts                  [78 linii]   — drobne helpery
│   ├── Grid.tsx                  [228 linii]  — rysowanie siatki
│   ├── OnlineUsers.tsx           [247 linii]  — lista online userów (Supabase Presence)
│   ├── RemoteCursors.tsx         [206 linii]  — kursory innych userów (Supabase Presence)
│   └── useMultiTouchGestures.tsx [218 linii]  — pinch-to-zoom, touch pan
├── toolbar/
│   ├── Toolbar.tsx               [183 linii]  — router narzędzi, eksportuje typ Tool i ShapeType
│   ├── ToolbarUI.tsx             [1016 linii] — UI toolbara (przyciski, panele boczne)
│   ├── SelectTool.tsx            [2247 linii] ← DRUGI POTWÓR (selekcja, resize, drag, grupowanie)
│   ├── PenTool.tsx               [349 linii]  — rysowanie odręczne
│   ├── ShapeTool.tsx             [352 linii]  — kształty (rect, circle, line, triangle...)
│   ├── TextTool.tsx              [481 linii]  — tekst edytowalny
│   ├── FunctionTool.tsx          [732 linii]  — wykresy funkcji matematycznych
│   ├── ImageTool.tsx             [298 linii]  — wstawianie obrazów
│   ├── EraserTool.tsx            [423 linii]  — gumka
│   ├── MarkdownNoteTool.tsx      [352 linii]  — notatki markdown
│   ├── TableTool.tsx             [357 linii]  — tabele
│   ├── CalculatorTool.tsx        [539 linii]  — kalkulator
│   ├── MathChatbot.tsx           [739 linii]  — chatbot matematyczny (AI)
│   ├── ArrowTool.tsx             [331 linii]  — strzałki
│   ├── PanTool.tsx               [169 linii]  — narzędzie przesuwania
│   ├── PDFTool.tsx               [169 linii]  — PDF viewer
│   ├── ZoomControls.tsx          [81 linii]   — przyciski zoom
│   ├── ActivityHistory.tsx       [493 linii]  — historia aktywności
│   ├── TextMiniToolbar.tsx       [169 linii]  — mini toolbar dla tekstu
│   └── SelectionPropertiesPanel.tsx [430 linii] — panel właściwości zaznaczenia
├── smartsearch/
│   ├── index.ts                  [13 linii]   — re-eksport
│   ├── SmartSearchBar.tsx        [774 linii]  — pasek wyszukiwania zasobów edukacyjnych
│   ├── CardViewer.tsx            [443 linii]  — podgląd kart
│   └── searchService.ts         [197 linii]  — logika wyszukiwania
└── utils/
    ├── snapUtils.ts              [155 linii]  — linie snapping przy przesuwaniu
    └── types.ts                  [76 linii]   — typy dla utils
```

---

## STRUKTURA DOCELOWA (src/\_new/features/whiteboard/) — ZAKTUALIZOWANA

> Foldery nazwane tak żeby sama nazwa mówiła co tam jest.
> Kolega stworzył szkielet w hooks/ components/ — przenosimy do tej struktury.

```
_new/features/whiteboard/
│
├── 📁 types/                        ← TYLKO typy TypeScript, zero logiki
│   ├── elements.ts                  ← DrawingPath, Shape, TextElement, ImageElement...
│   ├── tools.ts                     ← enum Tool, enum ShapeType
│   └── canvas.ts                    ← ViewportTransform, MomentumState, GuideLine
│
├── 📁 api/                          ← TYLKO komunikacja z backendem/supabase
│   ├── elements-api.ts              ← saveBoardElementsBatch, loadBoardElements, deleteBoardElement
│   └── realtime-api.ts              ← setup Supabase channel (wyciągnięty z BoardRealtimeContext)
│
├── 📁 navigation/                   ← WSZYSTKO co dotyczy poruszania się po tablicy
│   ├── use-viewport.ts              ← stan: { x, y, scale } — pozycja i zoom
│   ├── use-pan.ts                   ← obsługa przesuwania (mysz + touch)
│   ├── use-zoom.ts                  ← obsługa zoom (scroll + pinch + przyciski)
│   ├── use-momentum.ts              ← efekt "rzucania" tablicą po puszczeniu
│   └── use-multitouch.ts            ← gesty telefon/tablet (pinch-to-zoom, 2 palce)
│
├── 📁 elements/                     ← WSZYSTKO co dotyczy elementów NA tablicy
│   ├── use-elements.ts              ← dodaj/usuń/zmień element, główny stan tablicy
│   ├── use-history.ts               ← undo/redo stack (Ctrl+Z, Ctrl+Y)
│   ├── use-clipboard.ts             ← copy/paste/cut (Ctrl+C, Ctrl+V, Ctrl+X)
│   └── rendering/                   ← jak rysować każdy typ elementu na canvas
│       ├── draw-path.ts             ← rysowanie odręczne
│       ├── draw-shape.ts            ← kształty
│       ├── draw-text.ts             ← tekst
│       ├── draw-image.ts            ← obrazy
│       ├── draw-arrow.ts            ← strzałki
│       └── index.ts                 ← główna funkcja drawElement() (z rendering.ts)
│
├── 📁 selection/                    ← WSZYSTKO co dotyczy zaznaczania elementów
│   ├── use-selection.ts             ← kto jest zaznaczony, multi-select
│   ├── use-drag.ts                  ← przesuwanie zaznaczonych elementów
│   ├── use-resize.ts                ← zmiana rozmiaru (uchwyty)
│   ├── use-grouping.ts              ← grupowanie/rozgrupowanie
│   ├── context-menu/                ← PRAWY KLIK na elemencie (jak w Miro/Word)
│   │   ├── context-menu.tsx         ← komponent menu
│   │   ├── use-context-menu.ts      ← logika: gdzie pokazać, co pokazać
│   │   └── menu-items.ts            ← definicje opcji: przesuń na wierzch, pod spód, duplikuj, usuń...
│   └── properties-panel/            ← panel boczny właściwości zaznaczonego elementu
│       ├── properties-panel.tsx     ← główny komponent panelu
│       ├── color-picker.tsx         ← wybór koloru (reużywalny)
│       └── stroke-picker.tsx        ← grubość linii, styl
│
├── 📁 toolbar/                      ← PASEK NARZĘDZI (wybór narzędzia aktywnego)
│   ├── toolbar.tsx                  ← główny pasek z przyciskami
│   ├── tool-button.tsx              ← pojedynczy przycisk (reużywalny)
│   └── tools/                       ← każde narzędzie w osobnym pliku
│       ├── pen-tool.tsx
│       ├── shape-tool.tsx
│       ├── text-tool.tsx
│       ├── arrow-tool.tsx
│       ├── eraser-tool.tsx
│       ├── pan-tool.tsx
│       ├── select-tool.tsx          ← tylko UI, logika w selection/
│       ├── image-tool.tsx
│       ├── markdown-note-tool.tsx
│       ├── table-tool.tsx
│       └── function-tool.tsx
│
├── 📁 canvas/                       ← GŁÓWNY KOMPONENT + co widać na tablicy
│   ├── whiteboard-canvas.tsx        ← ~300 linii, tylko render + spinanie hooków
│   ├── grid.tsx                     ← siatka w tle
│   ├── coordinate-system.tsx        ← osie X i Y (włącz/wyłącz jedną flagą)
│   ├── snap-guides.tsx              ← linie pomocnicze przy przeciąganiu
│   └── remote-cursors.tsx           ← kursory innych użytkowników
│
├── 📁 realtime/                     ← SYNCHRONIZACJA między użytkownikami
│   ├── use-realtime.ts              ← broadcast zmian, receive zmian
│   └── use-presence.ts             ← kto jest online, kursory, typing
│
└── 📁 panels/                       ← IZOLOWANE FUNKCJE (można wyłączyć bez skutków)
    ├── voice-chat/                  ← WebRTC audio
    │   ├── voice-chat.tsx
    │   ├── voice-chat-settings.tsx
    │   └── use-voice-chat.ts
    ├── calculator/
    │   └── calculator.tsx
    ├── math-chatbot/
    │   └── math-chatbot.tsx
    ├── activity-history/
    │   └── activity-history.tsx
    ├── pdf-viewer/
    │   └── pdf-viewer.tsx
    └── smart-search/
        ├── smart-search-bar.tsx
        ├── card-viewer.tsx
        └── search-service.ts
```

---

## KLUCZOWE ZALEŻNOŚCI DO ZROZUMIENIA

### Supabase Realtime (najtrudniejsza część)

- `BoardRealtimeContext` (src/app/context/) — trzyma channel Supabase, presence, broadcast
- `WhiteboardCanvas.tsx` używa `useBoardRealtime()` hook z tego kontekstu
- `OnlineUsers.tsx` i `RemoteCursors.tsx` też używają `useBoardRealtime()`
- Plan: logika realtime w `use-realtime.ts`, komponenty w osobnych plikach

### Przepływ danych

```
page.tsx
  └── BoardRealtimeProvider (kontekst)
        └── WhiteboardCanvas (4173 linii) ← TU DZIEJE SIĘ WSZYSTKO
              ├── Toolbar (narzędzia)
              ├── SelectTool (selekcja)
              ├── OnlineUsers
              ├── RemoteCursors
              ├── SmartSearchBar
              └── ActivityHistory
```

### Co WhiteboardCanvas.tsx ROBI sam (do wyciągnięcia do hooków):

1. **Stan elementów** — elements[], historia undo/redo
2. **Viewport** — pan, zoom, momentum (pinch)
3. **Realtime** — broadcast, receive, merge remotely
4. **Renderowanie** — requestAnimationFrame loop
5. **Event handling** — MouseDown/Up/Move/Wheel, Touch, Keyboard
6. **Selection** — hit testing, drag, resize (delegowane do SelectTool)
7. **Ładowanie/zapis** — loadBoardElements, saveBoardElementsBatch

---

## PLAN ETAPÓW (od najbezpieczniejszego)

### ETAP 1 — Typy (ZEROWE RYZYKO)

> Nie zmienia żadnej logiki, tylko przenosi typy.

- [ ] `types/elements.ts` ← z `whiteboard/types.ts`
- [ ] `types/tools.ts` ← z `toolbar/Toolbar.tsx` (enum Tool, ShapeType)
- [ ] `types/canvas.ts` ← ViewportTransform, MomentumState
- [ ] `types/viewport.ts` ← typy viewport
- Stare pliki exportują z nowych (re-export) → zero breaking changes

### ETAP 2 — Utils/helpers (MINIMALNE RYZYKO)

> Czyste funkcje, łatwe do testowania, zero side effects.

- [ ] `utils/geometry.ts` ← funkcje geometryczne rozsiane po rendering.ts, utils.ts
- [ ] `utils/snap-utils.ts` ← z `utils/snapUtils.ts`
- [ ] `utils/canvas-helper.ts` ← `rendering.ts` + `Grid.tsx` (tylko funkcje, nie komponenty)
- [ ] `utils/export.ts` ← logika eksportu z BoardHeader/ToolbarUI

### ETAP 3 — API layer (NISKIE RYZYKO)

> Przeniesienie wywołań API do jednego miejsca.

- [ ] `api/elements-api.ts` ← saveBoardElementsBatch, loadBoardElements, deleteBoardElement (z boards_api)
- [ ] `api/realtime-api.ts` ← setup Supabase channel (z BoardRealtimeContext)

### ETAP 4 — Hooki (ŚREDNIE RYZYKO)

> Tu dzieje się porządkowanie logiki WhiteboardCanvas.

- [ ] `hooks/use-history.ts` ← undo/redo stack
- [ ] `hooks/use-clipboard.ts` ← copy/paste
- [ ] `hooks/use-viewport.ts` ← pan/zoom/momentum (z viewport.ts + hooks z WhiteboardCanvas)
- [ ] `hooks/use-selection.ts` ← logika zaznaczania z SelectTool.tsx
- [ ] `hooks/use-realtime.ts` ← Supabase presence + broadcast
- [ ] `hooks/use-canvas.ts` ← główny orchestrator (łączy pozostałe hooki)

### ETAP 5 — Komponenty (NAJWIĘKSZA ZMIANA)

> Rozbicie WhiteboardCanvas na małe komponenty.

- [ ] `components/canvas/whiteboard-canvas.tsx` ← NOWY, ~300 linii, używa hooków z etapu 4
- [ ] `components/canvas/grid.tsx` ← Grid.tsx (bez logiki, tylko render)
- [ ] `components/canvas/snap-guides.tsx` ← render linii snap
- [ ] `components/toolbar/toolbar.tsx` ← refactor Toolbar.tsx
- [ ] `components/toolbar/tool-button.tsx` ← reużywalny przycisk
- [ ] `components/toolbar/properties-panel.tsx` ← SelectionPropertiesPanel
- [ ] `components/panels/*` ← Calculator, Chat, PDF, ActivityHistory

### ETAP 6 — Integracja (FINALNE SPINANIE)

- [ ] Nowy `page.tsx` używa nowych komponentów z `_new/features/whiteboard/`
- [ ] Stary folder `tablica/` działa nadal (przez re-export) do momentu pełnego przejścia
- [ ] Po weryfikacji - usunięcie starych plików

---

## ZASADY REFAKTORYZACJI

1. **Nigdy nie edytuj i nie przenoś w tym samym kroku** — najpierw stwórz nowy plik, potem zmień importy
2. **Re-export ze starych plików** — po przeniesieniu stary plik robi `export * from '_new/...'` → zero breaking changes
3. **Jeden hook = jedna odpowiedzialność** — use-viewport TYLKO viewport, use-selection TYLKO selekcja
4. **Supabase tylko w use-realtime.ts** — żaden inny plik nie importuje supabase bezpośrednio
5. **Typy w types/** — żadnych inline interface w komponentach (poza lokalnymi props)

---

## STATUS

| Etap          | Status  | Notatki                                                                          |
| ------------- | ------- | -------------------------------------------------------------------------------- |
| 1. Typy       | ✅ DONE | elements.ts / tools.ts / canvas.ts / index.ts — stare pliki są re-exporterami    |
| 2. Utils      | ✅ DONE | viewport-math.ts / math-eval.ts / snap-utils.ts — stare pliki są re-exporterami  |
| 3. API layer  | ✅ DONE | elements-api.ts / realtime-api.ts (BoardEvent type + createBoardChannel factory) |
| 4. Hooki      | ✅ DONE | use-history / use-viewport / use-elements (nowy) / use-clipboard / use-selection / use-realtime |
| 5. Komponenty | ⬜ TODO |                                                                                  |
| 6. Integracja | ⬜ TODO |                                                                                  |

---

## NOTATKI ROBOCZE

- `WhiteboardCanvas.tsx` używa `useBoardRealtime()` z `BoardRealtimeContext` — ten kontekst ZOSTAJE jako provider, ale logika channel'a przenosi się do `use-realtime.ts`
- `SelectTool.tsx` (2247 linii) będzie wyciągany do `use-selection.ts` + `hooks/use-drag.ts` (opcjonalnie)
- `_new/features/whiteboard/*` — pliki ISTNIEJĄ ale są PUSTE — kolega zaplanował strukturę, wypełniamy
- `_new/shared/` — już ma `button.tsx`, `input.tsx`, `confirmation-modal.tsx` — używamy je!
