/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/PanTool.tsx
 * ============================================================================
 *
 * IMPORTUJE Z:
 * - react (useState, useCallback)
 * - ../whiteboard/types (Point, ViewportTransform)
 * - ../whiteboard/viewport (panViewportWithMouse, zoomViewport, panViewportWithWheel, constrainViewport)
 *
 * EKSPORTUJE:
 * - PanTool (component) - narzędzie przesuwania viewport
 *
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (aktywne gdy tool === 'pan')
 *
 * ⚠️ ZALEŻNOŚCI:
 * - viewport.ts - używa funkcji transformacji i zoom/pan
 * - WhiteboardCanvas.tsx - dostarcza callback: onViewportChange
 *
 * ⚠️ WAŻNE - WHEEL EVENTS:
 * - Overlay ma touchAction: 'none' - blokuje domyślny zoom przeglądarki
 * - onWheel obsługuje zoom (Ctrl+scroll) i pan (scroll)
 * - Drag to pan (LMB lub środkowy przycisk myszy)
 *
 * PRZEZNACZENIE:
 * Przesuwanie viewport przez przeciąganie myszką lub scroll/pinch.
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, ViewportTransform } from '@/_new/features/whiteboard/types';
import {
  panViewportWithMouse,
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '@/_new/features/whiteboard/navigation/viewport-math';
import { useMultiTouchGestures } from '@/_new/features/whiteboard/hooks/use-multi-touch-gestures';

interface PanToolProps {
  viewport: ViewportTransform;
  /** Stabilna referencja do aktualnego viewportu (z whiteboard-canvas) — używana w event handlerach */
  viewportRef?: React.RefObject<ViewportTransform>;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange: (viewport: ViewportTransform) => void;
  /** Wywoływane gdy użytkownik zaczyna ciągnąć canvas — ukryj overlaye */
  onPanStart?: () => void;
  /** Wywoływane gdy użytkownik puści canvas — pokaż overlaye */
  onPanEnd?: () => void;
}

export function PanTool({ viewport, viewportRef: canvasViewportRef, canvasWidth, canvasHeight, onViewportChange, onPanStart, onPanEnd }: PanToolProps) {
  /** Refs zamiast state — eliminują stale closures w hot-path pointer events */
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef<Point | null>(null);
  // Stan tylko do aktualizacji kursora (cursor: grabbing vs grab)
  const [isPanningVisual, setIsPanningVisual] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  /** Zawsze używaj najbardziej aktualnego viewportu (bez opóźnienia debounce) */
  const getViewport = () => canvasViewportRef?.current ?? viewport;

  const gestures = useMultiTouchGestures({
    viewport,
    canvasWidth,
    canvasHeight,
    onViewportChange,
  });

  // 🍎 FIX: Apple Pencil bug z iOS 14+ Scribble
  // Dodanie preventDefault na touchmove naprawia problem z brakującymi eventami Apple Pencil
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => overlay.removeEventListener('touchmove', handleTouchMove);
  }, []);

  // 🆕 Native wheel listener — musi być non-passive żeby preventDefault działał
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Użyj canvasViewportRef — bez opóźnienia debounce 80ms
      const vp = canvasViewportRef?.current ?? viewport;
      if (e.ctrlKey) {
        // Przelicz pozycję myszy względem canvas (nie przeglądarki)
        const rect = overlay?.getBoundingClientRect() ?? { left: 0, top: 0 };
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const newViewport = zoomViewport(
          vp,
          e.deltaY,
          mouseX,
          mouseY,
          canvasWidth,
          canvasHeight
        );
        onViewportChange(constrainViewport(newViewport));
      } else {
        const newViewport = panViewportWithWheel(vp, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    };

    overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleNativeWheel);
  }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

  // Pointer down - rozpocznij panning
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      gestures.handlePointerDown(e);
      if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        setIsPanningVisual(true);
        onPanStart?.();
      }
    },
    [gestures, onPanStart]
  );

  // Pointer move - kontynuuj panning
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      gestures.handlePointerMove(e);
      if (gestures.isGestureActive()) return; // Gesty mają priorytet

      if (!isPanningRef.current || !lastMousePosRef.current) return;

      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      // Zawsze używaj aktualnego viewportu z canvasViewportRef
      const newViewport = panViewportWithMouse(getViewport(), dx, dy);
      onViewportChange(constrainViewport(newViewport));

      // Aktualizuj ref natychmiast (bez setState — brak re-renderu)
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    },
    [gestures, onViewportChange]
  );

  // Pointer up - zakończ panning
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      gestures.handlePointerUp(e);
      if (isPanningRef.current) {
        onPanEnd?.();
      }
      isPanningRef.current = false;
      lastMousePosRef.current = null;
      setIsPanningVisual(false);
    },
    [gestures, onPanEnd]
  );

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: isPanningVisual ? 'grabbing' : 'grab' }}>
      {/* Overlay dla pointer events */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}

