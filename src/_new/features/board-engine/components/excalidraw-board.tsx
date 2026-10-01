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
 *   Y.Doc (zdalne)      -> binding.observeRemote -> reconcileElements -> updateScene(NEVER)
 *   onPointerUpdate     -> awareness.pointer   ; awareness.change -> updateScene({collaborators})
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as Y from 'yjs';
import { Excalidraw, CaptureUpdateAction, reconcileElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFiles,
  BinaryFileData,
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

const PUSH_THROTTLE_MS = 50;
const POINTER_THROTTLE_MS = 40;

export interface BoardUser {
  id: number;
  name: string;
}

export interface ExcalidrawBoardProps {
  /** Dokument tablicy; transport (Hocuspocus, IndexedDB) podpina wywołujący. */
  doc: Y.Doc;
  /** Awareness połączenia (kursory, lista osób); null = bez współpracy na żywo. */
  awareness: BoardAwareness | null;
  user: BoardUser;
  /** Tryb tylko do odczytu (rola viewer). */
  viewMode?: boolean;
}

export function ExcalidrawBoard({ doc, awareness, user, viewMode = false }: ExcalidrawBoardProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [editingSpec, setEditingSpec] = useState<FunctionSpec | null>(null);

  const bindingRef = useRef<ExcalidrawYjsBinding | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{
    elements: readonly OrderedExcalidrawElement[];
    files: BinaryFiles;
  } | null>(null);
  const lastPointerPushRef = useRef(0);
  const editingIdRef = useRef<string | null>(null);

  // --- lokalne -> Y.Doc ----------------------------------------------------

  const flushPending = useCallback(() => {
    pushTimerRef.current = null;
    const pending = pendingRef.current;
    const binding = bindingRef.current;
    if (!pending || !binding) return;
    pendingRef.current = null;
    binding.pushLocal(pending.elements as unknown as StoredElement[]);
    binding.pushFiles(pending.files as unknown as Record<string, StoredFile>);
  }, []);

  const handleChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      pendingRef.current = { elements, files };
      if (!pushTimerRef.current) pushTimerRef.current = setTimeout(flushPending, PUSH_THROTTLE_MS);

      // Zaznaczony dokładnie jeden wykres -> panel przechodzi w tryb edycji
      const ids = Object.keys(appState.selectedElementIds);
      const sel = ids.length === 1 ? elements.find((e) => e.id === ids[0]) : undefined;
      const nextId = isFunctionElement(sel) ? sel.id : null;
      if (nextId !== editingIdRef.current) {
        editingIdRef.current = nextId;
        setEditingSpec(isFunctionElement(sel) ? sel.customData.spec : null);
      }
    },
    [flushPending]
  );

  // --- Y.Doc <-> Excalidraw ------------------------------------------------

  useEffect(() => {
    if (!api) return;

    const binding = new ExcalidrawYjsBinding(doc, `excalidraw-local:${doc.clientID}`);
    bindingRef.current = binding;

    const applyRemote = (remote: StoredElement[]) => {
      const reconciled = reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        remote as unknown as RemoteExcalidrawElement[],
        api.getAppState()
      );
      api.updateScene({ elements: reconciled, captureUpdate: CaptureUpdateAction.NEVER });
    };

    // Stan początkowy (to, co już jest w dokumencie) + kolejne zmiany spoza tej karty
    const files = binding.getFiles();
    if (files.length) api.addFiles(files as unknown as BinaryFileData[]);
    applyRemote(binding.getElements());

    const unobserve = binding.observeRemote(applyRemote);
    const unobserveFiles = binding.observeRemoteFiles((added) =>
      api.addFiles(added as unknown as BinaryFileData[])
    );

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      flushPending();
      unobserve();
      unobserveFiles();
      bindingRef.current = null;
    };
  }, [api, doc, flushPending]);

  // --- awareness: tożsamość + kursory innych -------------------------------

  useEffect(() => {
    if (!api || !awareness) return;

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
  }, [api, awareness, user.id, user.name]);

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

  const renderTopRightUI = useCallback(
    () =>
      viewMode ? null : (
        <FunctionPanel editingSpec={editingSpec} onAdd={addFunction} onUpdate={updateFunction} />
      ),
    [viewMode, editingSpec, addFunction, updateFunction]
  );

  return (
    <div style={{ width: '100%', height: '100%' }} data-testid="excalidraw-board">
      <Excalidraw
        excalidrawAPI={setApi}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        renderTopRightUI={renderTopRightUI}
        viewModeEnabled={viewMode}
        langCode="pl-PL"
        isCollaborating={awareness != null}
      />
    </div>
  );
}
