# 🔍 SmartSearch + ChatBot - Kompleksowa Architektura

## 📋 SPIS TREŚCI

1. [Analiza Istniejącego Systemu](#1-analiza-istniejącego-systemu)
2. [Architektura SmartSearch](#2-architektura-smartsearch)
   - 2.1 Decyzja Architektoniczna
   - 2.2 Format Plików
   - **2.3 🔥 Jak Przechowywać Kartę Wzorów (Struktura Plików)**
   - **🆕 Spis Treści w Modalu (Nawigacja)**
   - **🆕 Przezroczyste Tło (Transparency)**
   - **🆕 Kategorie Kolorystyczne (Karty vs Wzory)**
   - 2.4 Nowy Przepływ UX
   - 2.5 Struktura Komponentów
   - 2.6 Przepływ Działania
3. [Struktura Zasobów (Resources)](#3-struktura-zasobów-resources)
4. [Mechanika Selekcji Sekcji](#4-mechanika-selekcji-sekcji)
5. [Integracja z ChatBotem Gemini](#5-integracja-z-chatbotem-gemini)
6. [Pliki Do Modyfikacji](#6-pliki-do-modyfikacji)
7. [Implementacja Krok Po Kroku](#7-implementacja-krok-po-kroku)
8. [Synchronizacja Realtime](#8-synchronizacja-realtime)

---

## 1. ANALIZA ISTNIEJĄCEGO SYSTEMU

### 1.1 Jak Działa Tablica (WhiteboardCanvas)

**Główne Komponenty:**

```
src/app/tablica/
├── page.tsx                    # Entry point, BoardRealtimeProvider wrapper
├── toolbar/
│   ├── Toolbar.tsx             # Kontener toolbara (Tool type)
│   ├── ToolbarUI.tsx           # UI przycisków narzędzi
│   ├── ImageTool.tsx           # Obsługa wstawiania obrazów
│   ├── PenTool.tsx             # Rysowanie
│   ├── TextTool.tsx            # Tekst
│   └── ...
└── whiteboard/
    ├── WhiteboardCanvas.tsx    # GŁÓWNY KOMPONENT - 1408 linii!
    ├── types.ts                # Typy elementów (ImageElement już istnieje!)
    ├── rendering.ts            # drawImage() - renderowanie obrazów
    └── viewport.ts             # Transformacje współrzędnych
```

### 1.2 Istniejący Typ ImageElement (types.ts)

```typescript
export interface ImageElement {
  id: string;
  type: "image";
  x: number; // Pozycja X w world coordinates
  y: number; // Pozycja Y w world coordinates
  width: number; // Szerokość w world units
  height: number; // Wysokość w world units
  src: string; // URL lub base64 data
  alt?: string; // Opis obrazu
}
```

✅ **WAŻNE:** Typ `ImageElement` już istnieje i obsługuje obrazy!  
✅ `DrawingElement` = `DrawingPath | Shape | TextElement | FunctionPlot | ImageElement`

### 1.3 Jak Działa Dodawanie Obrazu

**Przepływ w WhiteboardCanvas.tsx:**

```typescript
// 1. handleImageCreate - callback tworzący nowy obraz
const handleImageCreate = useCallback(
  (image: ImageElement) => {
    const newElements = [...elements, image];
    setElements(newElements); // Lokalna aktualizacja
    saveToHistory(newElements); // Historia undo/redo
    broadcastElementCreated(image); // 🔴 REALTIME - wysyła do innych!

    // Zapisywanie do bazy
    setUnsavedElements((prev) => new Set(prev).add(image.id));
    if (boardIdState) debouncedSave(boardIdState); // Debounced 2s

    // Ładowanie obrazu do Map
    if (image.src) {
      const img = new Image();
      img.src = image.src;
      img.onload = () =>
        setLoadedImages((prev) => new Map(prev).set(image.id, img));
    }
  },
  [
    elements,
    saveToHistory,
    broadcastElementCreated,
    boardIdState,
    debouncedSave,
  ]
);
```

### 1.4 Synchronizacja Realtime (BoardRealtimeContext)

**Supabase Broadcast + Presence:**

```typescript
// WYSYŁANIE (broadcast)
broadcastElementCreated(element); // → channel.send({ type: 'broadcast', event: 'element-created', payload })
broadcastElementUpdated(element);
broadcastElementDeleted(elementId);

// ODBIERANIE (w WhiteboardCanvas useEffect)
onRemoteElementCreated((element, userId, username) => {
  setElements((prev) => [...prev, element]);
  // Jeśli to obraz → załaduj do loadedImages
});
```

### 1.5 Zapisywanie do Bazy (boards_api/api.ts)

```typescript
// Batch save - debounced 2s
saveBoardElementsBatch(boardId, [
  {
    element_id: "uuid-123",
    type: "image",
    data: { ...ImageElement }, // Cały obiekt jako JSONB
  },
]);

// Ładowanie przy otwarciu tablicy
loadBoardElements(boardId); // → elements.map(e => e.data)
```

### 1.6 Renderowanie Obrazu (rendering.ts)

```typescript
export function drawImage(
  ctx: CanvasRenderingContext2D,
  img: ImageElement,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number,
  loadedImages: Map<string, HTMLImageElement>
): void {
  const htmlImg = loadedImages.get(img.id);
  if (htmlImg && htmlImg.complete) {
    ctx.drawImage(htmlImg, topLeft.x, topLeft.y, screenWidth, screenHeight);
  } else {
    // Placeholder while loading
  }
}
```

---

## 2. ARCHITEKTURA SMARTSEARCH

### 2.1 Decyzja Architektoniczna: Bez Bazy Danych

**✅ REKOMENDACJA: Statyczne pliki w `/public` + JSON manifest**

**Dlaczego:**

1. **Prostota** - Brak dodatkowych migracji, tabel, API
2. **Wydajność** - CDN cache dla obrazów, natychmiastowe ładowanie
3. **Skalowalność** - Łatwe dodawanie nowych zasobów (upload plików)
4. **Offline-ready** - Pliki są zawsze dostępne
5. **SEO/Hosting** - Next.js automatycznie optymalizuje /public

### 2.2 Format Plików - KLUCZOWA DECYZJA

| Format   | Zalety                                            | Wady                              | **Verdict**                            |
| -------- | ------------------------------------------------- | --------------------------------- | -------------------------------------- |
| **WebP** | Mały rozmiar, dobra jakość, wsparcie przeglądarek | Nie skaluje się idealnie          | ✅ **Dla miniatur i podglądu**         |
| **SVG**  | Nieskończone skalowanie, mały rozmiar             | Trudne do stworzenia dla zdjęć    | ✅ **Dla wzorów wektorowych**          |
| **PNG**  | Bezstratna jakość                                 | Duży rozmiar                      | ⚠️ Tylko gdy potrzebna jakość          |
| **PDF**  | Skalowanie, profesjonalny format                  | Wymaga biblioteki do renderowania | ❌ **NIE UŻYWAĆ** - zbyt skomplikowane |

**🏆 NAJLEPSZE ROZWIĄZANIE:**

```
Karta wzorów = Jeden duży WebP (2480x3508px, ~300KB)
                    +
              JSON z definicją sekcji (współrzędne crop)
```

**Dlaczego NIE PDF?**

- Wymaga `pdf.js` (~500KB biblioteka)
- Renderowanie do canvas jest wolne
- Komplikuje synchronizację realtime
- WebP + crop działa równie dobrze i jest DUŻO prostsze!

---

## 2.3 🔥 JAK PRZECHOWYWAĆ KARTĘ WZORÓW - SZCZEGÓŁOWE WYJAŚNIENIE

### Problem: Karta wzorów to ~30 stron/slajdów!

Oficjalna karta CKE ma wiele stron. Jak to przechowywać i wyświetlać?

### Porównanie Podejść

| Podejście                | Struktura                        | Zalety              | Wady                                             | Verdict     |
| ------------------------ | -------------------------------- | ------------------- | ------------------------------------------------ | ----------- |
| **A) PDF**               | `karta.pdf` (30 stron)           | Oficjalny format    | Wymaga pdf.js, wolne renderowanie, skomplikowane | ❌ NIE      |
| **B) Jeden MEGA WebP**   | `karta-full.webp` (2480x50000px) | Prosty scroll       | Za duży plik (~5MB), wolne ładowanie             | ❌ NIE      |
| **C) Wiele małych WebP** | 30× `strona-01.webp`             | Szybkie ładowanie   | Trudne zarządzanie, wiele requestów              | ⚠️ Opcja    |
| **D) Hybrydowe**         | Strony + sekcje                  | Elastyczne, szybkie | Wymaga więcej przygotowania                      | ✅ **TAK!** |

### 🏆 REKOMENDACJA: Podejście Hybrydowe (D)

```
/public/resources/matematyka/karty-wzorow/matura-podstawowa/
├── manifest.json           # Metadane + definicje sekcji
├── pages/
│   ├── page-01.webp        # Strona 1 (trygonometria)
│   ├── page-02.webp        # Strona 2 (stereometria)
│   ├── page-03.webp        # Strona 3 (planimetria)
│   └── ...                 # Każda strona ~200-400KB
└── sections/               # OPCJONALNE: Pre-wycięte fragmenty
    ├── tryg-jedynka.webp   # Pojedynczy wzór (gotowy do wstawienia)
    ├── tryg-sincos.webp
    ├── stereo-kula.webp
    └── ...
```

### Jak to Działa w Praktyce

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  KROK 1: User wyszukuje "karta wzorów"                                      │
│                                                                             │
│  KROK 2: Otwiera się ResourceViewer z LISTĄ STRON                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📄 Karta Wzorów - Matura Podstawowa                                │    │
│  │  ────────────────────────────────────────────────────────────────── │    │
│  │                                                                     │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │    │
│  │  │  STRONA 1        │  │  STRONA 2        │  │  STRONA 3        │  │    │
│  │  │  Trygonometria   │  │  Stereometria    │  │  Planimetria     │  │    │
│  │  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │  │    │
│  │  │  │ sin, cos   │  │  │  │ objętości  │  │  │  │ pola figur │  │  │    │
│  │  │  │   [➕]     │  │  │  │   [➕]     │  │  │  │   [✓]     │  │  │    │
│  │  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │  │    │
│  │  │  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │  │    │
│  │  │  │ tg, ctg    │  │  │  │ bryły      │  │  │  │ twierdzenia│  │  │    │
│  │  │  │   [➕]     │  │  │  │   [➕]     │  │  │  │   [➕]     │  │  │    │
│  │  │  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │  │    │
│  │  │  ┌────────────┐  │  │                  │  │                  │  │    │
│  │  │  │ jedynka    │  │  │                  │  │                  │  │    │
│  │  │  │   [➕]     │  │  │                  │  │                  │  │    │
│  │  │  └────────────┘  │  │                  │  │                  │  │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │    │
│  │                                                                     │    │
│  │  ◀ PREV          Strona 1 z 30           NEXT ▶                    │    │
│  │                                                                     │    │
│  │  Zaznaczono: 1 sekcja              [ANULUJ] [✓ AKCEPTUJ]            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  KROK 3: User przegląda strony (PREV/NEXT lub scroll)                       │
│  KROK 4: Klika ➕ przy konkretnych wzorach                                  │
│  KROK 5: Klika AKCEPTUJ → wybrane sekcje wstawiane na tablicę               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Struktura manifest.json dla Karty Wielostronicowej

```json
{
  "id": "mat-karta-podstawowa",
  "title": "Karta wzorów - Matura podstawowa",
  "type": "multi-page",
  "category": "matematyka",
  "subcategory": "karty-wzorow",
  "totalPages": 4,
  "pages": [
    {
      "pageNumber": 1,
      "title": "Trygonometria",
      "path": "/resources/matematyka/karty-wzorow/matura-podstawowa/pages/page-01.webp",
      "dimensions": { "width": 2480, "height": 3508 },
      "sections": [
        {
          "id": "tryg-funkcje",
          "name": "Funkcje trygonometryczne",
          "description": "sin, cos, tg, ctg - definicje",
          "crop": { "x": 50, "y": 100, "width": 1180, "height": 350 },
          "tags": ["sin", "cos", "tg", "definicje"],
          "preCropped": "/resources/matematyka/karty-wzorow/matura-podstawowa/sections/tryg-funkcje.webp"
        },
        {
          "id": "tryg-jedynka",
          "name": "Jedynka trygonometryczna",
          "description": "sin²α + cos²α = 1",
          "crop": { "x": 50, "y": 470, "width": 1180, "height": 200 },
          "tags": ["jedynka", "sin²", "cos²"],
          "preCropped": "/resources/matematyka/karty-wzorow/matura-podstawowa/sections/tryg-jedynka.webp"
        },
        {
          "id": "tryg-redukcyjne",
          "name": "Wzory redukcyjne",
          "description": "sin(90°-α), cos(180°+α), ...",
          "crop": { "x": 1250, "y": 100, "width": 1180, "height": 500 },
          "tags": ["redukcja", "kąty", "90", "180"]
        }
      ]
    },
    {
      "pageNumber": 2,
      "title": "Stereometria",
      "path": "/resources/matematyka/karty-wzorow/matura-podstawowa/pages/page-02.webp",
      "dimensions": { "width": 2480, "height": 3508 },
      "sections": [
        {
          "id": "stereo-graniastoslupy",
          "name": "Graniastosłupy",
          "description": "Objętość i pole powierzchni",
          "crop": { "x": 50, "y": 100, "width": 2380, "height": 600 },
          "tags": ["graniastosłup", "objętość", "pole"]
        },
        {
          "id": "stereo-ostroslup",
          "name": "Ostrosłup",
          "crop": { "x": 50, "y": 720, "width": 1180, "height": 500 },
          "tags": ["ostrosłup", "piramida"]
        }
      ]
    }
  ],
  "quickAccess": [
    { "sectionId": "tryg-jedynka", "label": "Jedynka trygonometryczna" },
    { "sectionId": "stereo-kula", "label": "Wzory na kulę" }
  ]
}
```

### Dwa Tryby Wstawiania Sekcji

#### Tryb A: Pre-cropped (ZALECANY dla popularnych wzorów)

```typescript
// Sekcja ma pole "preCropped" - gotowy plik!
if (section.preCropped) {
  // Użyj gotowego pliku (szybciej, mniej obliczeń)
  onImageCreate({
    id: Date.now().toString(),
    type: 'image',
    src: section.preCropped,  // '/resources/.../sections/tryg-jedynka.webp'
    ...
  });
}
```

**Zalety:**

- ⚡ Natychmiastowe wstawienie (brak cropowania w runtime)
- 📦 Mniejszy rozmiar (zoptymalizowany plik)
- 🔗 URL zamiast base64 (lepsze dla realtime sync)

#### Tryb B: Runtime crop (dla rzadziej używanych)

```typescript
// Sekcja NIE ma "preCropped" - cropuj w locie
if (!section.preCropped) {
  const croppedData = await cropImageSection(page.path, section.crop);
  onImageCreate({
    id: Date.now().toString(),
    type: 'image',
    src: croppedData,  // 'data:image/webp;base64,...'
    ...
  });
}
```

**Zalety:**

- 💾 Mniej plików do przechowywania
- 🎯 Elastyczność (user może zaznaczyć dowolny obszar)

### Jak Przygotować Kartę Wzorów (Workflow)

```
1. POZYSKAJ ŹRÓDŁO
   └─ PDF z CKE lub własne materiały

2. KONWERTUJ DO WEBP
   └─ Każda strona PDF → osobny WebP (2480x3508px, jakość 90%)
   └─ Narzędzia: ImageMagick, Photoshop, online converter

   $ convert -density 300 karta.pdf -quality 90 page-%02d.webp

3. ZMAPUJ SEKCJE
   └─ Otwórz każdą stronę w edytorze graficznym
   └─ Zaznacz obszary (x, y, width, height)
   └─ Zapisz współrzędne do manifest.json

   TIP: Użyj narzędzia jak Figma/Photoshop - pokaże współrzędne!

4. (OPCJONALNIE) PRE-CROP POPULARNE SEKCJE
   └─ Wytnij najczęściej używane wzory
   └─ Zapisz jako osobne pliki w /sections/
   └─ Dodaj ścieżkę "preCropped" do manifest.json

5. TESTUJ!
   └─ Otwórz ResourceViewer
   └─ Sprawdź czy sekcje się pokrywają z zawartością
   └─ Dostosuj współrzędne jeśli trzeba
```

### Porównanie Rozmiarów

| Zawartość             | Format | Rozmiar    | Uwagi                   |
| --------------------- | ------ | ---------- | ----------------------- |
| Pełna strona karty    | WebP   | ~300-500KB | Jakość 90%, 2480x3508px |
| Wycięta sekcja (duża) | WebP   | ~50-100KB  | ~1000x500px             |
| Wycięta sekcja (mała) | WebP   | ~10-30KB   | ~500x200px              |
| Cała karta (4 strony) | WebP   | ~1.5MB     | Suma stron              |
| PDF oryginał          | PDF    | ~2-5MB     | Nie używamy!            |

### Odpowiedź na Twoje Pytania

**Q: Jak widzimy kartę wzorów? Z czego? Jakim formatem?**

> A: Z plików **WebP** - każda strona to osobny plik. W modalu wyświetlamy aktualną stronę jako `<img src={page.path}>` z nakładkami sekcji (overlay divs).

**Q: Jak się składa z 30 slajdów?**

> A: Każdy slajd to osobny plik WebP w folderze `/pages/`. Ładujemy tylko aktualnie widoczną stronę (lazy loading).

**Q: Jak klikamy plus - co się dodaje?**

> A: Jeśli sekcja ma `preCropped` - wstawiamy gotowy plik. Jeśli nie - cropujemy w locie używając Canvas API i wstawiamy jako base64.

**Q: Czy nie będzie za duże na tablicy?**

> A: NIE! Wstawiamy tylko WYBRANE SEKCJE, nie całą kartę. Każda sekcja to mały fragment (~500x300px w rzeczywistości, ~3x2 world units na tablicy).

**Q: Czy można wycinać dowolny fragment?**

> A: TAK! Możemy dodać tryb "free crop" gdzie user rysuje prostokąt na stronie i wycina dokładnie to co chce.

---

### 🆕 SPIS TREŚCI W MODALU (Nawigacja po Karcie Wzorów)

**Problem:** Karta wzorów ma 30 stron - scrollowanie to koszmar!

**Rozwiązanie:** Sidebar ze spisem treści + szybka nawigacja

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📄 Karta Wzorów - Matura Podstawowa                              [X]      │
├──────────────────────┬──────────────────────────────────────────────────────┤
│  📋 SPIS TREŚCI      │                                                      │
│  ──────────────────  │     ┌─────────────────────────────────────────┐      │
│                      │     │                                         │      │
│  ▼ Strona 1          │     │   TRYGONOMETRIA                         │      │
│    • Funkcje tryg.   │     │   ┌─────────────────────────────────┐   │      │
│    • Jedynka    [➕] │     │   │  sin α, cos α, tg α, ctg α      │   │      │
│    • Wzory red.      │     │   │           [➕]                   │   │      │
│                      │     │   └─────────────────────────────────┘   │      │
│  ▼ Strona 2          │     │   ┌─────────────────────────────────┐   │      │
│    • Graniastosłupy  │     │   │  sin²α + cos²α = 1              │   │      │
│    • Ostrosłup       │     │   │           [✓]                   │   │      │
│    • Walec           │     │   └─────────────────────────────────┘   │      │
│                      │     │                                         │      │
│  ▶ Strona 3...       │     │   ┌─────────────────────────────────┐   │      │
│  ▶ Strona 4...       │     │   │  Wzory redukcyjne               │   │      │
│                      │     │   │           [➕]                   │   │      │
│  ──────────────────  │     │   └─────────────────────────────────┘   │      │
│  🔍 Szukaj...        │     │                                         │      │
│                      │     └─────────────────────────────────────────┘      │
│  ──────────────────  │                                                      │
│  Zaznaczono: 1       │     ◀ PREV      Strona 1/4      NEXT ▶               │
│  [ANULUJ] [✓ OK]     │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

**Funkcjonalności:**

1. **Sidebar ze spisem treści** - rozwijane sekcje per strona
2. **Kliknięcie w sekcję** → przeskakuje do strony i scrolluje do sekcji
3. **➕ bezpośrednio w spisie** → można dodać bez przeglądania!
4. **Wyszukiwarka** → filtruje sekcje ("szukaj: kula" → pokazuje tylko sekcje z kulą)

```typescript
// Struktura TOC w manifest.json
{
  "toc": [
    {
      "pageNumber": 1,
      "title": "Trygonometria",
      "sections": [
        { "id": "tryg-funkcje", "name": "Funkcje trygonometryczne", "anchor": 100 },
        { "id": "tryg-jedynka", "name": "Jedynka trygonometryczna", "anchor": 350 },
        { "id": "tryg-redukcyjne", "name": "Wzory redukcyjne", "anchor": 600 }
      ]
    },
    {
      "pageNumber": 2,
      "title": "Stereometria",
      "sections": [...]
    }
  ]
}
```

---

### 🆕 PRZEZROCZYSTE TŁO (Transparent Background)

**Problem:** WebP z białym tłem wygląda źle na kolorowej tablicy!

**Rozwiązanie:** Przechowuj wzory jako **WebP/PNG z przezroczystością** LUB **SVG**

#### Opcja A: WebP/PNG z Alpha Channel

```
┌──────────────────────────────────────────────────────────────┐
│  PRZYGOTOWANIE OBRAZÓW Z PRZEZROCZYSTOŚCIĄ                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Otwórz obraz w Photoshop/GIMP/Figma                      │
│  2. Użyj Magic Wand lub Select Color → zaznacz białe tło    │
│  3. Delete → przezroczystość                                 │
│  4. Eksportuj jako:                                          │
│     • PNG-24 z alpha (większy, ~100KB)                       │
│     • WebP z alpha (mniejszy, ~50KB) ✅ PREFEROWANE          │
│                                                              │
│  AUTOMATYZACJA (ImageMagick):                                │
│  $ convert input.webp -transparent white output.webp         │
│  $ convert input.png -fuzz 10% -transparent white output.png │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Workflow dla karty wzorów:**

```bash
# Konwertuj PDF do PNG z przezroczystością
convert -density 300 karta.pdf -background none -alpha set page-%02d.png

# Usuń białe tło (z tolerancją 10%)
for file in page-*.png; do
  convert "$file" -fuzz 10% -transparent white "${file%.png}-transparent.webp"
done
```

#### Opcja B: SVG dla Wzorów Matematycznych (NAJLEPSZA JAKOŚĆ!)

**Dla NOWYCH wzorów (nie skanów):**

```typescript
// Wzór jako SVG z MathJax/KaTeX
const jedynkaTrygonometryczna = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 60">
  <text x="10" y="40" font-family="KaTeX_Main" font-size="32">
    sin²α + cos²α = 1
  </text>
</svg>
`;

// Lub renderuj LaTeX do SVG używając KaTeX
import katex from "katex";

const svg = katex.renderToString("\\sin^2\\alpha + \\cos^2\\alpha = 1", {
  output: "mathml", // lub 'html'
  throwOnError: false,
});
```

**Zalety SVG:**

- ✅ Nieskończone skalowanie (nigdy nie pikseluje!)
- ✅ Zawsze przezroczyste tło
- ✅ Małe pliki (~2-5KB per wzór)
- ✅ Można stylować kolory CSS

**Wady SVG:**

- ❌ Trudne dla skanowanych dokumentów (tylko dla nowo tworzonych)
- ❌ Wymaga konwersji LaTeX → SVG

#### Opcja C: Runtime Background Removal (usuwanie tła przy cropie)

```typescript
// Usuń białe tło przy cropowaniu w locie!
async function cropWithTransparency(
  imageSrc: string,
  crop: CropArea
): Promise<string> {
  // 1. Crop obrazu
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d")!;

  const img = await loadImage(imageSrc);
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  // 2. Usuń białe tło (pixel manipulation)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Jeśli pixel jest "prawie biały" → ustaw alpha na 0
    if (r > 240 && g > 240 && b > 240) {
      data[i + 3] = 0; // Alpha = 0 (przezroczysty)
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // 3. Eksportuj jako PNG z alpha (WebP też wspiera alpha!)
  return canvas.toDataURL("image/png");
}
```

**⚠️ UWAGA:** Runtime removal może zostawić artefakty na krawędziach tekstu. Lepiej przygotować obrazy z przezroczystością wcześniej!

---

### 🎯 REKOMENDACJA: Hybrydowe Podejście

| Typ zasobu             | Format       | Tło           | Dlaczego                             |
| ---------------------- | ------------ | ------------- | ------------------------------------ |
| **Karta wzorów CKE**   | WebP z alpha | Przezroczyste | Oficjalny dokument, przygotowany raz |
| **Pojedyncze wzory**   | SVG          | Przezroczyste | Nowo tworzone, idealna jakość        |
| **Twierdzenia (skan)** | PNG z alpha  | Przezroczyste | Skanowane materiały                  |
| **Arkusze maturalne**  | WebP         | Białe OK      | Całe strony, białe tło akceptowalne  |

### Manifest z informacją o przezroczystości

```json
{
  "id": "tryg-jedynka",
  "name": "Jedynka trygonometryczna",
  "format": "svg", // 'svg' | 'webp' | 'png'
  "hasTransparency": true, // czy ma przezroczyste tło
  "path": "/resources/matematyka/wzory/tryg-jedynka.svg",
  "latexSource": "\\sin^2\\alpha + \\cos^2\\alpha = 1" // dla SVG - oryginał
}
```

### Jak to wygląda na tablicy

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   TABLICA (szare/kolorowe tło)                              │
│                                                             │
│      ┌─────────────────────────┐                            │
│      │                         │  ← BIAŁA KARTA (źle! 😕)   │
│      │  sin²α + cos²α = 1     │                            │
│      │                         │                            │
│      └─────────────────────────┘                            │
│                                                             │
│                                                             │
│         sin²α + cos²α = 1      ← PRZEZROCZYSTE (dobrze! 😊)│
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 🆕 KATEGORIE KOLORYSTYCZNE W SMARTSEARCH

**Problem:** User musi odróżnić karty wzorów (wielostronicowe) od pojedynczych wzorów (szybkie wstawienie)

**Rozwiązanie:** Kolorowe kategorie w wynikach wyszukiwania

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍 SmartSearch                                              [X]           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [ karta wzo...                                            🔍 ]            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🔴 KARTY WZORÓW (kliknij aby przeglądać)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔴 Karta wzorów - Matura podstawowa                    📄 4 strony │   │
│  │     trygonometria, stereometria, planimetria, algebra...            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔴 Karta wzorów - Matura rozszerzona                   📄 6 stron  │   │
│  │     całki, pochodne, granice, macierze...                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  🔵 WZORY (kliknij aby dodać od razu)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔵 Funkcje podwójnego kąta                             [➕ DODAJ]  │   │
│  │     sin(2α) = 2·sin(α)·cos(α)                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔵 Jedynka trygonometryczna                            [➕ DODAJ]  │   │
│  │     sin²α + cos²α = 1                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔵 Wzory redukcyjne                                    [➕ DODAJ]  │   │
│  │     sin(90° - α) = cos(α)                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  🟢 TWIERDZENIA                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🟢 Twierdzenie Pitagorasa                              [➕ DODAJ]  │   │
│  │     a² + b² = c²                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Typy Zasobów i Kolory

| Typ       | Kolor        | Badge        | Akcja po kliknięciu                         | Ikona |
| --------- | ------------ | ------------ | ------------------------------------------- | ----- |
| `card`    | 🔴 Czerwony  | "📄 X stron" | Otwiera ResourceViewer z paginacją          | 📕    |
| `formula` | 🔵 Niebieski | "➕ DODAJ"   | Wstawia od razu na tablicę                  | 📐    |
| `theorem` | 🟢 Zielony   | "➕ DODAJ"   | Wstawia od razu na tablicę                  | 📜    |
| `table`   | 🟡 Żółty     | "➕ DODAJ"   | Wstawia od razu (np. tabelka wartości)      | 📊    |
| `diagram` | 🟣 Fioletowy | "➕ DODAJ"   | Wstawia od razu (np. koło trygonometryczne) | 📈    |

### Struktura w manifest.json

```json
{
  "resourceTypes": {
    "card": {
      "label": "Karty wzorów",
      "color": "#EF4444",
      "bgColor": "bg-red-500",
      "textColor": "text-red-600",
      "borderColor": "border-red-500",
      "icon": "BookOpen",
      "action": "open-viewer",
      "priority": 1
    },
    "formula": {
      "label": "Wzory",
      "color": "#3B82F6",
      "bgColor": "bg-blue-500",
      "textColor": "text-blue-600",
      "borderColor": "border-blue-500",
      "icon": "Calculator",
      "action": "instant-add",
      "priority": 2
    },
    "theorem": {
      "label": "Twierdzenia",
      "color": "#22C55E",
      "bgColor": "bg-green-500",
      "textColor": "text-green-600",
      "borderColor": "border-green-500",
      "icon": "FileText",
      "action": "instant-add",
      "priority": 3
    },
    "table": {
      "label": "Tabele",
      "color": "#EAB308",
      "bgColor": "bg-yellow-500",
      "textColor": "text-yellow-600",
      "borderColor": "border-yellow-500",
      "icon": "Table",
      "action": "instant-add",
      "priority": 4
    },
    "diagram": {
      "label": "Diagramy",
      "color": "#A855F7",
      "bgColor": "bg-purple-500",
      "textColor": "text-purple-600",
      "borderColor": "border-purple-500",
      "icon": "PieChart",
      "action": "instant-add",
      "priority": 5
    }
  }
}
```

### Sortowanie Wyników

```typescript
// Wyniki posortowane według:
// 1. Priority typu (karty pierwsze)
// 2. Score wyszukiwania
// 3. Alfabetycznie

function sortSearchResults(results: SearchResult[]): SearchResult[] {
  return results.sort((a, b) => {
    // 1. Karty wzorów zawsze na górze
    const priorityA = resourceTypes[a.resource.type].priority;
    const priorityB = resourceTypes[b.resource.type].priority;
    if (priorityA !== priorityB) return priorityA - priorityB;

    // 2. Potem według score
    if (a.score !== b.score) return b.score - a.score;

    // 3. Alfabetycznie
    return a.resource.title.localeCompare(b.resource.title);
  });
}
```

### Grupowanie w UI

```typescript
// Komponent SearchResults grupuje po typie
function SearchResults({ results }: { results: SearchResult[] }) {
  // Grupuj wyniki po typie
  const grouped = groupBy(results, (r) => r.resource.type);

  return (
    <div className="space-y-4">
      {/* Karty wzorów (czerwone) - zawsze pierwsze */}
      {grouped.card && (
        <ResultGroup
          title="🔴 KARTY WZORÓW"
          results={grouped.card}
          color="red"
        />
      )}

      {/* Wzory (niebieskie) */}
      {grouped.formula && (
        <ResultGroup title="🔵 WZORY" results={grouped.formula} color="blue" />
      )}

      {/* Twierdzenia (zielone) */}
      {grouped.theorem && (
        <ResultGroup
          title="🟢 TWIERDZENIA"
          results={grouped.theorem}
          color="green"
        />
      )}

      {/* ... inne typy */}
    </div>
  );
}
```

---

### 2.4 Nowy Przepływ UX - Selekcja Sekcji

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. User klika SmartSearch w Toolbar                                    │
│         ↓                                                               │
│  2. Otwiera się modal z wyszukiwarką                                    │
│         ↓                                                               │
│  3. User wpisuje "karta wzorów" → autocomplete                          │
│         ↓                                                               │
│  4. Klika na "Karta wzorów - Matura podstawowa"                         │
│         ↓                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  RESOURCE VIEWER (nowy modal)                                   │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │                                                         │    │    │
│  │  │   📄 KARTA WZORÓW (scrollowalna)                        │    │    │
│  │  │   ┌─────────────────────────────────┐                   │    │    │
│  │  │   │  TRYGONOMETRIA          [➕]    │ ← klik = zielone  │    │    │
│  │  │   │  sin, cos, tg...                │    podświetlenie  │    │    │
│  │  │   └─────────────────────────────────┘                   │    │    │
│  │  │   ┌─────────────────────────────────┐                   │    │    │
│  │  │   │  STEREOMETRIA           [➕]    │                   │    │    │
│  │  │   │  objętości, pola...             │                   │    │    │
│  │  │   └─────────────────────────────────┘                   │    │    │
│  │  │   ┌─────────────────────────────────┐                   │    │    │
│  │  │   │  PLANIMETRIA            [✓]     │ ← zaznaczone!     │    │    │
│  │  │   │  (zielone tło)                  │                   │    │    │
│  │  │   └─────────────────────────────────┘                   │    │    │
│  │  │                                                         │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                 │    │
│  │  Zaznaczono: 1 sekcja              [ANULUJ] [✓ AKCEPTUJ]        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│         ↓                                                               │
│  5. User klika AKCEPTUJ                                                 │
│         ↓                                                               │
│  6. Na tablicy pojawia się TYLKO zaznaczona sekcja (przycięty obraz)   │
│         ↓                                                               │
│  7. broadcastElementCreated → wszyscy widzą!                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Struktura SmartSearch - Komponenty

```
SmartSearchTool (główny komponent)
      │
      ├── SearchModal (modal z wyszukiwarką)
      │     ├── SearchBar (input z autocomplete)
      │     └── SearchResults (lista wyników)
      │
      ├── ResourceViewer (modal podglądu zasobu)  ← 🆕 NOWY!
      │     ├── ResourceImage (scrollowalny obraz)
      │     ├── SectionOverlay (nakładki sekcji z ➕)
      │     ├── SelectionHighlight (zielone podświetlenie)
      │     └── ActionButtons (Anuluj / Akceptuj)
      │
      ├── ResourceLibrary (JSON manifest)
      │     └── manifest.json
      │
      └── onSectionsAccept → cropAndCreateImages()
            └── handleImageCreate() × N  (dla każdej sekcji)
```

### 2.6 Przepływ Działania - Szczegółowy

```
1. User klika ikonę SmartSearch w Toolbar
       ↓
2. Otwiera się SearchModal z search barem
       ↓
3. User wpisuje "karta wzorów" → debounced search (150ms)
       ↓
4. System filtruje manifest.json:
   - Po tytule (fuzzy match)
   - Po tagach
   - Po kategorii
       ↓
5. Wyświetla podpowiedzi z miniaturami
       ↓
6. User klika na zasób → Otwiera się ResourceViewer
       ↓
7. ResourceViewer:
   - Ładuje pełny obraz WebP
   - Nakłada interaktywne sekcje (z manifest.json)
   - User scrolluje i przegląda
   - Klika ➕ przy sekcjach które chce
   - Zaznaczone sekcje podświetlają się na zielono
       ↓
8. User klika "AKCEPTUJ"
       ↓
9. Dla KAŻDEJ zaznaczonej sekcji:
   a) Crop obrazu do współrzędnych sekcji (canvas API)
   b) Konwersja do base64 lub URL z parametrami
   c) handleImageCreate({
        id: Date.now().toString(),
        type: 'image',
        x: pozycjaX,  // Sekcje obok siebie
        y: pozycjaY,
        width: sekcja.width / 100,  // Skalowanie do world units
        height: sekcja.height / 100,
        src: croppedImageData,
        alt: 'Karta wzorów - Planimetria'
      })
       ↓
10. Obrazy renderują się na tablicy (obok siebie lub w siatce)
       ↓
11. broadcastElementCreated × N → wszyscy widzą wszystkie sekcje!
       ↓
12. debouncedSave → zapisuje do bazy (po 2s)
```

---

## 3. STRUKTURA ZASOBÓW (RESOURCES)

### 3.1 Aktualna Struktura Folderów (Utworzona!)

```
public/resources/
├── manifest.json                          # 🔥 GŁÓWNY MANIFEST
├── LogoEasyLesson.webp
│
└── matematyka/
    ├── karty-wzorow/                      # 🔴 KARTY (wielostronicowe)
    │   └── matura-podstawowa/
    │       ├── README.md
    │       ├── pages/                     # Pełne strony karty
    │       │   ├── README.md
    │       │   ├── strona-01-trygonometria.webp   # ⏳ Do dodania
    │       │   ├── strona-02-stereometria.webp
    │       │   ├── strona-03-planimetria.webp
    │       │   └── strona-04-algebra.webp
    │       │
    │       └── sections/                  # Pre-wycięte sekcje
    │           ├── README.md
    │           ├── tryg-definicje.webp    # ⏳ Do dodania
    │           ├── tryg-jedynka.webp
    │           ├── tryg-tangens.webp
    │           ├── tryg-redukcyjne.webp
    │           ├── tryg-wartosci.webp
    │           ├── tryg-podwojne.webp
    │           ├── stereo-graniastoslupy.webp
    │           ├── stereo-ostroslup.webp
    │           ├── stereo-walec.webp
    │           ├── stereo-stozek.webp
    │           ├── stereo-kula.webp
    │           ├── plani-trojkat.webp
    │           ├── plani-kolo.webp
    │           ├── plani-czworokaty.webp
    │           ├── plani-pitagoras.webp
    │           ├── algebra-skrocone.webp
    │           ├── algebra-logarytmy.webp
    │           ├── ciagi-arytmetyczny.webp
    │           └── ciagi-geometryczny.webp
    │
    └── wzory/                             # 🔵 POJEDYNCZE WZORY (instant add)
        ├── trygonometria/
        │   ├── README.md
        │   ├── funkcje-podwojnego-kata.webp   # ⏳ Do dodania
        │   ├── jedynka-trygonometryczna.webp
        │   ├── wzory-redukcyjne.webp
        │   ├── tabelka-wartosci.webp
        │   └── kolo-trygonometryczne.webp
        │
        ├── stereometria/
        │   ├── README.md
        │   └── kula-objetosc.webp         # ⏳ Do dodania
        │
        ├── planimetria/
        │   ├── README.md
        │   ├── twierdzenie-pitagorasa.webp
        │   └── twierdzenie-talesa.webp
        │
        ├── algebra/
        │   ├── README.md
        │   ├── wzory-skroconego-mnozenia.webp
        │   └── logarytmy.webp
        │
        └── ciagi/
            ├── README.md
            ├── ciag-arytmetyczny.webp
            └── ciag-geometryczny.webp
```

**Legenda:**

- ✅ Folder utworzony
- ⏳ Plik WebP do dodania (placeholder README.md istnieje)
- 🔴 Karty wzorów (czerwone w UI) - otwierają ResourceViewer
- 🔵 Pojedyncze wzory (niebieskie w UI) - instant add

### 3.2 Format Manifestu (manifest.json) - UTWORZONY!

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-12-08",
  "resources": [
    {
      "id": "mat-tryg-001",
      "title": "Wzory trygonometryczne",
      "description": "Podstawowe wzory sin, cos, tg, ctg",
      "category": "matematyka",
      "subcategory": "trygonometria",
      "tags": ["trygonometria", "sin", "cos", "tg", "ctg", "wzory", "matura"],
      "path": "/resources/matematyka/trygonometria/wzory-trygonometryczne.webp",
      "thumbnail": "/resources/matematyka/trygonometria/wzory-trygonometryczne-thumb.webp",
      "dimensions": {
        "width": 1920,
        "height": 1080,
        "aspectRatio": 1.78
      },
      "keywords": [
        "sinus",
        "cosinus",
        "tangens",
        "cotangens",
        "jedynka trygonometryczna",
        "funkcje trygonometryczne"
      ],
      "difficulty": "podstawowa",
      "source": "CKE",
      "addedAt": "2025-12-01"
    },
    {
      "id": "mat-karta-001",
      "title": "Karta wzorów - Matura podstawowa",
      "description": "Oficjalna karta wzorów CKE do matury podstawowej",
      "category": "matematyka",
      "subcategory": "karty-wzorow",
      "tags": [
        "karta wzorów",
        "matura",
        "podstawowa",
        "CKE",
        "wszystkie wzory"
      ],
      "path": "/resources/matematyka/karty-wzorow/karta-wzorow-matura-podstawowa.webp",
      "thumbnail": "/resources/matematyka/karty-wzorow/karta-wzorow-thumb.webp",
      "dimensions": {
        "width": 2480,
        "height": 3508,
        "aspectRatio": 0.707
      },
      "keywords": [
        "karta",
        "wzory",
        "matura podstawowa",
        "CKE",
        "trygonometria",
        "geometria",
        "algebra"
      ],
      "difficulty": "podstawowa",
      "source": "CKE 2024",
      "addedAt": "2025-12-01"
    },
    {
      "id": "mat-bezout-001",
      "title": "Twierdzenie Bezout",
      "description": "Twierdzenie Bezout o reszcie z dzielenia wielomianów",
      "category": "matematyka",
      "subcategory": "algebra",
      "tags": ["bezout", "wielomiany", "dzielenie", "reszta", "algebra"],
      "path": "/resources/matematyka/algebra/twierdzenie-bezout.webp",
      "thumbnail": "/resources/matematyka/algebra/twierdzenie-bezout-thumb.webp",
      "dimensions": {
        "width": 1200,
        "height": 800,
        "aspectRatio": 1.5
      },
      "keywords": [
        "bezout",
        "twierdzenie bezout",
        "wielomiany",
        "dzielenie wielomianów",
        "reszta z dzielenia"
      ],
      "difficulty": "rozszerzona",
      "source": "własne",
      "addedAt": "2025-12-01"
    }
  ],
  "categories": [
    {
      "id": "matematyka",
      "name": "Matematyka",
      "icon": "Calculator",
      "color": "bg-blue-500",
      "subcategories": [
        { "id": "trygonometria", "name": "Trygonometria" },
        { "id": "stereometria", "name": "Stereometria" },
        { "id": "planimetria", "name": "Planimetria" },
        { "id": "algebra", "name": "Algebra" },
        { "id": "karty-wzorow", "name": "Karty wzorów" },
        { "id": "arkusze-maturalne", "name": "Arkusze maturalne" }
      ]
    },
    {
      "id": "fizyka",
      "name": "Fizyka",
      "icon": "Atom",
      "color": "bg-green-500",
      "subcategories": []
    }
  ]
}
```

### 3.3 Algorytm Wyszukiwania (Fuzzy Search)

```typescript
// src/lib/resourceSearch.ts

interface Resource {
  id: string;
  title: string;
  tags: string[];
  keywords: string[];
  category: string;
  subcategory: string;
  path: string;
  dimensions: { aspectRatio: number };
}

interface SearchResult {
  resource: Resource;
  score: number;
  matchedIn: "title" | "tag" | "keyword" | "category";
}

export function searchResources(
  query: string,
  resources: Resource[]
): SearchResult[] {
  if (!query || query.length < 2) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const resource of resources) {
    let score = 0;
    let matchedIn: SearchResult["matchedIn"] = "keyword";

    // 1. Exact title match (highest priority)
    if (resource.title.toLowerCase().includes(normalizedQuery)) {
      score = 100;
      matchedIn = "title";
    }

    // 2. Tag match
    else if (
      resource.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    ) {
      score = 80;
      matchedIn = "tag";
    }

    // 3. Keyword match
    else if (
      resource.keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery))
    ) {
      score = 60;
      matchedIn = "keyword";
    }

    // 4. Category/subcategory match
    else if (
      resource.category.toLowerCase().includes(normalizedQuery) ||
      resource.subcategory.toLowerCase().includes(normalizedQuery)
    ) {
      score = 40;
      matchedIn = "category";
    }

    // 5. Fuzzy match (Levenshtein distance)
    else {
      const fuzzyScore = fuzzyMatch(
        normalizedQuery,
        resource.title.toLowerCase()
      );
      if (fuzzyScore > 0.6) {
        score = Math.round(fuzzyScore * 50);
        matchedIn = "title";
      }
    }

    if (score > 0) {
      results.push({ resource, score, matchedIn });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

// Simple fuzzy matching using Dice coefficient
function fuzzyMatch(str1: string, str2: string): number {
  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);

  let matches = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) matches++;
  }

  return (2 * matches) / (bigrams1.size + bigrams2.size);
}

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}
```

---

## 4. MECHANIKA SELEKCJI SEKCJI

### 4.1 Jak Definiować Sekcje w Manifeście

Każdy zasób z sekcjami (np. karta wzorów) ma zdefiniowane obszary do zaznaczania:

```json
{
  "id": "mat-karta-001",
  "title": "Karta wzorów - Matura podstawowa",
  "type": "sectioned", // 🆕 Nowy typ - z sekcjami!
  "path": "/resources/matematyka/karty-wzorow/karta-wzorow-podstawowa.webp",
  "dimensions": {
    "width": 2480,
    "height": 3508
  },
  "sections": [
    {
      "id": "tryg",
      "name": "Trygonometria",
      "description": "Funkcje trygonometryczne, jedynka, wzory redukcyjne",
      "crop": {
        "x": 50, // px od lewej
        "y": 100, // px od góry
        "width": 1180, // szerokość sekcji
        "height": 400 // wysokość sekcji
      },
      "tags": ["sin", "cos", "tg", "ctg", "trygonometria"]
    },
    {
      "id": "stereo",
      "name": "Stereometria",
      "description": "Wzory na objętości i pola powierzchni brył",
      "crop": {
        "x": 1250,
        "y": 100,
        "width": 1180,
        "height": 600
      },
      "tags": ["objętość", "bryła", "stożek", "walec", "kula"]
    },
    {
      "id": "plani",
      "name": "Planimetria",
      "description": "Wzory na pola figur płaskich",
      "crop": {
        "x": 50,
        "y": 520,
        "width": 1180,
        "height": 500
      },
      "tags": ["pole", "obwód", "trójkąt", "koło", "prostokąt"]
    },
    {
      "id": "algebra",
      "name": "Algebra",
      "description": "Wzory skróconego mnożenia, logarytmy",
      "crop": {
        "x": 1250,
        "y": 720,
        "width": 1180,
        "height": 400
      },
      "tags": ["wzory skróconego mnożenia", "logarytm", "potęga"]
    }
  ]
}
```

### 4.2 Typy Zasobów

```typescript
// src/types/resources.ts

