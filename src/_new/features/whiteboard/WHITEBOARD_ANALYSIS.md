# WHITEBOARD — PEŁNA ANALIZA ARCHITEKTURY I BUGÓW

> Plik roboczy do naprawy bugów. Aktualizuj przy każdej zmianie.

---

## 1. ARCHITEKTURA OGÓLNA

```
whiteboard-canvas.tsx   ← GŁÓWNY ORKIESTRATOR (1742 linii)
│
├── HOOKI
│   ├── use-viewport.ts       — stan kamery (x, y, scale) + momentum + follow mode
│   ├── use-elements.ts       — stan elementów, ładowanie z DB, debounced save
│   ├── use-selection.ts      — zaznaczone ID, tryb edycji tekstu/markdown
│   ├── use-history.ts        — stack undo/redo
│   ├── use-clipboard.ts      — kopiowanie/wklejanie elementów
│   └── use-realtime.ts       — WebSocket (Supabase realtime)
│
├── NAWIGACJA
│   └── navigation/viewport-math.ts  — czyste funkcje:
│         • transformPoint(worldPoint → screenPoint)
│         • inverseTransformPoint(screenPoint → worldPoint)
│         • panViewportWithMouse, panViewportWithWheel
│         • zoomViewport, constrainViewport
│         • updateMomentum, isElementInViewport
│
├── RENDEROWANIE
│   └── elements/rendering.ts — drawPath, drawShape, drawText, drawFunction,
│                               drawImage, drawElement (deleguje)
│
├── API
│   └── api/elements-api.ts  — wrapper na boards_api/api.ts
│
└── NARZĘDZIA (każde = absolutny overlay HTML + opcjonalny SVG preview)
    ├── select-tool.tsx     ← 2249 linii! bounding box, drag, resize, rotate
    ├── pen-tool.tsx        — rysowanie ścieżek
    ├── shape-tool.tsx      — kształty geometryczne
    ├── text-tool.tsx       — edytowalny tekst
    ├── pan-tool.tsx        — przesuwanie tablicy
    ├── eraser-tool.tsx     — gumka
    ├── function-tool.tsx   — wykresy funkcji
    ├── image-tool.tsx      — wstawianie obrazów
    ├── markdown-note-tool.tsx — notatki Markdown
    ├── table-tool.tsx      — tabele
    └── arrow-tool.tsx      — strzałki
```

---

## 2. UKŁAD WSPÓŁRZĘDNYCH

### World coordinates (układ tablicy)

- Nieskończona przestrzeń 2D
- Jednostka: 1 = 100px na ekranie przy scale=1
- Oś X rośnie w prawo, Y w dół
- Centrum viewportu = `(viewport.x, viewport.y)` w world coords

### Screen coordinates (pikselowe, względem canvas container!)

- (0, 0) = **lewy górny róg kontenera canvas** (NIE okna przeglądarki!)
- (canvasWidth/2, canvasHeight/2) = środek ekranu

### WZORY TRANSFORMACJI (viewport-math.ts)

```
// World → Screen
screenX = (worldX - viewport.x) * (viewport.scale * 100) + canvasWidth/2
screenY = (worldY - viewport.y) * (viewport.scale * 100) + canvasHeight/2

// Screen → World  (inverseTransformPoint)
worldX = (screenX - canvasWidth/2) / (viewport.scale * 100) + viewport.x
worldY = (screenY - canvasHeight/2) / (viewport.scale * 100) + viewport.y
```

### KLUCZOWE: `screenX` i `screenY` są WZGLĘDEM KONTENERA, nie okna!

- `e.clientX` = BEZWZGLĘDNA pozycja X w oknie (od lewej krawędzi okna)
- Kontener canvas może być przesunięty (toolbar = ~50px z lewej, header = ~60px z góry)
- **DLATEGO zawsze trzeba:** `screenX = e.clientX - containerRect.left`

---

## 3. DEBOUNCE 80ms NA VIEWPORT

Jeden z kluczowych mechanizmów do zrozumienia:

```typescript
// whiteboard-canvas.tsx — obsługa wheel/pan
// 1. viewportRef.current = newViewport  ← NATYCHMIAST (canvas RAF to czyta)
// 2. requestAnimationFrame(redrawCanvas) ← canvas prysowywany natychmiast
// 3. setViewport(newViewport) z debounce 80ms ← React state aktualizowany PO 80ms

wheelSetViewportTimerRef = setTimeout(() => {
  vp.setViewport(vp.viewportRef.current);
}, 80);
```

