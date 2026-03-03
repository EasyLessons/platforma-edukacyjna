/**
 * use-viewport.ts
 *
 * Zarządza stanem viewportu (przesunięcie + zoom) oraz momentum (kinetic scrolling).
 *
 * ODPOWIEDZIALNOŚĆ:
 *  - Przechowuje pozycję i skalę kamery (`viewport`)
 *  - Przechowuje stan pędu (`momentum`) do płynnego przewijania po puszczeniu palca/kółka
 *  - Trzyma `viewportRef` — stabilna referencja do bieżącego viewportu dla event handlerów
 *  - Zarządza follow mode (śledzenie viewportu innego użytkownika)
 *
 * NIE robi:
 *  - Nie obsługuje eventów myszy/dotyku (to jest w WhiteboardCanvas)
 *  - Nie robi broadcastu do Supabase (to jest w use-realtime.ts)
 *  - Nie przetwarza matematyki transformacji (to jest w navigation/viewport-math.ts)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ViewportTransform, MomentumState } from '../types';

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface UseViewportReturn {
  viewport: ViewportTransform;
  setViewport: React.Dispatch<React.SetStateAction<ViewportTransform>>;
  /** Stabilna referencja — bezpieczna do użycia w event handlerach bez dependency array */
  viewportRef: React.RefObject<ViewportTransform>;
  momentum: MomentumState;
  setMomentum: React.Dispatch<React.SetStateAction<MomentumState>>;
  /** ID użytkownika którego viewport śledzimy, null = nie śledzimy nikogo */
  followingUserId: number | null;
  /** Ustaw viewport i włącz follow mode dla danego użytkownika */
  handleFollowUser: (userId: number, x: number, y: number, scale: number) => void;
  /** Wyłącz follow mode */
  handleStopFollowing: () => void;
  /** Aktualizuj viewport z zewnątrz (np. gdy nadejdzie update od śledzonego użytkownika) */
  applyRemoteViewport: (x: number, y: number, scale: number, fromUserId: number) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useViewport(): UseViewportReturn {
  const [viewport, setViewport] = useState<ViewportTransform>({
    x: 0,
    y: 0,
    scale: 1, // 1.0 = 100% — viewport-math mnoży scale*100 wewnętrznie
  });

  const [momentum, setMomentum] = useState<MomentumState>({
    velocityX: 0,
    velocityY: 0,
    isActive: false,
    lastTimestamp: 0,
  });

  const [followingUserId, setFollowingUserId] = useState<number | null>(null);
  // Target viewport dla smooth follow — interpolujemy w kierunku tego celu
  const followTargetRef = useRef<ViewportTransform | null>(null);

  // Stabilna referencja — event handlery czytają viewportRef.current bez re-rerenderów
  const viewportRef = useRef<ViewportTransform>(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // ─── Smooth follow interpolation loop ───────────────────────────────────
  useEffect(() => {
    if (!followingUserId) return;

    let rafId: number;
    let lastTime = performance.now();

    const interpolate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // max 100ms delta
      lastTime = currentTime;

      const target = followTargetRef.current;
      if (!target) {
        // Brak targetu ale nadal followujemy - czekaj na nowy viewport
        rafId = requestAnimationFrame(interpolate);
        return;
      }

      const current = viewportRef.current;

      // Lerp factor — większy = bardziej responsywny
      const lerpFactor = Math.min(1, dt * 10); // 10 = prędkość

      const newX = current.x + (target.x - current.x) * lerpFactor;
      const newY = current.y + (target.y - current.y) * lerpFactor;
      const newScale = current.scale + (target.scale - current.scale) * lerpFactor;

      // Jeśli blisko celu (< 0.005 jednostek), snap do targetu
      const dx = Math.abs(target.x - newX);
      const dy = Math.abs(target.y - newY);
      const ds = Math.abs(target.scale - newScale);

      if (dx < 0.005 && dy < 0.005 && ds < 0.0005) {
        setViewport(target);
      } else {
        setViewport({ x: newX, y: newY, scale: newScale });
      }

      // ZAWSZE kontynuuj loop dopóki followingUserId jest ustawione
      rafId = requestAnimationFrame(interpolate);
    };

    rafId = requestAnimationFrame(interpolate);
    return () => cancelAnimationFrame(rafId);
  }, [followingUserId]);

  // ─── Follow mode ──────────────────────────────────────────────────────
  const handleFollowUser = useCallback(
    (userId: number, x: number, y: number, scale: number) => {
      // Natychmiastowy skok przy pierwszym follow (żeby user od razu zobaczył cel)
      setViewport({ x, y, scale });
      followTargetRef.current = { x, y, scale };
      setFollowingUserId(userId);
    },
    []
  );

  const handleStopFollowing = useCallback(() => {
    setFollowingUserId(null);
    followTargetRef.current = null;
  }, []);

  /**
   * Aplikuj zdalny viewport — wywoływane przez use-realtime.ts gdy przyjdzie
   * event `viewport-changed` od śledzonego użytkownika.
   * Smooth interpolacja w kierunku nowego celu (followTargetRef).
   */
  const applyRemoteViewport = useCallback(
    (x: number, y: number, scale: number, fromUserId: number) => {
      setFollowingUserId((currentFollowing) => {
        if (currentFollowing === fromUserId) {
          // Ustaw nowy target — RAF loop będzie interpolował
          followTargetRef.current = { x, y, scale };
        }
        return currentFollowing;
      });
    },
    []
  );

  return {
    viewport,
    setViewport,
    viewportRef,
    momentum,
    setMomentum,
    followingUserId,
    handleFollowUser,
    handleStopFollowing,
    applyRemoteViewport,
  };
}
