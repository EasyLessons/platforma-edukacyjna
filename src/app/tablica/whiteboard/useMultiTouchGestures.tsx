/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/useMultiTouchGestures.tsx
 * ============================================================================
 * 
 * PRZEZNACZENIE:
 * Hook do obsługi gestów multitouch (2+ palce) na iPadzie/telefonach.
 * 
 * GESTY:
 * - 2 palce: Pan (przesuwanie) + Pinch (zoom)
 * - 1 palec: Rysowanie (normalnie)
 * 
 * WAŻNE:
 * - Działa TYLKO dla pointerType === 'touch' (palce na ekranie)
 * - Touchpad Windows (pointerType === 'mouse') jest całkowicie ignorowany
 * - Gdy gesty aktywne → blokuje rysowanie (isGestureActive = true)
 * ============================================================================
 */

'use client';

import { useRef, useCallback } from 'react';
import { ViewportTransform } from './types';
import { constrainViewport } from './viewport';

interface TouchPointer {
  id: number;
  x: number;
  y: number;
}

interface UseMultiTouchGesturesProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange: (viewport: ViewportTransform) => void;
}

export function useMultiTouchGestures({
  viewport,
  canvasWidth,
  canvasHeight,
  onViewportChange,
}: UseMultiTouchGesturesProps) {
  // Map aktywnych touch pointerów (TYLKO touch, nie pen ani mouse)
  const activePointersRef = useRef<Map<number, TouchPointer>>(new Map());
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistanceRef = useRef<number | null>(null);

  // Czy gesty są aktywne (2+ palce)
  const isGestureActiveRef = useRef(false);

  // Oblicz środek między palcami
  const getCenter = (pointers: TouchPointer[]): { x: number; y: number } => {
    const sum = pointers.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / pointers.length, y: sum.y / pointers.length };
  };

  // Oblicz dystans między dwoma palcami (dla pinch)
  const getDistance = (p1: TouchPointer, p2: TouchPointer): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // 🔥 IGNORUJ wszystko oprócz touch (palce)
    if (e.pointerType !== 'touch') return;

    // Dodaj pointer do mapy
    activePointersRef.current.set(e.pointerId, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    });

    const pointers = Array.from(activePointersRef.current.values());

    // Jeśli 2+ palce → tryb gestów
    if (pointers.length >= 2) {
      isGestureActiveRef.current = true;
      lastCenterRef.current = getCenter(pointers);
      
      // Dla pinch zoom - zapisz początkowy dystans
      if (pointers.length === 2) {
        lastDistanceRef.current = getDistance(pointers[0], pointers[1]);
      }
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // 🔥 IGNORUJ wszystko oprócz touch
    if (e.pointerType !== 'touch') return;
    if (!activePointersRef.current.has(e.pointerId)) return;

    // Aktualizuj pozycję pointera
    activePointersRef.current.set(e.pointerId, {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    });

    const pointers = Array.from(activePointersRef.current.values());

    // Jeśli 2+ palce → obsługuj gesty
    if (pointers.length >= 2 && isGestureActiveRef.current) {
      e.preventDefault();
      e.stopPropagation();

      const newCenter = getCenter(pointers);

      if (lastCenterRef.current) {
        const deltaX = newCenter.x - lastCenterRef.current.x;
        const deltaY = newCenter.y - lastCenterRef.current.y;

        // PINCH ZOOM - sprawdź NAJPIERW czy to zoom (priorytet!)
        let isZooming = false;
        
        if (pointers.length === 2 && lastDistanceRef.current) {
          const newDistance = getDistance(pointers[0], pointers[1]);
          const distanceChange = newDistance - lastDistanceRef.current;
          
          // ✅ ZMNIEJSZONY THRESHOLD dla zoom (20px zamiast 40px)
          if (Math.abs(distanceChange) > 20) {
            isZooming = true; // ← Flaga że zoomujemy
            
            const distanceRatio = newDistance / lastDistanceRef.current;
            
            // ✅ ZWIĘKSZONA CZUŁOŚĆ ZOOM (dzielnik 5 zamiast 10)
            const zoomFactor = 1 + (distanceRatio - 1) / 5;
            const newScale = Math.max(0.1, Math.min(10, viewport.scale * zoomFactor));

            // Oblicz przesunięcie viewportu aby zoom był wokół środka gestów
            const centerWorldX = (newCenter.x - canvasWidth / 2) / viewport.scale - viewport.x;
            const centerWorldY = (newCenter.y - canvasHeight / 2) / viewport.scale - viewport.y;

            const newViewport: ViewportTransform = {
              ...viewport,
              scale: newScale,
              x: (newCenter.x - canvasWidth / 2) / newScale - centerWorldX,
              y: (newCenter.y - canvasHeight / 2) / newScale - centerWorldY,
            };

            onViewportChange(constrainViewport(newViewport));
            lastDistanceRef.current = newDistance;
          }
        }

        // PAN - TYLKO jeśli NIE zoomujemy
        if (!isZooming) {
          // ✅ ODWRÓCONY KIERUNEK (minus zamiast plus)
          // ✅ ZWIĘKSZONA CZUŁOŚĆ PAN (0.8 zamiast 0.05)
          const panSensitivity = 0.8;
          
          const newViewport: ViewportTransform = {
            ...viewport,
            x: viewport.x - (deltaX / viewport.scale) * panSensitivity,
            y: viewport.y - (deltaY / viewport.scale) * panSensitivity,
          };

          onViewportChange(constrainViewport(newViewport));
        }
      }

      lastCenterRef.current = newCenter;
    }
  }, [viewport, canvasWidth, canvasHeig