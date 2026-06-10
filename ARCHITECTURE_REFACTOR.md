# Refaktoryzacja architektury tablicy — Plugin/Tool Registry + Command

> **Status:** ✅ **Refaktor domknięty (Fazy 0–3).** Tablica stoi na: Command (historia) + Fasada `WhiteboardEngine` + `ToolRegistry` (wtyczki). Zero długu legacy, zero martwego kodu. Dalej już tylko czysta rozbudowa.
> **Cel:** Dodanie nowego narzędzia ma się sprowadzać do utworzenia **jednego pliku/konfiguracji**, bez modyfikowania boskiego komponentu, toolbara i historii.
> **Zasada nadrzędna:** każda faza jest osobno mergowalna i **nie wprowadza regresji** w działaniu tablicy (rysowanie, undo/redo, multi-touch, synchronizacja Supabase).

---

## 0. Podsumowanie zrealizowanych faz (0–2) ✅

Refaktor prowadzimy przyrostowo, fazami osobno commitowanymi. Stan na 2026-06-10:

| Faza | Wzorzec | Co dostarczono | Commit | Status |
|---|---|---|---|---|
| **0** | **Command** | `commands/` — `Command`/`CommandContext`, `Create/Delete/Update/CompositeCommand`, adapter `commandFromUserAction`. `use-history` operuje na `Command[]` zamiast `switch` po typie akcji. | `d50ee60` | ✅ |
| **1** | **Fasada** + `zustand` | `engine/` — `WhiteboardEngine` z intencjami `createElements`/`updateElements`/`deleteElements` (zwijają rytuał stan+persist+broadcast+historia). Store `zustand` na właściwości narzędzi. ~16 handlerów canvasu przepiętych na silnik. | `9aba6b7` | ✅ |
| **2** | **Strategia** + **Open/Closed** | `tools/` — `ToolDefinition` + `ToolRegistry` (`ALL_TOOLS`, lookup `Map` O(1)), `ToolHostContext` (gniazdko wtyczek), 11 adapterów `*.tool.tsx`. Drabinka 11 gałęzi → 1 `<ActiveToolOverlay/>`; toolbar i skróty z rejestru; `activeTool` w `zustand`. | `8706315` | ✅ |
| **3** | **Sprzątanie długu** | Usunięcie legacy `history[][]`/`saveToHistory` (pożeracz pamięci — kopia całej tablicy na każdy update) i typu `UserAction` (schowek → `recordCommand(new CreateElementsCommand)`). Migracja paneli pen/shape/image do `ToolDefinition.PropertiesPanel` (store-only) + slice `imageActions`. `toolbar-ui` **~970 → ~330 linii**; canvas przestał znać właściwości narzędzi. | _(ten commit)_ | ✅ |

**Efekt netto:** boski komponent stracił drabinkę renderującą narzędzia, switch skrótów, mapę kursorów i rytuały mutacji. **Dodanie narzędzia = 1 plik `tools/<x>.tool.tsx` + 1 wpis w `ALL_TOOLS`** — zero zmian w canvasie/toolbarze/historii.

**Dwie ortogonalne osie rejestrów (świadomie rozdzielone):**
- `ElementRegistry` (`handlers/`) — *jak zachowuje się obiekt na tablicy* (render/resize/move/rotate/hit-test). Wzorzec Strategii per **typ elementu**. Istniał wcześniej, zachowany bez zmian.
- `ToolRegistry` (`tools/`) — *co robi kursor, gdy narzędzie aktywne* (przycisk/overlay/skrót/kursor). Wzorzec Strategii + Open/Closed per **narzędzie**. Dodany w Fazie 2.

**Każda faza zweryfikowana:** `tsc` 0 błędów (poza cache `.next`), `eslint` czysty (poza znanym artefaktem repo `react-hooks/exhaustive-deps`), `vitest` 147/148 (1 przedawniony flaky `authApi`, potwierdzony na baseline). Smoke test ręczny po Fazach 1 i 2 — bez regresji.

> **Szczegóły, interfejsy i checklisty każdej fazy** znajdują się w sekcjach 2–4 poniżej. Wysokopoziomowy kontekst projektu dla sesji AI: [`AI_MENTOR_CONTEXT.md`](AI_MENTOR_CONTEXT.md).

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

### ✅ Faza 1 — Silnik (`WhiteboardEngine`) + store `zustand`  ⬅ **UKOŃCZONA (2026-06-09)**

> **Rafinacja (odkrycie z kodu):** persystencja NIE jest jednorodna — create/update
> zapisują przez `markUnsaved` (debounced batch), a delete przez `deleteElementDirectly`
> (natychmiast, chunki po 20). Dlatego silnik wystawia **typowane intencje**
> (`createElements`/`updateElements`/`deleteElements`), każda zachowująca dzisiejszą
> persystencję 1:1; generyczne `execute(command)` zostaje jako furtka „advanced".

