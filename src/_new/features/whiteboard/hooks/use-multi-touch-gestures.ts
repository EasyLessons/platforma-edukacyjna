'use client';

import { useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { ViewportTransform } from '@/_new/features/whiteboard/types';

interface UseMultiTouchGesturesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<ViewportTransform>;
  onViewportChange: (viewport: ViewportTransform) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  /** Wołany gdy momentum dobiegnie końca — sygnał do synchronizacji stanu React */
  onMomentumEnd?: () => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;

export function useMultiTouchGestures({
  containerRef,
  viewportRef,
  onViewportChange,
  onGestureStart,
  onGestureEnd,
  onMomentumEnd,
}: UseMultiTouchGesturesProps) {
  const gestureActiveRef = useRef(false);
  const momentumRafRef = useRef<number | null>(null);

  const startGesture = () => {
    // Anuluj ewentualne momentum z poprzedniego gestu
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
    if (!gestureActiveRef.current) {
      gestureActiveRef.current = true;
      onGestureStart?.();
    }
  };

  const endGesture = () => {
    if (gestureActiveRef.current) {
      gestureActiveRef.current = false;
      onGestureEnd?.();
    }
  };

  useGesture(
    {
      // ── PINCH (zoom + pan środkiem pincha) ────────────────────────────────
      onPinchStart() {
        startGesture();
      },

      onPinch({ origin, delta: [ds], touches }) {
        // onPinch odpala też dla wheel+ctrl — chcemy tylko touch
        if (touches < 2) return;

        const container = containerRef.current;
        if (!container) return;

        const viewport = viewportRef.current;
        const rect = container.getBoundingClientRect();

        // Środek pincha względem lewego-górnego rogu kontenera
        const originX = origin[0] - rect.left;
        const originY = origin[1] - rect.top;

        // delta[0] = przyrost mnożnika skali od poprzedniej klatki
        // @use-gesture liczy: ds = currentDistance / prevDistance
        // Nowa skala = stara * ds (clamp do [MIN, MAX])
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewport.scale * ds));

        // Punkt świata pod środkiem pincha musi pozostać stały po zmianie skali
        const oldScaleFactor = viewport.scale * 100;
        const newScaleFactor = newScale * 100;
        const worldX = viewport.x + (originX - rect.width / 2) / oldScaleFactor;
        const worldY = viewport.y + (originY - rect.height / 2) / oldScaleFactor;

        onViewportChange({
          scale: newScale,
          x: worldX - (originX - rect.width / 2) / newScaleFactor,
          y: worldY - (originY - rect.height / 2) / newScaleFactor,
        });
      },

      onPinchEnd() {
        endGesture();
        onMomentumEnd?.();
      },

      // ── DRAG dwoma palcami (pan tablicy) ─────────────────────────────────
      onDragStart({ touches }) {
        if (touches < 2) return;
        startGesture();
      },

      onDrag({ delta: [dx, dy], touches, velocity: [vx, vy], last, direction: [dirX, dirY] }) {
        if (touches < 2 && !last) return;

        const viewport = viewportRef.current;
        const scaleFactor = viewport.scale * 100;

        if (!last) {
          onViewportChange({
            ...viewport,
            x: viewport.x - dx / scaleFactor,
            y: viewport.y - dy / scaleFactor,
          });
        } else {
          // Po zakończeniu gestu: momentum z prędkością z chwili puszczenia
          const speed = Math.sqrt(vx * vx + vy * vy);

          if (speed > 0.3) {
            // @use-gesture velocity jest w px/ms, przeliczamy na sensowne jednostki
            let velX = -dirX * Math.min(speed, 3) * 8;
            let velY = -dirY * Math.min(speed, 3) * 8;
            const FRICTION = 0.88;

            const tick = () => {
              velX *= FRICTION;
              velY *= FRICTION;
              if (Math.sqrt(velX * velX + velY * velY) < 0.05) {
                momentumRafRef.current = null;
                onMomentumEnd?.();
                return;
              }
              const vp = viewportRef.current;
              onViewportChange({
                ...vp,
                x: vp.x + velX / (vp.scale * 100),
                y: vp.y + velY / (vp.scale * 100),
              });
              momentumRafRef.current = requestAnimationFrame(tick);
            };
            momentumRafRef.current = requestAnimationFrame(tick);
          } else {
            // Brak momentum — od razu sygnalizuj koniec
            onMomentumEnd?.();
          }

          endGesture();
        }
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      drag: {
        filterTaps: true,
        pointer: { touch: true },
        // Threshold w px zanim drag się aktywuje — eliminuje przypadkowe dragi przy tapie
        threshold: 4,
      },
      pinch: {
        scaleBounds: { min: MIN_SCALE, max: MAX_SCALE },
        // rubberband: lekkie "odbijanie" przy krańcach skali
        rubberband: 0.2,
        pointer: { touch: true },
      },
    }
  );
}
