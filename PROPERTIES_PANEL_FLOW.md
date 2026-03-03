# 🔍 ANALIZA: Properties Panel Flow - Co się dzieje podczas scroll/pan/wheel

## 📋 Gdzie jest renderowany SelectionPropertiesPanel

**TYLKO JEDNO MIEJSCE:**

- `select-tool.tsx` → `renderPropertiesPanel()` → `<SelectionPropertiesPanel />`
- Żadnych duplikatów, żadnych innych miejsc

---

## 🔄 FLOW 1: User zaczyna scrollować/wheelować

### Krok 1: handleViewportChange jest wywołane

```typescript
// whiteboard-canvas.tsx, linia ~672
const handleViewportChange = useCallback(
  (newVp: ViewportTransform) => {
    const constrained = constrainViewport(newVp);

    // ⚠️ TUTAJ: setOverlaysVisible(false) - ASYNCHRONICZNE setState!
    setOverlaysVisible(false);

    // CSS ukrycie - SYNCHRONICZNE, działa natychmiast
    if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';

    // Czyść selection jeśli to nie pan gesture
    if (!isPanningRef.current && sel.selectedElementIds.size > 0) {
      flushSync(() => {
        sel.clearSelection(); // selectedIds staje się puste
      });
    }

    // ... viewport update
  },
  [vp.setViewport, vp.viewportRef, sel]
);
```

### Krok 2: React planuje re-render SelectTool

- `setOverlaysVisible(false)` zmienia state
- React **PLANUJE** re-render, ale nie wykonuje go natychmiast
- Może być opóźnienie 1-2 frame (16-32ms)

### Krok 3: SelectTool dostaje nowy render z nowymi props

```typescript
// whiteboard-canvas.tsx, linia ~1404
<SelectTool
  viewport={vp.viewport}          // ⚠️ NOWY viewport (zmieniony)
  selectedIds={sel.selectedElementIds}  // ⚠️ Puste (clearSelection)
  isOverlayVisible={overlaysVisible}    // ⚠️ false (setState)
  ...
/>
```

### Krok 4: renderPropertiesPanel() jest wywoływane

```typescript
// select-tool.tsx, linia ~2165
const renderPropertiesPanel = () => {
  // ✅ isOverlayVisible = false → zwraca null
  if (!isOverlayVisible) return null;

  // ✅ selectedIds.size = 0 → zwraca null
  if (selectedIds.size === 0 || !onElementUpdateWithHistory) return null;

  // NIE DOJDZIE TUTAJ - już zwrócone null
  // ...
};
```

---

## ⚠️ PROBLEM: Delay między setState a re-render

### Timing:

1. **t=0ms**: User scrolluje → handleViewportChange wywołane
2. **t=0ms**: `setOverlaysVisible(false)` → React **planuje** update
3. **t=0ms**: CSS `visibility='hidden'` → działa NATYCHMIAST
4. **t=0ms**: `clearSelection()` w flushSync → działa SYNCHRONICZNIE
5. **t=16-32ms**: React wykonuje re-render SelectTool z nowymi props
6. **t=16-32ms**: Panel znika z DOM

### W tym czasie (0-32ms):

- CSS overlay jest ukryty (`visibility: hidden`)
- ALE SelectTool jeszcze ma stare props: `isOverlayVisible={true}`
- Panel jest renderowany w DOM (choć niewidoczny przez CSS parent)
- Panel oblicza nową pozycję z nowym viewport
- **Przez 1-2 frame panel ISTNIEJE w DOM na złej pozycji (choć niewidoczny)**

---

## 🐛 POTENCJALNY PROBLEM: innerHTML / text changes

**Nawet jeśli panel jest `visibility: hidden`, browser może:**

1. Wykonywać layout calculations
2. Obliczać pozycje elementów
3. Pokazywać tooltips (które mogą "uciec" poza hidden overlay)
4. Pokazywać native browser UI (np. color picker, dropdowns)

---

## 🤔 HIPOTEZY - Co może powodować widoczny lag:

### Hipoteza 1: Browser tooltips

```typescript
// properties-panel.tsx ma wiele tooltipów:
<span className="absolute ... opacity-0 group-hover:opacity-100 ...">
  Kopiuj (Ctrl+C)
</span>
```

- Te tooltips mogą być renderowane POZA hidden overlayem
- `position: absolute` + `z-50` może "wybić" je poza parent

### Hipoteza 2: Color picker / native UI

- Input koloru może otwierać native browser picker
- Native UI nie respektuje CSS `visibility: hidden` na parent

### Hipoteza 3: Selection box (nie properties panel!)

```typescript
// select-tool.tsx renderuje WIELE rzeczy:
{
  renderTextToolbar();
}
{
  renderPropertiesPanel();
} // ← Properties panel
{
  renderPreviewSelectionBoxes();
} // ← Preview boxes podczas resize
{
  renderPreviewBoundingBox();
} // ← Preview bounding box
{
  renderSelectionBox();
} // ← Main selection box z handles
```

**Może to SELECTION BOX się ciągnie, nie properties panel?**

### Hipoteza 4: Async setState race condition

- `setOverlaysVisible(false)` jest async
- Viewport zmienia się → SelectTool re-renderuje z nowym viewport
- ALE `overlaysVisible` jeszcze nie zmieniło się na `false`
- Panel renderuje się z nowym viewport ale starym `isOverlayVisible={true}`
- Widoczne przez CSS parent który jeszcze nie ma `visibility: hidden`

---

## 🔬 CO SPRAWDZIĆ:

### Test 1: Czy to faktycznie properties panel?

Dodać console.log w renderPropertiesPanel:

```typescript
const renderPropertiesPanel = () => {
  console.log('[PANEL] isOverlayVisible:', isOverlayVisible, 'selectedIds:', selectedIds.size);
  if (!isOverlayVisible) return null;
  // ...
};
```

### Test 2: Czy to selection box?

Spróbować wyłączyć renderowanie selection box:

```typescript
// {renderSelectionBox()} // ← zakomentować
```

### Test 3: Synchroniczny setState

Użyć flushSync dla setOverlaysVisible:

```typescript
flushSync(() => {
  setOverlaysVisible(false);
});
```

### Test 4: Zabić cały properties panel

Zakomentować całe renderPropertiesPanel:

```typescript
// {renderPropertiesPanel()} // ← zakomentować
```

---

## 🎯 REKOMENDACJE:

1. **Dodać debug logging** - zobaczyć KIEDY panel się faktycznie renderuje
2. **Sprawdzić selection box** - może to on się ciągnie, nie panel
3. **Użyć flushSync** dla setOverlaysVisible - wymusi synchroniczny update
4. **Tymczasowo wyłączyć panel** - potwierdzić że to faktycznie on