Co to oznacza:

- Canvas (WebGL/2D) jest zawsze aktualny — czyta z `viewportRef`
- Komponenty React (ZoomControls, Toolbar, SelectTool, panels) dostają viewport ze SPÓŹNIENIEM 80ms
- Po tym czasie: `useEffect(() => { przywróć HTML overlaje }, [vp.viewport])` uruchamia się

---

## 4. ZIDENTYFIKOWANE BUGI

---

### BUG #1 — GŁÓWNY: PRZESUNIĘCIE WSPÓŁRZĘDNYCH (offset)

**Objawy:**

- Narysowane elementy pojawiają się przesunięte od miejsca kliknięcia
- Zaznaczenie (bounding box) jest przesunięte względem elementu
- Problem dotyczy WSZYSTKICH narzędzi rysujących i SelectTool
- Przesunięcie jest stałe (nie zależy od zoom) i równa się offsetowi kontenera

**Diagnoza:**

Wszystkie narzędzia używają `e.clientX, e.clientY` BEZ odejmowania pozycji kontenera:

```typescript
// ❌ BŁĄD w pen-tool.tsx (handlePointerDown, handlePointerMove):
const screenPoint = { x: e.clientX, y: e.clientY };
const worldPoint = inverseTransformPoint(screenPoint, getViewport(), canvasWidth, canvasHeight);

// ❌ BŁĄD w select-tool.tsx (handlePointerDown, handleDoubleClick):
const screenPoint = { x: e.clientX, y: e.clientY };
const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

// ❌ BŁĄD w select-tool.tsx — global window listener (handleGlobalPointerMove):
const screenPoint = { x: e.clientX, y: e.clientY };
const worldPoint = inverseTransformPoint(
  screenPoint,
  viewportRef.current,
  canvasWidth,
  canvasHeight
);

// ❌ BŁĄD w select-tool.tsx — handlePointerMove (selection box):
const worldStart = inverseTransformPoint(selectionStart, viewport, canvasWidth, canvasHeight);
const worldEnd = inverseTransformPoint(currentEnd, viewport, canvasWidth, canvasHeight);
// gdzie selectionStart i currentEnd też są { x: e.clientX, y: e.clientY }
```

Ale w `whiteboard-canvas.tsx` kursor broadcast jest POPRAWNY:

```typescript
// ✅ POPRAWNIE w whiteboard-canvas.tsx:
const rect = container.getBoundingClientRect();
const worldPos = inverseTransformPoint(
  { x: e.clientX - rect.left, y: e.clientY - rect.top },
  vp.viewportRef.current,
  rect.width,
  rect.height
);
```

**Obliczenie błędu:**

```
Offset kontenera: containerLeft ≈ 50px (toolbar), containerTop ≈ 60px (header)
Błąd w world coords przy scale=1: 50px / (1 * 100) = 0.5 world units (X axis)

Na ekranie: 0.5 * 100px = 50px przesunięcia przy zoom 100%
Przy zoom 50% (scale=0.5): 50 / (0.5 * 100) = 1.0 world units → 50px na ekranie (ten sam!)
→ Przesunięcie na ekranie jest zawsze równe offsetowi kontenera, niezależnie od zoom
```

**Gdzie to naprawić:**

Każde narzędzie potrzebuje dostępu do `containerRef` z `whiteboard-canvas.tsx` LUB własnego `overlayRef`.

Plan naprawy — 2 opcje:

**Opcja A (prosta):** Przekazać `containerRef` do każdego narzędzia jako `containerRef?: React.RefObject<HTMLDivElement>` i odejmować rect w każdym.

**Opcja B (czysta):** Skoro każde narzędzie renderuje overlay `absolute inset-0` WEWNĄTRZ kontenera, można użyć własnego `overlayRef` każdego narzędzia do `getBoundingClientRect()`. Overlay `absolute inset-0` ma ten sam rect co kontener.

**Opcja B jest lepsza** — nie zmienia interfejsów, każde narzędzie już ma `overlayRef`.

Przykład dla PenTool:

