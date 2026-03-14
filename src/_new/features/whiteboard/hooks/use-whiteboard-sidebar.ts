/**
 * use-whiteboard-sidebar.ts
 *
 * Sidebar ma dwa tryby otwarcia:
 * - manual: klik toggle w headerze (pozostaje otwarty)
 * - hover: krótki hover przy lewej krawędzi (zamyka się po opuszczeniu sidebaru)
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export const SIDEBAR_WIDTH = 344;

const EDGE_THRESHOLD_PX = 8;
const EDGE_CANCEL_PX = 16;
const HOVER_OPEN_DELAY_MS = 320;

type SidebarMode = 'manual' | 'hover' | null;

export interface WhiteboardSidebarState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  closeFromHoverLeave: () => void;
}

export function useWhiteboardSidebar(): WhiteboardSidebarState {
  const [mode, setMode] = useState<SidebarMode>(null);
  const modeRef = useRef<SidebarMode>(null);
  const hoverOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const clearHoverTimer = useCallback(() => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const currentMode = modeRef.current;

      // Gdy sidebar otwarty manualnie — hover edge nic nie robi.
      if (currentMode === 'manual') return;

      if (e.clientX <= EDGE_THRESHOLD_PX) {
        if (!hoverOpenTimerRef.current && currentMode === null) {
          hoverOpenTimerRef.current = setTimeout(() => {
            hoverOpenTimerRef.current = null;
            if (modeRef.current === null) {
              setMode('hover');
            }
          }, HOVER_OPEN_DELAY_MS);
        }
      } else if (e.clientX > EDGE_CANCEL_PX) {
        clearHoverTimer();
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearHoverTimer();
    };
  }, [clearHoverTimer]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'manual' ? null : 'manual'));
  }, []);

  const close = useCallback(() => {
    setMode(null);
    clearHoverTimer();
  }, [clearHoverTimer]);

  const closeFromHoverLeave = useCallback(() => {
    setMode((prev) => (prev === 'hover' ? null : prev));
  }, []);

  return {
    isOpen: mode !== null,
    toggle,
    close,
    closeFromHoverLeave,
  };
}
