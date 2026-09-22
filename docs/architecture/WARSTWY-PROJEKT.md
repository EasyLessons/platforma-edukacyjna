# Warstwy elementów tablicy (przenieś na wierzch / na spód / o jeden w górę / w dół) — projekt

**Data:** 22.09.2026
**Status:** projekt do uzgodnienia z Bartkiem. Sam dokument, zero kodu — każdy krok implementacji
dotyka plików w strefie Yjs (`yjs/board-doc.ts`, `hooks/use-yjs-board.ts`, `engine/*`,
`whiteboard-canvas.tsx`), więc nie da się tego zrobić obok jego gałęzi `feature/whiteboard-yjs`.
**Zakres:** kolejność rysowania (z-order) elementów na tablicy, sterowana przez użytkownika.
Poza zakresem: grupowanie, blokowanie elementów, warstwy nazwane (jak w Figmie).

---

## 0. Gdzie dziś siedzi kolejność (zmierzone w kodzie, `origin/main@18d7f52`)

| Warstwa | Co jest | Wniosek |
| --- | --- | --- |
| Model `DrawingElement` (`types/elements.ts`) | **brak** pola `zIndex`/`order`. Kolejność = kolejność tablicy `elements` | render (`rendering.ts`) i hit-test (`selection/hit-testing.ts` → `findTopmostElementAt`, ostatni w tablicy wygrywa) polegają wyłącznie na kolejności tablicy |
| Yjs (`yjs/board-doc.ts`, flaga `NEXT_PUBLIC_WHITEBOARD_YJS`) | root `Y.Map<Y.Map>` po `id`; każdy węzeł ma pole wewnętrzne `_index` = klucz z `fractional-indexing` (`generateKeyBetween`), nowy element dostaje klucz za `maxIndex`. `getElements(doc)` **sortuje po `_index`** (tie-break po `id`). `hydrate()` nadaje klucze `generateNKeysBetween` wg kolejności z `GET /elements`. `writeElement` przyjmuje `explicitIndex`, ale nie ma publicznego mutatora „zmień `_index`” | **Model już jest** — brakuje tylko operacji zmiany klucza i UI. To nie jest `Y.Array`, więc reorder = zmiana jednego pola, bez przesuwania węzłów |
| Legacy (`hooks/use-elements.ts`, flaga wyłączona) | zwykła tablica React; nowe elementy `push` na koniec | po przeładowaniu kolejność = kolejność z bazy (patrz niżej). Na gałęzi Bartka plik jest **usuwany** (−509 linii) — nie inwestować |
| Backend `board_elements` (`core/models.py`, `whiteboard/service.py`) | kolumny: `element_id`, `type`, `data` (JSONB), `created_at`… **brak `z_index`**; `load_elements` robi `.all()` bez `order_by` (faktycznie kolejność wstawiania) | dla trybu Yjs backend jest nieistotny: `board_documents.snapshot` (`Y.encodeStateAsUpdate`) niesie `_index` w środku. Zmiana backendu **niepotrzebna** |
| `whiteboard-sync` (Hocuspocus) | przechowuje/rozsyła update'y Y.Doc | reorder to zwykły update Yjs — zero zmian |
| Undo/redo (Yjs) | `Y.UndoManager(getElementsMap(doc), { trackedOrigins: {userId} })` | zmiana `_index` w transakcji z `origin = userId` cofa się automatycznie |
| UI zaznaczenia | `components/toolbar/properties-panel.tsx` (`SelectionPropertiesPanel`) ma już przyciski „duplikuj”/„usuń” podpięte przez propsy z `select-tool.tsx` ← `whiteboard-canvas.tsx` | miejsce na 4 nowe przyciski jest; przewód do silnika idzie przez canvas (strefa Bartka) |
| Skróty klawiszowe | jeden `keydown` w `whiteboard-canvas.tsx` (Ctrl+Z/Y/C/V/D, Delete, Escape) | nowe skróty dopisuje się w tym samym miejscu |
| PPM | `onContextMenu={(e) => e.preventDefault()}` + PPM/MMB = pan | **menu kontekstowe koliduje z panem PPM** — patrz decyzja w §3 |

---

## 1. Model: `_index` (fractional indexing) — zostaje, bez `zIndex` w `DrawingElement`

Rozważone warianty:

| Wariant | Ocena |
| --- | --- |
| **A. Zmiana `_index` (fractional key) w istniejącym `Y.Map`** — rekomendacja | Zero migracji (klucze już są). Reorder = `node.set('_index', nowyKlucz)`: jedna zmiana pola, offline-safe (dwóch użytkowników zmieniających kolejność jednocześnie daje po prostu dwa różne klucze — brak konfliktu, wynik deterministyczny po `sort`). Undo za darmo. Nic w backendzie. |
| B. Przestawianie w `Y.Array` | Wymaga przepisania `board-doc.ts` z `Y.Map` na `Y.Array` (usuwanie + wstawianie węzła = utrata tożsamości węzła dla `UndoManager`, konflikty przy równoczesnym przesuwaniu tego samego elementu — Yjs nie ma „move” dla `Y.Array`, `Y.Array` z `move` to wciąż eksperyment). Odrzucone. |
| C. Liczbowe `zIndex` w `DrawingElement` + `z_index` w bazie | Wymaga renumeracji sąsiadów przy „o jeden w górę” (n zmian zamiast 1), migracja bazy, pole „wycieka” do API/kopiowania/szablonów. Odrzucone — fractional key robi to samo lepiej. |

