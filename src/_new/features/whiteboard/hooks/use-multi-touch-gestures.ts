/**
 * ============================================================================
 * PLIK: src/_new/features/whiteboard/hooks/use-multi-touch-gestures.ts
 * ============================================================================
 */

'use client';

import { useRef, useEffect } from 'react';
import { ViewportTransform } from '@/_new/features/whiteboard/types';
import { constrainViewport } from '@/_new/features/whiteboard/navigation/viewport-math';

interface TouchPointer {
  id: number;
  x: number;
  y: number;
}

interface UseMultiTouchGesturesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<ViewportTransform>;
  onViewportChange: (viewport: ViewportTransform) => void;
}

export function useMultiTouchGestures({
  containerRef,
  viewportRef,
  onViewportChange,
}: UseMultiTouchGesturesProps) {
  const activePointersRef = useRef<Map<number, TouchPointer>>(new Map());
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistanceRef = useRef<number | null>(null);
  const isGestureActiveRef = useRef(false);

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

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;

      activePointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      });

      const pointers = Array.from(activePointersRef.current.values());

      if (pointers.length >= 2) {
        if (!isGestureActiveRef.current) {
          isGestureActiveRef.current = true;
          
          // 🔥 MAGIA (Poprawka z glitchem Długopisu)
          // Wysyłamy pointerup, by narzędzie naturalnie się "puściło"
          // zanim przejmiemy sterowanie nad kamerą
          const cancelEvent = new PointerEvent('pointerup', {
            pointerId: pointers[0].id,
            bubbles: true,
            cancelable: true,
            pointerType: 'touch',
            clientX: pointers[0].x,
            clientY: pointers[0].y,
          });
          e.target?.dispatchEvent(cancelEvent);
        }

        lastCenterRef.current = getCenter(pointers);
        if (pointers.length === 2) {
          lastDistanceRef.current = getDistance(pointers[0], pointers[1]);
        }
        
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!activePointersRef.current.has(e.pointerId)) return;

      activePointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      });

      const pointers = Array.from(activePointersRef.current.values());

      if (pointers.length >= 2 && isGestureActiveRef.current) {
        e.preventDefault();
        e.stopPropagation();

        const newCenter = getCenter(pointers);
        const viewport = viewportRef.current;
        if (!viewport) return;

        if (lastCenterRef.current) {
          const deltaX = newCenter.x - lastCenterRef.current.x;
          const deltaY = newCenter.y - lastCenterRef.current.y;

          let newScale = viewport.scale;

          // 🔥 Pinch-to-Zoom (ZABRANO DŁAWIK /25!)
          if (pointers.length === 2 && lastDistanceRef.current) {
            const newDistance = getDistance(pointers[0], pointers[1]);
            const distanceRatio = newDistance / lastDistanceRef.current;
            
            // Czysty stosunek odległości - idealna, naturalna prędkość
            newScale = Math.max(0.1, Math.min(5, viewport.scale * distanceRatio));
            lastDistanceRef.current = newDistance;
          }

          // 🔥 Pan & Zoom JEDNOCZEŚNIE! (Zabrano dławik 0.03!)
          // 1 px ruchu palca = 1 px ruchu na ekranie
          onViewportChange(constrainViewport({
            ...viewport,
            scale: newScale,
            x: viewport.x - (deltaX / viewport.scale),
            y: viewport.y - (deltaY / viewport.scale),
          }));
          
          lastCenterRef.current = newCenter;
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;

      if (isGestureActiveRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }

      activePointersRef.current.delete(e.pointerId);
      const pointers = Array.from(activePointersRef.current.values());

      if (pointers.length < 2) {
        isGestureActiveRef.current = false;
        lastCenterRef.current = null;
        lastDistanceRef.current = null;
      } else {
        lastCenterRef.current = getCenter(pointers);
        if (pointers.length === 2) {
          lastDistanceRef.current = getDistance(pointers[0], pointers[1]);
        }
      }
    };

    const handlePointerCancel = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activePointersRef.current.delete(e.pointerId);
      const pointers = Array.from(activePointersRef.current.values());

      if (pointers.length < 2) {
        isGestureActiveRef.current = false;
        lastCenterRef.current = null;
        lastDistanceRef.current = null;
      }
    };

    // Faza CAPTURE
    container.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: false });
    window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', handlePointerUp, { capture: true, passive: false });
    window.addEventListener('pointercancel', handlePointerCancel, { capture: true, passive: false });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerCancel, { capture: true });
    };
  }, [containerRef, onViewportChange, viewportRef]);
}