```typescript
// pen-tool.tsx — handlePointerDown
const overlayRect = overlayRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
const screenPoint = {
  x: e.clientX - overlayRect.left,
  y: e.clientY - overlayRect.top,
};
```

Dla SelectTool — dodatkowy problem: `global window.addEventListener` nie ma dostępu do overlay rect z closure. Rozwiązanie: trzymać rect w `ref`:

```typescript
const overlayRectRef = useRef<DOMRect | null>(null);
useEffect(() => {
  overlayRectRef.current = overlayRef.current?.getBoundingClientRect() ?? null;
}, []);
// I aktualizować przy resize
```

Albo prościej: w global pointermove liczyć rect na bieżąco:

```typescript
const overlayRect = overlayRef.current?.getBoundingClientRect();
const screenPoint = {
  x: e.clientX - (overlayRect?.left ?? 0),
  y: e.clientY - (overlayRect?.top ?? 0),
};
```

**Które narzędzia wymagają poprawki:**

- [x] `pen-tool.tsx`: handlePointerDown, handlePointerMove (linia ~175, ~215)
- [x] `select-tool.tsx`: handlePointerDown (~1270), handleDoubleClick (~1230), handlePointerMove selection box (~1310-1320), global handleGlobalPointerMove (~190), rotation handle onMouseDown (~2020)
- [ ] `shape-tool.tsx` — prawdopodobnie ten sam bug (sprawdzić)
- [ ] `text-tool.tsx` — prawdopodobnie ten sam bug
- [ ] `arrow-tool.tsx` — prawdopodobnie ten sam bug
- [ ] `eraser-tool.tsx` — prawdopodobnie ten sam bug
- [ ] `markdown-note-tool.tsx` — prawdopodobnie ten sam bug
- [ ] `table-tool.tsx` — prawdopodobnie ten sam bug
- [ ] `image-tool.tsx` — prawdopodobnie ten sam bug
- [ ] `function-tool.tsx` — prawdopodobnie ten sam bug

**Uwaga na `getResizeHandleAt` w SelectTool:**

```typescript
const getResizeHandleAt = (screenPoint: Point, boundingBox: BoundingBox): ResizeHandle => {
  const topLeft = transformPoint({ x: box.x, y: box.y }, viewport, canvasWidth, canvasHeight);
  // ...
  const isNear = (p1: Point, p2: Point) => Math.sqrt(...) < handleSize;
  if (isNear(screenPoint, topLeft)) return 'nw';
};
```

`transformPoint` zwraca coords WZGLĘDEM kontenera (0...canvasWidth).
`screenPoint` = `e.clientX, e.clientY` = BEZWZGLĘDNE.
→ Ten sam bug — `screenPoint` musi być canvas-relative.

---

### BUG #2 — TIMEOUT NA PIERWSZE ŁADOWANIE TABLICY

**Objawy (z konsoli):**

```
❌ Error fetching board: signal timed out
⚠️ fetchBoardById zwróciło null - spróbuj pobrać workspace_id z joinBoardWorkspace
Błąd ładowania elementów: TimeoutError: signal timed out
```

Po odświeżeniu działa normalnie.

**Diagnoza:**

- Przy pierwszym wejściu: `fetchBoardById` jest wywoływane z AbortSignal który wygasa
- Prawdopodobnie: timeout jest zbyt krótki, albo wywołanie `fetchBoardById` a `joinBoardWorkspace` są wykonywane równolegle i jedno blokuje drugie
- `joinBoardWorkspace` działa poprawnie (WS join) ale `fetchBoardById` (HTTP REST) timeoutuje
- Możliwe race condition: strona ładuje się, WebSocket się łączy (szybko), ale HTTP request do backendu się spóźnia

**Gdzie szukać:**

- `src/app/tablica/[boardId]/page.tsx` lub odpowiednik w `_new/` — wywołanie `fetchBoardById`
- `boards_api/api.ts` — definicja `fetchBoardById` z AbortSignal/timeout

**Możliwe naprawy:**

1. Zwiększyć timeout dla `fetchBoardById`
2. Retry logic — przy timeout spróbuj ponownie automatycznie
3. Jeśli `fetchBoardById` zawiedzie, użyj danych z `joinBoardWorkspace` (fallback już istnieje, ale `loadBoardElements` też failuje)

**Powiązany problem:** `loadBoardElements` też failuje timeoutem — bo jest wywoływane w `use-elements.ts` `useEffect` który nie ma retry.

