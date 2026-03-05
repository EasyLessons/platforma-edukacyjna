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

  // --- PARAMETRY STABILIZACJI ---
  const ZOOM_DEADZONE_PX = 8;    // Ignoruj zmianę odległości mniejszą niż 8 pikseli (kluczowe dla Panu)
  const ZOOM_SENSITIVITY = 0.8;  // Zmniejsz czułość zoomu (0.8 = wolniejszy, stabilniejszy)

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

        // 1. OBLICZANIE ZOOMU Z PROGIEM (Deadzone)
        const newDistance = getDistance(pointers[0], pointers[1]);
        const distanceDiff = newDistance - lastDistanceRef.current;
        
        let targetScale = viewport.scale;

        // Reagujemy na zoom tylko, gdy palce faktycznie się zbliżyły/oddaliły o więcej niż próg
        if (Math.abs(distanceDiff) > ZOOM_DEADZONE_PX) {
          const ratio = newDistance / lastDistanceRef.current;
          // Zastosowanie czułości, by zoom nie był zbyt gwałtowny
          const adjustedRatio = 1 + (ratio - 1) * ZOOM_SENSITIVITY;
          targetScale = Math.max(0.1, Math.min(5, viewport.scale * adjustedRatio));
          
          // Aktualizujemy bazę odległości dopiero po przekroczeniu progu, 
          // żeby uniknąć "pływania" skali przy Panu
          lastDistanceRef.current = newDistance;
        }

        // 2. OBLICZANIE PAN (Zawsze płynne)
        const deltaX = newCenter.x - lastCenterRef.current.x;
        const deltaY = newCenter.y - lastCenterRef.current.y;

        // 3. MATEMATYKA PIVOTU
        const rect = container.getBoundingClientRect();
        const centerX = newCenter.x - rect.left;
        const centerY = newCenter.y - rect.top;
        const currentScaleFactor = viewport.scale * 100;

        const worldX = viewport.x + (centerX - rect.width / 2) / currentScaleFactor;
        const worldY = viewport.y + (centerY - rect.height / 2) / currentScaleFactor;

        onViewportChange({
          scale: targetScale,
          x: worldX - (centerX - rect.width / 2) / (targetScale * 100) - (deltaX / (targetScale * 100)),
          y: worldY - (centerY - rect.height / 2) / (targetScale * 100) - (deltaY / (targetScale * 100)),
        });

        lastCenterRef.current = newCenter;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activePointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

      const pointers = Array.from(activePointersRef.current.values());
      if (pointers.length >= 2) {
        if (!isGestureActiveRef.current) {
          isGestureActiveRef.current = true;
          onGestureStart?.();
        }
        lastCenterRef.current = getCenter(pointers);
        lastDistanceRef.current = getDistance(pointers[0], pointers[1]);
        e.stopPropagation();
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
      } else if (pointers.length >= 2) {
        lastCenterRef.current = getCenter(pointers);
        lastDistanceRef.current = getDistance(pointers[0], pointers[1]);
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