/**
 * whiteboard-canvas.tsx
 *
 * GŁÓWNY ORKIESTRATOR tablicy. Etap 5 refaktoryzacji.
 *
 * ODPOWIEDZIALNOŚĆ:
 *  - Spina razem 6 hooków: useViewport, useElements, useHistory,
 *    useClipboard, useSelection, useRealtime
 *  - Obsługuje resize canvas + pętlę renderowania (requestAnimationFrame)
 *  - Obsługuje kółko myszy (zoom + pan)
 *  - Obsługuje skróty klawiszowe (Ctrl+Z/Y, Ctrl+C/V/D, Delete, Escape, litery narzędzi)
 *  - Renderuje overlay UI: LoadingOverlay, StatusIndicators, SnapGuides
 *
 * NIE robi:
 *  - Nie zawiera logiki narzędzi (SelectTool, PenTool itp.) — TODO: Etap 6
 *  - Nie zawiera czatu ani SmartSearch — TODO: Etap 6
 *  - Nie zarządza rolami użytkownika złożono (tylko wymuszenie 'pan' dla viewera)
 *
 * STATUS: Etap 5 — gotowy do podłączenia w Etap 6 (tu: budujemy architekturę)
 */

'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

// ─── Nowe hooki ───────────────────────────────────────────────────────────────
import { useViewport } from '../../hooks/use-viewport';
import { useElements } from '../../hooks/use-elements';
import { useHistory } from '../../hooks/use-history';
import { useClipboard } from '../../hooks/use-clipboard';
import { useSelection } from '../../hooks/use-selection';
import { useRealtime } from '../../hooks/use-realtime';

// ─── Nowe komponenty UI ───────────────────────────────────────────────────────
import { LoadingOverlay } from './loading-overlay';
import { StatusIndicators } from './status-indicators';
import { SnapGuides } from './snap-guides';

// ─── Renderowanie (stara, sprawdzona funkcja — nie ruszamy w Etap 5) ──────────
import { drawElement } from '@/app/tablica/whiteboard/rendering';

// ─── Matematyka viewportu ─────────────────────────────────────────────────────
import {
  constrainViewport,
  zoomViewport,
  panViewportWithWheel,
} from '../../navigation/viewport-math';

// ─── Typy ─────────────────────────────────────────────────────────────────────
import type { DrawingElement } from '../../types';
import type { Tool, ShapeType } from '../../types';
import type { GuideLine } from '../../selection/snap-utils';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WhiteboardCanvasNewProps {
  /** ID tablicy (liczba jako string, z URL params) */
  boardId: string;
  /** Ścieżka do folderu z arkuszem PDF do wczytania jako tło — opcjonalne */
  arkuszPath?: string | null;
  /** Rola użytkownika — viewer dostaje tylko narzędzie 'pan' */
  userRole?: 'owner' | 'editor' | 'viewer';
  className?: string;
}

// ─── Komponent ────────────────────────────────────────────────────────────────

/**
 * WhiteboardCanvasNew — etapowa wersja orkiestratora tablicy.
 *
 * Eksportowana jako `default` żeby móc podmienić import w page.tsx w Etap 6.
 * Podczas Etap 5 NIE jest podłączona do produkcyjnego routingu —
 * testowanie odbywa się przez bezpośredni import na potrzeby weryfikacji.
 */
