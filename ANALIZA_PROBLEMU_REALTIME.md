# 🔍 GŁĘBOKA ANALIZA PROBLEMU REALTIME

## 📊 OPIS PROBLEMU

**Zgłoszenie użytkownika:**

> "u jednego uzytkownika (A) jest dobrze, to u drugiego (B) jest takie jakby cala tablica sie odswiezala wiele razy na sekunde"

## 🐛 GŁÓWNA PRZYCZYNA

### 1. **BRAK THROTTLINGU NA BROADCAST UPDATE**

**Lokalizacja:** `BoardRealtimeContext.tsx` (linie 500-520)

```typescript
const broadcastElementUpdated = useCallback(
  async (element: DrawingElement) => {
    if (!channelRef.current || !user) return;

    await channelRef.current.send({
      type: "broadcast",
      event: "element-updated",
      payload: {
        element,
        userId: user.id,
        username: user.username,
      },
    });
  },
  [user],
);
```

**Problem:** Brak throttlingu - każde wywołanie natychmiast wysyła event!

### 2. **CZĘSTE WYWOŁYWANIE PODCZAS RYSOWANIA**

**Scenariusz:** Użytkownik A rysuje pędzlem (pen tool):

1. Ruch myszy co ~16ms (60 FPS)
2. Każdy ruch dodaje punkt do ścieżki
3. **BRAK visible** wywołania `broadcastElementUpdated` podczas rysowania ścieżki
4. ALE: Po zakończeniu rysowania (mouseup) wywoływane jest `broadcastElementCreated`

**Sprawdzę PenTool:**

Problem może być w `SelectTool` gdy użytkownik A **przesuwa/zmienia rozmiar** elementu!

### 3. **SELECT TOOL - MAIN CULPRIT**

**Lokalizacja:** `WhiteboardCanvas.tsx` (linia 2270-2295)

```typescript
const handleElementUpdateWithHistory = useCallback(
  (id: string, updates: Partial<DrawingElement>) => {
    // ...
    // 🚨 TUTAJ: Każda zmiana (resize, move) NATYCHMIAST broadcastuje!
    if (updatedElement) {
      broadcastElementUpdated(updatedElement);
    }
    // ...
  },
  [
    userRole,
    saveToHistory,
    broadcastElementUpdated,
    boardIdState,
    debouncedSave,
  ],
);
```

**Problem:** SelectTool wywołuje `handleElementUpdateWithHistory` podczas:

- Przesuwania elementu (każdy ruch myszy = broadcast!)
- Zmiany rozmiaru (każdy piksel = broadcast!)
- Obracania (każdy stopień = broadcast!)

**Rezultat:**

- User A przesuwa element → 60 broadcasts/sekundę
- User B otrzymuje 60 updates/sekundę → **cała tablica re-renderuje się 60 razy/s**
- Browser User B nie nadąża → freezy, laggy, "odświeżanie się tablicy"

## 🔍 DODATKOWE PROBLEMY

### 4. **BRAK DEBOUNCE NA VIEWPORT BROADCAST**

`broadcastViewportChange` nie ma throttlingu - podczas pan/zoom wysyła update co ~16ms.

### 5. **BRAK DEBOUNCE NA CURSOR BROADCAST**

`broadcastCursorMove` nie ma throttlingu - wysyła pozycję kursora co ~50ms lub częściej.

### 6. **PRESENCE HEARTBEAT CO 15s**

```typescript
presenceHeartbeat = setInterval(() => trackPresence(), 15000);
```

To jest OK, ale może powodować micro-freezy jeśli synchroniczne.

## 💡 ROZWIĄZANIA

### ✅ ROZWIĄZANIE 1: THROTTLE BROADCASTS (PRIORYTET: KRYTYCZNY)

Dodaj throttling do wszystkich broadcast funkcji:

```typescript
// BoardRealtimeContext.tsx

// Ref do przechowywania ostatniego czasu broadcast
const lastBroadcastTimeRef = useRef({
  elementUpdate: 0,
  cursorMove: 0,
  viewportChange: 0,
});

const THROTTLE_MS = {
  ELEMENT_UPDATE: 100, // Max 10 updates/s podczas operacji
  CURSOR_MOVE: 50, // Max 20 pozycji kursora/s
  VIEWPORT_CHANGE: 200, // Max 5 viewport updates/s
};

const broadcastElementUpdated = useCallback(
  async (element: DrawingElement) => {
    if (!channelRef.current || !user) return;

    // 🛡️ THROTTLE: sprawdź czy minęło wystarczająco czasu
    const now = Date.now();
    if (
      now - lastBroadcastTimeRef.current.elementUpdate <
      THROTTLE_MS.ELEMENT_UPDATE
    ) {
      console.log("⏱️ Throttle: Pomijam element-updated");
      return; // Zbyt szybko - pomiń
    }

    lastBroadcastTimeRef.current.elementUpdate = now;

    await channelRef.current.send({
      type: "broadcast",
      event: "element-updated",
      payload: {
        element,
        userId: user.id,
        username: user.username,
      },
    });
  },
  [user],
);
```

### ✅ ROZWIĄZANIE 2: DEBOUNCE W SELECT TOOL

Zamiast broadcastować każdy update, debounce do końca operacji:

