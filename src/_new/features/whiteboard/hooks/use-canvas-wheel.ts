'use client';

import { useEffect, useRef } from 'react';
import type { ViewportTransform } from '../types';
import {
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '../navigation/viewport-math';

interface UseCanvasWheelProps {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  viewport: ViewportTransform;
  onViewportChange: ((vp: ViewportTransform) => void) | undefined;
  /** Opcjonalny ref bezpośrednio z canvasu — omija debounce Reacta.
   *  Używaj gdy komponent ma dostęp do `h.viewportRef` (np. pen-tool). */
  viewportRefOverride?: React.RefObject<ViewportTransform>;
  /** Gdy true — handler odpala się ale natychmiast wraca bez zmiany widoku.
   *  Używaj dla narzędzi z modalnymi popupami (np. table-tool z showConfig). */
  disabled?: boolean;
}

/**
 * Rejestruje natywny listener `wheel` na `overlayRef` dokładnie RAZ przez cały
 * cykl życia narzędzia (deps = [canvasWidth, canvasHeight]).
 *
 * Wzorzec "zamrożonych referencji" (viewportRef + onViewportChangeRef) zapewnia,
 * że handler zawsze widzi aktualne wartości bez ponownego montowania listenera
 * przy każdej zmianie viewportu (co zdarzałoby się 60×/s podczas scrollowania).
 */
export function useCanvasWheel({
  overlayRef,
  canvasWidth,
  canvasHeight,
  viewport,
  onViewportChange,
  viewportRefOverride,
  disabled,
}: UseCanvasWheelProps): void {
  // Zamroź viewport w stabilnym recie — aktualizowany przy każdym renderze O(1)
  const internalViewportRef = useRef(viewport);
  useEffect(() => { internalViewportRef.current = viewport; }, [viewport]);

  // Zamroź callback — bez tego listener musiałby się re-subscribe przy każdej
  // zmianie referencji onViewportChange z rodzica
  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);

  // Zamroź disabled — zmiana stanu popupa nie powoduje re-mount listenera
  const disabledRef = useRef(disabled ?? false);
  useEffect(() => { disabledRef.current = disabled ?? false; }, [disabled]);

  // Listener montowany dokładnie RAZ — viewport i callback celowo poza deps
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return; // DOM niegotowy — nie rejestruj (bez warunku na callback:
                          // callback może pojawić się po mount, listener musi już być)

    const handleWheel = (e: WheelEvent) => {
      if (disabledRef.current || !onViewportChangeRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      // viewportRefOverride (np. h.viewportRef z canvasu) omija debounce Reacta;
      // fallback na internalViewportRef synchronizowany z propem
      const vp = viewportRefOverride?.current ?? internalViewportRef.current;

      if (e.ctrlKey) {
        const rect = overlay.getBoundingClientRect();
        onViewportChangeRef.current(constrainViewport(
          zoomViewport(vp, e.deltaY, e.clientX - rect.left, e.clientY - rect.top, canvasWidth, canvasHeight)
        ));
      } else {
        onViewportChangeRef.current(constrainViewport(
          panViewportWithWheel(vp, e.deltaX, e.deltaY)
        ));
      }
    };

    overlay.addEventListener('wheel', handleWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleWheel);
  }, [canvasWidth, canvasHeight]); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ viewport i onViewportChange celowo pominięte — czytane przez stabilne refs
}
