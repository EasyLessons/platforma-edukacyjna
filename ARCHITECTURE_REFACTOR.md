# Refaktoryzacja architektury tablicy — Plugin/Tool Registry + Command

> **Status:** ✅ Faza 0 ukończona — przechodzimy do Fazy 1 (Silnik)
> **Cel:** Dodanie nowego narzędzia ma się sprowadzać do utworzenia **jednego pliku/konfiguracji**, bez modyfikowania boskiego komponentu, toolbara i historii.
> **Zasada nadrzędna:** każda faza jest osobno mergowalna i **nie wprowadza regresji** w działaniu tablicy (rysowanie, undo/redo, multi-touch, synchronizacja Supabase).

---

## 1. Analiza obecnego stanu (punkt wyjścia)

### 1.1. Główne źródło sprzężenia

`src/_new/features/whiteboard/components/canvas/whiteboard-canvas.tsx` — **~2647 linii** „boskiego orkiestratora", który:

- spina 6 hooków: `useViewport`, `useElements`, `useHistory`, `useClipboard`, `useSelection`, `useRealtime`,
- trzyma cały stan toolbara (`tool`, `selectedShape`, `color`, `lineWidth`, `fontSize`, `fillShape`, `polygonSides`),
- ma ~15 handlerów tworzenia/edycji elementów,
- renderuje narzędzia drabinką `{tool === 'x' && <XTool/>}` (linie ~2201–2359),
- ma `switch` skrótów klawiszowych (linie ~1132–1144),
- mapuje kursor przez `toolToCursor(tool)`.

### 1.2. Koszt dodania jednego narzędzia (dziś)

| Miejsce | Co trzeba dopisać | Plik |
|---|---|---|
| Union typu narzędzia | `\| 'mojeNarzedzie'` | `types/tools.ts` |
| Przycisk w toolbarze | `<ToolButton/>` + warianty mobile/„więcej" | `components/toolbar/toolbar-ui.tsx` |
| Render overlaya | gałąź `{tool === 'x' && <XTool/>}` | `whiteboard-canvas.tsx` |
| Handler tworzenia | `handleXCreate` + rytuał `addElements → markUnsaved → broadcast → pushUserAction` | `whiteboard-canvas.tsx` |
| Skrót klawiszowy | `case 'x': setTool('x')` | `whiteboard-canvas.tsx` |
| Kursor | `toolToCursor(tool)` | `whiteboard-canvas.tsx` |
| Historia | wariant w unionie `UserAction` + gałęzie w `applyUndo`/`applyRedo` | `hooks/use-history.ts`, `types/elements.ts` |

### 1.3. Co już jest zrobione DOBRZE (zostaje)

- `handlers/element-registry.ts` + `handlers/types.ts` — poprawny **rejestr per-TYP-elementu** (`render/resize/move/rotate/isPointInElement`). Używany przez `select-tool.tsx` i `rendering.ts`. **To ortogonalna oś — nie ruszamy jej.**

> **Rozróżnienie osi:**
> - `ElementRegistry` = „jak zachowuje się **obiekt** na tablicy" (model danych).
> - `ToolRegistry` (do dodania) = „co robi **kursor**, gdy narzędzie jest aktywne" (interakcja/UI).

### 1.4. Stan historii (do uproszczenia)

`hooks/use-history.ts` prowadzi **dwa równoległe systemy**:
1. legacy `history: DrawingElement[][]` — snapshoty (max 50), realnie **nie napędza** undo,
2. `userUndoStack` / `userRedoStack` — stos akcji `UserAction`, **to** napędza Ctrl+Z/Y.

Undo/redo to ręczny `switch` po `action.type` (`create`/`delete`/`update`/`batch`), z logiką lokalny-stan + broadcast + zapis/usuń-w-bazie rozsianą w `applyUndo`/`applyRedo`.

---

## 2. Docelowa architektura

Trzy elementy, prostopadłe do istniejącego `ElementRegistry`:

### 2.1. Wzorzec Command (historia)

Każda mutacja trwała to obiekt, który umie się **zrobić** i **cofnąć**:

```ts
export interface CommandContext {
  addElement(e: DrawingElement): void;
  removeElement(id: string): void;
  updateElement(e: DrawingElement): void;
  broadcastCreated(e: DrawingElement): void | Promise<void>;
  broadcastDeleted(id: string): void | Promise<void>;
  broadcastUpdated(e: DrawingElement): void | Promise<void>;
  saveElement(boardId: number, e: DrawingElement): Promise<void>;
  deleteElement(boardId: number, id: string): Promise<void>;
  boardIdRef: { readonly current: string | null };
  unsavedElementsRef: { readonly current: Set<string> | null };
}

export interface Command {
  readonly label: string;
  do(ctx: CommandContext): void;
  undo(ctx: CommandContext): void;
}
```