Decyzje szczegółowe wariantu A:

- `_index` pozostaje polem **wewnętrznym** (prefiks `_`, `isInternalField`) — nie trafia do `DrawingElement`,
  do schowka, szablonów ani do `GET /elements`. Kolejność tablicy `elements` (`getElements`) jest jedynym
  kontraktem dla renderu i hit-testu — tak jak dziś.
- Klucz zawsze liczony **względem sąsiadów w aktualnym `getElements(doc)`** (posortowanej liście), nie
  względem `maxIndex` całej mapy — inaczej „na spód” nie zadziała.
- Zaznaczenie wielu elementów przenosimy **z zachowaniem ich wzajemnej kolejności**
  (`generateNKeysBetween(a, b, n)`).
- Kolizja kluczy (dwóch użytkowników wygenerowało ten sam klucz): tie-break po `id` już jest w
  `getElements` — wynik stabilny.

## 2. API — trzy warstwy, zgodnie z istniejącym układem

### 2.1 Czysta logika (nowy plik, POZA strefą Bartka): `src/_new/features/whiteboard/layers/order.ts`

```ts
export type LayerAction = 'front' | 'back' | 'forward' | 'backward';

/** Posortowana lista (jak getElements) z kluczami: [{ id, index }] */
export interface OrderedEntry { id: string; index: string }

/** Zwraca nowe klucze TYLKO dla przenoszonych elementów (Map<id, index>). Pusta mapa = brak zmian. */
export function computeReorder(
  ordered: OrderedEntry[],
  selectedIds: ReadonlySet<string>,
  action: LayerAction
): Map<string, string>;
```

Semantyka (jak w Excalidraw/Figma):

- `front`: zaznaczone lądują za ostatnim niezaznaczonym (`generateNKeysBetween(last.index, null, n)`).
- `back`: przed pierwszym niezaznaczonym (`generateNKeysBetween(null, first.index, n)`).
- `forward`: zaznaczone (jako blok) przeskakują **jeden niezaznaczony element bezpośrednio nad
  najwyższym zaznaczonym**; jeśli nad zaznaczeniem nic nie ma — pusta mapa.
- `backward`: symetrycznie w dół.
- Elementy bez handlera (`function`, `arrow` z `ArrowElement`) traktujemy jak każdy inny wpis listy.

Zależność: `fractional-indexing` (już w `package.json`). Bez Reacta, bez Yjs — testowalne jednostkowo.

### 2.2 Dokument Yjs (`yjs/board-doc.ts`, strefa Bartka) — jeden mutator

```ts
/** Ustawia _index podanych elementów w jednej transakcji (jedna pozycja undo). */
export function setElementIndexes(doc: Y.Doc, indexes: Map<string, string>, origin: TransactionOrigin): void;
/** Aktualne klucze w kolejności rysowania — wejście dla computeReorder. */
export function getOrderedIndexes(doc: Y.Doc): OrderedEntry[];
```

Uwaga do `writeElementFields`: nie dotyka pól `_*`, więc zwykły `upsert` po reorderze **nie cofnie**
kolejności — dobrze. Obserwator w `use-yjs-board.ts` (`handleDeepChange`) już traktuje zmianę
dowolnego klucza węzła jako `updated` → `applySnapshot()` przelicza posortowaną listę. Wymaga sprawdzenia:
czy `spatialIndex.update` nie jest potrzebny (geometria się nie zmienia — nie jest).

### 2.3 Hook i silnik

- `hooks/use-yjs-board.ts` — `mutators.reorder(action: LayerAction, ids: Set<string>)`
  = `computeReorder(getOrderedIndexes(doc), ids, action)` → `setElementIndexes(doc, map, userId)`.
- `engine/use-whiteboard-engine.ts` — intencja `reorderSelected(action)` (read-only guard jak w
  `deleteElements`), broadcast niepotrzebny (Yjs rozsyła sam).
- `whiteboard-canvas.tsx` — `BoardElementsBinding.reorder?: (action, ids) => void`; w
  `adaptYjsElements` podpięcie do `board.mutators.reorder`; w legacy `undefined` → UI ukrywa przyciski
  (feature działa tylko z włączonym Yjs; legacy i tak znika na gałęzi Bartka).

## 3. UI

