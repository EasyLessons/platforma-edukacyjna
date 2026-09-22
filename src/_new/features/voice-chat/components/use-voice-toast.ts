/**
 * Toast voice chatu (dol ekranu): pokazanie, animacja wyjscia po 2,6 s, zdjecie po 3,2 s.
 * Timery czyszczone przy nowym toascie i przy odmontowaniu. Wydzielone z voice-chat.tsx, 1:1.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface VoiceToastState {
  id: number;
  message: string;
}

export function useVoiceToast() {
  const [toastState, setToastState] = useState<VoiceToastState | null>(null);
  const [isToastExiting, setIsToastExiting] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const toastExitTimerRef = useRef<number | null>(null);

  const clearToastTimers = useCallback(() => {
    if (toastExitTimerRef.current) {
      window.clearTimeout(toastExitTimerRef.current);
      toastExitTimerRef.current = null;
    }
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string) => {
      clearToastTimers();
      setToastState({ id: Date.now() + Math.floor(Math.random() * 1000), message });
      setIsToastExiting(false);

      toastExitTimerRef.current = window.setTimeout(() => setIsToastExiting(true), 2600);
      toastTimerRef.current = window.setTimeout(() => {
        setToastState(null);
        setIsToastExiting(false);
      }, 3200);
    },
    [clearToastTimers]
  );

  useEffect(() => clearToastTimers, [clearToastTimers]);

  return { toastState, isToastExiting, showToast };
}