---

### BUG #3 — PANEL WŁAŚCIWOŚCI "PODĄŻA" ZA KURSOREM PRZEZ CHWILĘ

**Objawy (ze zdjęć):**

- Przy scrollowaniu/panningu, `SelectionPropertiesPanel` (panel z kolorkiem, delete itp.) przez chwilę podąża za kursorem zamiast zostać przy elemencie
- Po ~80ms teleportuje na właściwą pozycję

**Diagnoza:**

Panel pozycjonowany jest na podstawie `vp.viewport` (React state):

```typescript
// select-tool.tsx — renderPropertiesPanel()
const topCenter = transformPoint(
  { x: bbox.x + bbox.width / 2, y: bbox.y },
  viewport, // ← to jest PROPS viewport z React state
  canvasWidth,
  canvasHeight
);
```

Podczas pan/wheel:

1. `viewportRef.current` = nowy viewport ← NATYCHMIAST
2. Canvas narysowany z nowym viewport ← NATYCHMIAST (RAF)
3. `setViewport(newViewport)` ← po 80ms debounce
4. React re-render → SelectTool dostaje nowy `viewport` prop → panel renderuje się w dobrej pozycji

W czasie tych 80ms:

- Canvas pokazuje elementy w NOWYCH pozycjach (z nowym viewport)
- SelectionPropertiesPanel używa STAREGO viewport → jest w złej pozycji

**Naprawy:**

- Opcja A: Podczas pana ukryć panel (tak jak ukrywane są HTML overlaje: `htmlOverlaysRef visibility: hidden`)
- Opcja B: Użyć `viewportRef` zamiast `viewport` w `renderPropertiesPanel` — ale to wymaga refaktoryzacji SelectTool (currently tylko `viewport` props)
- Opcja C: Przekazać `viewportRef` do SelectTool i użyć go dla pozycjonowania react overlay

**Plan naprawy (Opcja A):**

W `whiteboard-canvas.tsx`, `htmlOverlaysRef` wrappuje `<SelectTool>`. Gdy pan zaczyna, `htmlOverlaysRef.current.style.visibility = 'hidden'`. Panel jest wewnątrz SelectTool, ale SelectTool jest poza `htmlOverlaysRef` wrappe — sprawdzić strukturę JSX.

Sprawdzić aktualną strukturę JSX w canvas (linie ~1400-1742) — jak obiekty są zagnieżdżone.

---

### BUG #4 — `selectionStart` UŻYWA `e.clientX` (ABSOLUTE)

**Powiązany z BUG #1**, ale osobny aspekt:

```typescript
// select-tool.tsx — handlePointerDown:
setSelectionStart(screenPoint);  // { x: e.clientX, y: e.clientY }
setSelectionEnd(screenPoint);

// Potem podczas renderowania selection box:
<div style={{
  left: Math.min(selectionStart.x, selectionEnd.x),  // ← BŁĄD: absolute coords jako CSS pixels
  top: Math.min(selectionStart.y, selectionEnd.y),
}} />
```

`selectionStart.x = e.clientX ≈ 50 + canvasX` → `left: 50 + canvasX` → selection box jest przesunięta!

**Naprawa:** `setSelectionStart({ x: e.clientX - rect.left, y: e.clientY - rect.top })`

---

## 5. PLAN NAPRAWY — KOLEJNOŚĆ

### Priorytet 1: BUG #1 + #4 (koordynaty — core problem)

1. Dodać `overlayRef` do każdego narzędzia (większość już ma)
2. W każdym `handlePointerDown` i `handlePointerMove`:
   ```typescript
   const rect = overlayRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
   const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
   ```
3. Dla `global window.addEventListener` w SelectTool — trzymać `overlayRectRef` i odejmować:
   ```typescript
   const overlayRectRef = useRef({ left: 0, top: 0 });
   // Aktualizuj przy resize (lub po prostu czytaj getBoundingClientRect() na każdym eventcie)
   ```

### Priorytet 2: BUG #2 (timeout ładowania)

1. Zlokalizować `fetchBoardById` i `loadBoardElements`
2. Zwiększyć timeout lub dodać retry
3. Sprawdzić czy `loadBoardElements` zależy od `fetchBoardById` (jeśli tak — poprawka jednego może wystarczyć)

