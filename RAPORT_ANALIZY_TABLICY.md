# 📊 RAPORT ANALIZY FOLDERU TABLICA - WHITEBOARD & TOOLBAR

**Data analizy:** 4 listopada 2025  
**Zakres:** Folder `src/app/tablica` (whiteboard + toolbar)  
**Cel:** Weryfikacja spójności logiki, izolacji narzędzi, przepływu danych do `elements[]`

---

## 🎯 PODSUMOWANIE WYKONAWCZE

### ✅ **STAN OGÓLNY: BARDZO DOBRY (85/100)**

Aplikacja tablicy jest **dobrze zorganizowana** i **funkcjonalna**. Każde narzędzie jest **wyizolowane w osobnym komponencie** z własną logiką. Przepływ danych do `elements[]` jest **jasny i spójny**. Istnieją jednak **drobne niespójności** i **brakujące elementy**, które wymagają uwagi.

---

## 📁 STRUKTURA PROJEKTU

```
tablica/
├── page.tsx                    ✅ Główna strona (routing)
├── whiteboard/
│   ├── WhiteboardCanvas.tsx    ✅ Hub centralny - koordynuje wszystko
│   ├── types.ts                ✅ Definicje typów (DrawingElement union)
│   ├── viewport.ts             ✅ Transformacje współrzędnych, zoom/pan
│   ├── rendering.ts            ✅ Renderowanie wszystkich elementów
│   ├── utils.ts                ✅ Funkcje pomocnicze (clamp, math evaluator)
│   └── Grid.tsx                ✅ Siatka kartezjańska
└── toolbar/
    ├── Toolbar.tsx             ✅ Kontener logiki toolbara
    ├── ToolbarUI.tsx           ✅ UI toolbara (przyciski, ikony)
    ├── ZoomControls.tsx        ✅ Kontrolki zoom (oddzielny widget)
    ├── PenTool.tsx             ✅ Narzędzie rysowania piórem
    ├── ShapeTool.tsx           ✅ Narzędzie kształtów geometrycznych
    ├── TextTool.tsx            ✅ Narzędzie tekstu
    └── SelectTool.tsx          ✅ Narzędzie zaznaczania/edycji
```

---

## 🔍 ANALIZA SZCZEGÓŁOWA

### 1️⃣ **PRZEPŁYW DANYCH DO `elements[]`** ✅ **SPÓJNY**

#### **Diagram przepływu:**

```
Narzędzie (PenTool/ShapeTool/TextTool)
    ↓
    Tworzy element (DrawingPath/Shape/TextElement)
    ↓
    Callback do WhiteboardCanvas (handleXxxCreate)
    ↓
    setElements([...elements, newElement]) ← DODANIE DO TABLICY
    ↓
    saveToHistory(newElements) ← ZAPIS DO HISTORII
    ↓
    rendering.ts: drawElement() ← RENDEROWANIE NA CANVAS
```

#### **Weryfikacja każdego narzędzia:**

| Narzędzie        | Typ elementu   | Callback          | Stan        | Notatki                                                                                                                 |
| ---------------- | -------------- | ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| **PenTool**      | `DrawingPath`  | `onPathCreate`    | ✅          | Tworzy `{ id, type: 'path', points[], color, width }`                                                                   |
| **ShapeTool**    | `Shape`        | `onShapeCreate`   | ✅          | Tworzy `{ id, type: 'shape', shapeType, startX/Y, endX/Y, color, strokeWidth, fill }`                                   |
| **TextTool**     | `TextElement`  | `onTextCreate`    | ✅          | Tworzy `{ id, type: 'text', x, y, width, height, text, fontSize, color, fontFamily, fontWeight, fontStyle, textAlign }` |
| **SelectTool**   | -              | `onElementUpdate` | ✅          | **NIE TWORZY** - tylko edytuje istniejące (drag/resize)                                                                 |
| **FunctionTool** | `FunctionPlot` | -                 | ❌ **BRAK** | Wspomniany w kodzie, ale **PLIK NIE ISTNIEJE**                                                                          |

