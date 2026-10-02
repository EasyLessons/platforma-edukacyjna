'use client';

/**
 * Tablica na Excalidraw spięta z Y.Doc.
 *
 * Ten moduł importuje `@excalidraw/excalidraw` statycznie, więc MUSI być ładowany
 * przez `next/dynamic` z `ssr: false` (Excalidraw czyta `window` przy imporcie -
 * issue excalidraw#9907).
 *
 * Transport NIE jest tu tworzony: wywołujący podaje gotowy `doc` (i `awareness`,
 * jeśli jest połączenie z serwerem). Dzięki temu ten sam komponent działa z
 * `whiteboard-sync` (zalogowana tablica) i bez serwera (demo, testy).
 *
 * Przepływ danych:
 *   Excalidraw.onChange -> (throttle 50 ms) -> binding.pushLocal (tylko zmienione wersje)
 *   obrazy              -> files/board-file-sync.ts (Storage zamiast dataURL w Y.Doc)
 *   Y.Doc (zdalne)      -> binding.observeRemote -> reconcileElements -> updateScene(NEVER)
 *   onPointerUpdate     -> awareness.pointer   ; awareness.change -> updateScene({collaborators})
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type * as Y from 'yjs';
import {
  Excalidraw,
  CaptureUpdateAction,
  exportToBlob,
  reconcileElements,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './excalidraw-theme.css';
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawProps,
  AppState,
  BinaryFiles,
} from '@excalidraw/excalidraw/types';
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';

import {
  ExcalidrawYjsBinding,
  type StoredElement,
  type StoredFile,
} from '../yjs/excalidraw-binding';
import {
  collaboratorsFromAwareness,
  pickUserColor,
  type LocalAwarenessState,
} from '../yjs/awareness-collaborators';
import type { BoardAwareness } from '../yjs/types';
import {
  buildFunctionElement,
  isFunctionElement,
  updateFunctionElement,
} from '../math/function-element';
import type { FunctionSpec } from '../math/function-plot';
import { FunctionPanel } from './function-panel';
import { backgroundForTool } from '../config/default-fill';
import { createExcalidrawFileSync } from '../files/excalidraw-file-sync';
import type { BoardFileSync } from '../files/board-file-sync';

const PUSH_THROTTLE_MS = 50;
const POINTER_THROTTLE_MS = 40;

/** Hak dla testów e2e (Playwright) - tylko przy NEXT_PUBLIC_E2E=1. */
declare global {
  interface Window {
    __boardEngine?: {
      api: ExcalidrawImperativeAPI;
      /** Rozmiar PNG z eksportu całej sceny (bajty). */
      exportPng: () => Promise<number>;
      /** Nazwy użytkowników w awareness (łącznie z własną); null bez połączenia. */
      awarenessUsers: () => (string | null)[] | null;
      /** Wpis pliku w Y.Doc (odwołanie do Storage albo dataURL); null, gdy go nie ma. */
      storedFile: (fileId: string) => StoredFile | null;
    };
  }
}
const EXPOSE_E2E_HOOK = process.env.NEXT_PUBLIC_E2E === '1';

/**
 * Menu Excalidraw bez akcji, które u nas nie mają sensu albo dublują nasze panele:
 * wczytywanie/zapis pliku .excalidraw (tablica zapisuje się sama przez whiteboard-sync).
 * Zostają: eksport obrazu, czyszczenie płótna (z cofaniem), kolor tła, pomoc.
 */
const UI_OPTIONS: ExcalidrawProps['UIOptions'] = {
  canvasActions: {
    loadScene: false,
    saveToActiveFile: false,
    export: false,
    toggleTheme: false,
  },
};

export interface BoardUser {
  id: number;
  name: string;
}

/**
 * Slot na dodatkowy przycisk obok f(x) (np. "Rozmowa"). Renderowany także dla viewera.
 * `top-right` - prawy górny róg na komputerze; `mobile` - pływający przycisk nad stopką
 * na telefonie (tam zwykle sama ikona). board-engine nie zna feature'a, który go podaje.
 */
export type TopRightExtra = (placement: 'top-right' | 'mobile') => ReactNode;

export interface ExcalidrawBoardProps {
  /** Dokument tablicy; transport (Hocuspocus, IndexedDB) podpina wywołujący. */
  doc: Y.Doc;
  /** Awareness połączenia (kursory, lista osób); null = bez współpracy na żywo. */
  awareness: BoardAwareness | null;
  user: BoardUser;
  /** Tryb tylko do odczytu (rola viewer). */
  viewMode?: boolean;
  /** Siatka na płótnie (ustawienie tablicy `grid_visible`). */
  gridVisible?: boolean;
  topRightExtra?: TopRightExtra;
  /** Id tablicy na serwerze - obrazy idą do Storage. null (demo, gość) = dataURL w Y.Doc. */
  storageBoardId?: string | null;
}

