/**
 * whiteboard-canvas.tsx
 *
 * GŁÓWNY ORKIESTRATOR tablicy. Etap 6 — FINALNE SPINANIE.
 *
 * ODPOWIEDZIALNOŚĆ:
 *  - Spina razem 6 hooków: useViewport, useElements, useHistory,
 *    useClipboard, useSelection, useRealtime
 *  - Importuje i renderuje WSZYSTKIE stare narzędzia (SelectTool, PenTool,
 *    ShapeTool, TextTool, PanTool, EraserTool, FunctionTool, ImageTool,
 *    MarkdownNoteTool, TableTool, ArrowTool) — re-use as-is, podłączone do hooków
 *  - Renderuje HTML overlays dla markdown (MarkdownNoteView) i tabel (TableView)
 *  - Renderuje Toolbar, ZoomControls, OnlineUsers, RemoteCursors
 *  - Obsługuje resize canvas + pętlę renderowania (requestAnimationFrame)
 *  - Obsługuje kółko myszy (zoom + pan)
 *  - Obsługuje skróty klawiszowe (Ctrl+Z/Y, Ctrl+C/V/D, Delete, Escape, litery)
 *
 * ZMIANY vs Etap 5:
 *  - Dodano canvasWidth/canvasHeight state (potrzebne przez komponenty narzędzi)
 *  - Dodano wszystkie handler callbacks dla narzędzi
 *  - Dodano renderowanie narzędzi, overlayów MD/table, Toolbar, ZoomControls
 *  - Dodano imageToolRef (ImageTool to forwardRef)
 *  - Dodano handleFollowUser/handleStopFollowing (OnlineUsers)
 *  - Dodano clearCanvas, deleteSelectedElements, zoomIn, zoomOut
 *
 * STATUS: Etap 6 — gotowy do podmiany w page.tsx
 */

'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// ─── Nowe hooki ───────────────────────────────────────────────────────────────
import { useViewport } from '../../hooks/use-viewport';
import { useElements } from '../../hooks/use-elements';
import { useHistory } from '../../hooks/use-history';
import { useClipboard } from '../../hooks/use-clipboard';
import { useSelection } from '../../hooks/use-selection';
import { useRealtime } from '../../hooks/use-realtime';

// ─── Komponenty narzędzi (przez re-exportery _new/) ──────────────────────────
import Toolbar from '../toolbar/toolbar';
import { ZoomControls } from '../toolbar/zoom-controls';
import { TextTool } from '../toolbar/text-tool';
import { SelectTool } from '../toolbar/select-tool';
import { PenTool } from '../toolbar/pen-tool';
import { ShapeTool } from '../toolbar/shape-tool';
import { PanTool } from '../toolbar/pan-tool';
import { FunctionTool } from '../toolbar/function-tool';
import { ImageTool, ImageToolRef } from '../toolbar/image-tool';
import { EraserTool } from '../toolbar/eraser-tool';
import { MarkdownNoteTool, MarkdownNoteView } from '../toolbar/markdown-note-tool';
import { TableTool, TableView } from '../toolbar/table-tool';
import { ArrowTool } from '../toolbar/arrow-tool';
import { CalculatorTool } from '../toolbar/calculator-tool';
import { ActivityHistory } from '../toolbar/activity-history';
import { OnlineUsers } from './online-users';
import { RemoteCursorsContainer } from './remote-cursors';

// ─── Nowe komponenty UI ───────────────────────────────────────────────────────
import { LoadingOverlay } from './loading-overlay';
import { StatusIndicators } from './status-indicators';
import { SnapGuides } from './snap-guides';

// ─── SmartSearch ─────────────────────────────────────────────────────────────
import { SmartSearchBar, CardViewer } from '@/_new/features/whiteboard/components/smartsearch';
import type { FormulaResource, CardResource } from '@/_new/features/whiteboard/components/smartsearch';

// ─── MathChatbot ─────────────────────────────────────────────────────────────
import { MathChatbot } from '@/_new/features/whiteboard/components/toolbar/math-chatbot';

// ─── Renderowanie canvas ──────────────────────────────────────────────────────
import { drawElement } from '../../elements/rendering';
import { drawGrid } from './grid';

// ─── Matematyka viewportu ─────────────────────────────────────────────────────
import {
  constrainViewport,
  zoomViewport,
  panViewportWithWheel,
  panViewportWithMouse,
  transformPoint,
  inverseTransformPoint,
} from '../../navigation/viewport-math';

// ─── Typy ─────────────────────────────────────────────────────────────────────
import type {
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ImageElement,
  MarkdownNote,
  TableElement,
  ArrowElement,
  ViewportTransform,
} from '../../types';
import type { Tool, ShapeType } from '../../types';
import type { GuideLine } from '../../selection/snap-utils';
import type { BoardSettings } from '@/_new/features/board/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WhiteboardCanvasNewProps {
  /** ID tablicy (liczba jako string, z URL params) */
  boardId: string;
  /** Ścieżka do folderu z arkuszem PDF do wczytania jako tło — opcjonalne */
  arkuszPath?: string | null;
  /** Rola użytkownika — viewer dostaje tylko 'pan' */
  userRole?: 'owner' | 'editor' | 'viewer';
  /** Ustawienia tablicy z backendu (JSONB) */
  boardSettings?: BoardSettings;
  className?: string;
}

// ─── Komponent ────────────────────────────────────────────────────────────────

const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  ai_enabled: true,
  grid_visible: true,
  smartsearch_visible: true,
  toolbar_visible: true,
};