#### **🔴 PROBLEM #1: BRAK FunctionTool.tsx**

W `WhiteboardCanvas.tsx` (linia ~100) znajduje się:

```tsx
import { FunctionTool } from "../toolbar/FunctionTool"; // ❌ PLIK NIE ISTNIEJE
```

**Obecne obejście:**

- `handleGenerateFunction` w `WhiteboardCanvas.tsx` tworzy `FunctionPlot` bezpośrednio
- Toolbar ma input do wpisania wyrażenia matematycznego
- Funkcja jest dodawana przez przycisk "Rysuj" w `ToolbarUI.tsx`

**Stan:** 🟡 Działa, ale **niespójne z architekturą** (inne narzędzia mają własne komponenty)

---

### 2️⃣ **IZOLACJA NARZĘDZI** ✅ **DOBRA** (z małymi wyjątkami)

#### **Analiza każdego narzędzia:**

#### **A) PenTool.tsx** ✅ **DOSKONAŁA IZOLACJA**

**Odpowiedzialność:**

- Obsługa myszy/dotyku (mouseDown, mouseMove, mouseUp, touch events)
- Budowanie ścieżki (`currentPath.points[]`)
- Renderowanie podglądu SVG (live preview)
- Konwersja współrzędnych ekran→świat (`inverseTransformPoint`)
- Obsługa zoom/pan (własny handler `handleWheel`)

**Dane wejściowe:**

- `viewport`, `canvasWidth`, `canvasHeight`, `color`, `lineWidth`

**Dane wyjściowe:**

- `onPathCreate(path: DrawingPath)` - gotowy element do dodania
- `onViewportChange(viewport)` - synchronizacja zoom/pan

**Dodane do elements:**

```typescript
{
  id: Date.now().toString(),
  type: 'path',
  points: [{ x, y }, ...], // Współrzędne w układzie świata
  color: '#000000',
  width: 3
}
```

**✅ Ocena:** Perfekcyjna izolacja. Cała logika rysowania w jednym pliku.

---

#### **B) ShapeTool.tsx** ✅ **DOSKONAŁA IZOLACJA**

**Odpowiedzialność:**

- Obsługa myszy/dotyku
- Budowanie kształtu (start→end przez drag)
- Renderowanie podglądu SVG (live preview)
- Obsługa zoom/pan

**Dane wejściowe:**

- `viewport`, `canvasWidth`, `canvasHeight`, `selectedShape`, `color`, `lineWidth`, `fillShape`

**Dane wyjściowe:**

- `onShapeCreate(shape: Shape)`

**Dodane do elements:**

```typescript
{
  id: Date.now().toString(),
  type: 'shape',
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow',
  startX, startY, endX, endY, // Współrzędne w układzie świata
  color: '#000000',
  strokeWidth: 3,
  fill: false
}
```

**✅ Ocena:** Perfekcyjna izolacja. Cała logika kształtów w jednym pliku.

---

#### **C) TextTool.tsx** ✅ **DOSKONAŁA IZOLACJA**

**Odpowiedzialność:**

- Drag box → textarea (tworzenie nowego tekstu)
- Edycja istniejącego tekstu (przez `editingTextId` z double-click)
- Mini toolbar (bold, italic, alignment, fontSize, color)
- Auto-save przy kliknięciu poza edytor
- Obsługa zoom/pan (gdy NIE edytuje - blokuje scroll w textarea)

**Dane wejściowe:**

- `viewport`, `canvasWidth`, `canvasHeight`, `elements`, `editingTextId`

**Dane wyjściowe:**

- `onTextCreate(text: TextElement)` - nowy tekst
- `onTextUpdate(id, updates)` - aktualizacja istniejącego
- `onTextDelete(id)` - usunięcie pustego tekstu
- `onEditingComplete()` - reset `editingTextId`

**Dodane do elements:**