**Krok 1 — store `zustand` (ToolProperties):**
- [x] `npm i zustand` (`zustand@^5.0.14`)
- [x] `stores/tool-properties-store.ts` — `useToolProperties` (color/lineWidth/fontSize/fillShape/selectedShape/polygonSides + settery)
- [x] `whiteboard-canvas.tsx` — 6× `useState` → selektory store'a (nazwy lokalne zachowane, `Toolbar`/narzędzia bez zmian); `activeTool` zostaje `useState`

**Krok 2–3 — rdzeń silnika:**
- [x] `hooks/use-history.ts` — **+ `recordCommand(command: Command)`** (addytywnie; `pushUserAction` deleguje do niego)
- [x] `engine/types.ts` — `WhiteboardEngine` + `WhiteboardEngineDeps`
- [x] `engine/use-whiteboard-engine.ts` — montaż z hooków + intencje + koordynaty (obiekt stabilny `useMemo []` + `depsRef`)

**Krok 4 — migracja canvasu:**
- [x] Budowa `const engine = useWhiteboardEngine({...})`
- [x] create → `engine.createElements` (`createElement`, `handleImageCreate`, `handleChatbotAddToBoard`, `handleMarkdownNoteCreate`, `handleTableCreate`, `handleAssetDropCenter`; `handleAddFormulasFromCard` **zgrupowane w 1 cofnięcie**)
- [x] update → `engine.updateElements` (`handleElementUpdateWithHistory`, `handleSelectionFinish`) / `engine.updateElementsLive` (`handleElementsUpdate`)
- [x] delete → `engine.deleteElements` (`handleElementDelete`, `handleTextDelete`, `deleteSelectedElements`, `clearCanvas`)
- [x] Usunięty martwy `lastGroupBroadcastRef` (throttle przeniesiony do silnika)
- [x] Drabinka JSX, `Toolbar`, komponenty narzędzi — **bez zmian** (Faza 2)
- [ ] Pozostały bez zmian (no-history live edits, odrębna semantyka broadcastu): `handleElementUpdate`, `handleTextUpdate`, `handleMarkdownContentChange`, `handleTableCellChange`

**Kryterium:** tworzenie/edycja/usuwanie przez silnik, zachowanie i persystencja 1:1. ✅

**Weryfikacja:** `tsc --noEmit` 0 błędów w `src/` ✅ · `eslint` tylko znane artefakty `react-hooks rule not found` (0 realnych) ✅ · testy 147/148 (1 flaky auth) ✅

**Świadome uproszczenie (lepszy UX, zaakceptowane):**
- `handleAddFormulasFromCard` — wklejenie karty = **jedno** `Ctrl+Z` (było N osobnych).
- `handleSelectionFinish` — commit tylko **realnie zmienionych** elementów (zniknął redundantny re-broadcast/markUnsaved niezmienionych zaznaczonych).

### 🔨 Faza 2 — Rejestr narzędzi (`ToolRegistry`)  ⬅ **W TOKU**

> **Enabler:** `ToolHostContext` — gniazdko dostarczane przez canvas (silnik + reaktywny
> stan + refy + callbacki-klej). Konsumuje je tylko zamontowany overlay (1 naraz),
> Toolbar czyta wyłącznie store → pan/zoom nie re-renderują toolbara.

**Krok 1–2 — store + infrastruktura wtyczek (bez dotykania canvasu):**
- [x] `stores/tool-store.ts` (rename z `tool-properties-store.ts`) + `activeTool`/`setActiveTool`
- [x] `stores/tool-properties-store.ts` → **tymczasowy re-export shim** (canvas kompiluje bez zmian; usuwany w Kroku 3)
- [x] `tools/types.ts` — `ToolDefinition`, `ToolId = string`
- [x] `tools/tool-host-context.tsx` — `ToolHostProvider` + `useToolHost`
- [x] `tools/*.tool.tsx` — **11 adapterów** wokół istniejących komponentów (bez ich zmiany)
- [x] `tools/registry.ts` — `ALL_TOOLS`, `toolRegistry`, `getTool`, `TOOL_SHORTCUTS`
- [x] `tools/active-tool-overlay.tsx` — slot zastępujący drabinkę
- [x] Weryfikacja: `tsc` 0 błędów w `src/` ✅ · `eslint tools/ stores/` czysty ✅

**Krok 3 — wdrożenie do canvasu:**
- [x] `whiteboard-canvas.tsx`: `ToolHostProvider` (`hostValue` z istniejących handlerów) + drabinka (~160 linii) → `<ActiveToolOverlay/>`
- [x] switch skrótów → `TOOL_SHORTCUTS`; `toolToCursor` → `getTool(tool)?.cursor` (funkcja usunięta)
- [x] `tool` z `useState` → `useToolStore`; **usunięty shim** `tool-properties-store.ts`; sprzątnięte nieużywane importy narzędzi + typ `Tool`

