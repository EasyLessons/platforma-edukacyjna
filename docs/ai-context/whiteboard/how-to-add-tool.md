# Jak dodać nowe narzędzie do tablicy

> Kompletna instrukcja. Dodanie narzędzia = **1 plik `*.tool.tsx` + 1 wpis w `ALL_TOOLS`**.
> Toolbar, overlay, skrót klawiszowy, kursor i filtr ról działają automatycznie.

---

## Dwa rodzaje narzędzi

| Typ | Kiedy | Pole w ToolDefinition |
|-----|-------|-----------------------|
| **TRYB** | Narzędzie zajmuje ekran i obsługuje pointer/gesty (rysowanie, zaznaczanie) | `Overlay: ComponentType` |
| **AKCJA** | Kliknięcie przycisku wykonuje jednorazową akcję, nie wchodzi w tryb | `onInvoke: (host) => void` |

---

## Interfejs `ToolDefinition`

Plik źródłowy: [tools/types.ts](../../../src/_new/features/whiteboard/tools/types.ts)

```ts
export interface ToolDefinition {
  id: ToolId;           // string — unikalny, np. 'pen', 'myTool'
  label: string;        // tooltip przycisku, np. 'Rysuj (P)'
  icon: LucideIcon;     // ikona z lucide-react
  shortcut?: string;    // pojedynczy znak, np. 'p' — TOOL_SHORTCUTS rejestruje go auto
  group?: 'main' | 'more'; // sekcja toolbara; brak = tylko overlay, bez przycisku
  order?: number;       // kolejność w toolbarze (niższy = wyżej)
  cursor?: CSSProperties['cursor']; // kursor gdy narzędzie aktywne
  availableTo?: UserRole[]; // ['owner','editor'] domyślnie; dodaj 'viewer' gdy potrzeba
  iconFill?: number;    // 0–1 wypełnienie ikony (np. 1 dla select, 0.3 dla pen)

  Overlay?: ComponentType;      // TRYB — komponent bez propsów, używa useToolHost()
  PropertiesPanel?: ComponentType; // opcjonalny panel właściwości obok toolbara

  onInvoke?: (host: ToolHostContextValue) => void; // AKCJA — zamiast Overlay
}
```

**`ToolId`** to `string`, nie zamknięty union — dodanie nowego ID nie zmienia żadnego
istniejącego pliku poza `registry.ts`.

---

## Krok 1 — Utwórz plik adaptera `tools/<id>.tool.tsx`

Adapter to cienka warstwa: odczytuje `useToolHost()`, przekazuje propsы do
faktycznego komponentu narzędzia.

### Wzorzec dla narzędzia-TRYBU (przykład: `pen.tool.tsx`)

```tsx
'use client';

import { Pencil } from 'lucide-react';
import { MyToolComponent } from '../components/toolbar/my-tool';
import { useToolHost } from './tool-host-context';
import { useToolStore } from '../stores/tool-store';
import type { ToolDefinition } from './types';

function MyToolOverlay() {
  const h = useToolHost();
  // Właściwości narzędzia czytaj ze store'a (nie z h), bo pan/zoom
  // nie re-renderuje toolbara i nie powinien re-renderować overlaya przez props
  const color     = useToolStore((s) => s.color);
  const lineWidth = useToolStore((s) => s.lineWidth);

  return (
    <MyToolComponent
      viewport={h.viewport}
      viewportRef={h.viewportRef}        // stabilny ref — użyj zamiast viewport w event handlerach
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      color={color}
      lineWidth={lineWidth}
      onMyCreate={h.onMyCreate}          // callback z ToolHostContext
      onViewportChange={h.onViewportChange}
      isGestureActive={h.isGestureActive} // OBOWIĄZKOWE — patrz canvas-architecture.md §4
    />
  );
}

export const myTool: ToolDefinition = {
  id: 'myTool',
  label: 'Moje narzędzie (Y)',
  icon: Pencil,
  shortcut: 'y',
  group: 'main',
  order: 5,
  cursor: 'crosshair',
  Overlay: MyToolOverlay,
};
```

### Wzorzec dla narzędzia-AKCJI (bez trybu, klik = akcja)

```tsx
'use client';

import { Save } from 'lucide-react';
import type { ToolDefinition } from './types';

export const saveTemplateTool: ToolDefinition = {
  id: 'saveTemplate',
  label: 'Zapisz szablon',
  icon: Save,
  group: 'more',
  order: 20,
  onInvoke: (host) => {
    const selected = [...host.selectedIds].map(id =>
      host.elements.find(e => e.id === id)
    ).filter(Boolean);
    host.onSaveGroupTemplate(selected);
  },
};
```

---

## Krok 2 — Dopisz narzędzie do `ALL_TOOLS`

Plik: [tools/registry.ts](../../../src/_new/features/whiteboard/tools/registry.ts)