export default function WhiteboardCanvasNew({
  boardId,
  arkuszPath,
  userRole = 'editor',
  className = '',
}: WhiteboardCanvasNewProps) {
  // ─── Refs do DOM ────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Stabilna referencja do boardId — bezpieczna w event handlerach bez closures */
  const boardIdRef = useRef<string>(boardId);
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

  /** Aktywne linie prowadzące snap — ustawiane przez SelectTool podczas przeciągania */
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);

  // Viewer = tylko pan (nie może rysować)
  useEffect(() => {
    if (userRole === 'viewer') setTool('pan');
  }, [userRole]);

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
  });

  // ─── Broadcast viewport throttled ──────────────────────────────────────────
  const lastVpBroadcastRef = useRef(0);
  useEffect(() => {
    // Nie broadcastuj gdy jesteśmy w follow mode
    if (vp.followingUserId) return;
    const now = Date.now();
    if (now - lastVpBroadcastRef.current < 50) return; // 20 FPS max
    lastVpBroadcastRef.current = now;
    rt.broadcastViewportChange(vp.viewport.x, vp.viewport.y, vp.viewport.scale);
  }, [vp.viewport, vp.followingUserId, rt.broadcastViewportChange]);

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

    // Rysuj elementy (markdown + table są renderowane jako HTML overlay, nie canvas)
    for (const element of el.elementsRef.current) {
      drawElement(
        ctx,
        element,
        viewport,
        width,
        height,
        el.loadedImages,
        false,  // debug
        undefined, // onAutoExpand — TODO: Etap 6 (podłączyć autoExpand)
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

  // Przerysuj przy każdej zmianie elementów / viewportu / obrazów
  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      redrawCanvasRef.current();
      rafIdRef.current = null;
    });
  }, [el.elements, el.loadedImages, vp.viewport]);

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
      const ctx = canvas.getContext('2d');
      if (ctx) {
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Wyłącz follow mode gdy user sam nawiguje
      vp.handleStopFollowing();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const current = vp.viewportRef.current;

      const next = e.ctrlKey
        ? zoomViewport(current, e.deltaY, mouseX, mouseY, rect.width, rect.height)
        : panViewportWithWheel(current, e.deltaX, e.deltaY);

      const constrained = constrainViewport(next);
      vp.viewportRef.current = constrained;
      vp.setViewport(constrained);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
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
      // Ctrl+V — wklej
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        clip.handlePaste();
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
          const boardIdNum = parseInt(boardIdRef.current);
          sel.selectedElementIds.forEach((id) => {
            el.removeElement(id);
            rt.broadcastElementDeleted(id);
            if (!isNaN(boardIdNum)) {
              el.deleteElementDirectly(boardIdNum, id).catch(console.error);
            }
          });
          sel.clearSelection();
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
    el.removeElement, el.deleteElementDirectly,
    rt.broadcastElementDeleted,
    userRole,
  ]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ cursor: toolToCursor(tool) }}
    >
      {/* Canvas — renderowanie ścieżek, kształtów, tekstów, obrazów */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
        /**
         * TODO: [Etap 6] Podłączyć handlery zdarzeń myszy/dotyku.
         * Każde narzędzie ma własny komponent (SelectTool, PenTool, ShapeTool itp.)
         * który obsługuje onPointerDown/Move/Up i wywołuje nowe hooki.
         *
         * Przykład dla PenTool:
         *   onPointerDown={tool === 'pen' ? penTool.handlePointerDown : undefined}
         *   onPointerMove={tool === 'pen' ? penTool.handlePointerMove : undefined}
         *   onPointerUp={tool === 'pen' ? penTool.handlePointerUp : undefined}
         */
      />

      {/*
       * TODO: [Etap 6] NAKŁADKI NARZĘDZI (renderowane jako SVG/HTML nad canvasem)
       *
       * ─── SelectTool ──────────────────────────────────────────────────────────
       * <SelectTool
       *   elements={el.elements}
       *   elementsRef={el.elementsRef}
       *   selectedElementIds={sel.selectedElementIds}
       *   setSelectedElementIds={sel.setSelectedElementIds}
       *   viewport={vp.viewport}
       *   viewportRef={vp.viewportRef}
       *   setViewport={vp.setViewport}
       *   canvasRef={canvasRef}
       *   tool={tool}
       *   onElementsUpdate={(updated, ids) => {
       *     updated.forEach(u => el.updateElement(u));
       *     el.markUnsaved(ids);
       *     updated.forEach(u => rt.broadcastElementUpdated(u));
       *   }}
       *   onActiveGuides={setActiveGuides}
       *   boardId={boardId}
       * />
       *
       * ─── PenTool ─────────────────────────────────────────────────────────────
       * <PenTool
       *   tool={tool}
       *   color={color}
       *   lineWidth={lineWidth}
       *   viewport={vp.viewport}
       *   viewportRef={vp.viewportRef}
       *   canvasRef={canvasRef}
       *   onPathCreated={(path) => {
       *     el.addElements([path]);
       *     el.markUnsaved([path.id]);
       *     rt.broadcastElementCreated(path);
       *     hist.pushUserAction({ type: 'create', element: path });
       *   }}
       * />
       *
       * i tak dalej dla ShapeTool, TextTool, FunctionTool, ImageTool, EraserTool, MarkdownTool...
       * Każde narzędzie to ~4 linie konfiguracji dzięki nowej architekturze hooków.
       */}

      {/* Linie snap (niebieskie prowadnice podczas przeciągania) */}
      <SnapGuides
        guides={activeGuides}
        viewport={vp.viewport}
        canvasWidth={canvasRef.current?.offsetWidth ?? 800}
        canvasHeight={canvasRef.current?.offsetHeight ?? 600}
      />

      {/* Wskaźniki stanu (zapisywanie / niezapisane / brak połączenia) */}
      <StatusIndicators
        isSaving={el.isSaving}
        unsavedCount={el.unsavedElements.size}
        isConnected={rt.isConnected}
      />

      {/* Overlay ładowania — zakrywa canvas do momentu gdy wszystko gotowe */}
      <LoadingOverlay
        isLoading={el.isLoading}
        progress={el.loadingProgress}
      />
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
    default:         return 'default';
  }
}