| Element | Gdzie | Uwagi |
| --- | --- | --- |
| 4 przyciski w panelu zaznaczenia | `components/toolbar/properties-panel.tsx` (poza strefą) — obok „duplikuj”/„usuń”, w każdej z 3 gałęzi renderu panelu (ksztalty/sciezki, notatki/obrazy, tabele) | nowy props `onReorderSelected?: (action: LayerAction) => void`; propsy przechodzą przez `selection-panels.tsx` → `select-tool.tsx` → `whiteboard-canvas.tsx` (ostatni = strefa Bartka) |
| Skróty | `whiteboard-canvas.tsx`, ten sam `keydown` co Ctrl+D | Ctrl+] = forward, Ctrl+[ = backward, Ctrl+Shift+] = front, Ctrl+Shift+[ = back. Uwaga: `e.key` dla `]` z Shiftem na polskim układzie to `}` — sprawdzać `e.code === 'BracketRight'/'BracketLeft'`, nie `e.key`. Tylko gdy `selectedIds.size > 0`, `userRole !== 'viewer'`, cel nie jest INPUT/TEXTAREA (jak dziś) |
| Menu kontekstowe (PPM) | **nie w pierwszej iteracji** | PPM to dziś pan tablicy (`isRightButtonPan…` w canvas), `contextmenu` jest blokowany. Włączenie menu wymagałoby rozróżnienia „klik PPM bez ruchu = menu, PPM z ruchem = pan” — osobna decyzja produktowa. Przyciski w panelu + skróty pokrywają 100 % funkcji |
| Etykiety | „Na wierzch”, „Wyżej”, „Niżej”, „Na spód” + tooltip ze skrótem | ikony: `lucide-react` (`BringToFront`, `SendToBack`, `ArrowUp`, `ArrowDown`) — biblioteka już w projekcie |

## 4. Co dokładnie trzeba zmienić w strefie Bartka (lista do uzgodnienia)

1. `src/_new/features/whiteboard/yjs/board-doc.ts` — `getOrderedIndexes`, `setElementIndexes` (+ testy w `board-doc.test.ts`: reorder przeżywa `upsert`, undo cofa kolejność, dwóch klientów ze zmianą naraz → deterministyczny wynik po sync).
2. `src/_new/features/whiteboard/hooks/use-yjs-board.ts` — `mutators.reorder` + rozszerzenie `UseYjsBoardMutators`.
3. `src/_new/features/whiteboard/engine/use-whiteboard-engine.ts` (+ `engine/types.ts`) — intencja `reorderSelected`.
4. `src/_new/features/whiteboard/components/canvas/whiteboard-canvas.tsx` — `BoardElementsBinding.reorder`, `adaptYjsElements`, 4 skróty w `keydown`, przekazanie `onReorderSelected` do `SelectTool`.

Poza strefą (może powstać wcześniej, nawet przed mergem Bartka, bo nie ma zależności od Yjs):

5. `src/_new/features/whiteboard/layers/order.ts` + `order.test.ts` — czysta logika z §2.1.
6. `components/toolbar/properties-panel.tsx`, `selection-panels.tsx`, `select-tool.tsx` — przyciski i props (renderowane tylko gdy `onReorderSelected` jest przekazane, więc do czasu podpięcia w canvas nic się nie zmienia).

## 5. Testy

- `layers/order.test.ts` (czyste): front/back/forward/backward dla 1 i wielu elementów; zachowanie
  wzajemnej kolejności; brak zmian na krańcach; klucze rosnące (`a < b` jako string) i unikalne; zaznaczenie
  spoza listy ignorowane.
- `yjs/board-doc.test.ts`: `setElementIndexes` zmienia `getElements`; `upsert` po reorderze nie psuje
  kolejności; `UndoManager` cofa reorder; dwa `Y.Doc` z krzyżującymi się reorderami po
  `applyUpdate` dają tę samą kolejność.
- `components/toolbar/_tests/select-tool-hit.test.tsx` (istniejący plik): po `front` klik w nachodzący
  obszar zaznacza nowy wierzch (`findTopmostElementAt` już to gwarantuje — test integracyjny kolejność ↔ hit-test).
- Ręcznie: dwa okna, reorder w jednym, drugie widzi nową kolejność; odśwież — kolejność z snapshotu.

## 6. Szacunek

| Krok | h |
| --- | --- |
| §2.1 `layers/order.ts` + testy | 2 |
| §2.2 mutatory w `board-doc.ts` + testy | 1,5 |
| §2.3 hook + engine + binding w canvas | 1,5 |
| §3 przyciski w panelu + skróty (`e.code`) | 2 |
| QA ręczne (dwa okna, undo, odświeżenie, viewer) + poprawki | 1 |
| **Razem** | **~8** |

Kolejność: 5 → 6 (mogą wejść jako osobny PR od razu, bez efektu w UI) → po merge'u `feature/whiteboard-yjs`
kroki 1–4 (jeden PR Bartka albo wspólny, ale w jego plikach).

## 7. Pytania do Bartka

1. Czy `_index` może zostać jedynym źródłem kolejności także po migracji (skrypt
   `scripts/migrate-board-elements-to-yjs.ts`) — tj. nie planujesz `zIndex` w `DrawingElement`?
2. `mutators.reorder` w `use-yjs-board.ts` czy raczej bezpośrednio w engine (który ma `doc`)?
3. Czy legacy (flaga wyłączona) ma dostać cokolwiek — propozycja: nie (przyciski ukryte).
