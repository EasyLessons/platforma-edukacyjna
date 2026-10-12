'use client';

/**
 * Tablica Excalidraw gotowa do wstawienia na stronę (/whiteboard, /demo).
 *
 * Spina: tożsamość (zalogowany user albo gość demo) + połączenie (use-board-connection)
 * + `ExcalidrawBoard` ładowany przez `next/dynamic` z `ssr: false`. Nagłówek, sidebar
 * i ustawienia tablicy zostają na stronie, dookoła tego komponentu.
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useAuth } from '@/_new/lib/auth';
import { ACCESS_DENIED, SESSION_EXPIRED, useBoardConnection } from '../yjs/use-board-connection';
import type { BoardUser, TopRightExtra } from './excalidraw-board';
import { PanelLayer, PanelToggles, availablePanels, useBoardPanels } from '../panels/board-panels';
import { useNoteElements, insertNote, NEW_NOTE_CONTENT } from '../elements/note';
import {
  ElementButtons,
  NOTE_BUTTON,
  PDF_BUTTON,
  TABLE_BUTTON,
  type ElementButton,
} from '../elements/element-buttons';
import { PdfImport } from '../elements/pdf-import';
import { insertTable } from '../elements/table';
import { TableToolbar, useSelectedTable } from '../elements/table-toolbar';
import { useSheetInsert } from '../templates/use-sheet-insert';

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
   * Ustawienia tablicy (panel ustawień): `grid_visible`, `smartsearch_visible`, `ai_enabled`.
   * TODO(decyzja): `toolbar_visible` - pasek to pasek Excalidraw (własny pasek "nie teraz");
   */
  gridVisible?: boolean;
  /** Panel "Wzory" (SmartSearch) - ustawienie tablicy `smartsearch_visible`. */
  smartSearchVisible?: boolean;
  /** Panel "Tutor AI" - ustawienie tablicy `ai_enabled`. */
  aiEnabled?: boolean;
  /** Dodatkowy przycisk obok f(x) (strona podaje np. "Rozmowa"); demo go nie podaje. */
  topRightExtra?: TopRightExtra;
  /** Arkusz CKE do wstawienia raz po otwarciu (id z templates/catalog.ts; z `?arkusz=` dashboardu). */
  sheetTemplateId?: string | null;
  /** Arkusz jest na tablicy - strona usuwa `?arkusz=` z adresu. */
  onSheetInserted?: () => void;
}

export function ExcalidrawWhiteboard(props: ExcalidrawWhiteboardProps) {
  // Nowa tablica = nowy dokument i nowe połączenie.
  return <BoardSession key={props.boardId} {...props} />;
}

function BoardSession({
  boardId,
  userRole,
  guest,
  gridVisible,
  smartSearchVisible = true,
  aiEnabled = true,
  topRightExtra,
  sheetTemplateId,
  onSheetInserted,
}: ExcalidrawWhiteboardProps) {
  const { user, loading: authLoading } = useAuth();
  const panels = useBoardPanels();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const readOnly = userRole === 'viewer';
  const available = useMemo(
    () => availablePanels({ readOnly, smartSearchVisible, aiEnabled }),
    [readOnly, smartSearchVisible, aiEnabled]
  );
  const notes = useNoteElements({ api, readOnly });
  const [sceneSynced, setSceneSynced] = useState(false);
  const markSceneSynced = useCallback(() => setSceneSynced(true), []);
  const tableSelection = useSelectedTable(api, readOnly);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { startEditing } = notes;
  // Wstawianie elementów (B2) - tylko z prawem edycji
  const elementButtons = useMemo<ElementButton[]>(
    () =>
      readOnly
        ? []
        : [
            {
              ...NOTE_BUTTON,
              onClick: () => {
                if (api) void insertNote(api, NEW_NOTE_CONTENT).then(startEditing);
              },
            },
            {
              ...TABLE_BUTTON,
              onClick: () => {
                if (api) void insertTable(api);
              },
            },
            { ...PDF_BUTTON, onClick: () => pdfInputRef.current?.click() },
          ],
    [readOnly, api, startEditing]
  );
  // Slot Excalidraw: przycisk strony (np. "Rozmowa") + wstawianie elementów + przełączniki paneli
  const renderTopRight = useCallback<TopRightExtra>(
    (placement) => (
      <>
        {topRightExtra?.(placement)}
        <ElementButtons buttons={elementButtons} placement={placement} />
        <PanelToggles panels={panels} available={available} placement={placement} />
      </>
    ),
    [topRightExtra, elementButtons, panels, available]
  );
  const connection = useBoardConnection({ boardId, userId: guest ? null : (user?.id ?? null) });
  const { authError, clearLocalCache } = connection;
  const sheetState = useSheetInsert({
    api,
    templateId: sheetTemplateId,
    // stan z serwera w scenie (tablica bez serwera - od razu)
    ready: sceneSynced && (!connection.isRemote || connection.hasSynced),
    readOnly,
    onDone: onSheetInserted,
  });

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
    <div className="relative h-full w-full" onDoubleClickCapture={notes.handleDoubleClickCapture}>
      <ExcalidrawBoard
        doc={connection.doc}
        awareness={connection.awareness}
        user={me}
        viewMode={readOnly}
        gridVisible={gridVisible}
        topRightExtra={renderTopRight}
        storageBoardId={connection.isRemote ? boardId : null}
        onApiReady={setApi}
        onSceneSynced={markSceneSynced}
        validateEmbeddable={notes.validateEmbeddable}
        renderEmbeddable={notes.renderEmbeddable}
      />
      <PanelLayer
        panels={panels}
        available={available}
        api={api}
        readOnly={readOnly}
        demo={!!guest}
      />
      <TableToolbar api={api} selection={tableSelection} />
      {!readOnly && <PdfImport api={api} inputRef={pdfInputRef} />}
      {(sheetState === 'loading' || sheetState === 'error') && (
        <div
          role="status"
          data-testid="sheet-status"
          className="pointer-events-none absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-gray-900/85 px-4 py-2 text-sm text-white shadow"
        >
          {sheetState === 'loading' ? 'Wczytywanie arkusza...' : 'Nie udało się wczytać arkusza.'}
        </div>
      )}
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
