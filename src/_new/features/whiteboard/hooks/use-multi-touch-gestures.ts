'use client';

import { useRef, useEffect } from 'react';
import { ViewportTransform } from '@/_new/features/whiteboard/types';

interface TouchPointer {
  id: number;
  x: number;
  y: number;
}

interface UseMultiTouchGesturesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<ViewportTransform>;
  onViewportChange: (viewport: ViewportTransform) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

export function useMultiTouchGestures({
  containerRef,
  viewportRef,
  onViewportChange,
  onGestureStart,
  onGestureEnd,
}: UseMultiTouchGesturesProps) {
  const activePointersRef = useRef<Map<number, TouchPointer>>(new Map());
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistanceRef = useRef<number | null>(null);
  const isGestureActiveRef = useRef(false);
  
  // --- STABILIZACJA GESTU ---
  const isZoomingRef = useRef(false); 
  const initialDistanceRef = useRef<number | null>(null);
  
  // PRÓG STARTU: Zwiększamy do 35px, aby wyeliminować przypadkowy zoom przy ruchu góra-dół
  const ZOOM_START_THRESHOLD = 35; 
  // CZUŁOŚĆ: 0.7 sprawia, że zoom jest bardziej przewidywalny i mniej "nerwowy"
  const ZOOM_SMOOTHING = 0.7; 

  const getCenter = (pointers: TouchPointer[]): { x: number; y: number } => {
    const sum = pointers.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / pointers.length, y: sum.y / pointers.length };
  };

  const getDistance = (p1: TouchPointer, p2: TouchPointer): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

      const pointers = Array.from(activePointersRef.current.values());
      if (pointers.length >= 2 && isGestureActiveRef.current) {
        e.preventDefault();
        e.stopPropagation();

        const newCenter = getCenter(pointers);
        const viewport = viewportRef.current;
        if (!viewport || !lastCenterRef.current || !lastDistanceRef.current) return;

        // 1. LOGIKA ZOOMU (z wysokim progiem wejścia)
        const currentDistance = getDistance(pointers[0], pointers[1]);
        let targetScale = viewport.scale;

        // Aktywuj zoom tylko jeśli zmiana odległości od początku gestu jest znacząca
        if (!isZoomingRef.current && initialDistanceRef.current !== null) {
          const totalDistChange = Math.abs(currentDistance - initialDistanceRef.current);
          if (totalDistChange > ZOOM_START_THRESHOLD) {
            isZoomingRef.current = true;
            // Aby uniknąć przeskoku, ustawiamy lastDistance na obecny, by od teraz liczyć deltę
            lastDistanceRef.current = currentDistance;
          }
        }

        if (isZoomingRef.current) {
          const ratio = currentDistance / lastDistanceRef.current;
          // Zastosuj wygładzanie zmiany skali
          const smoothedRatio = 1 + (ratio - 1) * ZOOM_SMOOTHING;
          targetScale = Math.max(0.1, Math.min(5, viewport.scale * smoothedRatio));
        }

        // 2. LOGIKA PAN (Przesuwanie - zawsze aktywne)
        const deltaX = newCenter.x - lastCenterRef.current.x;
        const deltaY = newCenter.y - lastCenterRef.current.y;

        // 3. MATEMATYKA VIEWPORTU
        const rect = container.getBoundingClientRect();
        const centerX = newCenter.x - rect.left;
        const centerY = newCenter.y - rect.top;
        const scaleFactor = viewport.scale * 100;

        const worldX = viewport.x + (centerX - rect.width / 2) / scaleFactor;
        const worldY = viewport.y + (centerY - rect.height / 2) / scaleFactor;

        onViewportChange({
          scale: targetScale,
          x: worldX - (centerX - rect.width / 2) / (targetScale * 100) - (deltaX / (targetScale * 100)),
          y: worldY - (centerY - rect.height / 2) / (targetScale * 100) - (deltaY / (targetScale * 100)),
        });

        lastCenterRef.current = newCenter;
        lastDistanceRef.current = currentDistance;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activePointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

      const pointers = Array.from(activePointersRef.current.values());
      if (pointers.length >= 2) {
        if (!isGestureActiveRef.current) {
          isGestureActiveRef.current = true;
          isZoomingRef.current = false; 
          onGestureStart?.();
        }
        lastCenterRef.current = getCenter(pointers);
        const dist = getDistance(pointers[0], pointers[1]);
        lastDistanceRef.current = dist;
        initialDistanceRef.current = dist;
        e.stopPropagation();
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      activePointersRef.current.delete(e.pointerId);
      const pointers = Array.from(activePointersRef.current.values());

      if (pointers.length < 2 && isGestureActiveRef.current) {
        isGestureActiveRef.current = false;
        isZoomingRef.current = false;
        onGestureEnd?.();
        lastCenterRef.current = null;
        lastDistanceRef.current = null;
        initialDistanceRef.current = null;
      } else if (pointers.length >= 2) {
        // Reset bazy przy zmianie liczby palców
        lastCenterRef.current = getCenter(pointers);
        const dist = getDistance(pointers[0], pointers[1]);
        lastDistanceRef.current = dist;
        initialDistanceRef.current = dist;
      }
    };

    container.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: false });
    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointercancel', handlePointerUp, { capture: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerUp, { capture: true });
    };
  }, [containerRef, onViewportChange, viewportRef, onGestureStart, onGestureEnd]);
}