Konkretne komendy: `CreateElementsCommand`, `DeleteElementsCommand`, `UpdateElementsCommand`, `CompositeCommand` (zastępuje `batch`).

Hook historii staje się **generyczny** — trzyma `Command[]` i woła `cmd.do()/cmd.undo()`. Nowy rodzaj zmiany = nowa klasa Command; **hook nie zmienia się nigdy**.

### 2.2. Fasada `WhiteboardEngine` (silnik)

Stabilny kontrakt, przez który narzędzia mutują tablicę — zamiast bezpośrednich wywołań `rt.broadcast*`, `el.markUnsaved`, `hist.pushUserAction`.

```ts
export interface WhiteboardEngine {
  // odczyt
  readonly elementsRef: RefObject<DrawingElement[]>;
  getElements(): DrawingElement[];
  getById(id: string): DrawingElement | undefined;
  readonly viewportRef: RefObject<ViewportTransform>;
  readonly canvasSize: { width: number; height: number };
  readonly userRole: 'owner' | 'editor' | 'viewer';
  // mutacje z historią
  execute(command: Command): void;   // do() + undo-stack + broadcast + persist
  undo(): void;
  redo(): void;
  // mutacje „live" (podgląd drag/resize, bez historii)
  updateElementsLive(updates: Map<string, Partial<DrawingElement>>): void;
  // selekcja / viewport / narzędzie
  selection: { ids: ReadonlySet<string>; set(ids: string[]): void; clear(): void };
  setActiveTool(id: ToolId): void;
  screenToWorld(p: Point): Point;
  worldToScreen(p: Point): Point;
  centerOfViewport(): Point;
}
```

Sedno: `execute(command)` zbiera w **jednym miejscu** czterowierszowy rytuał (`addElements → markUnsaved → broadcast → pushUserAction`) dziś skopiowany w `createElement` i ~6 handlerach.

### 2.3. `ToolDefinition` + `ToolRegistry` (wtyczki)

```ts
export interface ToolDefinition {
  id: ToolId;                       // string — rozszerzalny, NIE zamknięty union
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  group?: 'main' | 'more' | 'history';
  order?: number;
  cursor?: CSSProperties['cursor'];
  availableTo?: Array<'owner' | 'editor' | 'viewer'>;  // domyślnie owner+editor
  Overlay?: ComponentType<ToolOverlayProps>;            // obsługa pointer/gestów
  PropertiesPanel?: ComponentType<ToolPropertiesProps>; // panel obok toolbara
  onInvoke?: (engine: WhiteboardEngine) => void;        // akcja „przyciskowa"
  onActivate?(engine: WhiteboardEngine): void;
  onDeactivate?(engine: WhiteboardEngine): void;
}

export interface ToolOverlayProps {
  engine: WhiteboardEngine;
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  properties: ToolProperties;
  isGestureActive: boolean;
}
```

Rejestr — **jawna lista** (lepsza dla SSR/Next i tree-shakingu niż auto-rejestracja side-effectem):

```ts
export const ALL_TOOLS: ToolDefinition[] = [selectTool, penTool, /* ... */];
export const toolRegistry = new Map(ALL_TOOLS.map(t => [t.id, t]));
```

Konsumenci (zamiast hardkodu): **Toolbar** mapuje rejestr → przyciski; **Canvas** renderuje 1 slot `activeTool.Overlay` + `activeTool.PropertiesPanel`; **skróty** budują mapę z `tool.shortcut`; **kursor** = `activeTool.cursor`.

### 2.4. Centralny store właściwości (`ToolProperties`)

Konsolidacja `color`/`lineWidth`/`fontSize`/`fillShape`/`selectedShape`/`polygonSides` w jeden store. **Decyzja: `zustand`** (wydajność — częste zmiany myszą bez re-renderów całego drzewa, w przeciwieństwie do React Context).

---

## 3. Decyzje architektoniczne (zatwierdzone)

| # | Decyzja | Wybór |
|---|---|---|
| 1 | Store właściwości / silnika | **`zustand`** (instalacja w Fazie 2/3) |
| 2 | Kolejność prac | **Najpierw Faza 0** (Command + historia), potem wtyczki |
| 3 | Rejestracja narzędzi | **Jawna lista `ALL_TOOLS`** (nie side-effect) |
| 4 | `ToolId` | **`string`** (rozszerzalny), nie zamknięty union |
| 5 | `ElementRegistry` / `handlers/*` | **Bez zmian** — ortogonalne |

---

## 4. Plan podziału na fazy