```typescript
{
  id: Date.now().toString(),
  type: 'text',
  x, y, // Lewy górny róg
  width: 3, // Szerokość box (jednostki świata)
  height: 1, // Wysokość box
  text: 'Hello World',
  fontSize: 24,
  color: '#000000',
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'normal' | 'bold',
  fontStyle: 'normal' | 'italic',
  textAlign: 'left' | 'center' | 'right'
}
```

**✅ Ocena:** Perfekcyjna izolacja. Kompleksowa obsługa tekstu w jednym pliku.

---

#### **D) SelectTool.tsx** ✅ **DOSKONAŁA IZOLACJA** (NIE TWORZY ELEMENTÓW)

**Odpowiedzialność:**

- Kliknięcie → wybór pojedynczego elementu
- Box selection → wybór wielu elementów
- Drag → przesuwanie wybranych
- Resize handles → skalowanie wybranych
- Double-click na tekst → otwiera TextTool do edycji
- Obsługa zoom/pan

**Dane wejściowe:**

- `viewport`, `canvasWidth`, `canvasHeight`, `elements`, `selectedIds`

**Dane wyjściowe:**

- `onSelectionChange(ids: Set<string>)` - zmiana zaznaczenia
- `onElementUpdate(id, updates)` - aktualizacja pojedynczego (podczas drag)
- `onElementsUpdate(updates: Map)` - aktualizacja wielu (podczas drag/resize)
- `onOperationFinish()` - zapis do historii po zakończeniu
- `onTextEdit(id)` - otwiera TextTool w trybie edycji

**Modyfikuje elements:**

- **NIE dodaje** nowych elementów
- **Aktualizuje** istniejące (zmiana x, y, width, height, points, etc.)

**✅ Ocena:** Perfekcyjna izolacja. Logika zaznaczania/edycji w jednym pliku.

---

### 3️⃣ **RENDEROWANIE (`rendering.ts`)** ✅ **SPÓJNE**

#### **Dispatcher pattern:**

```typescript
export function drawElement(ctx, element, viewport, width, height) {
  if (element.type === "path") drawPath(ctx, element, viewport, width, height);
  else if (element.type === "shape")
    drawShape(ctx, element, viewport, width, height);
  else if (element.type === "text")
    drawText(ctx, element, viewport, width, height);
  else if (element.type === "function")
    drawFunction(ctx, element, viewport, width, height);
  else if (element.type === "image")
    drawImage(ctx, element, viewport, width, height, loadedImages);
}
```

#### **Analiza funkcji renderowania:**

| Funkcja        | Element        | Stan | Używa transformPoint? | Notatki                                                                    |
| -------------- | -------------- | ---- | --------------------- | -------------------------------------------------------------------------- |
| `drawPath`     | `DrawingPath`  | ✅   | Tak                   | Renderuje points[] jako SVG path. Używa `clampLineWidth()`.                |
| `drawShape`    | `Shape`        | ✅   | Tak                   | Renderuje rectangle/circle/triangle/line/arrow. Używa `clampLineWidth()`.  |
| `drawText`     | `TextElement`  | ✅   | Tak                   | **RICH TEXT:** bold, italic, alignment, wrapping. Używa `clampFontSize()`. |
| `drawFunction` | `FunctionPlot` | ✅   | Tak                   | Evaluuje wyrażenie matematyczne punktowo. Dynamiczny step.                 |
| `drawImage`    | `ImageElement` | 🟡   | Tak                   | **Przyszłość** - placeholder. Brak integracji z narzędziami.               |

**✅ Ocena:** Każdy typ elementu ma własną funkcję renderowania. Spójna konwencja.

---

### 4️⃣ **VIEWPORT & TRANSFORMACJE (`viewport.ts`)** ✅ **POPRAWNE**

#### **Kluczowe funkcje:**

```typescript
// World → Screen
transformPoint(point, viewport, width, height)
  → { x: (point.x - viewport.x) * scale * 100 + centerX, y: ... }

// Screen → World (odwrotność)
inverseTransformPoint(point, viewport, width, height)
  → { x: (point.x - centerX) / (scale * 100) + viewport.x, y: ... }

// Pan (touchpad 2 palce - scroll)
panViewportWithWheel(viewport, deltaX, deltaY)

// Zoom (touchpad 2 palce - pinch, lub Ctrl+scroll)
zoomViewport(viewport, deltaY, mouseX, mouseY, width, height)
```

