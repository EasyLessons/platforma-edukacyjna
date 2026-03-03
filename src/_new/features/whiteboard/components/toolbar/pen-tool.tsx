/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/PenTool.tsx
 * ============================================================================
 *
 * IMPORTUJE Z:
 * - react (useState, useCallback)
 * - ../whiteboard/types (Point, ViewportTransform, DrawingPath)
 * - ../whiteboard/viewport (inverseTransformPoint, zoomViewport, panViewportWithWheel, constrainViewport)
 *
 * EKSPORTUJE:
 * - PenTool (component) - narzędzie rysowania piórem
 *
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (aktywne gdy tool === 'pen')
 *
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - używa DrawingPath
 * - viewport.ts - używa funkcji transformacji i zoom/pan
 * - WhiteboardCanvas.tsx - dostarcza callback'i: onPathCreate, onViewportChange
 *
 * ⚠️ WAŻNE - WHEEL EVENTS:
 * - Overlay ma touchAction: 'none' - blokuje domyślny zoom przeglądarki
 * - onWheel obsługuje zoom (Ctrl+scroll) i pan (scroll)
 * - Współdzieli viewport z WhiteboardCanvas przez onViewportChange
 *
 * PRZEZNACZENIE:
 * Rysowanie ścieżek piórem - płynne linie rysowane myszką/touchem.
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, ViewportTransform, DrawingPath } from '@/_new/features/whiteboard/types';
import {
  inverseTransformPoint,
  transformPoint,
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '@/_new/features/whiteboard/navigation/viewport-math';
import { clampLineWidth } from '@/_new/features/whiteboard/elements/math-eval';
import { useMultiTouchGestures } from '@/_new/features/whiteboard/hooks/use-multi-touch-gestures';

interface PenToolProps {
  viewport: ViewportTransform;
  /** Stabilna referencja do aktualnego viewportu (z whiteboard-canvas) — używana w event handlerach */
  viewportRef?: React.RefObject<ViewportTransform>;
  canvasWidth: number;
  canvasHeight: number;
  color: string;
  lineWidth: number;
  onPathCreate: (path: DrawingPath) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function PenTool({
  viewport,
  viewportRef: canvasViewportRef,
  canvasWidth,
  canvasHeight,
  color,
  lineWidth,
  onPathCreate,
  onViewportChange,
}: PenToolProps) {
  /** Zawsze używaj najbardziej aktualnego viewportu z canvasViewportRef (bez opóźnienia debounce) */
  const getViewport = () => canvasViewportRef?.current ?? viewport;
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef<DrawingPath | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const widthsRef = useRef<number[]>([]); // 🆕 Grubości dla każdego punktu
  const lastTimestampRef = useRef<number>(0); // 🆕 Timestamp ostatniego punktu
  const [, forceUpdate] = useState({});

  // 🆕 Pen Mode - jak w Excalidraw: blokuj touch gdy używamy pióra
  const isPenModeRef = useRef(false);

  // 🆕 Multi-touch gestures (2+ palce = pan/zoom)
  const gestures = useMultiTouchGestures({
    viewport,
    canvasWidth,
    canvasHeight,
    onViewportChange: onViewportChange || (() => {}),
  });

  // Wheel events dla pan/zoom - używamy native event listener dla { passive: false }
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Użyj canvasViewportRef jeśli dostępny (bez opóźnienia debounce)
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

  // Pointer down - rozpocznij rysowanie (obsługuje mysz, tablet, touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    // 🆕 Wykryj czy to pióro i aktywuj pen mode (jak Excalidraw)
    if (e.pointerType === 'pen') {
      isPenModeRef.current = true;
    }

    // 🆕 W pen mode: BLOKUJ wszystko oprócz pen (blokuje palce gdy pióro aktywne)
    if (isPenModeRef.current && e.pointerType !== 'pen') {
      return;
    }

    // 🆕 Najpierw przekaż do gesture handler
    gestures.handlePointerDown(e);

    // 🆕 Jeśli gesty aktywne (2+ palce touch) → blokuj rysowanie
    if (gestures.isGestureActive()) return;

    // Tylko lewy przycisk myszy (button === 0) lub pen/touch (button === 0 lub -1)
    if (e.button !== 0 && e.button !== -1) return;

    e.preventDefault();
    e.stopPropagation();

    // Przechwytuj pointer events
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const overlayRect = overlayRef.current?.getBoundingClientRect();
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    // 🔴 DEBUG — usuń po naprawie
    console.log('🔴 PEN DEBUG pointerDown:', {
      clientX: e.clientX,
      clientY: e.clientY,
      overlayRect: overlayRect ? { left: overlayRect.left, top: overlayRect.top, width: overlayRect.width, height: overlayRect.height } : null,
      screenPoint,
      viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale },
      canvasWidth,
      canvasHeight,
      worldPoint,
    });

    pointsRef.current = [worldPoint];
    
    // 🆕 Variable width tylko dla pędzla, nie dla highlightera
    const isHighlighter = lineWidth >= 20;
    if (!isHighlighter) {
      widthsRef.current = [lineWidth]; // 🆕 Pierwsza szerokość to bazowa szerokość
      lastTimestampRef.current = performance.now(); // 🆕 Timestamp rozpoczęcia
    } else {
      widthsRef.current = []; // Highlighter nie używa variable width
    }

    const newPath: DrawingPath = {
      id: Date.now().toString(),
      type: 'path',
      points: pointsRef.current,
      color,
      width: lineWidth,
      opacity: isHighlighter ? 0.2 : undefined,
    };

    currentPathRef.current = newPath;
    isDrawingRef.current = true;
    // Wymuszaj natychmiastowy render pierwszego punktu
    forceUpdate({});
  };

  // Pointer move - kontynuuj rysowanie (obsługuje mysz, tablet, touch)
  const handlePointerMove = (e: React.PointerEvent) => {
    // 🆕 W pen mode: BLOKUJ wszystko oprócz pen
    if (isPenModeRef.current && e.pointerType !== 'pen') {
      return;
    }

    // 🆕 Najpierw przekaż do gesture handler
    gestures.handlePointerMove(e);

    // 🆕 Jeśli gesty aktywne → nie rysuj
    if (gestures.isGestureActive()) return;

    if (!isDrawingRef.current || !currentPathRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const overlayRect = overlayRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const screenPoint = { x: e.clientX - overlayRect.left, y: e.clientY - overlayRect.top };
    const worldPoint = inverseTransformPoint(screenPoint, getViewport(), canvasWidth, canvasHeight);

    // Wygładzanie - dodaj punkt tylko jeśli jest wystarczająco daleko od poprzedniego
    const lastPoint = pointsRef.current[pointsRef.current.length - 1];
    if (lastPoint) {
      const dx = worldPoint.x - lastPoint.x;
      const dy = worldPoint.y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Minimalna odległość między punktami (w jednostkach świata)
      // Im większa wartość, tym bardziej wygładzona linia
      const minDistance = 0.001 * (viewport.scale || 1); // Skaluj minimalną odległość wraz z zoomem
      
      if (distance < minDistance) {
        return; // Pomiń ten punkt - zbyt blisko poprzedniego
      }

      // 🆕 Oblicz szybkość rysowania dla pressure-sensitive width
      // Tylko dla cienkich linii (pędzel), highlighter ma stałą grubość
      const isHighlighter = lineWidth >= 20;
      
      if (!isHighlighter) {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTimestampRef.current;
        lastTimestampRef.current = currentTime;

        // Szybkość = odległość / czas (w jednostkach świata na milisekundę)
        const speed = deltaTime > 0 ? distance / deltaTime : 0;

        // Mapowanie szybkości na grubość:
        // - Wolne rysowanie (speed < 0.5) → 100% bazowej grubości
        // - Szybkie rysowanie (speed > 2) → 50% bazowej grubości
        // Używamy funkcji wykładniczej dla płynnego przejścia
        const speedFactor = Math.exp(-speed * 0.5); // Wykładnicze zanikanie
        const minWidthRatio = 0.5; // Minimalna grubość to 50% bazowej
        const widthMultiplier = minWidthRatio + (1 - minWidthRatio) * speedFactor;
        
        const newWidth = lineWidth * widthMultiplier;
        widthsRef.current.push(newWidth);
      }
    }

    // Dodaj punkt bezpośrednio do ref (bez kopiowania całej tablicy)
    pointsRef.current.push(worldPoint);

    // Wymuszaj re-render dla płynnego podglądu
    forceUpdate({});
  };

  // Pointer up - zakończ rysowanie (obsługuje mysz, tablet, touch)
  const handlePointerUp = (e: React.PointerEvent) => {
    // 🆕 Przekaż do gesture handler
    gestures.handlePointerUp(e);

    if (!isDrawingRef.current) return;

    // Zwolnij pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (currentPathRef.current && pointsRef.current.length >= 1) {
      // Utwórz finalną ścieżkę z kopiami punktów
      const finalPath: DrawingPath = {
        ...currentPathRef.current,
        points: [...pointsRef.current],
        widths: widthsRef.current.length > 0 ? [...widthsRef.current] : undefined, // 🆕 Dodaj widths jeśli są
      };
      onPathCreate(finalPath);
    }

    isDrawingRef.current = false;
    currentPathRef.current = null;
    pointsRef.current = [];
    widthsRef.current = []; // 🆕 Wyczyść widths

    // 🆕 Wyłącz pen mode po 1 sekundzie nieaktywości (jak Excalidraw)
    setTimeout(() => {
      if (!isDrawingRef.current) {
        isPenModeRef.current = false;
      }
    }, 1000);
  };

  // Pointer cancel - anuluj rysowanie
  const handlePointerCancel = (e: React.PointerEvent) => {
    // 🆕 Przekaż do gesture handler
    gestures.handlePointerCancel(e);

    if (!isDrawingRef.current) return;

    // Zwolnij pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    isDrawingRef.current = false;
    currentPathRef.current = null;
    pointsRef.current = [];
    widthsRef.current = []; // 🆕 Wyczyść widths
  };

  // Render preview path (rysowanie w trakcie)
  const renderPreviewPath = () => {
    if (!currentPathRef.current || pointsRef.current.length === 0) return null;

    // Transformuj punkty ze współrzędnych świata na ekran
    const pathData = pointsRef.current
      .map((p, i) => {
        const screenPoint = transformPoint(p, viewport, canvasWidth, canvasHeight);
        return i === 0
          ? `M ${screenPoint.x} ${screenPoint.y}`
          : `L ${screenPoint.x} ${screenPoint.y}`;
      })
      .join(' ');

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-40"
        style={{ width: canvasWidth, height: canvasHeight }}
      >
        <path
          d={pathData}
          stroke={currentPathRef.current.color}
          strokeWidth={clampLineWidth(currentPathRef.current.width, viewport.scale)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={currentPathRef.current.opacity ?? 1}
        />
      </svg>
    );
  };

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: 'crosshair' }}>
      {/* Overlay dla mouse events */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {/* Preview path */}
      {renderPreviewPath()}
    </div>
  );
}

