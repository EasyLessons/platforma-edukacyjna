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
    scale: 100, // 100 px = 1 jednostka świata
  });

  const [momentum, setMomentum] = useState<MomentumState>({
    velocityX: 0,
    velocityY: 0,
    isActive: false,
    lastTimestamp: 0,
  });

  const [followingUserId, setFollowingUserId] = useState<number | null>(null);

  // Stabilna referencja — event handlery czytają viewportRef.current bez re-rerenderów
  const viewportRef = useRef<ViewportTransform>(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // ─── Follow mode ──────────────────────────────────────────────────────
  const handleFollowUser = useCallback(
    (userId: number, x: number, y: number, scale: number) => {
      setViewport({ x, y, scale });
      setFollowingUserId(userId);
    },
    []
  );

  const handleStopFollowing = useCallback(() => {
    setFollowingUserId(null);
  }, []);

  /**
   * Aplikuj zdalny viewport — wywoływane przez use-realtime.ts gdy przyjdzie
   * event `viewport-changed` od śledzonego użytkownika.
   * Ignoruje update jeśli nie śledzimy tego konkretnego użytkownika.
   */
  const applyRemoteViewport = useCallback(
    (x: number, y: number, scale: number, fromUserId: number) => {
      setFollowingUserId((currentFollowing) => {
        if (currentFollowing === fromUserId) {
          setViewport({ x, y, scale });
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
