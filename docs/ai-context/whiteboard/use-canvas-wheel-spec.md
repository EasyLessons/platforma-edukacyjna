# Specyfikacja hooka `useCanvasWheel`

> Status: **ZAIMPLEMENTOWANY I WDROŻONY** — hook jest aktywny we wszystkich 5 narzędziach.
> Ten plik służy jako dokumentacja projektu hooka dla przyszłych modyfikacji.

---

## Problem (motywacja — rozwiązany)

Identyczny blok ~20 linii kodu (ręczne `viewportRef + onViewportChangeRef + addEventListener wheel`)
był zduplikowany w 5 narzędziach. Hook eliminuje tę duplikację — przyszłe zmiany
w logice wheel (np. nowe gesty) wymagają edycji jednego pliku.

---

## Sygnatura (finalna)

```ts
interface UseCanvasWheelProps {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  viewport: ViewportTransform;
  onViewportChange: ((vp: ViewportTransform) => void) | undefined;
  viewportRefOverride?: React.RefObject<ViewportTransform>; // omija debounce React
  disabled?: boolean; // blokuje obsługę wheel (np. gdy modal otwarty)
}

export function useCanvasWheel(props: UseCanvasWheelProps): void
```

---

## Pułapka: stabilność `getViewport`

`getViewport` **musi być stabilną funkcją** — inaczej zamknie się w `useEffect`
z deps `[canvasWidth, canvasHeight]` jako stale closure i będzie zwracać viewport
z momentu montowania, a nie aktualny.

**Złe — `getViewport` tworzona co render:**
```ts
// ❌ inline arrow function w ciele komponentu
const getViewport = () => canvasViewportRef?.current ?? localViewportRef.current;
useCanvasWheel(overlayRef, w, h, getViewport, onChange); // ← stale closure!
```

**Dobre — opcja A: handler czyta refs bezpośrednio (bez argumentu `getViewport`):**
```ts
// ✅ wewnątrz hooka handler sam sięga po refs
// Hook przyjmuje viewportRef i canvasViewportRef jako RefObject — są stabilne
const handler = (e: WheelEvent) => {
  const vp = canvasViewportRef?.current ?? viewportRef.current; // zawsze aktualne
};
```

**Dobre — opcja B: `getViewport` owinięta `useCallback(fn, [])`:**
```ts
// ✅ stabilna bo deps = []
const getViewport = useCallback(
  () => canvasViewportRef?.current ?? localViewportRef.current,
  [], // refs są stabilne, więc callback nigdy się nie zmienia
);
useCanvasWheel(overlayRef, w, h, getViewport, onChange);
```

**Rekomendacja dla implementacji hooka:** Opcja A — hook przyjmuje
`viewportRef: RefObject<ViewportTransform>` zamiast funkcji `getViewport`.
Refs są zawsze stabilne i nie wymagają `useCallback` po stronie konsumenta.

---

## Implementacja

Plik: [hooks/use-canvas-wheel.ts](../../../src/_new/features/whiteboard/hooks/use-canvas-wheel.ts)

```ts
interface UseCanvasWheelProps {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  viewport: ViewportTransform;
  onViewportChange: ((vp: ViewportTransform) => void) | undefined;
  viewportRefOverride?: React.RefObject<ViewportTransform>; // dla pen-tool (h.viewportRef)
}

export function useCanvasWheel({ overlayRef, canvasWidth, canvasHeight,
                                  viewport, onViewportChange, viewportRefOverride }: UseCanvasWheelProps): void {

  const internalViewportRef = useRef(viewport);
  useEffect(() => { internalViewportRef.current = viewport; }, [viewport]);

  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return; // ← TYLKO ten warunek; brak warunku na onViewportChange!
                          // Listener MUSI być zarejestrowany niezależnie od callbacku —
                          // callback sprawdzamy w handlerze, bo effect montuje się tylko raz

    const handleWheel = (e: WheelEvent) => {
      if (!onViewportChangeRef.current) return; // safety net w handlerze
      e.preventDefault(); e.stopPropagation();
      const vp = viewportRefOverride?.current ?? internalViewportRef.current;
      if (e.ctrlKey) {
        const rect = overlay.getBoundingClientRect();
        onViewportChangeRef.current(constrainViewport(
          zoomViewport(vp, e.deltaY, e.clientX - rect.left, e.clientY - rect.top, canvasWidth, canvasHeight)
        ));
      } else {
        onViewportChangeRef.current(constrainViewport(panViewportWithWheel(vp, e.deltaX, e.deltaY)));
      }
    };

    overlay.addEventListener('wheel', handleWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleWheel);
  }, [canvasWidth, canvasHeight]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

> **Kluczowa różnica względem pierwszej wersji:** wczesny return `if (!onViewportChangeRef.current) return`
> **usunięty z setup-u** useEffect — zostawiony tylko wewnątrz handlera. Effect montuje się raz;
> gdyby callback był `undefined` w chwili montowania, listener nigdy by się nie zarejestrował.

---

## Użycie po refaktorze (przykład dla `eraser-tool.tsx`)

```ts
// PRZED (~20 linii):
const viewportRef = useRef(viewport);
useEffect(() => { viewportRef.current = viewport; }, [viewport]);
const onViewportChangeRef = useRef(onViewportChange);
useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);
useEffect(() => {
  const overlay = overlayRef.current;
  if (!overlay) return;
  const handler = (e: WheelEvent) => { /* ... */ };
  overlay.addEventListener('wheel', handler, { passive: false });
  return () => overlay.removeEventListener('wheel', handler);
}, [canvasWidth, canvasHeight]);

// PO (1 linia):
useCanvasWheel(overlayRef, canvasWidth, canvasHeight, getViewport, onViewportChange);
```

---

## Użycie w narzędziu (wzorzec dla nowych narzędzi)

```ts
// Podstawowe (eraser, markdown):
useCanvasWheel({ overlayRef, canvasWidth, canvasHeight, viewport, onViewportChange });

// Z viewportRefOverride (pen, shape — mają h.viewportRef z canvasu):
useCanvasWheel({ overlayRef, canvasWidth, canvasHeight, viewport, onViewportChange,
                 viewportRefOverride: canvasViewportRef });

// Z disabled (table — zablokuj scroll gdy popup konfiguracji otwarty):
useCanvasWheel({ overlayRef, canvasWidth, canvasHeight, viewport, onViewportChange,
                 disabled: showConfig });
```

## Status wdrożenia

| Plik | Status |
|------|--------|
| `hooks/use-canvas-wheel.ts` | ✅ zaimplementowany |
| `pen-tool.tsx` | ✅ używa hooka |
| `eraser-tool.tsx` | ✅ używa hooka |
| `shape-tool.tsx` | ✅ używa hooka |
| `markdown-note-tool.tsx` | ✅ używa hooka |
| `table-tool.tsx` | ✅ używa hooka (`disabled: showConfig`) |