```typescript
// WhiteboardCanvas.tsx

const updateBroadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const handleElementUpdateWithHistory = useCallback(
  (id: string, updates: Partial<DrawingElement>) => {
    if (userRole === "viewer") return;

    let updatedElement: DrawingElement | undefined;

    setElements((prev) => {
      const newElements = prev.map((el) => {
        if (el.id === id) {
          updatedElement = { ...el, ...updates } as DrawingElement;
          return updatedElement;
        }
        return el;
      });
      saveToHistory(newElements);
      return newElements;
    });

    // 🛡️ DEBOUNCE BROADCAST: czekaj 200ms na więcej zmian
    if (updateBroadcastTimeoutRef.current) {
      clearTimeout(updateBroadcastTimeoutRef.current);
    }

    updateBroadcastTimeoutRef.current = setTimeout(() => {
      if (updatedElement) {
        broadcastElementUpdated(updatedElement);
        console.log("📡 Broadcasted update po debounce:", updatedElement.id);
      }
    }, 200); // 200ms delay - użytkownik przestał przesuwać

    // Zapisywanie (bez zmian)
    setUnsavedElements((prev) => new Set(prev).add(id));
    if (boardIdState) debouncedSave(boardIdState);
  },
  [
    userRole,
    saveToHistory,
    broadcastElementUpdated,
    boardIdState,
    debouncedSave,
  ],
);
```

### ✅ ROZWIĄZANIE 3: BATCH UPDATES

Podczas operacji batch (np. przesuwanie wielu elementów), wyślij jeden batch event:

```typescript
// Zamiast:
selectedElements.forEach((el) => broadcastElementUpdated(el));

// Użyj:
broadcastElementsBatch(selectedElements);
```

### ✅ ROZWIĄZANIE 4: OPTIMISTIC UI

User B powinien widzieć smooth animations zamiast discrete jumps:

```typescript
// WhiteboardCanvas.tsx - onRemoteElementUpdated

onRemoteElementUpdated((element, userId, username) => {
  console.log(`📥 [${username}] zaktualizował element:`, element.id);

  // 🎬 SMOOTH UPDATE: animuj zmianę zamiast skoku
  setElements((prev) =>
    prev.map((el) => {
      if (el.id === element.id) {
        // Interpolacja pozycji dla smooth movement
        // TODO: Dodać spring animation lub lerp
        return element;
      }
      return el;
    }),
  );

  setElementsWithAuthor((prev) =>
    prev.map((el) =>
      el.element_id === element.id ? { ...el, data: element } : el,
    ),
  );
});
```

### ✅ ROZWIĄZANIE 5: RAF (Request Animation Frame) THROTTLE

Zamiast time-based throttle, użyj RAF dla smooth 60 FPS:

```typescript
const rafThrottle = (callback: Function) => {
  let rafId: number | null = null;
  let lastArgs: any[] = [];

  return (...args: any[]) => {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        callback(...lastArgs);
        rafId = null;
      });
    }
  };
};

// Użycie:
const throttledBroadcast = rafThrottle(broadcastElementUpdated);
```

## 📋 PLAN IMPLEMENTACJI

### FAZA 1: QUICK FIX (5 min)

1. ✅ Dodaj prosty throttle (100ms) do `broadcastElementUpdated`
2. ✅ Dodaj throttle (50ms) do `broadcastCursorMove`
3. ✅ Test: sprawdź czy laggy UI zniknęły

### FAZA 2: DEBOUNCE (10 min)

4. ✅ Dodaj debounce (200ms) w `handleElementUpdateWithHistory`
5. ✅ Cleanup timeout w useEffect cleanup
6. ✅ Test: przesuń element, sprawdź czy broadcast wysyłany tylko na końcu

### FAZA 3: OPTIMALIZACJA (20 min)

7. ⏳ RAF throttle dla cursor i viewport
8. ⏳ Batch updates dla multi-selection operations
9. ⏳ Smooth animations dla remote updates
10. ⏳ Test performance z 5+ użytkownikami

## 🎯 OCZEKIWANE REZULTATY

**Przed:**

- 60 broadcasts/s podczas przesuwania elementu
- User B: 60 re-renders/s → laggy UI
- Network: ~60 KB/s upload (overkill)

**Po (FAZA 1):**

- 10 broadcasts/s (throttle 100ms)
- User B: 10 re-renders/s → smooth
- Network: ~10 KB/s upload

**Po (FAZA 2):**

- 1 broadcast po zakończeniu operacji (debounce 200ms)
- User B: 1 update po skończeniu ruchu
- Network: ~1-2 KB/operation

**Po (FAZA 3):**

- Smooth 60 FPS animations
- Network optimal
- Support 10+ concurrent users

## 🔬 DEBUG TIPS

### Jak zdiagnozować:

1. Otwórz 2 karty: User A i User B
2. User A: Przesuń element myszą (trzymaj i przeciągaj)
3. User B: Otwórz DevTools Console
4. Obserwuj logi `📥 [...] zaktualizował element`
5. **Problem:** Jeśli widzisz 10+ logów/sekundę = THROTTLE NEEDED

### Monitoring:

```typescript
let updateCount = 0;
let lastLogTime = Date.now();

onRemoteElementUpdated((element, userId, username) => {
  updateCount++;

  const now = Date.now();
  if (now - lastLogTime >= 1000) {
    console.log(`📊 Updates/s: ${updateCount}`);
    updateCount = 0;
    lastLogTime = now;
  }

  // ... reszta kodu
});
```

## 🚀 NASTĘPNE KROKI

1. ✅ Implementuj FAZA 1 (throttle)
2. ⏳ Test z 2 użytkownikami
3. ⏳ Implementuj FAZA 2 (debounce)
4. ⏳ Test z 5 użytkownikami
5. ⏳ Monitor performance metrics

---

**Data analizy:** 2026-01-26  
**Severity:** 🔴 KRYTYCZNY (blokuje współpracę wielu użytkowników)  
**Priorytet:** P0 (natychmiastowa interwencja)
