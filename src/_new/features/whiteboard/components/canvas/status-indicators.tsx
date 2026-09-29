/**
 * status-indicators.tsx
 *
 * Stan połączenia tablicy z whiteboard-sync:
 * - synchronizacja - połączono, trwa wymiana stanu z serwerem,
 * - offline - brak połączenia; zmiany zapisują się lokalnie i wyślą po połączeniu.
 *
 * Badge pojawia się dopiero po krótkim opóźnieniu, aby uniknąć migania.
 */

import { useEffect, useState } from 'react';

const SHOW_DELAY_MS = 1_500;

/** true dopiero, gry `value` jest true nieprzerwanie przez `delayMs`. */
function useDelayedFlag(value: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => {
      clearTimeout(timer);
      setShown(false);
    };
  }, [value, delayMs]);

  return value && shown;
}

interface StatusIndicatorsProps {
  /** Połączono, trwa synchronizacja z serwerem. */
  isSyncing: boolean;
  /** Brak połączenia - edycja zapisuje się lokalnie. */
  isOffline: boolean;
}

export function StatusIndicators({ isSyncing, isOffline }: StatusIndicatorsProps) {
  const showSyncing = useDelayedFlag(isSyncing, SHOW_DELAY_MS);
  const showOffline = useDelayedFlag(isOffline, SHOW_DELAY_MS);

  return (
    <>
      {showSyncing && (
        <div className="absolute top-20 right-4 bg-green-100 text-green-700 px-4 py-2 rounded-lg shadow-md flex items-center gap-2 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
          <span className="text-sm font-medium">Synchronizacja...</span>
        </div>
      )}

      {showOffline && (
        <div className="absolute bottom-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg px-3 py-2 shadow-lg z-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-sm text-yellow-800">
              Offline - zmiany zapisują się na tym urządzeniu
            </span>
          </div>
        </div>
      )}
    </>
  );
}
