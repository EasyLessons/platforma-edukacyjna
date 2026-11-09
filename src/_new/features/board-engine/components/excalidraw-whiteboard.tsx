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
import { PanelLayer, availablePanels, useBoardPanels } from '../panels/board-panels';
import { useNoteElements, insertNote, NEW_NOTE_CONTENT } from '../elements/note';
import { PdfImport } from '../elements/pdf-import';
import { insertTable } from '../elements/table';
import { TableToolbar, useSelectedTable } from '../elements/table-toolbar';
import { useSheetInsert } from '../templates/use-sheet-insert';
import { useElementLimit } from '../yjs/use-element-limit';
import { ExcalidrawHeader } from './excalidraw-header';
import { ExcalidrawVerticalToolbar } from './excalidraw-vertical-toolbar';
import { ExcalidrawZoomControls } from './excalidraw-zoom-controls';
import { SavedAssetsPanel } from '@/_new/features/whiteboard/components/panels/saved-assets-panel';
import {
  useWhiteboardUiMetrics,
  safeInset,
} from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';
import { GraduationCap } from 'lucide-react';

/** Narzedzia dostepne, gdy tablica osiagnela limit elementow (nic nie dodaja). */
const TOOLS_ALLOWED_AT_LIMIT = new Set(['selection', 'lasso', 'eraser', 'hand', 'laser']);

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
  boardName?: string;
  workspaceId?: number | null;
  /** Tożsamość gościa (demo). Bez niej używany jest zalogowany użytkownik. */
  guest?: { id: number; username: string };
  gridVisible?: boolean;
  /** Panel "Wzory" (SmartSearch) - ustawienie tablicy `smartsearch_visible`. */
  smartSearchVisible?: boolean;
  /** Panel "Tutor AI" - ustawienie tablicy `ai_enabled`. */
  aiEnabled?: boolean;
  /** Opcjonalna wsteczna kompatybilność. */
  topRightExtra?: TopRightExtra;
  /** Arkusz CKE do wstawienia raz po otwarciu (id z templates/catalog.ts; z `?arkusz=` dashboardu). */
  sheetTemplateId?: string | null;
  /** Arkusz jest na tablicy - strona usuwa `?arkusz=` z adresu. */
  onSheetInserted?: () => void;
  /** Limit zywych elementow wg planu wlasciciela przestrzeni (null/brak = bez limitu, np. demo). */
  elementLimit?: number | null;
  // Nawigacja / akcje nagłówka:
  isSidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  onSettingsClick?: () => void;
  onShareClick?: () => void;
  onToggleHistory?: () => void;
}

export function ExcalidrawWhiteboard(props: ExcalidrawWhiteboardProps) {
  // Nowa tablica = nowy dokument i nowe połączenie.
  return <BoardSession key={props.boardId} {...props} />;
}

