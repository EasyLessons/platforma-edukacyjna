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

      // PAN - przesuwanie na podstawie ruchu środka
      if (lastCenterRef.current) {
        const deltaX = newCenter.x - lastCenterRef.current.x;
        const deltaY = newCenter.y - lastCenterRef.current.y;

        // ✅ POPRAWKA 1: Odwrócony kierunek pan (minus zamiast plus)
        // ✅ POPRAWKA 2: Zmniejszona czułość pan (mnożenie przez 0.6)
        const panSensitivity = 0.1; // ← Dostosuj: 0.5 = spokojniejsze, 1.0 = szybsze
        
        const newViewport: ViewportTransform = {
          ...viewport,
          x: viewport.x + (deltaX / viewport.scale) * panSensitivity,
          y: viewport.y + (deltaY / viewport.scale) * panSensitivity,
        };

        // PINCH ZOOM - tylko jeśli dokładnie 2 palce
        if (pointers.length === 2 && lastDistanceRef.current) {
          const newDistance = getDistance(pointers[0], pointers[1]);
          const distanceChange = newDistance - lastDistanceRef.current;
          
          // ✅ POPRAWKA 3: Większy threshold dla zoom (80px zamiast 10px)
          if (Math.abs(distanceChange) > 40) {
            const distanceRatio = newDistance / lastDistanceRef.current;
            
            // 🔥 ZMNIEJSZ CZUŁOŚĆ: zamiast pełnego ratio, użyj bardziej subtelnej zmiany
            const zoomFactor = 1 + (distanceRatio - 1) / 10;
            const newScale = Math.max(0.1, Math.min(10, viewport.scale * zoomFactor));

            // Oblicz przesunięcie viewportu aby zoom był wokół środka gestów
            const centerWorldX = (newCenter.x - canvasWidth / 2) / viewport.scale - viewport.x;
            const centerWorldY = (newCenter.y - canvasHeight / 2) / viewport.scale - viewport.y;

            newViewport.scale = newScale;
            newViewport.x = (newCenter.x - canvasWidth / 2) / newScale - centerWorldX;
            newViewport.y = (newCenter.y - canvasHeight / 2) / newScale - centerWorldY;

            lastDistanceRef.current = newDistance;
          }
        }

        onViewportChange(constrainViewport(newViewport));
      }

      lastCenterRef.current = newCenter;
    }
  }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // 🔥 IGNORUJ wszystko oprócz touch
    if (e.pointerType !== 'touch') return;

    // Usuń pointer z mapy
    activePointersRef.current.delete(e.pointerId);

    const pointers = Array.from(activePointersRef.current.values());

    // Jeśli zostało mniej niż 2 palce → wyłącz tryb gestów
    if (pointers.length < 2) {
      isGestureActiveRef.current = false;
      lastCenterRef.current = null;
      lastDistanceRef.current = null;
    } else {
      // Zaktualizuj centrum i dystans dla pozostałych palców
      lastCenterRef.current = getCenter(pointers);
      if (pointers.length === 2) {
        lastDistanceRef.current = getDistance(pointers[0], pointers[1]);
      }
    }
  }, []);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    // 🔥 IGNORUJ wszystko oprócz touch
    if (e.pointerType !== 'touch') return;

    // Wyczyść wszystko
    activePointersRef.current.clear();
    isGestureActiveRef.current = false;
    lastCenterRef.current = null;
    lastDistanceRef.current = null;
  }, []);

  // Zwróć czy gesty są aktywne (do blokowania rysowania)
  const isGestureActive = () => isGestureActiveRef.current;

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    isGestureActive,
  };
}