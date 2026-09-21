/**
 * Pokazywanie/chowanie przyciskow panelu po najechaniu: przy wyjsciu myszka
 * 2 s zwloki, potem schowanie i po kolejnych 420 ms odmontowanie (animacja).
 * Wydzielone z voice-chat.tsx, 1:1.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useHoverControls(onHide: () => void) {
  const [isHovered, setIsHovered] = useState(false);
  const [areControlsMounted, setAreControlsMounted] = useState(false);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const controlsUnmountTimerRef = useRef<number | null>(null);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  const onMouseEnter = useCallback(() => {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    if (controlsUnmountTimerRef.current) {
      window.clearTimeout(controlsUnmountTimerRef.current);
      controlsUnmountTimerRef.current = null;
    }
    setAreControlsMounted(true);
    setIsHovered(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
    }
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setIsHovered(false);
      onHideRef.current();
      if (controlsUnmountTimerRef.current) {
        window.clearTimeout(controlsUnmountTimerRef.current);
      }
      controlsUnmountTimerRef.current = window.setTimeout(() => {
        setAreControlsMounted(false);
      }, 420);
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverCloseTimerRef.current) window.clearTimeout(hoverCloseTimerRef.current);
      if (controlsUnmountTimerRef.current) window.clearTimeout(controlsUnmountTimerRef.current);
    };
  }, []);

  return { isHovered, areControlsMounted, onMouseEnter, onMouseLeave };
}