```ts
import { myTool } from './my-tool.tool'; // ← dodaj import

export const ALL_TOOLS: ToolDefinition[] = [
  selectTool,
  // ... istniejące narzędzia ...
  myTool, // ← dodaj tutaj (kolejność nie ma znaczenia, sort po `order`)
];
```

To jedyna zmiana poza nowym plikiem. Toolbar, `<ActiveToolOverlay/>`, skróty i
kursor zaktualizują się automatycznie.

---

## Krok 3 — Jeśli narzędzie tworzy nowy typ elementu: dodaj callback do `ToolHostContext`

Plik: [tools/tool-host-context.tsx](../../../src/_new/features/whiteboard/tools/tool-host-context.tsx)
Dostawca kontekstu: [components/canvas/whiteboard-canvas.tsx](../../../src/_new/features/whiteboard/components/canvas/whiteboard-canvas.tsx)

```ts
// tool-host-context.tsx — dodaj do interfejsu:
onMyCreate: (element: MyElement) => void;

// whiteboard-canvas.tsx — podłącz w hostValue:
onMyCreate: useCallback((el: MyElement) => {
  engine.createElements([el]);
}, [engine]),
```

Dla istniejących typów elementów callbacki są już dostępne — patrz pełna lista niżej.

---

## Pełna lista pól `ToolHostContext`

Plik źródłowy: [tools/tool-host-context.tsx](../../../src/_new/features/whiteboard/tools/tool-host-context.tsx)

```ts
// ── Stan canvasu ──────────────────────────────────────────────────────────
engine: WhiteboardEngine         // fasada do mutacji (createElements, undo, redo…)
viewport: ViewportTransform      // reaktywny — zmienia się przy pan/zoom
viewportRef: RefObject<ViewportTransform> // stabilny ref — użyj w event handlerach
canvasWidth: number
canvasHeight: number
isGestureActive: boolean         // true gdy pinch-zoom/pan na touchscreenie
onViewportChange: (vp) => void   // zmiana widoku (pan/zoom z overlay)

// ── Dane ─────────────────────────────────────────────────────────────────
elements: DrawingElement[]       // wszystkie elementy tablicy (reaktywne)
selectedIds: Set<string>
editingTextId: string | null
overlaysVisible: boolean

// ── Refy współdzielone ────────────────────────────────────────────────────
htmlOverlaysRef: RefObject<HTMLDivElement | null>   // kontener HTML overlayów
textEditorDivRef: RefObject<HTMLDivElement | null>  // ref edytora tekstu
imageToolRef: RefObject<ImageToolRef | null>        // ref narzędzia obrazu

// ── Tworzenie elementów ───────────────────────────────────────────────────
onPathCreate:     (path: DrawingPath)      => void
onShapeCreate:    (shape: Shape)           => void
onFunctionCreate: (func: FunctionPlot)     => void
onImageCreate:    (image: ImageElement)    => void
onNoteCreate:     (note: MarkdownNote)     => void
onTableCreate:    (table: TableElement)    => void
onArrowCreate:    (arrow: ArrowElement)    => void
onTextCreate:     (text: TextElement)      => void

// ── Tekst ─────────────────────────────────────────────────────────────────
onTextUpdate:      (id, updates) => void
onTextDelete:      (id) => void
onEditingComplete: () => void
onTextEdit:        (id) => void

// ── Zaznaczenie i aktualizacje ────────────────────────────────────────────
onSelectionChange:           (ids: Set<string>) => void
onElementUpdate:             (id, updates) => void       // live (bez historii)
onElementUpdateWithHistory:  (id, updates) => void       // z Command
onElementsUpdate:            (Map<id, updates>) => void  // batch live
onOperationFinish:           (originalElements?) => void // commit po drag/resize
onMarkdownEdit:              (id) => void
onActiveGuidesChange:        (guides) => void
onDeleteSelected:            () => void
onCopySelected:              () => void
onDuplicateSelected:         () => void
onSaveGroupTemplate:         (elements) => void

// ── Specyficzne ───────────────────────────────────────────────────────────
onElementDelete: (id) => void   // gumka — usuwa pojedynczy element
onPanStart:      () => void     // pan tool
onPanEnd:        () => void
```

---

## Checklist przed commitem

- [ ] Nowy plik `tools/<id>.tool.tsx` eksportuje `const <id>Tool: ToolDefinition`
- [ ] Wpis w `ALL_TOOLS` w `registry.ts`
- [ ] `isGestureActive` przekazane do komponentu overlaya i obsługiwane guard clausem
- [ ] Wheel events przez wzorzec `viewportRef` — deps `[canvasWidth, canvasHeight]` (lub `useCanvasWheel` gdy już zaimplementowany)
- [ ] `tsc --noEmit` — 0 błędów
- [ ] `eslint` — 0 nowych ostrzeżeń
