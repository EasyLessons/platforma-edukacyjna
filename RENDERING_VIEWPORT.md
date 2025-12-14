# 📐 Rendering i Viewport - Analiza Systemu

## 🏗️ Architektura Renderowania

### Główne Pliki

| Plik                   | Funkcja                                            |
| ---------------------- | -------------------------------------------------- |
| `viewport.ts`          | Transformacje współrzędnych świat↔ekran, pan, zoom |
| `Grid.tsx`             | Rysowanie siatki kartezjańskiej                    |
| `rendering.ts`         | Rysowanie elementów (shapes, paths, text)          |
| `WhiteboardCanvas.tsx` | Główny komponent, orchestracja renderowania        |

---

## 🔄 Pipeline Renderowania (ZAKTUALIZOWANY)

```
1. User action (mouse/wheel)
   ↓
2. setViewport() - aktualizacja stanu React (używa viewportRef!)
   ↓
3. redrawCanvas() - useCallback z dependency [viewport]
   ↓
4. requestAnimationFrame() - synchronizacja z refresh rate ✅ NOWE
   ↓
5. ctx.setTransform(dpr,...) - reset transformacji ✅ NOWE
   ↓
6. ctx.clearRect() - czyszczenie canvas
   ↓
7. drawGrid() - rysowanie siatki (imageSmoothingEnabled=false)
   ↓
8. drawElement() - rysowanie każdego elementu
```

---

## ✅ NAPRAWIONE PROBLEMY (14.12.2025)

### Problem 1: Wheel useEffect z [viewport] dependency ❌→✅

**Symptom:** Event listener był re-subscribed przy każdej zmianie viewport!

**Rozwiązanie:** Używamy `viewportRef.current` i `[]` dependencies:

```typescript
useEffect(() => {
  const handleWheel = (e) => {
    const currentViewport = viewportRef.current; // ✅ ref!
    const newViewport = panViewportWithWheel(currentViewport, ...);
  };
  container.addEventListener('wheel', handleWheel);
  return () => container.removeEventListener('wheel', handleWheel);
}, []); // ✅ pusta tablica!
```

### Problem 2: Brak requestAnimationFrame ❌→✅

**Symptom:** Migotanie i "tearing" podczas szybkiego przesuwania.

**Rozwiązanie:**

```typescript
const rafIdRef = useRef<number | null>(null);

const redrawCanvas = useCallback(() => {
  if (rafIdRef.current !== null) {
    cancelAnimationFrame(rafIdRef.current);
  }
  rafIdRef.current = requestAnimationFrame(() => {
    // ... rendering
  });
}, [...]);
```

### Problem 3: ctx.scale() się kumulował ❌→✅

**Symptom:** Canvas stawał się coraz bardziej powiększony przy resize.

**Rozwiązanie:**

```typescript
ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset przed każdym rysowaniem
ctx.clearRect(0, 0, width, height);
```

### Problem 4: Float precision w Grid ❌→✅

**Symptom:** Linie siatki "skakały" - kwadraty zmieniały się w prostokąty.

**Rozwiązanie:**

```typescript
// PRZED:
if (worldX % 1 !== 0) // ❌ float precision issue

// PO:
if (Math.abs(worldX % 1) > 0.1) // ✅ tolerancja
```

---

## 📏 System Jednostek

```
1 jednostka świata = 100px przy scale=1
1 kratka = 0.5 jednostki = 50px przy scale=1
2 kratki = 1 jednostka = 100px przy scale=1
```

### Transformacja World → Screen

```typescript
const scale100 = viewport.scale * 100;
const halfWidth = width / 2;
const halfHeight = height / 2;

screenX = halfWidth + (worldX - viewport.x) * scale100;
screenY = halfHeight + (worldY - viewport.y) * scale100;
```

---

## 🔧 Viewport State

```typescript
interface ViewportTransform {
  x: number; // Pozycja środka ekranu w world coords
  y: number; // Pozycja środka ekranu w world coords
  scale: number; // Zoom level (0.2 - 5.0)
}
```

---

## 📋 Status Napraw

- [x] Batch rendering w Grid.tsx
- [x] Inline transformacje w Grid.tsx
- [x] Fix wheel useEffect - używa ref zamiast viewport
- [x] requestAnimationFrame dla płynnego renderingu
- [x] ctx.setTransform() reset przed każdym rysowaniem
- [x] Tolerancja float w Grid (Math.abs > 0.1)
- [x] Bounds checking dla linii siatki
- [x] imageSmoothingEnabled = false dla ostrych linii