// Prosty zasób (całe zdjęcie)
export interface SimpleResource {
  id: string;
  type: "simple";
  title: string;
  category: string;
  subcategory: string;
  tags: string[];
  keywords: string[];
  path: string;
  thumbnail?: string;
  dimensions: {
    width: number;
    height: number;
    aspectRatio: number;
  };
}

// Zasób z sekcjami (np. karta wzorów)
export interface SectionedResource {
  id: string;
  type: "sectioned";
  title: string;
  category: string;
  subcategory: string;
  tags: string[];
  keywords: string[];
  path: string;
  thumbnail?: string;
  dimensions: {
    width: number;
    height: number;
  };
  sections: ResourceSection[];
}

export interface ResourceSection {
  id: string;
  name: string;
  description?: string;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tags: string[];
}

export type Resource = SimpleResource | SectionedResource;

// Wynik wyszukiwania
export interface SearchResult {
  resource: Resource;
  score: number;
  matchedIn: "title" | "tag" | "keyword" | "category" | "section";
  matchedSection?: ResourceSection; // Jeśli match w sekcji
}
```

### 4.3 Komponent ResourceViewer

```typescript
// src/app/tablica/components/ResourceViewer.tsx

"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Check, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { SectionedResource, ResourceSection } from "@/types/resources";