export function ExcalidrawBoard({
  doc,
  awareness,
  user,
  viewMode = false,
  gridVisible = true,
  topRightExtra,
  storageBoardId = null,
}: ExcalidrawBoardProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [editingSpec, setEditingSpec] = useState<FunctionSpec | null>(null);

  const bindingRef = useRef<ExcalidrawYjsBinding | null>(null);
  const fileSyncRef = useRef<BoardFileSync | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{
    elements: readonly OrderedExcalidrawElement[];
    files: BinaryFiles;
  } | null>(null);
  const lastPointerPushRef = useRef(0);
  const editingIdRef = useRef<string | null>(null);
  const lastToolRef = useRef<string | null>(null);

  // Excalidraw inicjalizuje scenę asynchronicznie (initializeScene): po `await initialData`
  // nadpisuje elementy i appState, w tym `collaborators`. Wszystko, co wpiszemy przez
  // updateScene wcześniej, przepada - dlatego wiązanie i awareness startują dopiero po
  // pierwszym onChange (Excalidraw nie woła go, dopóki isLoading === true).
  const initialDataRequestedRef = useRef(false);
  const [sceneReady, setSceneReady] = useState(false);
  const initialData = useCallback(async () => {
    initialDataRequestedRef.current = true;
    return null;
  }, []);

  // --- lokalne -> Y.Doc ----------------------------------------------------

  const flushPending = useCallback(() => {
    pushTimerRef.current = null;
    const pending = pendingRef.current;
    const binding = bindingRef.current;
    const fileSync = fileSyncRef.current;
    if (!pending || !binding || !fileSync) return;
    pendingRef.current = null;
    // Najpierw pliki: element-obraz trafia do Y.Doc dopiero, gdy jego plik ma tam wpis.
    const elements = pending.elements as unknown as StoredElement[];
    fileSync.syncLocal(pending.files as unknown as Record<string, StoredFile>, elements);
    binding.pushLocal(fileSync.shareable(elements));
  }, []);

  const handleChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      if (!initialDataRequestedRef.current) return;
      setSceneReady(true);

      pendingRef.current = { elements, files };
      if (!pushTimerRef.current) pushTimerRef.current = setTimeout(flushPending, PUSH_THROTTLE_MS);

      // Domyślne lekkie wypełnienie kształtów - tylko przy zmianie narzędzia (config/default-fill.ts)
      const tool = appState.activeTool.type;
      if (tool !== lastToolRef.current) {
        lastToolRef.current = tool;
        const background = backgroundForTool(tool, appState.currentItemBackgroundColor);
        if (background && api) {
          api.updateScene({
            appState: { currentItemBackgroundColor: background },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
      }

      // Zaznaczony dokładnie jeden wykres -> panel przechodzi w tryb edycji
      const ids = Object.keys(appState.selectedElementIds);
      const sel = ids.length === 1 ? elements.find((e) => e.id === ids[0]) : undefined;
      const nextId = isFunctionElement(sel) ? sel.id : null;
      if (nextId !== editingIdRef.current) {
        editingIdRef.current = nextId;
        setEditingSpec(isFunctionElement(sel) ? sel.customData.spec : null);
      }
    },
    [api, flushPending]
  );

  // --- Y.Doc <-> Excalidraw ------------------------------------------------

  useEffect(() => {
    if (!api || !sceneReady) return;

    const binding = new ExcalidrawYjsBinding(doc, `excalidraw-local:${doc.clientID}`);
    bindingRef.current = binding;
    const fileSync = createExcalidrawFileSync({ api, binding, boardId: storageBoardId });
    fileSyncRef.current = fileSync;

    const applyRemote = (remote: StoredElement[]) => {
      const reconciled = reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        remote as unknown as RemoteExcalidrawElement[],
        api.getAppState()
      );
      api.updateScene({ elements: reconciled, captureUpdate: CaptureUpdateAction.NEVER });
    };

    // Stan początkowy (to, co już jest w dokumencie) + kolejne zmiany spoza tej karty
    fileSync.receive(binding.getFiles());
    applyRemote(binding.getElements());

    const unobserve = binding.observeRemote(applyRemote);
    const unobserveFiles = binding.observeRemoteFiles((added) => fileSync.receive(added));

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      flushPending();
      unobserve();
      unobserveFiles();
      fileSync.dispose();
      fileSyncRef.current = null;
      bindingRef.current = null;
    };
  }, [api, sceneReady, doc, flushPending, storageBoardId]);

  useEffect(() => {
    if (!api || !EXPOSE_E2E_HOOK) return;
    window.__boardEngine = {
      api,
      exportPng: async () => {
        const blob = await exportToBlob({
          elements: api.getSceneElements(),
          appState: api.getAppState(),
          files: api.getFiles(),
          mimeType: 'image/png',
        });
        return blob.size;
      },
      awarenessUsers: () =>
        awareness
          ? [...awareness.getStates().values()].map(
              (st) => (st as Partial<LocalAwarenessState>).user?.name ?? null
            )
          : null,
      storedFile: (fileId) => bindingRef.current?.getFile(fileId) ?? null,
    };
    return () => {
      if (window.__boardEngine?.api === api) delete window.__boardEngine;
    };
  }, [api, awareness]);

  // --- awareness: tożsamość + kursory innych -------------------------------

  useEffect(() => {
    if (!api || !sceneReady || !awareness) return;

    const me: LocalAwarenessState = {
      user: { name: user.name, color: pickUserColor(user.id) },
    };
    awareness.setLocalState(me);

    const onAwareness = () =>
      api.updateScene({ collaborators: collaboratorsFromAwareness(awareness) });
    awareness.on('change', onAwareness);
    onAwareness();

    return () => {
      awareness.off('change', onAwareness);
      awareness.setLocalState(null);
      api.updateScene({ collaborators: new Map() });
    };
  }, [api, sceneReady, awareness, user.id, user.name]);

  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: 'pointer' | 'laser' };
      button: 'down' | 'up';
    }) => {
      if (!awareness) return;
      const now = Date.now();
      if (payload.button === 'up' && now - lastPointerPushRef.current < POINTER_THROTTLE_MS) return;
      lastPointerPushRef.current = now;
      awareness.setLocalStateField('pointer', payload.pointer);
      awareness.setLocalStateField('button', payload.button);
      const sel = api?.getAppState().selectedElementIds;
      if (sel) awareness.setLocalStateField('selectedElementIds', sel);
    },
    [api, awareness]
  );

  // --- wykres funkcji --------------------------------------------------------

  const sceneCenter = useCallback((): { x: number; y: number } => {
    if (!api) return { x: 0, y: 0 };
    const s = api.getAppState();
    return {
      x: -s.scrollX + s.width / 2 / s.zoom.value - 200,
      y: -s.scrollY + s.height / 2 / s.zoom.value - 200,
    };
  }, [api]);

  const addFunction = useCallback(
    (spec: FunctionSpec) => {
      if (!api) return;
      const { element, file } = buildFunctionElement(spec, sceneCenter());
      api.addFiles([file]);
      api.updateScene({
        elements: [...api.getSceneElementsIncludingDeleted(), element],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    [api, sceneCenter]
  );

  const updateFunction = useCallback(
    (spec: FunctionSpec) => {
      if (!api || !editingIdRef.current) return;
      const current = api
        .getSceneElementsIncludingDeleted()
        .find((e) => e.id === editingIdRef.current);
      if (!isFunctionElement(current)) return;
      const { element, file } = updateFunctionElement(current, spec);
      api.addFiles([file]);
      api.updateScene({
        elements: api
          .getSceneElementsIncludingDeleted()
          .map((e): ExcalidrawElement => (e.id === element.id ? element : e)),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setEditingSpec(spec);
    },
    [api]
  );

  // Na telefonie prawy górny róg należy do paska narzędzi Excalidraw - f(x) i slot jako pływające
  // przyciski nad stopką (widoczność przełącza CSS w excalidraw-theme.css).
  const renderTopRightUI = useCallback(
    (isMobile: boolean) =>
      isMobile || (viewMode && !topRightExtra) ? null : (
        <>
          {topRightExtra?.('top-right')}
          {!viewMode && (
            <FunctionPanel
              editingSpec={editingSpec}
              onAdd={addFunction}
              onUpdate={updateFunction}
            />
          )}
        </>
      ),
    [viewMode, topRightExtra, editingSpec, addFunction, updateFunction]
  );

  return (
    <div
      className="easylesson-board"
      style={{ position: 'relative', width: '100%', height: '100%' }}
      data-testid="excalidraw-board"
    >
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        renderTopRightUI={renderTopRightUI}
        viewModeEnabled={viewMode}
        gridModeEnabled={gridVisible}
        UIOptions={UI_OPTIONS}
        langCode="pl-PL"
        isCollaborating={awareness != null}
      />
      {(!viewMode || topRightExtra) && (
        <div className="easylesson-fx-mobile">
          {topRightExtra?.('mobile')}
          {!viewMode && (
            <FunctionPanel
              editingSpec={editingSpec}
              onAdd={addFunction}
              onUpdate={updateFunction}
              placement="up-left"
            />
          )}
        </div>
      )}
    </div>
  );
}
