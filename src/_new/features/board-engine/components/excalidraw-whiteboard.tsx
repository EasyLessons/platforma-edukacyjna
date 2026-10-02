'use client';

/**
 * Tablica Excalidraw gotowa do wstawienia na stronę (/whiteboard, /demo).
 *
 * Spina: tożsamość (zalogowany user albo gość demo) + połączenie (use-board-connection)
 * + `ExcalidrawBoard` ładowany przez `next/dynamic` z `ssr: false`. Nagłówek, sidebar
 * i ustawienia tablicy zostają na stronie, dookoła tego komponentu.
 */

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useAuth } from '@/_new/lib/auth';
import { ACCESS_DENIED, SESSION_EXPIRED, useBoardConnection } from '../yjs/use-board-connection';
import type { BoardUser } from './excalidraw-board';

/**
 * Fonty Excalidraw z naszego serwera, nie z CDN (esm.sh) - szkoły bywają offline.
 * Pliki kopiuje scripts/copy-excalidraw-assets.mjs (predev/prebuild). Excalidraw liczy
 * adresy fontów przy pierwszym użyciu, więc wystarczy ustawić to przed jego załadowaniem.
 */
export const EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}
if (typeof window !== 'undefined') window.EXCALIDRAW_ASSET_PATH = EXCALIDRAW_ASSET_PATH;

const ExcalidrawBoard = dynamic(() => import('./excalidraw-board').then((m) => m.ExcalidrawBoard), {
  ssr: false,
  loading: () => <BoardLoading label="Ładowanie tablicy..." />,
});

export type BoardRole = 'owner' | 'editor' | 'viewer';

export interface ExcalidrawWhiteboardProps {
  boardId: string;
  userRole: BoardRole;
  /** Tożsamość gościa (demo). Bez niej używany jest zalogowany użytkownik. */
  guest?: { id: number; username: string };
  /**
   * Ustawienia tablicy (panel ustawień). Na razie działa `grid_visible`.
   * TODO(decyzja): `toolbar_visible` - pasek to pasek Excalidraw (własny pasek "nie teraz");
   * `ai_enabled` / `smartsearch_visible` dotyczą paneli z etapu B.
   */
  gridVisible?: boolean;
}

export function ExcalidrawWhiteboard(props: ExcalidrawWhiteboardProps) {
  // Nowa tablica = nowy dokument i nowe połączenie.
  return <BoardSession key={props.boardId} {...props} />;
}

function BoardSession({ boardId, userRole, guest, gridVisible }: ExcalidrawWhiteboardProps) {
  const { user, loading: authLoading } = useAuth();
  const connection = useBoardConnection({ boardId, userId: guest ? null : (user?.id ?? null) });
  const { authError, clearLocalCache } = connection;

  useEffect(() => {
    if (authError === ACCESS_DENIED) clearLocalCache();
  }, [authError, clearLocalCache]);

  const me: BoardUser | null = guest
    ? { id: guest.id, name: guest.username }
    : user
      ? { id: user.id, name: user.username }
      : null;

  if (!me) {
    return (
      <BoardLoading
        label={authLoading ? 'Ładowanie tablicy...' : 'Zaloguj się, aby otworzyć tablicę.'}
      />
    );
  }

  // Nakładka do pierwszej synchronizacji, chyba że jest co pokazać z kopii lokalnej.
  const isWaitingForServer =
    connection.isRemote && !connection.hasSynced && !connection.hasLocalContent && !authError;
  const isOffline =
    connection.isRemote && !connection.isConnected && !isWaitingForServer && !authError;

  return (
    <div className="relative h-full w-full">
      <ExcalidrawBoard
        doc={connection.doc}
        awareness={connection.awareness}
        user={me}
        viewMode={userRole === 'viewer'}
        gridVisible={gridVisible}
        storageBoardId={connection.isRemote ? boardId : null}
      />
      {isWaitingForServer && (
        <div className="absolute inset-0 z-10 bg-white/80">
          <BoardLoading label="Synchronizacja tablicy..." />
        </div>
      )}
      {(authError || isOffline) && (
        <div
          role="status"
          data-testid="board-connection-banner"
          className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-gray-900/85 px-4 py-2 text-sm text-white shadow"
        >
          {authError === ACCESS_DENIED
            ? 'Nie masz już dostępu do tej tablicy.'
            : authError === SESSION_EXPIRED
              ? 'Sesja wygasła. Zaloguj się ponownie - zmiany są zapisywane na tym urządzeniu.'
              : 'Brak połączenia - zmiany zapiszą się po powrocie sieci.'}
        </div>
      )}
    </div>
  );
}

function BoardLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
        <p className="text-gray-600">{label}</p>
      </div>
    </div>
  );
}