interface ResourceViewerProps {
  resource: SectionedResource;
  onAccept: (selectedSections: ResourceSection[]) => void;
  onCancel: () => void;
}

export function ResourceViewer({
  resource,
  onAccept,
  onCancel,
}: ResourceViewerProps) {
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set()
  );
  const [zoom, setZoom] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleAccept = () => {
    const sections = resource.sections.filter((s) =>
      selectedSections.has(s.id)
    );
    onAccept(sections);
  };

  // Oblicz skalę dla overlay sekcji
  const getOverlayStyle = (section: ResourceSection) => {
    const scaleX = 100 / resource.dimensions.width;
    const scaleY = 100 / resource.dimensions.height;

    return {
      left: `${section.crop.x * scaleX}%`,
      top: `${section.crop.y * scaleY}%`,
      width: `${section.crop.width * scaleX}%`,
      height: `${section.crop.height * scaleY}%`,
    };
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{resource.title}</h2>
            <p className="text-sm text-gray-500">
              Kliknij ➕ aby zaznaczyć sekcje do wstawienia
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-500 w-16 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg ml-4"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Image with Sections */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-4 bg-gray-100"
        >
          <div
            className="relative mx-auto"
            style={{
              width: `${resource.dimensions.width * zoom * 0.3}px`,
              maxWidth: "100%",
            }}
          >
            {/* Main Image */}
            <img
              src={resource.path}
              alt={resource.title}
              onLoad={() => setImageLoaded(true)}
              className="w-full h-auto"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
            />

            {/* Section Overlays */}
            {imageLoaded &&
              resource.sections.map((section) => (
                <div
                  key={section.id}
                  className={`
                  absolute border-2 rounded-lg cursor-pointer transition-all
                  ${
                    selectedSections.has(section.id)
                      ? "border-green-500 bg-green-500/20"
                      : "border-blue-400/50 bg-blue-400/10 hover:bg-blue-400/20"
                  }
                `}
                  style={getOverlayStyle(section)}
                  onClick={() => toggleSection(section.id)}
                >
                  {/* Section Label */}
                  <div
                    className={`
                  absolute -top-8 left-0 px-2 py-1 rounded text-xs font-medium
                  ${
                    selectedSections.has(section.id)
                      ? "bg-green-500 text-white"
                      : "bg-blue-500 text-white"
                  }
                `}
                  >
                    {section.name}
                  </div>

                  {/* Plus/Check Button */}
                  <button
                    className={`
                    absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center
                    ${
                      selectedSections.has(section.id)
                        ? "bg-green-500 text-white"
                        : "bg-white text-gray-700 shadow-md hover:bg-gray-50"
                    }
                  `}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection(section.id);
                    }}
                  >
                    {selectedSections.has(section.id) ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Zaznaczono: <strong>{selectedSections.size}</strong>
            {selectedSections.size === 1 ? " sekcja" : " sekcji"}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Anuluj
            </button>
            <button
              onClick={handleAccept}
              disabled={selectedSections.size === 0}
              className={`
                px-6 py-2 rounded-lg font-medium flex items-center gap-2
                ${
                  selectedSections.size > 0
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              <Check className="w-4 h-4" />
              Akceptuj
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4.4 Funkcja Cropowania Sekcji

```typescript
// src/lib/cropImage.ts

/**
 * Przycina obraz do wybranej sekcji używając Canvas API
 * Zwraca base64 data URL przyciętego fragmentu
 */
export async function cropImageSection(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Ważne dla CORS!

    img.onload = () => {
      // Stwórz canvas o rozmiarze sekcji
      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Cannot get canvas context"));
        return;
      }

      // Rysuj przycięty fragment
      ctx.drawImage(
        img,
        crop.x,
        crop.y, // Źródło: skąd zacząć
        crop.width,
        crop.height, // Źródło: ile wyciąć
        0,
        0, // Cel: gdzie narysować
        crop.width,
        crop.height // Cel: w jakim rozmiarze
      );

      // Konwertuj do WebP (mniejszy rozmiar!)
      const dataUrl = canvas.toDataURL("image/webp", 0.9);
      resolve(dataUrl);
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
}

/**
 * Przetwarza zaznaczone sekcje i zwraca gotowe ImageElements
 */
export async function processSelectedSections(
  resource: SectionedResource,
  selectedSections: ResourceSection[],
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): Promise<ImageElement[]> {
  const images: ImageElement[] = [];

  // Oblicz pozycję startową (centrum viewport)
  const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
  const centerWorld = inverseTransformPoint(
    centerScreen,
    viewport,
    canvasWidth,
    canvasHeight
  );

  // Rozmieść sekcje obok siebie
  let currentX = centerWorld.x - (selectedSections.length * 2) / 2; // Centruj

  for (const section of selectedSections) {
    // Cropuj sekcję
    const croppedData = await cropImageSection(resource.path, section.crop);

    // Oblicz proporcje
    const aspectRatio = section.crop.height / section.crop.width;
    const worldWidth = 3; // Stała szerokość w world units
    const worldHeight = worldWidth * aspectRatio;

    images.push({
      id: `${Date.now()}-${section.id}`,
      type: "image",
      x: currentX,
      y: centerWorld.y - worldHeight / 2,
      width: worldWidth,
      height: worldHeight,
      src: croppedData,
      alt: `${resource.title} - ${section.name}`,
    });

    // Przesuń X dla następnej sekcji (z odstępem)
    currentX += worldWidth + 0.5;
  }

  return images;
}
```

### 4.5 Czy Trzeba Modyfikować Canvas?

**❌ NIE!** Istniejący `ImageElement` w pełni wystarczy!

| Potrzeba                | Rozwiązanie                          | Status    |
| ----------------------- | ------------------------------------ | --------- |
| Renderowanie obrazu     | `drawImage()` w rendering.ts         | ✅ Gotowe |
| Przesuwanie/skalowanie  | `SelectTool` + `handleElementUpdate` | ✅ Gotowe |
| Synchronizacja realtime | `broadcastElementCreated`            | ✅ Gotowe |
| Zapisywanie do bazy     | `saveBoardElementsBatch`             | ✅ Gotowe |
| Historia undo/redo      | `saveToHistory`                      | ✅ Gotowe |

**Jedyna zmiana w WhiteboardCanvas:** Obsługa nowego narzędzia `search` w Tool type.

### 4.6 Alternatywa: Całe Zdjęcie bez Cropowania

Jeśli chcesz prostsze rozwiązanie (bez cropowania):

```typescript
// Zamiast cropować, wstaw całe zdjęcie z URL do sekcji
const newImage: ImageElement = {
  id: Date.now().toString(),
  type: "image",
  x: centerWorld.x,
  y: centerWorld.y,
  width: 5, // Większy rozmiar
  height: 7,
  src: resource.path, // Całe zdjęcie
  alt: resource.title,
};
```

**Ale to mniej przydatne** - użytkownik musi sam scrollować po dużej karcie wzorów.

**Rekomendacja:** Implementuj cropowanie - daje lepszy UX!

---

## 5. INTEGRACJA Z CHATBOTEM GEMINI

### 5.1 Architektura ChatBot

```
ChatBot Panel (boczny panel lub modal)
      │
      ├── Chat UI (wiadomości user/bot)
      │
      ├── Gemini API Client
      │     └── Google AI SDK (@google/generative-ai)
      │
      ├── Function Calling (Tools)
      │     ├── searchResources()     → SmartSearch
      │     ├── renderResource()      → handleImageCreate
      │     └── solveEquation()       → (przyszłość)
      │
      └── Animation Controller
            └── typeInSearchBar()     → Animacja wpisywania
```

### 5.2 Gemini Function Calling

```typescript
// src/lib/gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // Darmowy tier
  tools: [
    {
      functionDeclarations: [
        {
          name: "search_and_render_resource",
          description:
            "Wyszukuje i renderuje zasób edukacyjny na tablicy (karta wzorów, twierdzenie, wykres)",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  'Fraza do wyszukania (np. "karta wzorów", "twierdzenie Pitagorasa")',
              },
              animate: {
                type: "boolean",
                description:
                  "Czy animować wpisywanie w search bar (domyślnie true)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "explain_concept",
          description: "Wyjaśnia pojęcie matematyczne/fizyczne",
          parameters: {
            type: "object",
            properties: {
              concept: {
                type: "string",
                description: "Pojęcie do wyjaśnienia",
              },
            },
            required: ["concept"],
          },
        },
      ],
    },
  ],
});

// Obsługa Function Calling
export async function processGeminiResponse(
  response: any,
  handlers: {
    onSearchAndRender: (query: string, animate: boolean) => Promise<void>;
    onExplainConcept: (concept: string) => Promise<string>;
  }
) {
  const functionCall = response.functionCall;

  if (functionCall) {
    switch (functionCall.name) {
      case "search_and_render_resource":
        await handlers.onSearchAndRender(
          functionCall.args.query,
          functionCall.args.animate ?? true
        );
        return {
          type: "action",
          message: `Renderuję: ${functionCall.args.query}`,
        };

      case "explain_concept":
        const explanation = await handlers.onExplainConcept(
          functionCall.args.concept
        );
        return { type: "text", message: explanation };

      default:
        return { type: "error", message: "Nieznana funkcja" };
    }
  }

  return { type: "text", message: response.text() };
}
```

### 5.3 Animacja Wpisywania (TypeWriter Effect)

```typescript
// src/components/SmartSearchAnimator.ts

export async function animateTypeInSearchBar(
  text: string,
  searchInputRef: React.RefObject<HTMLInputElement>,
  onComplete: () => void
): Promise<void> {
  const input = searchInputRef.current;
  if (!input) return;

  // Focus search bar
  input.focus();

  // Clear existing text
  input.value = "";

  // Type character by character
  for (let i = 0; i < text.length; i++) {
    input.value = text.substring(0, i + 1);

    // Dispatch input event to trigger autocomplete
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Random delay for natural typing feel
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 100)
    );
  }

  // Short pause before selecting
  await new Promise((resolve) => setTimeout(resolve, 300));

  onComplete();
}
```

### 5.4 Przykładowa Konwersacja z Selekcją Sekcji

```
User: "Potrzebuję wzorów trygonometrycznych i stereometrycznych"

