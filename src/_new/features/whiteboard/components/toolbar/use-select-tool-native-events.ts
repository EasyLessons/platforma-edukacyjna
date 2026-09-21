/**
 * Natywne listenery overlaya narzedzia zaznaczania (wydzielone 1:1 z select-tool.tsx, PR-C6):
 * - wheel z { passive: false }: ctrl+kolko = zoom w punkcie, kolko = pan (przez viewportRef,
 *   zeby nie re-subskrybowac przy kazdej zmianie viewportu),
 * - touchmove z preventDefault: obejscie buga Apple Pencil (iOS 14+ Scribble).
 */
import { useEffect, type RefObject } from 'react';
import type { ViewportTransform } from '@/_new/features/whiteboard/types';
import {
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '@/_new/features/whiteboard/navigation/viewport-math';

interface Options {
  overlayRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<ViewportTransform>;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function useSelectToolNativeEvents({
  overlayRef,
  viewportRef,
  canvasWidth,
  canvasHeight,
  onViewportChange,
}: Options) {
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const currentViewport = viewportRef.current;

      if (e.ctrlKey) {
        const rect = overlay?.getBoundingClientRect() ?? { left: 0, top: 0 };
        const newViewport = zoomViewport(
          currentViewport,
          e.deltaY,
          e.clientX - rect.left,
          e.clientY - rect.top,
          canvasWidth,
          canvasHeight
        );
        onViewportChange(constrainViewport(newViewport));
      } else {
        const newViewport = panViewportWithWheel(currentViewport, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    };

    overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleNativeWheel);
  }, [overlayRef, viewportRef, canvasWidth, canvasHeight, onViewportChange]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => overlay.removeEventListener('touchmove', handleTouchMove);
  }, [overlayRef]);
}
