# Frontend Refactoring Notes

## Zasady ogólne
- Każda logika w osobnym pliku (hook, util, komponent)
- Brak wielkich "god componentów" — rozbijać na mniejsze
- Hooki odpowiadają tylko za logikę/state, komponenty tylko za UI
- Typy centralizowane w `types.ts` wewnątrz feature folderu

---

## Struktura `src/_new/`

```
_new/
  features/
    auth/         # Logowanie, rejestracja, tokeny
    board/        # Tablice: API, hooki, typy, komponenty
    whiteboard/   # Edytor tablicy (canvas, narzędzia, handlersy)
    workspace/    # Przestrzenie robocze: API, hooki, typy, komponenty
  lib/            # Utility, helpers wspódzielone
  shared/
    hooks/        # Wspólne hooki (useDebounce itp.)
    types/        # Typy wspólne (User, OnlineUser)
    ui/           # Komponenty UI (Button, Input, Modal)
```

---

## Whiteboard — layout komponentów

### Hierarchia renderowania (tablica/page.tsx → whiteboard-canvas.tsx)

```
TablicaContent (page.tsx)
 ├── WorkspaceIconStrip     ← cienki pasek WorkspaceÓW (only ikony), zawsze widoczny, z-index: 200
 ├── WhiteboardBoardSidebar ← lista tablic workspace'u, slide-in z lewej, z-index: 190
 ├── BoardHeader            ← logo, toggle sidebaru, ustawienia
 ├── BoardSettingsPanel     ← pływające ustawienia tablicy
 └── WhiteboardCanvasNew    ← główna tablica
      ├── Toolbar            ← pionowy, left-offset zależy od stanu sidebaru
      ├── ZoomControls
      ├── SelectTool, PenTool, ...
      └── ...
```

### Stałe layoutu sidebaru
- `WORKSPACE_STRIP_WIDTH = 48px`  — cienki pasek z ikonami workspace'ów (zawsze widoczny)
- `BOARD_SIDEBAR_WIDTH = 260px`   — lista tablic (wysuwa się z lewej)

### Hook: `use-whiteboard-sidebar`
Zarządza stanem sidebaru tablicy:
- `isOpen` + `isPushMode` (push = przesuwa toolbar, float = nakłada się)
- Wykrywanie hoveru na lewej krawędzi (< 8px) → float sidebar po 350ms
- Toggle przez przycisk w headerze → push mode
- `toolbarOffset` = StripWidth + (pushOpen ? SidebarWidth : 0)

---

## Dashboard — sidebar workspace'ów

`workspace-sidebar.tsx` — sidebar z listą workspace'ów użytkownika
- Używa `WorkspaceList` + CRUD modali
- Collapsible (ikony lub pełna lista)

---

## Komponenty wielokrotnego użytku (shared/ui)
- `Button` — warianty: primary, secondary, ghost
- `Input` — z leftIcon
- `confirmation-modal` — modal potwierdzenia akcji

---

## Uwagi
- Nie używamy inline resizeObserver jeśli można użyć CSS (np. `w-full h-full`)
- Supabase realtime channels — zawsze cleanup w return z useEffect
- `useRef` dla wartości które zmieniają się często ale nie triggerują re-render (boardId, isPanning)
- Tablicowe state → wolać `immer` lub functional updater zamiast mutacji