ChatBot:
  1. Rozpoznaje: potrzebne 2 sekcje z karty wzorów
  2. Wywołuje function: search_and_render_sections({
       query: "karta wzorów matura",
       sections: ["trygonometria", "stereometria"],
       animate: true
     })
  3. Otwiera SmartSearch → wpisuje "karta wzorów"
  4. Otwiera ResourceViewer
  5. Automatycznie zaznacza sekcje "Trygonometria" i "Stereometria"
  6. Klika "Akceptuj"
  7. Dwie sekcje renderują się na tablicy obok siebie
  8. Odpowiada: "Wrzuciłem wzory trygonometryczne i stereometryczne! 📐"

User: "A potrzebuję jeszcze twierdzenie Bezout"

ChatBot:
  1. Wyszukuje zasób "Bezout" (simple resource, nie sectioned)
  2. Wywołuje: search_and_render_resource({ query: "bezout" })
  3. Od razu wstawia całe zdjęcie na tablicę
  4. Odpowiada: "Dodałem twierdzenie Bezout! 📝"
```

### 5.5 Rozszerzone Function Calling dla Sekcji

```typescript
// Rozszerzony tool dla ChatBot
{
  name: 'search_and_render_sections',
  description: 'Wyszukuje kartę wzorów i renderuje wybrane sekcje na tablicy',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Fraza do wyszukania karty wzorów'
      },
      sections: {
        type: 'array',
        items: { type: 'string' },
        description: 'Lista nazw sekcji do zaznaczenia (np. ["trygonometria", "algebra"])'
      },
      animate: {
        type: 'boolean',
        description: 'Czy animować wpisywanie (domyślnie true)'
      }
    },
    required: ['query', 'sections']
  }
}
```

---

## 6. PLIKI DO MODYFIKACJI

### 6.1 NOWE PLIKI (do utworzenia)

| Plik                                              | Opis                                     |
| ------------------------------------------------- | ---------------------------------------- |
| `public/resources/manifest.json`                  | Manifest zasobów z sekcjami              |
| `public/resources/matematyka/karty-wzorow/*.webp` | Obrazy kart wzorów                       |
| `src/types/resources.ts`                          | Typy (Resource, SectionedResource, etc.) |
| `src/lib/resourceSearch.ts`                       | Algorytm wyszukiwania (fuzzy)            |
| `src/lib/cropImage.ts`                            | 🆕 Funkcje cropowania sekcji             |
| `src/lib/gemini.ts`                               | Klient Gemini API                        |
| `src/hooks/useResources.ts`                       | Hook do ładowania manifestu              |
| `src/app/tablica/toolbar/SmartSearchTool.tsx`     | Główny komponent SmartSearch             |
| `src/app/tablica/components/SearchModal.tsx`      | Modal wyszukiwarki                       |
| `src/app/tablica/components/ResourceViewer.tsx`   | 🆕 Podgląd z selekcją sekcji             |
| `src/app/tablica/components/ChatBotPanel.tsx`     | Panel ChatBot                            |

### 6.2 PLIKI DO MODYFIKACJI

| Plik                                              | Zmiany                                    |
| ------------------------------------------------- | ----------------------------------------- |
| `src/app/tablica/toolbar/Toolbar.tsx`             | Dodać `'search'` do `Tool` type           |
| `src/app/tablica/toolbar/ToolbarUI.tsx`           | Dodać przycisk SmartSearch (ikona Search) |
| `src/app/tablica/whiteboard/WhiteboardCanvas.tsx` | Obsługa tool='search', state dla modali   |
| `src/app/tablica/page.tsx`                        | ChatBot panel (opcjonalnie)               |
| `package.json`                                    | Dodać `@google/generative-ai`             |
| `.env.local`                                      | `NEXT_PUBLIC_GEMINI_API_KEY`              |

### 6.3 Struktura Zmian w Toolbar.tsx

```typescript
// BYŁO:
export type Tool =
  | "select"
  | "pan"
  | "pen"
  | "text"
  | "shape"
  | "function"
  | "image"
  | "eraser";

// BĘDZIE:
export type Tool =
  | "select"
  | "pan"
  | "pen"
  | "text"
  | "shape"
  | "function"
  | "image"
  | "eraser"
  | "search";
```

### 6.4 Zaktualizowany SmartSearchTool.tsx

```typescript
// src/app/tablica/toolbar/SmartSearchTool.tsx

"use client";

import React, { useState, useRef, useCallback } from "react";
import { ViewportTransform, ImageElement } from "../whiteboard/types";
import {
  Resource,
  SectionedResource,
  ResourceSection,
} from "@/types/resources";
import { SearchModal } from "../components/SearchModal";
import { ResourceViewer } from "../components/ResourceViewer";
import { processSelectedSections } from "@/lib/cropImage";
import { inverseTransformPoint } from "../whiteboard/viewport";

export interface SmartSearchToolRef {
  openSearch: () => void;
  typeAndSearch: (query: string) => Promise<void>;
  selectSections: (sectionNames: string[]) => Promise<void>;
}

interface SmartSearchToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onImageCreate: (image: ImageElement) => void;
  onClose: () => void;
}

type ViewState = "search" | "viewer" | "closed";

export const SmartSearchTool = React.forwardRef<
  SmartSearchToolRef,
  SmartSearchToolProps
>(({ viewport, canvasWidth, canvasHeight, onImageCreate, onClose }, ref) => {
  const [viewState, setViewState] = useState<ViewState>("search");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(
    null
  );

  // Gdy user wybierze zasób z wyszukiwarki
  const handleResourceSelect = useCallback(
    (resource: Resource) => {
      if (resource.type === "sectioned") {
        // Otwórz ResourceViewer dla zasobów z sekcjami
        setSelectedResource(resource);
        setViewState("viewer");
      } else {
        // Dla prostych zasobów - od razu wstaw
        const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
        const centerWorld = inverseTransformPoint(
          centerScreen,
          viewport,
          canvasWidth,
          canvasHeight
        );

        const aspectRatio =
          resource.dimensions.height / resource.dimensions.width;
        const worldWidth = 4;
        const worldHeight = worldWidth * aspectRatio;

        onImageCreate({
          id: Date.now().toString(),
          type: "image",
          x: centerWorld.x - worldWidth / 2,
          y: centerWorld.y - worldHeight / 2,
          width: worldWidth,
          height: worldHeight,
          src: resource.path,
          alt: resource.title,
        });

        onClose();
      }
    },
    [viewport, canvasWidth, canvasHeight, onImageCreate, onClose]
  );

  // Gdy user zaakceptuje sekcje w ResourceViewer
  const handleSectionsAccept = useCallback(
    async (sections: ResourceSection[]) => {
      if (!selectedResource || selectedResource.type !== "sectioned") return;

      // Przetwórz sekcje (crop + stwórz ImageElements)
      const images = await processSelectedSections(
        selectedResource,
        sections,
        viewport,
        canvasWidth,
        canvasHeight
      );

      // Wstaw wszystkie obrazy
      images.forEach((image) => onImageCreate(image));

      onClose();
    },
    [
      selectedResource,
      viewport,
      canvasWidth,
      canvasHeight,
      onImageCreate,
      onClose,
    ]
  );

  // Expose methods for ChatBot
  React.useImperativeHandle(ref, () => ({
    openSearch: () => setViewState("search"),
    typeAndSearch: async (query: string) => {
      // Implementacja animacji wpisywania...
    },
    selectSections: async (sectionNames: string[]) => {
      // Automatyczne zaznaczanie sekcji dla ChatBot...
    },
  }));

  if (viewState === "closed") return null;

  return (
    <>
      {viewState === "search" && (
        <SearchModal onSelect={handleResourceSelect} onClose={onClose} />
      )}

      {viewState === "viewer" && selectedResource?.type === "sectioned" && (
        <ResourceViewer
          resource={selectedResource}
          onAccept={handleSectionsAccept}
          onCancel={() => setViewState("search")}
        />
      )}
    </>
  );
});

SmartSearchTool.displayName = "SmartSearchTool";
```

---

## 7. IMPLEMENTACJA KROK PO KROKU

### FAZA 1: Podstawowy SmartSearch z Sekcjami (MVP)

**Czas: ~6-8h**

| #   | Zadanie                            | Opis                                                  |
| --- | ---------------------------------- | ----------------------------------------------------- |
| 1   | Struktura folderów                 | Utworzyć `/public/resources/matematyka/karty-wzorow/` |
| 2   | Przygotować obrazy                 | Karta wzorów w WebP (2480x3508px, ~300KB)             |
| 3   | `manifest.json`                    | Z definicją sekcji (crop coordinates)                 |
| 4   | `src/types/resources.ts`           | Typy Resource, SectionedResource, ResourceSection     |
| 5   | `src/lib/resourceSearch.ts`        | Algorytm wyszukiwania (fuzzy match)                   |
| 6   | `src/lib/cropImage.ts`             | Funkcje cropowania sekcji (Canvas API)                |
| 7   | `src/hooks/useResources.ts`        | Hook ładujący manifest                                |
| 8   | `SearchModal.tsx`                  | Modal wyszukiwarki z autocomplete                     |
| 9   | `ResourceViewer.tsx`               | Podgląd z selekcją sekcji (➕ buttons)                |
| 10  | `SmartSearchTool.tsx`              | Główny komponent łączący wszystko                     |
| 11  | Modyfikacja `Toolbar.tsx`          | Dodać 'search' do Tool type                           |
| 12  | Modyfikacja `ToolbarUI.tsx`        | Dodać przycisk Search                                 |
| 13  | Modyfikacja `WhiteboardCanvas.tsx` | Obsługa tool='search'                                 |
| 14  | Testowanie!                        | E2E flow: search → select → crop → render             |

### FAZA 2: Rozbudowa Zasobów

**Czas: ~4-6h (+ zbieranie materiałów)**

| #   | Zadanie                                                |
| --- | ------------------------------------------------------ |
| 1   | Dodać więcej kart wzorów (rozszerzona, fizyka)         |
| 2   | Dodać pojedyncze twierdzenia (Bezout, Pitagoras, etc.) |
| 3   | Zmapować wszystkie sekcje (crop coordinates)           |
| 4   | Wygenerować miniatury (thumbnail)                      |
| 5   | Optymalizować obrazy (WebP compression)                |
| 6   | Dodać więcej kategorii/tagów                           |

### FAZA 3: ChatBot Gemini

**Czas: ~8-10h**

| #   | Zadanie                                         |
| --- | ----------------------------------------------- |
| 1   | `npm install @google/generative-ai`             |
| 2   | Skonfigurować API key w `.env.local`            |
| 3   | Utworzyć `src/lib/gemini.ts` z function calling |
| 4   | Utworzyć `ChatBotPanel.tsx` (UI czatu)          |
| 5   | Zintegrować z SmartSearch (ref methods)         |
| 6   | Implementować animacje (typewriter)             |
| 7   | Testować różne scenariusze konwersacji          |
| 8   | Dodać obsługę `search_and_render_sections`      |

### FAZA 4: Polish & UX

**Czas: ~4-6h**

| #   | Zadanie                                            |
| --- | -------------------------------------------------- |
| 1   | Keyboard shortcuts (Ctrl+K dla search, Esc zamyka) |
| 2   | Animacje (slide-in, fade, selection highlight)     |
| 3   | Loading states (skeleton, spinner)                 |
| 4   | Error handling (toast notifications)               |
| 5   | Mobile responsive                                  |
| 6   | Accessibility (focus trap, aria labels)            |

---

## 8. SYNCHRONIZACJA REALTIME

### 8.1 Jak SmartSearch Współpracuje z Realtime

**Kluczowa obserwacja:** SmartSearch używa `handleImageCreate()` który już:

1. Dodaje element do `elements[]`
2. Wywołuje `broadcastElementCreated(image)` → Supabase Broadcast
3. Planuje `debouncedSave()` → Zapis do PostgreSQL

**Więc:**

- ✅ User A wrzuca kartę wzorów przez SmartSearch
- ✅ User B od razu ją widzi (Supabase Realtime)
- ✅ Po 2s zapisuje się do bazy
- ✅ User C wchodzi później → ładuje z bazy

### 8.2 Diagram Przepływu

```
┌─────────────────────────────────────────────────────────────┐
│                        USER A                                │
├─────────────────────────────────────────────────────────────┤
│  1. Klik SmartSearch                                         │
│  2. Wpisuje "karta wzorów"                                   │
│  3. Wybiera zasób                                            │
│  4. Przegląda sekcje w ResourceViewer                        │
│  5. Klikuje ➕ przy wybranych sekcjach                       │
│  6. Klikuje "Akceptuj" → cropImage dla każdej sekcji        │
│  7. handleImageCreate(croppedImage) x N                      │
│         │                                                    │
│         ├─→ setElements([...elements, ...images]) ← Lokalna │
│         ├─→ broadcastElementCreated(img) x N     ← Realtime │
│         └─→ debouncedSave()                      ← Baza (2s)│
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Supabase Broadcast
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        USER B                                │
├─────────────────────────────────────────────────────────────┤
│  onRemoteElementCreated((element, userId, username) => {     │
│    setElements(prev => [...prev, element]);                  │
│                                                              │
│    // Wyciągnięta sekcja to base64                           │
│    if (element.type === 'image') {                           │
│      const img = new Image();                                │
│      img.src = element.src; // 'data:image/webp;base64,...'  │
│      img.onload = () => setLoadedImages(...);                │
│    }                                                         │
│  })                                                          │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 URL vs Base64 dla Sekcji

**Dla pełnego zasobu (bez selekcji sekcji):**

```typescript
src: "/resources/matematyka/karta-wzorow.webp"; // ✅ URL - mały rozmiar!
```

**Dla wyciętej sekcji (cropped):**

```typescript
src: "data:image/webp;base64,UklGRlQ..."; // Base64 - nieuniknione po cropie
```

**Optymalizacja dla przyszłości:**
Można by zapisywać wycięte sekcje na serwerze i zwracać URL, ale dla MVP base64 jest OK ponieważ:

- Sekcje są małe (tylko fragment obrazu)
- WebP compression daje ~50-100KB per sekcja
- Broadcast nadal szybki

---

## 📌 PODSUMOWANIE

### Co Mamy Gotowe:

- ✅ `ImageElement` type z pełną obsługą
- ✅ `handleImageCreate()` z realtime + save
- ✅ `drawImage()` renderowanie na canvas
- ✅ `BoardRealtimeContext` synchronizacja
- ✅ Backend API dla elementów

### Co Trzeba Zbudować:

| Plik                                             | Opis                                              |
| ------------------------------------------------ | ------------------------------------------------- |
| `src/types/resources.ts`                         | Typy Resource, SectionedResource, ResourceSection |
| `src/lib/resourceSearch.ts`                      | Algorytm fuzzy search                             |
| `src/lib/cropImage.ts`                           | 🆕 Canvas API cropowanie sekcji                   |
| `src/hooks/useResources.ts`                      | Hook ładujący manifest                            |
| `src/components/SearchModal.tsx`                 | Modal wyszukiwania                                |
| `src/components/ResourceViewer.tsx`              | 🆕 Podgląd z selekcją sekcji                      |
| `src/app/tablica/whiteboard/SmartSearchTool.tsx` | Główny komponent                                  |
| `/public/resources/manifest.json`                | Manifest zasobów z sekcjami                       |

### Modyfikacje:

| Plik                   | Zmiana                        |
| ---------------------- | ----------------------------- |
| `Toolbar.tsx`          | Dodać `'search'` do Tool type |
| `ToolbarUI.tsx`        | Dodać przycisk SmartSearch    |
| `WhiteboardCanvas.tsx` | Obsługa `tool='search'` + ref |

### Nowy UX Flow:

```
Search → Wybierz zasób → 📄 ResourceViewer otwiera się
    → Scroll przez zawartość
    → Klikaj ➕ przy sekcjach które chcesz (zielone podświetlenie)
    → Klik "Akceptuj" → Sekcje cropowane i wstawiane na canvas
```

### Priorytet:

1. 🔥 **FAZA 1** - SmartSearch z selekcją sekcji (MVP) ~6-8h
2. 🔶 **FAZA 2** - Więcej zasobów ~4-6h
3. 🔷 **FAZA 3** - ChatBot Gemini ~8-10h
4. ⬜ **FAZA 4** - Polish & UX ~4-6h

---

_Dokument utworzony: 2025-12-08_
_Ostatnia aktualizacja: 2025-12-08 (dodano selekcję sekcji)_
_Autor: GitHub Copilot (Claude Opus 4.5)_