### ✅ Faza 0 — Fundament: Wzorzec Command + refaktor historii  ⬅ **UKOŃCZONA (2026-06-09)**
**Cel:** wprowadzić Command bez żadnej zmiany zachowania. Zależności: **brak** (czysty TS).

- [x] `commands/types.ts` — `Command`, `CommandContext`
- [x] `commands/command-effects.ts` — `createEffect` / `removeEffect` / `updateEffect` (odtworzenie `applyUndo`/`applyRedo` co do linijki)
- [x] `commands/create-elements-command.ts`
- [x] `commands/delete-elements-command.ts`
- [x] `commands/update-elements-command.ts`
- [x] `commands/composite-command.ts`
- [x] `commands/from-user-action.ts` — **adapter** `UserAction → Command` (zgodność wsteczna)
- [x] `commands/index.ts` — barrel
- [x] `commands/_tests/commands.test.ts` — test fidelity do/undo (vitest) — **11/11 zielonych**
- [x] **`hooks/use-history.ts`** — wewnętrznie `Command[]` zamiast `UserAction[]`; **publiczne API i zachowanie 1:1**
- [x] Bez zmian: `whiteboard-canvas.tsx`, `use-clipboard.ts`, `types/elements.ts` (legacy `history[][]` zostaje)

**Kryterium akceptacji:** undo/redo (create/delete/update/move/resize/rotate/paste/duplicate/clear/delete-selected) + realtime + zapis do bazy działają identycznie jak przed zmianą; testy zielone.

**Weryfikacja:** `vitest` komend 11/11 ✅ · `tsc --noEmit` 0 błędów w `src/` ✅ · `eslint` czysty ✅ · pełna suita 147/148 (1 padający to przedwcześniej istniejący flaky timeout w `auth/api/authApi.test.ts`, potwierdzony na baseline — niezwiązany).

### Faza 1 — Silnik (`WhiteboardEngine`)
- [ ] `engine/types.ts` — interfejs `WhiteboardEngine`
- [ ] `engine/use-whiteboard-engine.ts` — montaż z istniejących hooków, implementacja `execute(command)`
- [ ] Podmiana `createElement` i `handleX*` w canvasie na `engine.execute(new CreateElementsCommand([...]))`
- [ ] Drabinka JSX i toolbar **jeszcze stare**

**Kryterium:** tworzenie/edycja przez silnik, zachowanie 1:1.

### Faza 2 — Rejestr narzędzi (`ToolRegistry`)
- [ ] `npm i zustand`
- [ ] `tools/types.ts`, `tools/registry.ts`
- [ ] `tools/*.tool.tsx` — adaptery wokół istniejących komponentów narzędzi
- [ ] `components/toolbar/registry-toolbar.tsx` — toolbar sterowany danymi
- [ ] Canvas: drabinka → 1 slot `<ActiveToolOverlay>`; switch skrótów → mapa z rejestru; kursor z rejestru

**Kryterium:** wszystkie narzędzia działają z rejestru; dodanie pliku `*.tool.tsx` + wpis w `ALL_TOOLS` wystarcza.

### Faza 3 — Store właściwości + sprzątanie
- [ ] `tools/use-tool-properties.ts` (zustand)
- [ ] Przeniesienie paneli pen/shape/image do `PropertiesPanel` narzędzi
- [ ] Usunięcie martwych propsów, legacy `history[][]`, typu `UserAction`

**Kryterium:** orkiestrator schudnięty do ~kilkuset linii; zero martwego kodu.

---

## 5. Mapa plików (nowe / zmieniane)

**Nowe (rdzeń):**
- `whiteboard/commands/*` (Faza 0)
- `whiteboard/engine/*` (Faza 1)
- `whiteboard/tools/*` (Faza 2–3)
- `whiteboard/components/toolbar/registry-toolbar.tsx` (Faza 2)

**Zmieniane:**
- `hooks/use-history.ts` (Faza 0 → generyczny stos Command)
- `components/canvas/whiteboard-canvas.tsx` (Faza 1–3)
- `components/toolbar/toolbar-ui.tsx` (Faza 2–3)
- `types/elements.ts` (Faza 3 → usunięcie `UserAction`)

**Bez zmian (świadomie):** `handlers/*`, `element-registry.ts`.

---

## 6. Dziennik postępów

| Data | Faza | Zmiana | Status |
|---|---|---|---|
| 2026-06-09 | — | Analiza + akceptacja architektury, utworzenie tego dokumentu | ✅ |
| 2026-06-09 | 0 | Projekt Fazy 0 + kod do wglądu | ✅ |
| 2026-06-09 | 0 | Implementacja: 9 plików `commands/` + refaktor `use-history.ts`; testy 11/11, tsc/eslint czyste | ✅ |