function BoardSession({
  boardId,
  userRole,
  boardName,
  workspaceId,
  guest,
  gridVisible,
  smartSearchVisible = true,
  aiEnabled = true,
  sheetTemplateId,
  onSheetInserted,
  elementLimit,
  isSidebarOpen,
  onSidebarToggle,
  onSettingsClick,
  onShareClick,
  onToggleHistory,
}: ExcalidrawWhiteboardProps) {
  const { user, loading: authLoading } = useAuth();
  const metrics = useWhiteboardUiMetrics();
  const panels = useBoardPanels();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [isFunctionPanelOpen, setIsFunctionPanelOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
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

  // Akcje paska narzędzi
  const handleInsertNote = useCallback(() => {
    if (!api || readOnly) return;
    void insertNote(api, NEW_NOTE_CONTENT).then(startEditing);
  }, [api, readOnly, startEditing]);

  const handleInsertTable = useCallback(() => {
    if (!api || readOnly) return;
    void insertTable(api);
  }, [api, readOnly]);

  const handleInsertPdf = useCallback(() => {
    if (readOnly) return;
    pdfInputRef.current?.click();
  }, [readOnly]);

  const handleToggleFunctionPanel = useCallback(() => {
    setIsFunctionPanelOpen((prev) => !prev);
  }, []);

  const handleToggleCalculator = useCallback(() => {
    panels.toggle('calculator');
  }, [panels]);

  const handleToggleLibrary = useCallback(() => {
    setIsLibraryOpen((prev) => !prev);
  }, []);

  const handleClearCanvas = useCallback(() => {
    if (!api || readOnly) return;
    if (
      typeof window !== 'undefined' &&
      window.confirm('Czy na pewno chcesz wyczyścić całą tablicę?')
    ) {
      api.resetScene();
    }
  }, [api, readOnly]);

  const connection = useBoardConnection({ boardId, userId: guest ? null : (user?.id ?? null) });
  const { authError, clearLocalCache } = connection;
  const limit = useElementLimit(connection.doc, guest ? null : elementLimit);
  const atLimit = limit.level === 'full' && !readOnly;

  // Pelna tablica: narzedzia rysujace wracaja do zaznaczania (gumka, przesuwanie, edycja dzialaja).
  useEffect(() => {
    if (!api || !atLimit) return;
    const guard = () => {
      const state = api.getAppState();
      if (state.newElement) return; // nie przerywamy trwajacego rysowania
      if (!TOOLS_ALLOWED_AT_LIMIT.has(state.activeTool.type)) {
        api.setActiveTool({ type: 'selection' });
      }
    };
    guard();
    return api.onChange(guard);
  }, [api, atLimit]);

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
    <div
      className="relative h-full w-full overflow-hidden"
      onDoubleClickCapture={notes.handleDoubleClickCapture}
    >
      {/* 1. Nagłówek 1:1 jak na starym silniku (karta lewa, centralny search, karta prawa) */}
      <ExcalidrawHeader
        boardId={boardId}
        boardName={boardName}
        workspaceId={workspaceId}
        userRole={userRole}
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={onSidebarToggle}
        onSettingsClick={onSettingsClick}
        onShareClick={onShareClick}
        panels={panels}
        available={available}
        guest={guest}
        currentUser={user}
        onToggleHistory={onToggleHistory}
      />

      {/* 2. Płótno Excalidraw */}
      <ExcalidrawBoard
        doc={connection.doc}
        awareness={connection.awareness}
        user={me}
        viewMode={readOnly}
        gridVisible={gridVisible}
        storageBoardId={connection.isRemote ? boardId : null}
        onApiReady={setApi}
        onSceneSynced={markSceneSynced}
        validateEmbeddable={notes.validateEmbeddable}
        renderEmbeddable={notes.renderEmbeddable}
        isFunctionPanelOpen={isFunctionPanelOpen}
        onFunctionPanelClose={() => setIsFunctionPanelOpen(false)}
      />

      {/* 3. Własny pionowy pasek narzędzi (lewa strona) */}
      <ExcalidrawVerticalToolbar
        api={api}
        readOnly={readOnly}
        isFunctionPanelOpen={isFunctionPanelOpen}
        onToggleFunctionPanel={handleToggleFunctionPanel}
        onInsertNote={handleInsertNote}
        onInsertTable={handleInsertTable}
        onInsertPdf={handleInsertPdf}
        isCalculatorOpen={panels.isOpen('calculator')}
        onToggleCalculator={handleToggleCalculator}
        onToggleLibrary={handleToggleLibrary}
        onClearCanvas={handleClearCanvas}
      />

      {/* 4. Kontrolki zoom i reset widoku (lewy dolny róg) */}
      <ExcalidrawZoomControls api={api} />

      {/* 5. Pływający przycisk Tutor AI (prawy dolny róg) */}
      {available.includes('chat') && !panels.isOpen('chat') && (
        <div
          className="fixed z-50 pointer-events-auto"
          style={{
            right: safeInset(metrics.isPhoneLayout ? 16 : 24, 'right'),
            bottom: safeInset(metrics.isPhoneLayout ? 16 : 24, 'bottom'),
          }}
        >
          <button
            type="button"
            onClick={() => panels.toggle('chat')}
            data-testid="panel-toggle-chat"
            aria-label="Tutor AI"
            title="Tutor AI"
            className={`cursor-pointer font-semibold flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white text-gray-800 shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:bg-gray-50 hover:text-blue-600 transition-all active:scale-95 ${
              metrics.isPhoneLayout ? 'h-11 w-11 px-0' : 'h-11 px-4'
            }`}
          >
            <GraduationCap className="h-5 w-5 text-blue-600" />
            {!metrics.isPhoneLayout && <span className="text-sm font-semibold">Tutor AI</span>}
          </button>
        </div>
      )}

      {/* 6. Panele EasyLesson: SmartSearch, CardViewer, Calculator, Tutor AI (MathChatbot) */}
      <PanelLayer
        panels={panels}
        available={available}
        api={api}
        readOnly={readOnly}
        demo={!!guest}
      />

      {/* 7. Biblioteka zapisanych szablonów (SavedAssetsPanel) */}
      {isLibraryOpen && (
        <div className="absolute right-4 top-20 z-50 pointer-events-auto">
          <SavedAssetsPanel onClose={() => setIsLibraryOpen(false)} />
        </div>
      )}

      {/* 8. Pasek narzędzi tabeli */}
      <TableToolbar api={api} selection={tableSelection} />

      {/* 9. Ukryty input dla PDF */}
      {!readOnly && <PdfImport api={api} inputRef={pdfInputRef} />}

      {/* 10. Statusy arkusza, limitu elementów i połączenia */}
      {(sheetState === 'loading' || sheetState === 'error') && (
        <div
          role="status"
          data-testid="sheet-status"
          className="pointer-events-none absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-gray-900/85 px-4 py-2 text-sm text-white shadow"
        >
          {sheetState === 'loading' ? 'Wczytywanie arkusza...' : 'Nie udało się wczytać arkusza.'}
        </div>
      )}
      {!readOnly && limit.level !== 'none' && (
        <div
          role="status"
          data-testid="board-element-limit"
          className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-gray-900/85 px-4 py-2 text-sm text-white shadow"
        >
          {limit.level === 'full'
            ? `Tablica osiągnęła limit ${limit.limit} elementów. Usuń coś (gumka działa), aby dodać nowe, albo przejdź na Premium.`
            : `Tablica się zapełnia: ${limit.count}/${limit.limit} elementów.`}
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