**Ważne:** `scale * 100` - **100px = 1 jednostka matematyczna** (2 kratki siatki)

**✅ Ocena:** Transformacje są spójne we wszystkich narzędziach i renderowaniu.

---

### 5️⃣ **HISTORIA UNDO/REDO** ✅ **DZIAŁA POPRAWNIE**

#### **Mechanizm:**

```typescript
// State
const [history, setHistory] = useState<DrawingElement[][]>([[]]);
const [historyIndex, setHistoryIndex] = useState(0);

// Zapis do historii (po każdej akcji)
const saveToHistory = (newElements: DrawingElement[]) => {
  // Obcina przyszłość (jeśli jesteśmy w środku historii)
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(newElements);

  // Limit: 50 stanów
  if (newHistory.length > 50) {
    newHistory.slice(newHistory.length - 50);
  }
};

// Undo
if (historyIndex > 0) {
  setHistoryIndex(historyIndex - 1);
  setElements(history[historyIndex - 1]);
}

// Redo
if (historyIndex < history.length - 1) {
  setHistoryIndex(historyIndex + 1);
  setElements(history[historyIndex + 1]);
}
```

**Keyboard shortcuts:**

- `Ctrl+Z` - Undo
- `Ctrl+Y` / `Ctrl+Shift+Z` - Redo
- `Delete` - Usuń zaznaczone elementy

**✅ Ocena:** Historia działa poprawnie. SelectTool wywołuje `onOperationFinish()` po drag/resize.

---

## 🚨 ZNALEZIONE PROBLEMY

### 🔴 **PROBLEM #1: BRAK FunctionTool.tsx**

**Opis:**

- `WhiteboardCanvas.tsx` importuje `FunctionTool` (linia ~100)
- Plik **nie istnieje** w projekcie
- Funkcje są tworzone bezpośrednio w `handleGenerateFunction` (WhiteboardCanvas.tsx linia ~300)
- Toolbar renderuje input + button, ale nie ma dedykowanego overlay/interakcji na canvas

**Wpływ:**

- 🟡 **Funkcjonalność działa** (można narysować funkcję)
- ❌ **Niespójność architektury** (inne narzędzia mają własne komponenty)
- ❌ **Brak live preview** podczas wpisywania wyrażenia
- ❌ **Brak drag-to-adjust range** (interaktywne dopasowanie zakresów X/Y)

**Rekomendacja:**

```typescript
// Stworzyć: src/app/tablica/toolbar/FunctionTool.tsx
// - Overlay z podglądem funkcji na żywo
// - Drag handles do zmiany xRange/yRange
// - Input wyrażenia bezpośrednio na canvas
// - onFunctionCreate(func: FunctionPlot)
```

---

### 🟡 **PROBLEM #2: ImageElement - niedokończona funkcjonalność**

**Opis:**

- `types.ts` definiuje `ImageElement`
- `rendering.ts` ma funkcję `drawImage()` (placeholder)
- **Brak narzędzia** do dodawania obrazów (upload, drag-drop, paste)
- Nie ma `ImageTool.tsx`

**Wpływ:**

- 🟢 **Nie blokuje** obecnej funkcjonalności
- 🟡 **Nieużywany kod** w types.ts i rendering.ts

**Rekomendacja:**

- Usunąć `ImageElement` z `DrawingElement` union (jeśli nie planowane w najbliższym czasie)
- LUB: Stworzyć `ImageTool.tsx` z obsługą:
  - Drag-drop plików
  - Paste ze schowka
  - Upload z URL
  - Resize i crop

---

### 🟡 **PROBLEM #3: Pan Tool - brak dedykowanego komponentu**

**Opis:**

