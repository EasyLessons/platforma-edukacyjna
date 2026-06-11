# Canvas Architecture — Invariants (po Fazach 0–3 + poprawkach narzędzi)

> Jedyne źródło prawdy o zasadach tworzenia i modyfikowania kodu tablicy.
> Każdy PR dotykający `src/_new/features/whiteboard/` musi zachowywać poniższe
> niezmienniki. Naruszenie któregokolwiek z nich jest błędem architektonicznym.

---

## 1. Canvas jest czystym konsumentem stanu

**Zasada:** Metody `render()` w handlerach (`handlers/*.ts`) są funkcjami czystymi —
czytają element i rysują na kontekście. Nigdy nie wywołują callbacków mutujących
Zustand, React state ani żadnych efektów ubocznych.

**Dlaczego:** Pętla renderowania (`requestAnimationFrame`) wywołuje `render()` dla
każdego widocznego elementu 60×/s. Wywołanie mutacji wewnątrz tej pętli powoduje
kaskadę: `render()` → `setState` → re-render → `render()` → …

**Przykład naruszenia (usunięty):**
```ts
// ❌ handlers/text-handler.ts — BYŁO (usunięte)
extras?.onAutoExpand(id, height); // mutacja Zustanda w środku render()
```

**Kontrakt po refaktorze:**
```ts
// ✅ TextHandler.render() — po refaktorze
// Brak parametru extras.onAutoExpand. Metoda jest (ctx, el, viewport) → void.
```

---

## 2. Izolacja stanu edytorów — Commit O(1)

**Zasada:** Podczas aktywnej edycji (tekst, notatka markdown, komórka tabeli)
komponent utrzymuje stan lokalnie przez `useState`. Synchronizacja z globalnym
Zustandem / `WhiteboardEngine` następuje **dokładnie raz** — przy zdarzeniu
kończącym edycję.

**Zdarzenia kończące edycję:**

| Zdarzenie | Akcja |
|-----------|-------|
| Blur textarea / Click outside | `handleSave()` → `engine.updateElements()` |
| Escape | `handleCancel()` — brak zapisu |
| Unmount (zmiana narzędzia) | `handleSave()` via `useEffect` cleanup |

**Złożoność:** O(1) commitów do Zustanda niezależnie od długości tekstu.

**Przykład naruszenia (usunięty):**
```ts
// ❌ text-tool.tsx — BYŁO (usunięte)
useEffect(() => {
  onTextUpdate(draft.id, { text: editText, ... }); // O(N) przy N znakach
}, [editText, draft?.worldX, ...]);
```

**Kontrakt:**
```ts
// ✅ text-tool.tsx — po refaktorze
const [editText, setEditText]       = useState('');
const [localHeight, setLocalHeight] = useState(0);
// commit wyłącznie w handleSave() — jeden raz
const handleSave = useCallback(() => {
  engine.updateElements([{ id: draft.id, text: editText, height: localHeight, ... }]);
}, [draft, editText, localHeight, ...]);
```

---

## 3. Cache linii tekstu — per `el.id`, klucz 6-polowy

**Zasada:** `textWrapCache` w `TextHandler` jest `Map<string, CacheEntry>` gdzie
kluczem jest `el.id`. Każdy element ma co najwyżej jeden wpis. Cache jest
inwalidowany natychmiast przy usunięciu elementu.

**Klucz wpisu** (konkatenacja 6 pól):
```
key = `${text}|${width.toFixed(1)}|${fontSize}|${fontFamily}|${fontWeight}|${fontStyle}`
```

Pola **nie** uczestniczące w kluczu (nie wpływają na łamanie wierszy):
`color`, `x`, `y`, `height`, `rotation`, `textAlign`.

**Złożoność:**

| Operacja | Stary cache | Nowy cache |
|----------|-------------|------------|
| HIT | O(1) | O(1) |
| Purge | O(cache.size) przy >1000 wpisów | O(1) per usunięty element |
| Rozmiar | Rósł do 1000 bez strategii | Bounded = #elementów tekstowych |

---

## 4. Zabezpieczenie przed gestami dotykowymi (`isGestureActive`)

**Zasada:** Każde narzędzie tworzące elementy musi sprawdzać flagę `isGestureActive`
na początku każdego handlera inicjującego interakcję.

**Wzorzec guard clause:**
```ts
const handlePointerDown = (e: React.PointerEvent) => {
  if (isGestureActive) return; // ← obowiązkowe
  // ...
};
```

**Status implementacji (wszystkie narzędzia):**

| Narzędzie | Guard w handlerze | Reset przy gescie |
|-----------|-------------------|-------------------|
| `pen-tool` | ✅ `handlePointerDown` | ✅ `useEffect([isGestureActive])` |
| `shape-tool` | ✅ `handlePointerDown` | ✅ `useEffect([isGestureActive])` |
| `eraser-tool` | ✅ `handlePointerDown` | ✅ `useEffect([isGestureActive])` |
| `arrow-tool` | ✅ `handlePointerDown` | ✅ `useEffect([isGestureActive])` |
| `text-tool` | ✅ `handleOverlayDown` | ✅ `useEffect([isGestureActive])` |
| `select-tool` | ✅ | ✅ |
| `markdown-note-tool` | ✅ `handleMouseDown` (Faza 1) | ✅ `useEffect([isGestureActive])` (Faza 1) |
| `table-tool` | ✅ `handleClick` (Faza 1) | — (click-to-open dialog, reset niekonieczny) |
| `pan-tool` | ✅ | ✅ |