export default function WhiteboardCanvasNew({
  boardId,
  arkuszPath: _arkuszPath,
  userRole = 'editor',
  boardSettings: boardSettingsProp,
  className = '',
}: WhiteboardCanvasNewProps) {

  // Zmerguj props z domyślnymi — używamy ref żeby nie powiązać przez state
  const settings = boardSettingsProp ?? DEFAULT_BOARD_SETTINGS;
  // Ref do settings — unika stale closure w useCallback renderowania
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  // ─── Refs do DOM ────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Stabilna referencja do boardId — bezpieczna w event handlerach */
  const boardIdRef = useRef<string>(boardId);
  /** Ref do ImageTool (forwardRef — potrzebny do triggerFileUpload / handlePasteFromClipboard) */
  const imageToolRef = useRef<ImageToolRef>(null);
  /** Ref do wrappera wszystkich HTML overlaysów (SelectTool, Markdown, Table) — ukrywany podczas pan by uniknąć lag pozycjonowania */
  const htmlOverlaysRef = useRef<HTMLDivElement>(null);
  /** Ref do wrappera Markdown + Table overlayów — ukrywany podczas pan razem z htmlOverlaysRef */
  const mdTableOverlaysRef = useRef<HTMLDivElement>(null);
  /** Ref do RemoteCursors — ukrywany podczas pan (viewport stale → złe pozycje ekranowe) */
  const remoteCursorsRef = useRef<HTMLDivElement>(null);
  /** Czy trwa aktywny pan gestem (PanTool lub wheel) — pomija setViewport w hot-path */
  const isPanningRef = useRef(false);
  /** Debounced timer do przywrócenia overlayów po zakończeniu viewport scrollu/pana */
  const viewportChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    boardIdRef.current = boardId;
  }, [boardId]);

  // ─── Stan paska narzędzi ────────────────────────────────────────────────────
  const [tool, setTool] = useState<Tool>('select');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const [polygonSides, setPolygonSides] = useState(5);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(4);
  const [fontSize, setFontSize] = useState(70);
  const [fillShape, setFillShape] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // ─── Stan SmartSearch ───────────────────────────────────────────────────────
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isCardViewerActive, setIsCardViewerActive] = useState(false);
  const [activeCard, setActiveCard] = useState<CardResource | null>(null);
  const [windowWidth, setWindowWidth] = useState(0);

  // ─── Stan MathChatbot ───────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }>
  >([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Cześć! 👋 Jestem **Math Tutor**!\n\nMogę Ci pomóc z:\n• 📐 Rozwiązywaniem zadań\n• 💡 Podpowiedziami  \n• ✅ Sprawdzaniem rozwiązań\n• 📚 Wyjaśnianiem wzorów\n\nZadaj pytanie! 🤔`,
      timestamp: new Date(),
    },
  ]);

  /** Aktywne linie snap — aktualizuje SelectTool podczas przeciągania */
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);

  /**
   * Wymiary canvasa w CSS-px — potrzebne przez wszystkie komponenty narzędzi.
   * Inicjalizowane na 0, aktualizowane przez ResizeObserver w effekcie resize.
   * Narzędzia renderują się dopiero gdy > 0 (guard: `canvasWidth > 0`).
   */
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  // Viewer = tylko pan (nie może rysować)
  useEffect(() => {
    if (userRole === 'viewer') setTool('pan');
  }, [userRole]);

  // ─── windowWidth dla responsywnego pozycjonowania SmartSearch ──────────────
  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── Broadcast refs — rozwiązanie problemu "kółkowej zależności" ────────────
  // hist potrzebuje rt.broadcastElementCreated, ale rt inicjalizujemy po hist.
  // Rozwiązanie: ref do funkcji broadcastu, wypełniany po inicjalizacji rt.
  const broadcastCreatedRef = useRef<(el: DrawingElement) => Promise<void>>(
    async () => {}
  );
  const broadcastDeletedRef = useRef<(id: string) => Promise<void>>(
    async () => {}
  );

  // ─── HOOK: viewport ─────────────────────────────────────────────────────────
  const vp = useViewport();

  // ─── HOOK: elements ─────────────────────────────────────────────────────────
  const el = useElements({ boardId });

  // ─── HOOK: selection ────────────────────────────────────────────────────────
  const sel = useSelection();

  // ─── HOOK: history ──────────────────────────────────────────────────────────
  const hist = useHistory({
    onDeleteElement: (boardIdNum, elementId) =>
      el.deleteElementDirectly(boardIdNum, elementId),
    onSaveElement: (boardIdNum, element) =>
      el.saveElementDirectly(boardIdNum, element),
    // Używamy ref żeby nie tworzyć pętli zależności z rt
    onBroadcastCreated: (element) => broadcastCreatedRef.current(element),
    onBroadcastDeleted: (elementId) => broadcastDeletedRef.current(elementId),
    onRemoveElement: (elementId) => el.removeElement(elementId),
    onAddElement: (element) => el.addElements([element]),
    onClearSelection: sel.clearSelection,
    unsavedElementsRef: el.unsavedElementsRef,
    boardIdRef,
  });

  // ─── HOOK: realtime ─────────────────────────────────────────────────────────
  const rt = useRealtime({
    onRemoteElementAdded: (element) => {
      el.addElements([element]);
    },
    onRemoteElementUpdated: (element) => {
      el.updateElement(element);
    },
    onRemoteElementDeleted: (elementId) => {
      el.removeElement(elementId);
    },
    onLoadRemoteImage: el.loadImage,
    onRemoteViewport: vp.applyRemoteViewport,
  });

  // Wypełnij broadcast refs gdy rt jest dostępne (bez ponownego renderowania)
  useEffect(() => {
    broadcastCreatedRef.current = rt.broadcastElementCreated;
    broadcastDeletedRef.current = rt.broadcastElementDeleted;
  }, [rt.broadcastElementCreated, rt.broadcastElementDeleted]);

  // ─── HOOK: clipboard ────────────────────────────────────────────────────────
  const clip = useClipboard({
    elementsRef: el.elementsRef,
    selectedElementIdsRef: sel.selectedElementIdsRef,
    viewportRef: vp.viewportRef,
    canvasRef,
    boardIdRef,
    onAddElements: el.addElements,
    onBroadcastCreated: rt.broadcastElementCreated,
    onMarkUnsaved: el.markUnsaved,
    // markUnsaved już wywołuje debouncedSave wewnętrznie — no-op tu wystarczy
    onDebouncedSave: () => {},
    onSelectElements: sel.selectElements,
    onLoadImage: el.loadImage,
    onPushUserAction: hist.pushUserAction,
  });

  // ─── Broadcast viewport throttled ──────────────────────────────────────────
  const lastVpBroadcastRef = useRef(0);
  useEffect(() => {
    // Nie broadcastuj gdy kanał WebSocket nie jest gotowy
    if (!rt.isConnected) return;
    // Nie broadcastuj gdy jesteśmy w follow mode
    if (vp.followingUserId) return;
    const now = Date.now();
    if (now - lastVpBroadcastRef.current < 50) return; // 20 FPS max
    lastVpBroadcastRef.current = now;
    rt.broadcastViewportChange(vp.viewport.x, vp.viewport.y, vp.viewport.scale);
  }, [vp.viewport, vp.followingUserId, rt.broadcastViewportChange, rt.isConnected]);

  // ─── RENDEROWANIE CANVAS ────────────────────────────────────────────────────

  const rafIdRef = useRef<number | null>(null);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const viewport = vp.viewportRef.current;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Siatka kartezjańska (układ współrzędnych) — ukrywana gdy settings.grid_visible = false
    if (settingsRef.current.grid_visible) {
      drawGrid(ctx, viewport, width, height);
    }

    // Markdown + Table renderowane jako HTML overlay — canvas je pomija
    for (const element of el.elementsRef.current) {
      if (element.type === 'markdown' || element.type === 'table') continue;
      drawElement(
        ctx,
        element,
        viewport,
        width,
        height,
        el.loadedImages,
        false,
        undefined,
        el.elementsRef.current
      );
    }

    ctx.restore();
  }, [el.elementsRef, el.loadedImages, vp.viewportRef]);

  // Przechowuj redrawCanvas w ref żeby był dostępny w event handlerach bez przechwycenia
  const redrawCanvasRef = useRef(redrawCanvas);
  useEffect(() => {
    redrawCanvasRef.current = redrawCanvas;
  }, [redrawCanvas]);

  // Przerysuj przy każdej zmianie elementów / viewportu / obrazów / settings
  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      redrawCanvasRef.current();
      rafIdRef.current = null;
    });
  }, [el.elements, el.loadedImages, vp.viewport, boardSettingsProp]);

  // ─── RESIZE CANVAS ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = Math.ceil(rect.width);
      const h = Math.ceil(rect.height);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // Zaktualizuj stan — narzędzia czekają na canvasWidth > 0
      setCanvasWidth(w);
      setCanvasHeight(h);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Reset transform before scaling to prevent accumulation
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        redrawCanvasRef.current();
      }
    };

    const debouncedUpdate = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateSize, 100);
    };

    updateSize();
    window.addEventListener('resize', debouncedUpdate);
    const ro = new ResizeObserver(debouncedUpdate);
    ro.observe(container);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedUpdate);
      ro.disconnect();
    };
  }, []); // Celowo pusta — setup jednorazowy, korzystamy z redrawCanvasRef

  // ─── ZOOM + PAN (kółko myszy / touchpad) ───────────────────────────────────
  //
  // ⚡ PERF: Nie wołamy setViewport w hot-path każdego eventu!
  //   - viewportRef.current aktualizowany natychmiast (canvas RAF reads this)
  //   - redrawCanvasRef.current() wołane bezpośrednio przez RAF
  //   - setViewport wywołany przez debounce (co 80ms) — synchronizuje React state
  //     (ZoomControls, HTMLoverlays) bez jitter klatka-po-klatce

  const wheelSetViewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Po każdej aktualizacji React-stanu viewportu (po re-renderze z poprawnymi pozycjami) — przywróć widoczność wszystkich HTML overlaysów
  useEffect(() => {
    if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = '';
    if (mdTableOverlaysRef.current) mdTableOverlaysRef.current.style.visibility = '';
    if (remoteCursorsRef.current) remoteCursorsRef.current.style.visibility = '';
  }, [vp.viewport]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      vp.handleStopFollowing();
      // Ukryj HTML overlaye — pojawią się z powrotem po zsynchronizowaniu React-stanu viewport (useEffect wyżej)
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';
      if (mdTableOverlaysRef.current) mdTableOverlaysRef.current.style.visibility = 'hidden';
      if (remoteCursorsRef.current) remoteCursorsRef.current.style.visibility = 'hidden';

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const current = vp.viewportRef.current;

      const next = e.ctrlKey
        ? zoomViewport(current, e.deltaY, mouseX, mouseY, rect.width, rect.height)
        : panViewportWithWheel(current, e.deltaX, e.deltaY);

      const constrained = constrainViewport(next);

      // 1. Zaktualizuj ref natychmiast — canvas RAF odczyta nową wartość
      vp.viewportRef.current = constrained;

      // 2. Narysuj canvas bezpośrednio (bez czekania na React re-render)
      requestAnimationFrame(() => redrawCanvasRef.current());

      // 3. Zsynchronizuj React state z debounce — aktualizuje ZoomControls + HTML overlays
      if (wheelSetViewportTimerRef.current) clearTimeout(wheelSetViewportTimerRef.current);
      wheelSetViewportTimerRef.current = setTimeout(() => {
        vp.setViewport(vp.viewportRef.current);
      }, 80);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [vp.handleStopFollowing, vp.setViewport, vp.viewportRef]);

  // ─── BROADCAST CURSOR (pointermove → world coords → WebSocket) ──────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const worldPos = inverseTransformPoint(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        vp.viewportRef.current,
        rect.width,
        rect.height
      );
      rt.broadcastCursorMove(worldPos.x, worldPos.y);
    };

    container.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => container.removeEventListener('pointermove', handlePointerMove);
  }, [rt.broadcastCursorMove, vp.viewportRef]);

  // ─── PAN środkowym przyciskiem myszy (wciśnięcie kółka + przeciągnięcie) ──

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      document.body.style.cursor = 'grabbing';
      vp.handleStopFollowing();
      // Ukryj HTML overlaye — pojawią się z powrotem po setViewport (mouseup)
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';
      if (mdTableOverlaysRef.current) mdTableOverlaysRef.current.style.visibility = 'hidden';
      if (remoteCursorsRef.current) remoteCursorsRef.current.style.visibility = 'hidden';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const next = panViewportWithMouse(vp.viewportRef.current, dx, dy);
      const constrained = constrainViewport(next);

      // ⚡ PERF: tylko ref — bez React re-render w hot-path
      vp.viewportRef.current = constrained;
      requestAnimationFrame(() => redrawCanvasRef.current());
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 1) return;
      isPanning = false;
      document.body.style.cursor = '';
      // Zsynchronizuj React state raz na koniec gestu
      vp.setViewport(vp.viewportRef.current);
    };

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [vp.handleStopFollowing, vp.setViewport, vp.viewportRef]);

  // ─── SKRÓTY KLAWISZOWE ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      // Ctrl+Z — cofnij
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        hist.undo();
        return;
      }
      // Ctrl+Y / Ctrl+Shift+Z — ponów
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        hist.redo();
        return;
      }
      // Ctrl+C — kopiuj
      if (e.ctrlKey && e.key === 'c') {
        if (sel.selectedElementIds.size > 0) {
          e.preventDefault();
          clip.handleCopy();
        }
        return;
      }
      // Ctrl+V — wklej (inteligentnie: najpierw sprawdź schowek systemowy pod kątem obrazu)
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        // Jeśli mamy skopiowane elementy wewnątrz aplikacji — wklej je bezpośrednio
        if (clip.copiedElements.length > 0) {
          clip.handlePaste();
        } else {
          // Brak wewnętrznej kopii — sprawdź schowek OS (screenshot itp.)
          handleOsClipboardPasteRef.current().then((pasted) => {
            if (!pasted) clip.handlePaste(); // fallback (no-op gdy copiedElements=[])
          });
        }
        return;
      }
      // Ctrl+D — duplikuj
      if (e.ctrlKey && e.key === 'd') {
        if (sel.selectedElementIds.size > 0) {
          e.preventDefault();
          clip.handleDuplicate();
        }
        return;
      }
      // Delete — usuń zaznaczone
      if (e.key === 'Delete') {
        if (sel.selectedElementIds.size > 0) {
          e.preventDefault();
          deleteSelectedElementsRef.current();
        }
        return;
      }
      // Escape — odznacz + wróć do select
      if (e.key === 'Escape') {
        e.preventDefault();
        sel.clearSelection();
        if (userRole !== 'viewer') setTool('select');
        return;
      }

      // Skróty narzędzi (bez Ctrl/Alt/Meta)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && userRole !== 'viewer') {
        switch (e.key.toLowerCase()) {
          case 'v': e.preventDefault(); setTool('select'); break;
          case 'h': e.preventDefault(); setTool('pan'); break;
          case 'p': e.preventDefault(); setTool('pen'); break;
          case 't': e.preventDefault(); setTool('text'); break;
          case 's': e.preventDefault(); setTool('shape'); break;
          case 'f': e.preventDefault(); setTool('function'); break;
          case 'i': e.preventDefault(); setTool('image'); break;
          case 'e': e.preventDefault(); setTool('eraser'); break;
          case 'm': e.preventDefault(); setTool('markdown'); break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hist.undo, hist.redo,
    sel.selectedElementIds, sel.clearSelection,
    clip.handleCopy, clip.handlePaste, clip.handleDuplicate,
    userRole,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLER VIEWPORT (wywołują narzędzia podczas pan/zoom przez touch/drag)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Ukrywa wszystkie HTML-overlaye natychmiast — bez re-renderu React */
  const hideOverlaysForPan = useCallback(() => {
    isPanningRef.current = true;
    if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';
    if (mdTableOverlaysRef.current) mdTableOverlaysRef.current.style.visibility = 'hidden';
    if (remoteCursorsRef.current) remoteCursorsRef.current.style.visibility = 'hidden';
  }, []);

  /** Przywraca overlaye i synchronizuje React viewport state raz po zakończeniu pana */
  const restoreOverlaysAfterPan = useCallback(() => {
    isPanningRef.current = false;
    // Anuluj debounce — przywróć natychmiast (gest skończony, pozycja znana)
    if (viewportChangeTimerRef.current) {
      clearTimeout(viewportChangeTimerRef.current);
      viewportChangeTimerRef.current = null;
    }
    // Najpierw synchronicznie zaktualizuj React state — React przerenderuje
    // wszystkie pozycje (w tym SelectionPropertiesPanel) jeszcze zanim
    // overlaye staną się widoczne. Bez tego panel przez ułamek sekundy
    // byłby widoczny na starej pozycji (efekt "leci za nami").
    flushSync(() => {
      vp.setViewport(vp.viewportRef.current);
    });
    // Dopiero teraz odkryj overlaye — panele są już na właściwych pozycjach
    if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = '';
    if (mdTableOverlaysRef.current) mdTableOverlaysRef.current.style.visibility = '';
    if (remoteCursorsRef.current) remoteCursorsRef.current.style.visibility = '';
  }, [vp.setViewport, vp.viewportRef]);

  const handleViewportChange = useCallback((newVp: ViewportTransform) => {
    const constrained = constrainViewport(newVp);
    vp.viewportRef.current = constrained;

    // Ukryj overlaye natychmiast (każda zmiana viewport — wheel, scroll, pan)
    if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';
    if (mdTableOverlaysRef.current) mdTableOverlaysRef.current.style.visibility = 'hidden';
    if (remoteCursorsRef.current) remoteCursorsRef.current.style.visibility = 'hidden';

    // Podczas aktywnego pana gestu — tylko ref + redraw canvas, bez setViewport (brak re-renderów React)
    if (isPanningRef.current) {
      requestAnimationFrame(() => redrawCanvasRef.current());
      return;
    }

    vp.setViewport(constrained);

    // Przywróć overlaye po 80ms ciszy — panel pojawi się w dobrym miejscu
    if (viewportChangeTimerRef.current) clearTimeout(viewportChangeTimerRef.current);
    viewportChangeTimerRef.current = setTimeout(() => {
      viewportChangeTimerRef.current = null;
      if (isPanningRef.current) return; // gest wciąż trwa — poczekaj na restoreOverlaysAfterPan
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = '';
      if (mdTableOverlaysRef.current) mdTableOverlaysRef.current.style.visibility = '';
      if (remoteCursorsRef.current) remoteCursorsRef.current.style.visibility = '';
    }, 80);
  }, [vp.setViewport, vp.viewportRef]);

  /** Używane przez ActivityHistory — centruje widok i zaznacza elementy */
  const handleCenterViewAndSelectElements = useCallback((
    x: number,
    y: number,
    scale?: number,
    _bounds?: { minX: number; minY: number; maxX: number; maxY: number }
  ) => {
    const constrained = constrainViewport({ x, y, scale: scale ?? vp.viewport.scale });
    vp.viewportRef.current = constrained;
    vp.setViewport(constrained);
  }, [vp.setViewport, vp.viewportRef, vp.viewport.scale]);

  /** Używane przez ActivityHistory — zaznacza elementy i przełącza na select */
  const handleSelectElementsFromHistory = useCallback((elementIds: string[]) => {
    sel.selectElements(elementIds);
    setTool('select');
  }, [sel.selectElements]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERY TWORZENIA ELEMENTÓW
  // ═══════════════════════════════════════════════════════════════════════════

  /** Wspólna logika: dodaj element + broadcast + history */
  const createElement = useCallback((element: DrawingElement) => {
    if (userRole === 'viewer') return;
    el.addElements([element]);
    el.markUnsaved([element.id]);
    rt.broadcastElementCreated(element);
    hist.pushUserAction({ type: 'create', element });
  }, [userRole, el.addElements, el.markUnsaved, rt.broadcastElementCreated, hist.pushUserAction]);

  const handlePathCreate = useCallback(
    (path: DrawingPath) => createElement(path),
    [createElement]
  );

  const handleShapeCreate = useCallback(
    (shape: Shape) => createElement(shape),
    [createElement]
  );

  const handleFunctionCreate = useCallback(
    (func: FunctionPlot) => createElement(func),
    [createElement]
  );

  const handleArrowCreate = useCallback(
    (arrow: ArrowElement) => createElement(arrow as DrawingElement),
    [createElement]
  );

  const handleImageCreate = useCallback((image: ImageElement) => {
    if (userRole === 'viewer') return;
    el.addElements([image]);
    el.markUnsaved([image.id]);
    rt.broadcastElementCreated(image);
    hist.pushUserAction({ type: 'create', element: image });
    if (image.src) el.loadImage(image.id, image.src);
    setTool('select');
  }, [userRole, el.addElements, el.markUnsaved, rt.broadcastElementCreated, hist.pushUserAction, el.loadImage]);

  // ─── SmartSearch handlers ──────────────────────────────────────────────────

  const handleFormulaSelect = useCallback((formula: FormulaResource) => {
    const img = new Image();
    img.src = formula.path;
    img.onload = () => {
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      const worldWidth = 3.5;
      const worldHeight = worldWidth * aspectRatio;
      const centerWorld = inverseTransformPoint(
        { x: canvasWidth / 2, y: canvasHeight / 2 },
        vp.viewportRef.current,
        canvasWidth,
        canvasHeight
      );
      const newImage: ImageElement = {
        id: `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        x: centerWorld.x - worldWidth / 2,
        y: centerWorld.y - worldHeight / 2,
        width: worldWidth,
        height: worldHeight,
        src: formula.path,
        alt: formula.title,
      };
      handleImageCreate(newImage);
    };
  }, [canvasWidth, canvasHeight, vp.viewportRef, handleImageCreate]);

  const handleCardSelect = useCallback((card: CardResource) => {
    setActiveCard(card);
  }, []);

  const handleChatbotAddToBoard = useCallback((content: string) => {
    const centerWorld = inverseTransformPoint(
      { x: canvasWidth / 2, y: canvasHeight / 2 },
      vp.viewportRef.current,
      canvasWidth,
      canvasHeight
    );
    const noteWidth = 5;
    const noteHeight = 4;
    const newNote: MarkdownNote = {
      id: `chatbot-note-${Date.now()}`,
      type: 'markdown',
      x: centerWorld.x - noteWidth / 2,
      y: centerWorld.y - noteHeight / 2,
      width: noteWidth,
      height: noteHeight,
      content,
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
    };
    el.addElements([newNote]);
    el.markUnsaved([newNote.id]);
    rt.broadcastElementCreated(newNote);
    hist.pushUserAction({ type: 'create', element: newNote });
  }, [canvasWidth, canvasHeight, vp.viewportRef, el, rt, hist]);

  const handleAddFormulasFromCard = useCallback((formulas: FormulaResource[]) => {
    const COLS = 2, WORLD_WIDTH = 3.5, WORLD_PADDING = 0.5;
    const centerWorld = inverseTransformPoint(
      { x: canvasWidth / 2, y: canvasHeight / 2 },
      vp.viewportRef.current,
      canvasWidth,
      canvasHeight
    );
    const imagePromises = formulas.map((formula, index) =>
      new Promise<{ formula: FormulaResource; img: HTMLImageElement; index: number }>((resolve, reject) => {
        const img = new Image();
        img.src = formula.path;
        img.onload = () => resolve({ formula, img, index });
        img.onerror = () => reject(new Error(`Failed to load: ${formula.path}`));
      })
    );
    Promise.all(imagePromises)
      .then((loaded) => {
        const newImages = loaded.map(({ formula, img, index }) => {
          const aspectRatio = img.naturalHeight / img.naturalWidth;
          const worldHeight = WORLD_WIDTH * aspectRatio;
          const col = index % COLS;
          const row = Math.floor(index / COLS);
          const startX = centerWorld.x - ((COLS - 1) * (WORLD_WIDTH + WORLD_PADDING)) / 2;
          const startY = centerWorld.y - 2;
          const imageEl: ImageElement = {
            id: `formula-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'image',
            x: startX + col * (WORLD_WIDTH + WORLD_PADDING) - WORLD_WIDTH / 2,
            y: startY + row * (worldHeight + WORLD_PADDING),
            width: WORLD_WIDTH,
            height: worldHeight,
            src: formula.path,
            alt: formula.title,
          };
          return { imageEl, img };
        });
        const elements = newImages.map(({ imageEl }) => imageEl);
        el.addElements(elements);
        el.markUnsaved(elements.map((e) => e.id));
        elements.forEach((imageEl) => {
          rt.broadcastElementCreated(imageEl);
          hist.pushUserAction({ type: 'create', element: imageEl });
          el.loadImage(imageEl.id, imageEl.src!);
        });
        setActiveCard(null);
      })
      .catch((err) => {
        console.error('❌ Błąd ładowania wzorów z karty:', err);
        setActiveCard(null);
      });
  }, [canvasWidth, canvasHeight, vp.viewportRef, el, rt, hist]);

  /**
   * Wklejanie obrazka ze schowka systemowego (screenshot, Ctrl+C z przeglądarki itp.).
   * Czyta navigator.clipboard.read() i tworzy ImageElement w centrum widoku.
   * Zwraca true jeśli obraz został wklejony, false gdy schowek nie zawiera obrazka.
   */
  const handleOsClipboardPaste = useCallback(async (): Promise<boolean> => {
    if (userRole === 'viewer') return false;
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        // Blob → base64 data URL
        const data: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        // Pobierz naturalne wymiary obrazka
        const { width: imgW, height: imgH } = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.src = data;
        });
        const centerWorld = inverseTransformPoint(
          { x: canvasWidth / 2, y: canvasHeight / 2 },
          vp.viewportRef.current,
          canvasWidth,
          canvasHeight
        );
        const aspectRatio = imgH / Math.max(imgW, 1);
        const worldWidth = 3;
        const worldHeight = worldWidth * aspectRatio;
        const newImage: ImageElement = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
          type: 'image',
          x: centerWorld.x - worldWidth / 2,
          y: centerWorld.y - worldHeight / 2,
          width: worldWidth,
          height: worldHeight,
          src: data,
          alt: 'Pasted image',
        };
        handleImageCreate(newImage);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [userRole, canvasWidth, canvasHeight, vp.viewportRef, handleImageCreate]);

  // Ref — umożliwia wywołanie w async then-chain wewnątrz useEffect (keydown handler)
  const handleOsClipboardPasteRef = useRef(handleOsClipboardPaste);
  useEffect(() => { handleOsClipboardPasteRef.current = handleOsClipboardPaste; }, [handleOsClipboardPaste]);

  const handleMarkdownNoteCreate = useCallback((note: MarkdownNote) => {
    if (userRole === 'viewer') return;
    el.addElements([note]);
    el.markUnsaved([note.id]);
    rt.broadcastElementCreated(note);
    hist.pushUserAction({ type: 'create', element: note });
    setTool('select');
    sel.setSelectedElementIds(new Set([note.id]));
    sel.setEditingMarkdownId(note.id);
  }, [
    userRole,
    el.addElements, el.markUnsaved, rt.broadcastElementCreated, hist.pushUserAction,
    sel.setSelectedElementIds, sel.setEditingMarkdownId,
  ]);

  const handleTableCreate = useCallback((table: TableElement) => {
    if (userRole === 'viewer') return;
    el.addElements([table]);
    el.markUnsaved([table.id]);
    rt.broadcastElementCreated(table);
    hist.pushUserAction({ type: 'create', element: table });
    setTool('select');
    sel.setSelectedElementIds(new Set([table.id]));
  }, [
    userRole,
    el.addElements, el.markUnsaved, rt.broadcastElementCreated, hist.pushUserAction,
    sel.setSelectedElementIds,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERY TextTool
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTextCreate = useCallback(
    (text: TextElement) => createElement(text),
    [createElement]
  );

  const handleTextUpdate = useCallback((id: string, updates: Partial<TextElement>) => {
    if (userRole === 'viewer') return;
    const current = el.elementsRef.current.find((e) => e.id === id);
    if (!current) return;
    const updated = { ...current, ...updates } as DrawingElement;
    el.updateElement(updated);
    el.markUnsaved([id]);
    rt.broadcastElementUpdated(updated);
  }, [userRole, el.elementsRef, el.updateElement, el.markUnsaved, rt.broadcastElementUpdated]);

  const handleTextDelete = useCallback((id: string) => {
    if (userRole === 'viewer') return;
    const current = el.elementsRef.current.find((e) => e.id === id);
    el.removeElement(id);
    rt.broadcastElementDeleted(id);
    const boardIdNum = parseInt(boardIdRef.current);
    if (!isNaN(boardIdNum)) el.deleteElementDirectly(boardIdNum, id).catch(console.error);
    if (current) hist.pushUserAction({ type: 'delete', element: current });
  }, [
    userRole,
    el.elementsRef, el.removeElement, el.deleteElementDirectly,
    rt.broadcastElementDeleted, hist.pushUserAction,
  ]);

  const handleEditingComplete = useCallback(() => {
    sel.setEditingTextId(null);
    if (userRole !== 'viewer') setTool('select');
  }, [sel.setEditingTextId, userRole]);

  const handleTextEdit = useCallback((id: string) => {
    sel.setEditingTextId(id);
    setTool('text');
  }, [sel.setEditingTextId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERY SelectTool
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    sel.setSelectedElementIds(ids);
  }, [sel.setSelectedElementIds]);

  /** Szybki update bez historii (podczas przeciągania) */
  const handleElementUpdate = useCallback((id: string, updates: Partial<DrawingElement>) => {
    if (userRole === 'viewer') return;
    const current = el.elementsRef.current.find((e) => e.id === id);
    if (!current) return;
    el.updateElement({ ...current, ...updates } as DrawingElement);
  }, [userRole, el.elementsRef, el.updateElement]);

  /** Update z historią (po zakończeniu przeciągania / zmianie rozmiaru) */
  const handleElementUpdateWithHistory = useCallback(
    (id: string, updates: Partial<DrawingElement>) => {
      if (userRole === 'viewer') return;
      const current = el.elementsRef.current.find((e) => e.id === id);
      if (!current) return;
      const updated = { ...current, ...updates } as DrawingElement;
      el.updateElement(updated);
      el.markUnsaved([id]);
      rt.broadcastElementUpdated(updated);
      hist.saveToHistory(
        el.elementsRef.current.map((e) => (e.id === id ? updated : e))
      );
    },
    [
      userRole,
      el.elementsRef, el.updateElement, el.markUnsaved,
      rt.broadcastElementUpdated, hist.saveToHistory,
    ]
  );

  /** Batch update (SelectTool przesuwa wiele elementów naraz) */
  const handleElementsUpdate = useCallback(
    (updates: Map<string, Partial<DrawingElement>>) => {
      if (userRole === 'viewer') return;
      const ids = Array.from(updates.keys());
      ids.forEach((id) => {
        const current = el.elementsRef.current.find((e) => e.id === id);
        if (!current) return;
        const updated = { ...current, ...updates.get(id) } as DrawingElement;
        el.updateElement(updated);
        rt.broadcastElementUpdated(updated);
      });
      el.markUnsaved(ids);
    },
    [userRole, el.elementsRef, el.updateElement, el.markUnsaved, rt.broadcastElementUpdated]
  );

  /** Wywoływane przez SelectTool po zakończeniu operacji (mouseup) */
  const handleSelectionFinish = useCallback(() => {
    if (userRole === 'viewer') return;
    const currentElements = el.elementsRef.current;
    const selectedIds = Array.from(sel.selectedElementIdsRef.current);
    hist.saveToHistory(currentElements);
    selectedIds.forEach((id) => {
      const found = currentElements.find((e) => e.id === id);
      if (found) rt.broadcastElementUpdated(found);
    });
    el.markUnsaved(selectedIds);
  }, [
    userRole,
    el.elementsRef, el.markUnsaved,
    sel.selectedElementIdsRef,
    hist.saveToHistory,
    rt.broadcastElementUpdated,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLER EraserTool
  // ═══════════════════════════════════════════════════════════════════════════

  const handleElementDelete = useCallback((id: string) => {
    if (userRole === 'viewer') return;
    const current = el.elementsRef.current.find((e) => e.id === id);
    el.removeElement(id);
    rt.broadcastElementDeleted(id);
    const boardIdNum = parseInt(boardIdRef.current);
    if (!isNaN(boardIdNum)) el.deleteElementDirectly(boardIdNum, id).catch(console.error);
    if (current) hist.pushUserAction({ type: 'delete', element: current });
  }, [
    userRole,
    el.elementsRef, el.removeElement, el.deleteElementDirectly,
    rt.broadcastElementDeleted, hist.pushUserAction,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERY HTML OVERLAYS (Markdown + Table)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleMarkdownContentChange = useCallback((noteId: string, content: string) => {
    if (userRole === 'viewer') return;
    const current = el.elementsRef.current.find((e) => e.id === noteId);
    if (!current || current.type !== 'markdown') return;
    const updated = { ...current, content } as DrawingElement;
    el.updateElement(updated);
    el.markUnsaved([noteId]);
    rt.broadcastElementUpdated(updated);
  }, [userRole, el.elementsRef, el.updateElement, el.markUnsaved, rt.broadcastElementUpdated]);

  const handleMarkdownEditStart = useCallback((noteId: string) => {
    sel.setEditingMarkdownId(noteId);
    rt.broadcastTypingStarted(noteId);
  }, [sel.setEditingMarkdownId, rt.broadcastTypingStarted]);

  const handleMarkdownEditEnd = useCallback(() => {
    const editingId = sel.editingMarkdownId;
    if (editingId) rt.broadcastTypingStopped(editingId);
    sel.setEditingMarkdownId(null);
  }, [sel.editingMarkdownId, sel.setEditingMarkdownId, rt.broadcastTypingStopped]);

  const handleTableCellChange = useCallback(
    (tableId: string, row: number, col: number, value: string) => {
      if (userRole === 'viewer') return;
      const current = el.elementsRef.current.find((e) => e.id === tableId);
      if (!current || current.type !== 'table') return;
      const table = current as TableElement;
      const newCells = table.cells.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? value : c)) : [...r]
      );
      const updated = { ...table, cells: newCells } as DrawingElement;
      el.updateElement(updated);
      el.markUnsaved([tableId]);
      rt.broadcastElementUpdated(updated);
    },
    [userRole, el.elementsRef, el.updateElement, el.markUnsaved, rt.broadcastElementUpdated]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // USUWANIE ZAZNACZONYCH
  // ═══════════════════════════════════════════════════════════════════════════

  const deleteSelectedElements = useCallback(() => {
    if (userRole === 'viewer') return;
    const ids = sel.selectedElementIdsRef.current;
    if (ids.size === 0) return;
    const boardIdNum = parseInt(boardIdRef.current);
    ids.forEach((id) => {
      const element = el.elementsRef.current.find((e) => e.id === id);
      el.removeElement(id);
      rt.broadcastElementDeleted(id);
      if (!isNaN(boardIdNum)) el.deleteElementDirectly(boardIdNum, id).catch(console.error);
      if (element) hist.pushUserAction({ type: 'delete', element });
    });
    sel.clearSelection();
  }, [
    userRole,
    sel.selectedElementIdsRef, sel.clearSelection,
    el.elementsRef, el.removeElement, el.deleteElementDirectly,
    rt.broadcastElementDeleted,
    hist.pushUserAction,
  ]);

  // Aktualizuj ref (używany w keyDown handler)
  const deleteSelectedElementsRef = useRef<() => void>(deleteSelectedElements);
  useEffect(() => {
    deleteSelectedElementsRef.current = deleteSelectedElements;
  }, [deleteSelectedElements]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ZOOM CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  const resetView = useCallback(() => {
    const neutral = constrainViewport({ x: 0, y: 0, scale: 1 });
    vp.viewportRef.current = neutral;
    vp.setViewport(neutral);
  }, [vp.setViewport, vp.viewportRef]);

  const zoomIn = useCallback(() => {
    vp.setViewport((prev: ViewportTransform) =>
      constrainViewport({ ...prev, scale: Math.min(prev.scale * 1.2, 5.0) })
    );
  }, [vp.setViewport]);

  const zoomOut = useCallback(() => {
    vp.setViewport((prev: ViewportTransform) =>
      constrainViewport({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) })
    );
  }, [vp.setViewport]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR CANVAS
  // ═══════════════════════════════════════════════════════════════════════════

  const clearCanvas = useCallback(async () => {
    if (userRole === 'viewer') return;
    const boardIdNum = parseInt(boardIdRef.current);
    const snapshot = [...el.elementsRef.current];
    snapshot.forEach((e) => {
      el.removeElement(e.id);
      rt.broadcastElementDeleted(e.id);
      if (!isNaN(boardIdNum)) {
        el.deleteElementDirectly(boardIdNum, e.id).catch(console.error);
      }
    });
    sel.clearSelection();
  }, [
    userRole,
    el.elementsRef, el.removeElement, el.deleteElementDirectly,
    rt.broadcastElementDeleted,
    sel.clearSelection,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE TOOL WRAPPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleImageToolPaste = useCallback(() => {
    imageToolRef.current?.handlePasteFromClipboard();
  }, []);

  const handleImageToolUpload = useCallback(() => {
    imageToolRef.current?.triggerFileUpload();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // FOLLOW MODE
  // ═══════════════════════════════════════════════════════════════════════════

  const handleFollowUser = useCallback(
    (userId: number, x: number, y: number, scale: number) => {
      vp.handleFollowUser(userId, x, y, scale);
    },
    [vp.handleFollowUser]
  );

  const handleStopFollowing = useCallback(() => {
    vp.handleStopFollowing();
  }, [vp.handleStopFollowing]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className={`relative w-full h-full bg-[#FEF2F2] ${className}`}>

      {/* Loading overlay — zakrywa canvas aż elementy się załadują */}
      <LoadingOverlay isLoading={el.isLoading} progress={el.loadingProgress} />

      {/* Wewnętrzny kontener (narzędzia, overlaye, canvas) */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden touch-none overscroll-none"
        onContextMenu={(e) => e.preventDefault()}
        style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
      >

        {/* ── ONLINE USERS ──────────────────────────────────────────────── */}
        <OnlineUsers
          onFollowUser={handleFollowUser}
          onStopFollowing={handleStopFollowing}
          followingUserId={vp.followingUserId}
          userRole={userRole}
        />

        {/* ── FOLLOW MODE BANNER ────────────────────────────────────────── */}
        {vp.followingUserId && (
          <div className="absolute top-20 right-4 z-50 bg-blue-500 text-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-3 animate-pulse">
            <span className="text-sm font-medium">👁️ Śledzisz użytkownika</span>
            <button
              onClick={handleStopFollowing}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Przestań śledzić
            </button>
          </div>
        )}

        {/* ── SMARTSEARCH BAR ───────────────────────────────────────────── */}
        {userRole !== 'viewer' && settings.smartsearch_visible && (
          <div
            className="absolute top-4 z-50 pointer-events-auto"
            style={{
              left: windowWidth <= 760 ? '90px' : windowWidth <= 1550 ? '90px' : '50%',
              transform:
                windowWidth <= 760 ? 'none' : windowWidth <= 1550 ? 'none' : 'translateX(-50%)',
              right: windowWidth <= 760 ? '16px' : windowWidth <= 1550 ? '330px' : 'auto',
              maxWidth:
                windowWidth <= 760
                  ? 'calc(100vw - 90px - 16px)'
                  : windowWidth <= 1550
                  ? 'calc(100vw - 90px - 330px)'
                  : '900px',
            }}
          >
            <SmartSearchBar
              onFormulaSelect={handleFormulaSelect}
              onCardSelect={handleCardSelect}
              onActiveChange={setIsSearchActive}
              userRole={userRole}
            />
          </div>
        )}

        {/* ── CARD VIEWER MODAL ─────────────────────────────────────────── */}
        {activeCard && (
          <CardViewer
            card={activeCard}
            onClose={() => setActiveCard(null)}
            onAddFormulas={handleAddFormulasFromCard}
            onActiveChange={setIsCardViewerActive}
          />
        )}

        {/* ── VIEWER BANNER ─────────────────────────────────────────────── */}
        {userRole === 'viewer' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[150] bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-lg shadow-md flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="font-medium">Tryb tylko do odczytu</span>
          </div>
        )}

        {/* ── TOOLBAR ───────────────────────────────────────────────────── */}
        {settings.toolbar_visible && (
          <Toolbar
            tool={tool}
            setTool={setTool}
            selectedShape={selectedShape}
            setSelectedShape={setSelectedShape}
            polygonSides={polygonSides}
            setPolygonSides={setPolygonSides}
            color={color}
            setColor={setColor}
            lineWidth={lineWidth}
            setLineWidth={setLineWidth}
            fontSize={fontSize}
            setFontSize={setFontSize}
            fillShape={fillShape}
            setFillShape={setFillShape}
            onUndo={hist.undo}
            onRedo={hist.redo}
            onClear={clearCanvas}
            onResetView={resetView}
            canUndo={hist.canUndo}
            canRedo={hist.canRedo}
            hasSelection={sel.selectedElementIds.size > 0}
            onDeleteSelected={deleteSelectedElements}
            onImagePaste={handleImageToolPaste}
            onImageUpload={handleImageToolUpload}
            onPDFUpload={handleImageToolUpload}
            isCalculatorOpen={isCalculatorOpen}
            onCalculatorToggle={() => setIsCalculatorOpen((v) => !v)}
            isReadOnly={userRole === 'viewer'}
          />
        )}

        {/* ── ZOOM CONTROLS ─────────────────────────────────────────────── */}
        <ZoomControls
          zoom={vp.viewport.scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
        />

        {/* ═══════════════════════════════════════════════════════════════
            NARZĘDZIA — każde zarządza własnymi overlayami pointer-events
            ═══════════════════════════════════════════════════════════════ */}

        {tool === 'text' && canvasWidth > 0 && (
          <TextTool
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            elements={el.elements.filter((e) => e.type === 'text') as TextElement[]}
            editingTextId={sel.editingTextId}
            onTextCreate={handleTextCreate}
            onTextUpdate={handleTextUpdate}
            onTextDelete={handleTextDelete}
            onEditingComplete={handleEditingComplete}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'select' && canvasWidth > 0 && (
          <div ref={htmlOverlaysRef} style={{ position: 'absolute', inset: 0 }}>
            <SelectTool
              viewport={vp.viewport}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              elements={el.elements}
              selectedIds={sel.selectedElementIds}
              onSelectionChange={handleSelectionChange}
              onElementUpdate={handleElementUpdate}
              onElementUpdateWithHistory={handleElementUpdateWithHistory}
              onElementsUpdate={handleElementsUpdate}
              onOperationFinish={handleSelectionFinish}
              onTextEdit={handleTextEdit}
              onMarkdownEdit={sel.setEditingMarkdownId}
              onViewportChange={handleViewportChange}
              onActiveGuidesChange={setActiveGuides}
              onDeleteSelected={deleteSelectedElements}
              onCopySelected={clip.handleCopy}
              onDuplicateSelected={clip.handleDuplicate}
            />
          </div>
        )}

        {tool === 'pen' && canvasWidth > 0 && (
          <PenTool
            viewport={vp.viewport}
            viewportRef={vp.viewportRef}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            color={color}
            lineWidth={lineWidth}
            onPathCreate={handlePathCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'shape' && canvasWidth > 0 && (
          <ShapeTool
            viewport={vp.viewport}
            viewportRef={vp.viewportRef}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            selectedShape={selectedShape}
            polygonSides={polygonSides}
            color={color}
            lineWidth={lineWidth}
            fillShape={fillShape}
            onShapeCreate={handleShapeCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'pan' && canvasWidth > 0 && (
          <PanTool
            viewport={vp.viewport}
            viewportRef={vp.viewportRef}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onViewportChange={handleViewportChange}
            onPanStart={hideOverlaysForPan}
            onPanEnd={restoreOverlaysAfterPan}
          />
        )}

        {tool === 'function' && canvasWidth > 0 && (
          <FunctionTool
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            color={color}
            lineWidth={lineWidth}
            onFunctionCreate={handleFunctionCreate}
            onColorChange={setColor}
            onLineWidthChange={setLineWidth}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'image' && canvasWidth > 0 && (
          <ImageTool
            ref={imageToolRef}
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onImageCreate={handleImageCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'eraser' && canvasWidth > 0 && (
          <EraserTool
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            elements={el.elements}
            onElementDelete={handleElementDelete}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'markdown' && canvasWidth > 0 && (
          <MarkdownNoteTool
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onNoteCreate={handleMarkdownNoteCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'table' && canvasWidth > 0 && (
          <TableTool
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onTableCreate={handleTableCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'arrow' && canvasWidth > 0 && (
          <ArrowTool
            elements={el.elements}
            selectedIds={sel.selectedElementIds}
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            color={color}
            lineWidth={lineWidth}
            onArrowCreate={handleArrowCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════════
            HTML OVERLAYS (Markdown + Table) — ukrywane podczas pan
            Render wszystkich HTML-pozycjonowanych elementów świata
            ═══════════════════════════════════════════════════════════════ */}
        <div
          ref={mdTableOverlaysRef}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
          {/* MARKDOWN */}
          {canvasWidth > 0 &&
            el.elements
              .filter((e) => e.type === 'markdown')
              .map((e) => {
                const note = e as MarkdownNote;
                const topLeft = transformPoint(
                  { x: note.x, y: note.y },
                  vp.viewport,
                  canvasWidth,
                  canvasHeight
                );
                const baseWidth = note.width * 100; // 100px = 1 world unit
                const baseHeight = note.height * 100;
                const scaledW = baseWidth * vp.viewport.scale;
                const scaledH = baseHeight * vp.viewport.scale;

                // Culling — nie renderuj jeśli poza ekranem lub za małe
                if (scaledW < 30 || scaledH < 30) return null;
                if (topLeft.x + scaledW < 0 || topLeft.x > canvasWidth) return null;
                if (topLeft.y + scaledH < 0 || topLeft.y > canvasHeight) return null;

                const isBeingEdited = sel.editingMarkdownId === note.id;
                // contentScale kontroluje rozmiar tekstu (1 = domyślny, 2 = 2x większy)
                const contentScale = note.contentScale ?? 1;

                return (
                  <div
                    key={note.id}
                    className="absolute rounded-lg shadow-md border overflow-hidden"
                    style={{
                      left: topLeft.x,
                      top: topLeft.y,
                      width: baseWidth,
                      height: baseHeight,
                      transform: `scale(${vp.viewport.scale})`,
                      transformOrigin: 'top left',
                      willChange: 'transform',
                      backgroundColor: note.backgroundColor || '#fffde7',
                      borderColor: note.borderColor || '#fbc02d',
                      pointerEvents: isBeingEdited ? 'auto' : 'none',
                      zIndex: isBeingEdited ? 50 : 10,
                    }}
                  >
                    {/* Inner wrapper dla contentScale (rozmiar tekstu) */}
                    <div
                      style={{
                        width: `${100 / contentScale}%`,
                        height: `${100 / contentScale}%`,
                        transform: `scale(${contentScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      <MarkdownNoteView
                        note={note}
                        noteId={note.id}
                        isEditing={isBeingEdited}
                        onContentChange={handleMarkdownContentChange}
                        onEditStart={handleMarkdownEditStart}
                        onEditEnd={handleMarkdownEditEnd}
                        remoteTypingUser={
                          rt.typingUsers.find((t) => t.elementId === note.id)?.username
                        }
                      />
                    </div>
                  </div>
                );
              })}

        </div>

        {/* TABLE — osobny wrapper, NIE ukrywany podczas pan */}
        {canvasWidth > 0 &&
          el.elements
            .filter((e) => e.type === 'table')
            .map((e) => {
              const table = e as TableElement;
              const topLeft = transformPoint(
                { x: table.x, y: table.y },
                vp.viewport,
                canvasWidth,
                canvasHeight
              );
              const bottomRight = transformPoint(
                { x: table.x + table.width, y: table.y + table.height },
                vp.viewport,
                canvasWidth,
                canvasHeight
              );
              const screenW = bottomRight.x - topLeft.x;
              const screenH = bottomRight.y - topLeft.y;

              if (screenW < 20 || screenH < 20) return null;
              if (topLeft.x + screenW < 0 || topLeft.x > canvasWidth) return null;
              if (topLeft.y + screenH < 0 || topLeft.y > canvasHeight) return null;

              const isSelected = sel.selectedElementIds.has(table.id);

              return (
                <div
                  key={table.id}
                  className="absolute"
                  style={{
                    left: topLeft.x,
                    top: topLeft.y,
                    width: screenW,
                    minHeight: screenH,
                    pointerEvents: isSelected ? 'auto' : 'none',
                    zIndex: isSelected ? 35 : 10,
                    overflow: 'visible',
                  }}
                >
                  <TableView
                    table={table}
                    onCellChange={(row, col, value) =>
                      handleTableCellChange(table.id, row, col, value)
                    }
                  />
                </div>
              );
            })}

        {/* ═══════════════════════════════════════════════════════════════
            CANVAS — pointer-events: none
            Narzędzia mają własne pełnoekranowe overlaye powyżej canvasa.
            Canvas tylko RYSUJE — nie obsługuje eventów myszy/dotyku.
            ═══════════════════════════════════════════════════════════════ */}
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor: toolToCursor(tool),
            willChange: 'auto',
            imageRendering: 'crisp-edges',
            pointerEvents: 'none',
          }}
        />

        {/* ── KURSORY INNYCH UŻYTKOWNIKÓW ───────────────────────────────── */}
        {canvasWidth > 0 && (
          <div ref={remoteCursorsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
            <RemoteCursorsContainer
              viewport={vp.viewport}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
            />
          </div>
        )}

        {/* ── KALKULATOR ────────────────────────────────────────────────── */}
        {isCalculatorOpen && canvasWidth > 0 && (
          <CalculatorTool
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onViewportChange={handleViewportChange}
            onClose={() => setIsCalculatorOpen(false)}
          />
        )}

        {/* ── HISTORIA AKTYWNOŚCI ───────────────────────────────────────── */}
        <ActivityHistory
          elements={el.elementsWithAuthor}
          viewport={vp.viewport}
          onCenterView={handleCenterViewAndSelectElements}
          onSelectElements={handleSelectElementsFromHistory}
        />

        {/* ── SNAP GUIDES ───────────────────────────────────────────────── */}
        <SnapGuides
          guides={activeGuides}
          viewport={vp.viewport}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />

        {/* ── STATUS INDICATORS ─────────────────────────────────────────── */}
        <StatusIndicators
          isSaving={el.isSaving}
          unsavedCount={el.unsavedElements.size}
          isConnected={rt.isConnected}
        />

        {/* ── MATH CHATBOT ──────────────────────────────────────────────── */}
        {settings.ai_enabled && (
          <MathChatbot
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onAddToBoard={handleChatbotAddToBoard}
            messages={chatMessages}
            setMessages={setChatMessages}
            onActiveChange={setIsCardViewerActive}
            userRole={userRole}
          />
        )}

      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mapuje narzędzie na kursor CSS */
function toolToCursor(tool: Tool): string {
  switch (tool) {
    case 'select':   return 'default';
    case 'pan':      return 'grab';
    case 'pen':      return 'crosshair';
    case 'eraser':   return 'cell';
    case 'text':     return 'text';
    case 'shape':    return 'crosshair';
    case 'function': return 'crosshair';
    case 'image':    return 'copy';
    case 'markdown': return 'crosshair';
    case 'table':    return 'crosshair';
    case 'arrow':    return 'crosshair';    default:         return 'default';
  }
}