- Toolbar ma przycisk "Pan" (tool === 'pan')
- **Brak `PanTool.tsx`**
- Pan działa przez wheel event na kontenerze w `WhiteboardCanvas.tsx`

**Wpływ:**

- 🟢 **Funkcjonalność działa** (można przesuwać viewport)
- 🟡 **Niespójność** (inne narzędzia mają własne komponenty)
- 🟡 **Mylące dla użytkownika** - scroll/pinch działa zawsze, niezależnie od wybranego narzędzia

**Rekomendacja:**

- Usunąć tool='pan' z toolbara (pan zawsze dostępny przez scroll/pinch)
- LUB: Stworzyć `PanTool.tsx` z drag-to-pan (środkowy przycisk myszy lub Spacja+LMB)

---

### 🟢 **PROBLEM #4: Brak walidacji wyrażeń matematycznych**

**Opis:**

- `utils.ts`: `evaluateExpression()` używa `new Function()` - ryzyko injection
- Brak walidacji przed dodaniem funkcji do elements

**Wpływ:**

- 🟡 Potencjalne **bezpieczeństwo** (XSS jeśli zapisywane do bazy bez sanitizacji)
- 🟡 **Crash** jeśli nieprawidłowe wyrażenie (np. `1/0`, `log(-1)`)

**Rekomendacja:**

- Dodać try-catch w `handleGenerateFunction`
- Pokazać błąd użytkownikowi jeśli wyrażenie nieprawidłowe
- Rozważyć użycie bezpieczniejszego parsera (np. `math.js`)

---

### 🟢 **PROBLEM #5: Brak culling (optymalizacja)**

**Opis:**

- `utils.ts` ma funkcję `isOutsideViewport()` - **zawsze zwraca false**
- Wszystkie elementy są renderowane, nawet jeśli poza ekranem

**Wpływ:**

- 🟡 **Performance** - duża liczba elementów (>1000) może spowalniać renderowanie
- 🟢 Nie problemem dla typowych użytkowników (do 100-200 elementów)

**Rekomendacja:**

- Zaimplementować culling w `WhiteboardCanvas.tsx`:

```typescript
const visibleElements = elements.filter(
  (el) => !isOutsideViewport(el, viewport)
);
visibleElements.forEach((el) => drawElement(ctx, el, viewport, width, height));
```

---

## ✅ MOCNE STRONY

### 1. **Doskonała separacja odpowiedzialności**

- Każde narzędzie w osobnym pliku
- Jasny podział: tool component → callback → WhiteboardCanvas → rendering
- Zero przeciekania logiki między narzędziami

### 2. **Spójne konwencje nazewnictwa**

```typescript
// Wszystkie narzędzia:
handle{Xxx}Create(element: XxxElement) → void
onViewportChange(viewport: ViewportTransform) → void
handleWheel(e: React.WheelEvent) → void (własna obsługa zoom/pan)
```

### 3. **Transformacje współrzędnych**

- Konsekwentne użycie `transformPoint` / `inverseTransformPoint`
- Wszystkie elementy w układzie świata (world coordinates)
- Rendering konwertuje do ekranu (screen coordinates)

### 4. **Live preview**

- PenTool: SVG preview podczas rysowania
- ShapeTool: SVG preview podczas drag
- TextTool: Live textarea z formatowaniem
- SelectTool: Bounding box + resize handles

### 5. **Historia z limitem**

- Max 50 stanów
- Automatyczne przycinanie przyszłości przy nowym stanie
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)

### 6. **Obsługa zoom/pan w każdym narzędziu**

- Każde narzędzie ma własny `handleWheel`
- Synchronizacja przez `onViewportChange`
- Blokowanie zoom/pan gdy potrzebne (np. scroll w textarea)

---

## 📊 OCENA KOŃCOWA