### Priorytet 3: BUG #3 (panel podąza podczas pan)

1. Sprawdzić czy SelectTool jest wewnątrz `htmlOverlaysRef`
2. Jeśli tak — już jest ukrywany podczas pan (sprawdzić czy jest bug w implementacji)
3. Jeśli nie — dodać ukrywanie panelu podczas pan

---

## 6. PLIKI DO EDYCJI

| Plik                                           | Bug        | Linie (przybliżone)                   |
| ---------------------------------------------- | ---------- | ------------------------------------- |
| `components/toolbar/pen-tool.tsx`              | #1         | ~175, ~215 (handlePointerDown, Move)  |
| `components/toolbar/select-tool.tsx`           | #1, #3, #4 | ~190, ~1230, ~1270, ~1310-1320, ~2020 |
| `components/toolbar/shape-tool.tsx`            | #1         | do zbadania                           |
| `components/toolbar/text-tool.tsx`             | #1         | do zbadania                           |
| `components/toolbar/arrow-tool.tsx`            | #1         | do zbadania                           |
| `components/toolbar/eraser-tool.tsx`           | #1         | do zbadania                           |
| `components/toolbar/markdown-note-tool.tsx`    | #1         | do zbadania                           |
| `components/toolbar/table-tool.tsx`            | #1         | do zbadania                           |
| `components/toolbar/image-tool.tsx`            | #1         | do zbadania                           |
| `components/toolbar/function-tool.tsx`         | #1         | do zbadania                           |
| `components/canvas/whiteboard-canvas.tsx`      | #3         | layout JSX                            |
| `boards_api/api.ts` lub `app/tablica/page.tsx` | #2         | fetchBoardById timeout                |
| `hooks/use-elements.ts`                        | #2         | loadBoardElements bez retry           |

---

## 7. RZECZY KTÓRE DZIAŁAJĄ POPRAWNIE

- `transformPoint` / `inverseTransformPoint` — matematyka jest poprawna
- Debounce 80ms na viewport — właściwe rozwiązanie dla wydajności
- `viewportRef.current` w canvas RAF — prawidłowe
- Cursor broadcast (widnboard-canvas.tsx) — już poprawnie odejmuje rect
- Renderowanie HTML overlayów (markdown, table) — `left: topLeft.x` z `transformPoint` jest poprawne
- Bounding box selection box rendering (`left: topLeft.x`) — poprawne (canvas-relative)
- Undo/redo historia
- Realtime WebSocket
- Auto-save debounced

---

## 8. NOTATKI PODCZAS NAPRAWY

<!-- Tutaj zapisuj postęp i odkrycia podczas naprawiania -->

### Sesja naprawcza 1:

- [ ] BUG #1: PenTool — dodać rect subtraction
- [ ] BUG #1: SelectTool — handlePointerDown
- [ ] BUG #1: SelectTool — global listener
- [ ] BUG #1: SelectTool — selectionStart/End (BUG #4)
- [ ] BUG #1: Zbadać inne narzędzia (shape, text, arrow, eraser, markdown, table, image, function)
- [ ] BUG #2: Zlokalizować i naprawić timeout
- [ ] BUG #3: Sprawdzić ukrywanie panelu podczas pan

---

## 9. KOMENTARZE DO KODU WARTYCH UWAGI

### Dobre wzorce już w kodzie:

```typescript
// ✅ canvas cursor broadcast — POPRAWNE
const rect = container.getBoundingClientRect();
const worldPos = inverseTransformPoint(
  { x: e.clientX - rect.left, y: e.clientY - rect.top },
  vp.viewportRef.current,
  rect.width,
  rect.height
);

// ✅ wheel handler — POPRAWNE
const rect = container.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;
const next = zoomViewport(current, e.deltaY, mouseX, mouseY, rect.width, rect.height);
```

### Zle wzorce do naprawienia:

```typescript
// ❌ pen-tool handlePointerDown — BŁĘDNE
const screenPoint = { x: e.clientX, y: e.clientY }; // brak - rect.left/top
const worldPoint = inverseTransformPoint(screenPoint, getViewport(), canvasWidth, canvasHeight);

// ❌ select-tool handlePointerDown — BŁĘDNE
const screenPoint = { x: e.clientX, y: e.clientY }; // brak - rect.left/top
const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);
```