---

## 5. Wheel listener przez `useCanvasWheel` — montowany raz, deps `[canvasWidth, canvasHeight]`

**Zasada:** Natywne listenery `wheel` w narzędziach są obsługiwane wyłącznie przez
hook `useCanvasWheel`. Listener nie może mieć `viewport` w tablicy zależności —
`viewport` to nowy obiekt przy każdym pan/zoom → bez hooka listener byłby niszczony
i ponownie rejestrowany 60×/s.

**Wzorzec (obowiązuje w pen, eraser, shape, markdown, table):**
```ts
useCanvasWheel({ overlayRef, canvasWidth, canvasHeight, viewport, onViewportChange });
```

**Opcje hooka:**

| Prop | Kiedy używać |
|------|-------------|
| `viewportRefOverride` | Narzędzia z dostępem do `h.viewportRef` z canvasu (pen, shape) — omija debounce React |
| `disabled` | Narzędzia z modalnym popupem (table z `showConfig`) — zatrzymuje scroll gdy popup otwarty |

**Implementacja hooka:** [hooks/use-canvas-wheel.ts](../../../src/_new/features/whiteboard/hooks/use-canvas-wheel.ts)
— szczegółowa dokumentacja w `use-canvas-wheel-spec.md`.

**Pułapka:** Wewnątrz hooka `useEffect` setup sprawdza **tylko** czy `overlayRef.current` istnieje.
Nie sprawdza `onViewportChange` — callback może być `undefined` w chwili montowania,
ale listener musi być zarejestrowany. Callback jest sprawdzany w handlerze przez `onViewportChangeRef`.

---

## 6. Cleanup timerów przy odmontowaniu

**Zasada:** Każdy `setTimeout` musi mieć przechowywaną referencję (`useRef`) i być
czyszczony w `useEffect` cleanup (unmount).

```ts
// ✅ pen-tool.tsx — wzorzec po Fazie 2
const penTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// w handlePointerUp:
if (penTimeoutRef.current) clearTimeout(penTimeoutRef.current);
penTimeoutRef.current = setTimeout(() => { ...; penTimeoutRef.current = null; }, 1000);

// cleanup na unmount:
useEffect(() => {
  return () => { if (penTimeoutRef.current) clearTimeout(penTimeoutRef.current); };
}, []);
```

---

## 7. Efekty reagujące na `isGestureActive` — tylko `[isGestureActive]` w deps

**Zasada:** Efekt przerywający rysowanie podczas gestu musi mieć w tablicy deps
wyłącznie `[isGestureActive]`. Stan rysowania (`isDrawing`) sprawdzamy przez ref,
nie przez reaktywną zmienną — unikamy podwójnego odpalenia.

```ts
// ✅ shape-tool.tsx — wzorzec po Fazie 3
const isDrawingRef = useRef(false);
useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);

useEffect(() => {
  if (isGestureActive && isDrawingRef.current) {
    setIsDrawing(false);
    setCurrentShape(null);
  }
}, [isGestureActive]); // ← nie [isGestureActive, isDrawing]
```

---

## 8. Znany artefakt ESLint — nie naprawiać

**Lokalizacja:** [whiteboard-canvas.tsx:743](../../../src/_new/features/whiteboard/components/canvas/whiteboard-canvas.tsx#L743)

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Stabilna — wszystkie wartości runtime przez renderStateRef
```

Jest to świadomy komentarz wyłączający regułę dla funkcji `redrawCanvas`. Funkcja
jest celowo stabilna (`deps = []`) bo wszystkie wartości runtime czyta przez
`renderStateRef` zamiast przez closure. Reguła ESLint `react-hooks/exhaustive-deps`
nie rozumie tego wzorca i zgłasza fałszywy alarm.

**Nie usuwaj tego `eslint-disable` ani nie dodawaj brakujących deps** — zepsuje
stabilność `redrawCanvas` i wprowadzi re-mount event handlerów przy każdym renderze.

---

## 9. Znana luka w `eraser-tool` — nieobsługiwane typy elementów

**Lokalizacja:** [eraser-tool.tsx:116](../../../src/_new/features/whiteboard/components/toolbar/eraser-tool.tsx#L116) — funkcja `isPointInElement`

Gumka obsługuje hit-testing tylko dla: `shape`, `text`, `image`, `path`, `function`.

**Nie obsługuje:** `markdown`, `table`, `arrow` — te elementy są **nieusuwalne gumką**.

```ts
// eraser-tool.tsx — isPointInElement
if (element.type === 'shape')    { /* ... */ }
else if (element.type === 'text')   { /* ... */ }
else if (element.type === 'image')  { /* ... */ }
else if (element.type === 'path')   { /* ... */ }
else if (element.type === 'function') { /* ... */ }
// ← brak: markdown, table, arrow
return false; // te typy zawsze zwracają false → gumka ich nie dotyka
```

**To jest znana luka, nie celowe zachowanie.** Przy rozbudowie gumki lub dodawaniu
nowego typu elementu: dodaj odpowiednią gałąź do `isPointInElement` oraz wpis do
`renderHighlight` w tym samym pliku.