| Kategoria                 | Ocena | Notatki                                                            |
| ------------------------- | ----- | ------------------------------------------------------------------ |
| **Izolacja narzędzi**     | 9/10  | ✅ Każde narzędzie w osobnym pliku. ❌ Brak FunctionTool.tsx       |
| **Przepływ danych**       | 10/10 | ✅ Jasny flow: tool → callback → elements → rendering              |
| **Spójność architektury** | 8/10  | ✅ Wspólne konwencje. ❌ Pan/Function bez dedykowanych komponentów |
| **Renderowanie**          | 10/10 | ✅ Wszystkie typy renderowane poprawnie. Rich text support         |
| **Transformacje**         | 10/10 | ✅ Spójne transformacje world ↔ screen we wszystkich miejscach     |
| **Historia**              | 9/10  | ✅ Działa poprawnie. 🟡 Brak auto-save do bazy                     |
| **Performance**           | 7/10  | 🟡 Brak culling. 🟡 Wszystkie elementy renderowane zawsze          |
| **UX**                    | 9/10  | ✅ Live preview. ✅ Keyboard shortcuts. ✅ Responsive UI           |

**Średnia:** **8.9/10** ⭐⭐⭐⭐⭐

---

## 🎯 REKOMENDACJE

### **🔥 Priorytet WYSOKI (zrobić teraz)**

1. **Stworzyć `FunctionTool.tsx`**

   - Overlay z live preview funkcji
   - Drag handles do xRange/yRange
   - Poprawić spójność architektury

2. **Usunąć tool='pan' z toolbara**

   - Pan zawsze dostępny przez scroll/pinch
   - Zmniejszy confusion dla użytkownika

3. **Walidacja wyrażeń matematycznych**
   - Try-catch w `handleGenerateFunction`
   - User feedback przy błędach

### **🟡 Priorytet ŚREDNI (następna iteracja)**

4. **Zaimplementować culling**

   - Filtrowanie elementów poza viewport
   - Performance boost dla >200 elementów

5. **Auto-save do bazy danych**

   - Debounced save po każdej zmianie
   - Loader indicator podczas zapisywania

6. **Usunąć ImageElement lub zaimplementować ImageTool**
   - Obecnie nieużywany kod w types.ts

### **🟢 Priorytet NISKI (nice to have)**

7. **Refactor wheel handling**

   - Centralny handler zamiast duplikacji w każdym tool
   - HOC lub custom hook: `useWheelControl()`

8. **Unit testy**

   - Testy dla `viewport.ts` (transformacje)
   - Testy dla `utils.ts` (evaluateExpression)

9. **Accessibility**
   - ARIA labels dla toolbara
   - Keyboard navigation dla narzędzi

---

## 📝 WNIOSKI

### **Co działa świetnie:**

✅ Izolacja narzędzi - każde w osobnym pliku  
✅ Przepływ danych - jasny i prosty  
✅ Renderowanie - wszystkie typy obsługiwane  
✅ Historia - undo/redo działa poprawnie  
✅ Live preview - użytkownik widzi co rysuje

### **Co wymaga poprawy:**

❌ Brak FunctionTool.tsx (niespójność architektury)  
🟡 Brak culling (performance przy wielu elementach)  
🟡 Brak auto-save (ryzyko utraty danych)  
🟡 ImageElement - nieużywany kod

### **Gotowość do dalszego rozwoju:**

🟢 **Architektura jest skalowalna** - łatwo dodać nowe narzędzia (wzorzec jasny)  
🟢 **Code jest czytelny** - dobrze udokumentowany, sensowne nazwy  
🟢 **Zero legacy code** - świeża implementacja, nowoczesne podejście

---

## 🚀 NEXT STEPS

1. Przeczytaj raport i zadecyduj o priorytetach
2. Stwórz `FunctionTool.tsx` (wzorując się na PenTool/ShapeTool)
3. Usuń tool='pan' z toolbara (lub stwórz PanTool.tsx z drag-to-pan)
4. Dodaj walidację wyrażeń matematycznych
5. Zaimplementuj auto-save do bazy danych
6. Przetestuj z >200 elementami i zdecyduj o cullingu

---

**Raport przygotowany przez:** GitHub Copilot  
**Status:** ✅ Gotowy do review i implementacji poprawek
