# Specyfikacja hooka `useCanvasWheel`

> Blueprint dla nowej sesji AI. Hook eliminuje duplikację wzorca `viewportRef +
> onViewportChangeRef + addEventListener wheel` obecnego w 5 narzędziach.

---

## Problem (motywacja)

Aktualnie identyczny blok ~20 linii kodu istnieje w:
- `pen-tool.tsx`
- `eraser-tool.tsx`
- `shape-tool.tsx`
- `markdown-note-tool.tsx`
- `table-tool.tsx`

Każda kopia ręcznie zarządza `viewportRef`, `onViewportChangeRef` i listener
`wheel`. Ryzyko dryfu — przyszła zmiana (np. obsługa `onPointerCapture`) musi być
replikowana w 5 miejscach.

---

## Sygnatura

```ts
// src/_new/features/whiteboard/hooks/use-canvas-wheel.ts

export function useCanvasWheel(
  overlayRef: React.RefObject<HTMLElement | null>,
  canvasWidth: number,
  canvasHeight: number,
): void
```

### Skąd hook pobiera viewport i onViewportChange

Hook **nie przyjmuje** `viewport` ani `onViewportChange` jako argumentów.
Czyta je bezpośrednio ze stabilnych źródeł:

- `viewport` — z `canvasViewportRef` przekazywanego przez `ToolHostContext`
  (lub lokalny `viewportRef` synchronizowany w narzędziu)
- `onViewportChange` — ze store'a Zustand lub `ToolHostContext`

Alternatywnie, jeśli zależności muszą być jawne:

```ts
export function useCanvasWheel(
  overlayRef: React.RefObject<HTMLElement | null>,
  canvasWidth: number,
  canvasHeight: number,
  getViewport: () => ViewportTransform,       // stabilna funkcja/ref getter
  onViewportChange: (vp: ViewportTransform) => void, // stabilny callback
): void
```

> **Decyzja do podjęcia na początku nowej sesji:** wariant ze store'em (prostszy
> dla konsumentów) vs. jawne argumenty (łatwiejszy do testowania). Oba spełniają
> kryterium `deps = [canvasWidth, canvasHeight]`.

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

## Implementacja (finalna, zaimplementowana)

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

## Pliki do zmiany w ramach refaktoru

| Plik | Zmiana |
|------|--------|
| `hooks/use-canvas-wheel.ts` | **Nowy** — implementacja hooka |
| `pen-tool.tsx` | Zastąpić blok wheel → `useCanvasWheel(...)` |
| `eraser-tool.tsx` | Zastąpić blok wheel → `useCanvasWheel(...)` |
| `shape-tool.tsx` | Zastąpić blok wheel → `useCanvasWheel(...)` |
| `markdown-note-tool.tsx` | Zastąpić blok wheel → `useCanvasWheel(...)` |
| `table-tool.tsx` | Zastąpić blok wheel → `useCanvasWheel(...)` |

---

## Kryteria akceptacji

- [ ] `tsc --noEmit` 0 błędów
- [ ] `eslint` czysty (zero nowych `react-hooks/exhaustive-deps`)
- [ ] Listener `wheel` montowany dokładnie raz przez cały cykl życia narzędzia
      (weryfikacja: `console.count` lub React DevTools Profiler — 0 re-mount przy scrollu)
- [ ] Zachowanie pan/zoom identyczne jak przed refaktorem (smoke test ręczny)
