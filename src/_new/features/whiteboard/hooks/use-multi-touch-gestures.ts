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

// Progi czułości, by "pan" nie wywoływał "zoomu" przypadkiem
const PINCH_THRESHOLD = 3; // Ignoruj zmiany odległości mniejsze niż 3px

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
          onGestureStart?.();
        }

        lastCenterRef.current = getCenter(pointers);
        if (pointers.length === 2) {
          lastDistanceRef.current = getDistance(pointers[0], pointers[1]);
        }
        e.stopPropagation();
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
        if (!viewport || !lastCenterRef.current) return;

        // 1. OBLICZANIE PAN (Przesuwanie)
        const deltaX = newCenter.x - lastCenterRef.current.x;
        const deltaY = newCenter.y - lastCenterRef.current.y;

        // 2. OBLICZANIE ZOOM (Pinch)
        let newScale = viewport.scale;
        if (pointers.length === 2 && lastDistanceRef.current !== null) {
          const newDistance = getDistance(pointers[0], pointers[1]);
          const distanceDiff = Math.abs(newDistance - lastDistanceRef.current);

          // 🔥 POPRAWKA: Reaguj na zoom tylko jeśli zmiana odległości jest wyraźna
          if (distanceDiff > PINCH_THRESHOLD) {
            const distanceRatio = newDistance / lastDistanceRef.current;
            newScale = Math.max(0.1, Math.min(5, viewport.scale * distanceRatio));
            lastDistanceRef.current = newDistance;
          }
        }

        // 3. MATEMATYKA PIVOTU (Zoom względem środka palców)
        const rect = container.getBoundingClientRect();
        const centerX = newCenter.x - rect.left;
        const centerY = newCenter.y - rect.top;
        const scaleFull = viewport.scale * 100;

        const worldX = viewport.x + (centerX - rect.width / 2) / scaleFull;
        const worldY = viewport.y + (centerY - rect.height / 2) / scaleFull;

        onViewportChange({
          scale: newScale,
          x: worldX - (centerX - rect.width / 2) / (newScale * 100) - (deltaX / (newScale * 100)),
          y: worldY - (centerY - rect.height / 2) / (newScale * 100) - (deltaY / (newScale * 100)),
        });
        
        lastCenterRef.current = newCenter;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      activePointersRef.current.delete(e.pointerId);
      const pointers = Array.from(activePointersRef.current.values());

      if (pointers.length < 2 && isGestureActiveRef.current) {
        isGestureActiveRef.current = false;
        onGestureEnd?.();
        lastCenterRef.current = null;
        lastDistanceRef.current = null;
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