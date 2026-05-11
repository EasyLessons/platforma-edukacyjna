'use client';

import { useRef, useEffect } from 'react';
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
const MOMENTUM_FRICTION = 0.88;

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

  // Śledzenie aktywnych pointerów (tylko touch, nie pen/mouse)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistanceRef = useRef<number | null>(null);

  const stopMomentum = () => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  };

  const startGesture = () => {
    stopMomentum();
    if (!gestureActiveRef.current) {
      gestureActiveRef.current = true;
      onGestureStart?.();
    }
  };

  const endGesture = (withMomentum = false) => {
    if (!withMomentum) onMomentumEnd?.();
    if (gestureActiveRef.current) {
      gestureActiveRef.current = false;
      onGestureEnd?.();
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getCenter = (pts: { x: number; y: number }[]) => ({
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    });

    const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

    const handlePointerDown = (e: PointerEvent) => {
      // Tylko palce — ignoruj Apple Pencil (pen) i mysz (mouse)
      if (e.pointerType !== 'touch') return;

      container.setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pts = Array.from(pointersRef.current.values());
      if (pts.length >= 2) {
        startGesture();
        lastCenterRef.current = getCenter(pts);
        lastDistanceRef.current = getDistance(pts[0], pts[1]);
        e.preventDefault();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!pointersRef.current.has(e.pointerId)) return;

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pts = Array.from(pointersRef.current.values());
      if (pts.length < 2 || !gestureActiveRef.current) return;

      e.preventDefault();

      const [p0, p1] = pts;
      const newCenter = getCenter(pts);
      const newDistance = getDistance(p0, p1);

      const prevCenter = lastCenterRef.current!;
      const prevDistance = lastDistanceRef.current!;

      const viewport = viewportRef.current;
      const rect = container.getBoundingClientRect();

      // Pan delta w pikselach ekranu
      const dx = newCenter.x - prevCenter.x;
      const dy = newCenter.y - prevCenter.y;

      // Zoom: ratio odległości palców (poprawna matematyka, bez smoothing)
      const distRatio = prevDistance > 0 ? newDistance / prevDistance : 1;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewport.scale * distRatio));

      // Środek gestu względem kontenera
      const centerX = newCenter.x - rect.left;
      const centerY = newCenter.y - rect.top;

      // Punkt świata pod środkiem gestu musi pozostać stały
      const oldScaleFactor = viewport.scale * 100;
      const newScaleFactor = newScale * 100;
      const worldX = viewport.x + (centerX - rect.width / 2) / oldScaleFactor;
      const worldY = viewport.y + (centerY - rect.height / 2) / oldScaleFactor;

      onViewportChange({
        scale: newScale,
        // Nowa pozycja: korekta za zoom + korekta za pan (dx/dy w nowej skali)
        x: worldX - (centerX - rect.width / 2) / newScaleFactor - dx / newScaleFactor,
        y: worldY - (centerY - rect.height / 2) / newScaleFactor - dy / newScaleFactor,
      });

      lastCenterRef.current = newCenter;
      lastDistanceRef.current = newDistance;
    };

    // Śledzimy prędkość do momentum
    const velocityRef = { x: 0, y: 0 };
    const lastMoveTimeRef = { t: 0 };

    const handlePointerMoveVelocity = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const now = performance.now();
      const dt = now - lastMoveTimeRef.t;
      if (dt > 0 && dt < 100) {
        const prev = pointersRef.current.get(e.pointerId);
        if (prev) {
          velocityRef.x = (e.clientX - prev.x) / dt;
          velocityRef.y = (e.clientY - prev.y) / dt;
        }
      }
      lastMoveTimeRef.t = now;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;

      pointersRef.current.delete(e.pointerId);
      const pts = Array.from(pointersRef.current.values());

      if (pts.length < 2 && gestureActiveRef.current) {
        // Koniec gestu — uruchom momentum jeśli była prędkość
        const speed = Math.sqrt(velocityRef.x ** 2 + velocityRef.y ** 2);

        if (speed > 0.2) {
          let velX = -velocityRef.x * 12;
          let velY = -velocityRef.y * 12;

          const tick = () => {
            velX *= MOMENTUM_FRICTION;
            velY *= MOMENTUM_FRICTION;
            if (Math.sqrt(velX ** 2 + velY ** 2) < 0.05) {
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
          endGesture(true);
        } else {
          endGesture(false);
        }

        lastCenterRef.current = null;
        lastDistanceRef.current = null;
        velocityRef.x = 0;
        velocityRef.y = 0;
      } else if (pts.length >= 2) {
        // Zmiana liczby palców — reset bazy bez kończenia gestu
        lastCenterRef.current = getCenter(pts);
        lastDistanceRef.current = getDistance(pts[0], pts[1]);
      }
    };

    // capture: true — przechwytujemy przed narzędziami rysowania
    container.addEventListener('pointerdown', handlePointerDown, { passive: false, capture: true });
    container.addEventListener('pointermove', handlePointerMoveVelocity, { passive: true, capture: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: false, capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointercancel', handlePointerUp, { capture: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      container.removeEventListener('pointermove', handlePointerMoveVelocity, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerUp, { capture: true });
      stopMomentum();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