**Krok 4 — toolbar sterowany rejestrem:**
- [x] `components/toolbar/registry-toolbar.tsx` (`<ToolModeButtons/>`, własny `ToolButton` by uniknąć cyklu) + wpięcie do `toolbar-ui` (3 sekcje: main, „więcej" full + menu)
- [x] `toolbar.tsx` / `toolbar-ui.tsx`: usunięte propsy `tool`/`onToolChange`; panele czytają `activeTool` ze store'a; `iconFill` zachowuje wypełnione ikony select/pen

**Weryfikacja Fazy 2:** `tsc` 0 błędów ✅ · `eslint` czysty (poza znanym artefaktem `react-hooks`) ✅ · `vitest` 147/148 (1 flaky `authApi`) ✅

**Kryterium spełnione:** dodanie narzędzia = 1 plik `*.tool.tsx` + wpis w `ALL_TOOLS`.

**Drobny dług (→ Faza 3):** w `toolbar-ui.tsx` zostały nieużywane importy ikon (MousePointer2, Hand, Type…) i martwa `getShapeIcon` — usuną się przy migracji paneli właściwości do `PropertiesPanel`. Decyzja: select-button widoczny-disabled dla viewera (wcześniej ukryty) — drobna, spójniejsza zmiana.

### ✅ Faza 3 — Sprzątanie długu + panele właściwości w rejestrze  ⬅ **UKOŃCZONA (2026-06-10)**

**Krok 1–2 — wycięcie legacy (zero regresji):**
- [x] `use-history.ts`: usunięte `history[][]`, `historyIndex(Ref)`, `saveToHistory`, `historyLength`, `pushUserAction`, `MAX_HISTORY_SIZE` (**217 → ~155 linii**). Koniec kopiowania całej tablicy elementów co update (do 50 snapshotów).
- [x] Silnik: `updateElements` bez `saveToHistory`; dep usunięty z `WhiteboardEngineDeps`/`WhiteboardEngine` i z canvasu.
- [x] Schowek: `onPushUserAction` → `onRecordCommand?.(new CreateElementsCommand(...))` (**chunkowany broadcast zachowany**). Usunięte: `from-user-action.ts`, eksport z `commands/index`, 4 kazusy adaptera w teście, typ `UserAction`.

**Krok 3–5 — panele właściwości → `PropertiesPanel` + sprzątanie:**
- [x] `tools/{pen,shape,image}.properties.tsx` (store-only) wpięte przez `ToolDefinition.PropertiesPanel`.
- [x] Slice `imageActions` w `tool-store` — canvas rejestruje akcje obrazu, `ImageProperties` czyta przez selektor (pełna spójność, zero prop-drillingu).
- [x] `toolbar-ui.tsx` przepisany **~970 → ~330 linii** (−~500 linii paneli, `getShapeIcon`, 8 nieużywanych ikon, stan pędzla + 6 refów, martwe propsy). `toolbar.tsx` odchudzony do akcji/flag.
- [x] Canvas: usunięte 12 selektorów właściwości; `<Toolbar>` dostaje już tylko akcje — **canvas nie zna właściwości narzędzi**.

**Weryfikacja:** `tsc` 0 błędów ✅ · `eslint` czysty (poza znanym artefaktem `react-hooks` w canvasie) ✅ · `vitest` 143/144 (suma −4: usunięte testy adaptera `UserAction`; 1 flaky `authApi`) ✅ · smoke test (historia, schowek, panele pen/shape/image) bez regresji.

**Kryterium spełnione:** zero długu legacy, zero martwego kodu; właściwości narzędzi w pełni rejestrowe (`getTool(activeTool)?.PropertiesPanel`).

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
| 2026-06-09 | 0 | Commit `d50ee60` (Faza 0) | ✅ |
| 2026-06-09 | 1 | Krok 1: `zustand` + `stores/tool-properties-store.ts` + 6× `useState`→store w canvasie; tsc 0 błędów, testy 147/148 (1 flaky auth), brak nowych uwag lintera | ✅ |
| 2026-06-09 | 1 | Krok 2–3: `recordCommand` w `use-history` + `engine/{types,use-whiteboard-engine}.ts` (intencje create/update/delete, obiekt stabilny) | ✅ |
| 2026-06-09 | 1 | Krok 4: migracja ~16 handlerów canvasu na intencje silnika; tsc/lint/testy zielone. Faza 1 domknięta jednym commitem | ✅ |
| 2026-06-09 | 2 | Krok 1–2: `tool-store` + shim, `tools/` (host-context, types, 11 adapterów, registry, active-tool-overlay). Canvas NIETKNIĘTY. tsc 0 błędów, eslint czysty | ✅ |
| 2026-06-10 | 2 | Krok 3–4: drabinka→slot, skróty/kursor z rejestru, toolbar z `ALL_TOOLS`, shim usunięty. tsc/eslint/testy zielone. Faza 2 domknięta jednym commitem | ✅ |
| 2026-06-10 | 3 | Krok 1–2: wycięcie legacy `history[][]`/`saveToHistory` + `UserAction` (schowek → `recordCommand`); tsc 0, vitest 143/144 | ✅ |
| 2026-06-10 | 3 | Krok 3–6: panele pen/shape/image → `PropertiesPanel` + slice `imageActions`; `toolbar-ui` ~970→~330 linii. Faza 3 domknięta jednym commitem | ✅ |
