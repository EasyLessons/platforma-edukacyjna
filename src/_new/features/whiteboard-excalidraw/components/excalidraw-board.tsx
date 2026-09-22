'use client';

/**
 * Tablica na Excalidraw + Yjs (PROTOTYP).
 *
 * Ten moduł importuje `@excalidraw/excalidraw` statycznie, więc MUSI być
 * ładowany przez `next/dynamic` z `ssr: false` (Excalidraw czyta `window`
 * na poziomie modułu - issue excalidraw#9907). Robi to strona
 * `src/app/(whiteboard)/proto-excalidraw/[boardId]/page.tsx`.
 *
 * Przepływ danych:
 *   Excalidraw.onChange -> (throttle 50 ms) -> binding.pushLocal (tylko zmienione wersje)
 *   Y.Doc (zdalne)      -> binding.observeRemote -> reconcileElements -> updateScene(NEVER)
 *   onPointerUpdate     -> awareness.pointer   ; awareness.change -> updateScene({collaborators})
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Excalidraw,
  CaptureUpdateAction,
  reconcileElements,
  exportToBlob,
} from '@excalidraw/excalidraw';
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
import { connectProtoBoard, type ProtoConnection } from '../yjs/provider';
import {
  collaboratorsFromAwareness,
  makeGuestName,
  pickUserColor,
  type LocalAwarenessState,
} from '../yjs/awareness-collaborators';
import {
  buildFunctionElement,
  isFunctionElement,
  updateFunctionElement,
} from '../math/function-element';
import type { FunctionSpec } from '../math/function-plot';
import { FunctionPanel } from './function-panel';

const PUSH_THROTTLE_MS = 50;
const POINTER_THROTTLE_MS = 40;

export interface ExcalidrawBoardProps {
  boardId: string;
  /** Nazwa użytkownika do awareness (domyślnie "Gość N"). */
  username?: string;
}

type ConnStatus = 'connecting' | 'connected' | 'disconnected';

declare global {
  interface Window {
    __excalidrawAPI?: ExcalidrawImperativeAPI;
    __proto?: {
      exportPng: () => Promise<number>;
      counts: () => { live: number; deleted: number };
      peers: () => number;
      status: () => ConnStatus;
      synced: () => boolean;
      addFunction: (spec: FunctionSpec, x?: number, y?: number) => string;
    };
  }
}

function shouldExposeApi(): boolean {
  return process.env.NEXT_PUBLIC_PROTO_EXPOSE_API === '1' || process.env.NODE_ENV === 'development';
}

export function ExcalidrawBoard({ boardId, username }: ExcalidrawBoardProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(0);
  const [editingSpec, setEditingSpec] = useState<FunctionSpec | null>(null);

  const bindingRef = useRef<ExcalidrawYjsBinding | null>(null);
  const connRef = useRef<ProtoConnection | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{
    elements: readonly OrderedExcalidrawElement[];
    files: BinaryFiles;
  } | null>(null);
  const lastPointerPushRef = useRef(0);
  const editingIdRef = useRef<string | null>(null);
  const statusRef = useRef<ConnStatus>('connecting');
  const syncedRef = useRef(false);

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

  // --- Y.Doc -> Excalidraw ---------------------------------------------------

  const applyRemote = useCallback(
    (remote: StoredElement[]) => {
      if (!api) return;
      const reconciled = reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        remote as unknown as RemoteExcalidrawElement[],
        api.getAppState()
      );
      api.updateScene({ elements: reconciled, captureUpdate: CaptureUpdateAction.NEVER });
    },
    [api]
  );

  // --- połączenie ------------------------------------------------------------

  useEffect(() => {
    if (!api) return;

    const conn = connectProtoBoard({
      boardId,
      onStatus: (s) => {
        statusRef.current = s;
        setStatus(s);
      },
      onSynced: () => {
        syncedRef.current = true;
        setSynced(true);
      },
    });
    connRef.current = conn;
    const binding = new ExcalidrawYjsBinding(conn.doc, `local:${conn.doc.clientID}`);
    bindingRef.current = binding;

    // Stan początkowy (z IndexedDB / z serwera po sync) + kolejne zmiany zdalne
    const applyAll = () => {
      const files = binding.getFiles();
      if (files.length) api.addFiles(files as unknown as BinaryFileData[]);
      applyRemote(binding.getElements());
    };
    applyAll();
    const unobserve = binding.observeRemote(applyRemote);
    const unobserveFiles = binding.observeRemoteFiles((files) =>
      api.addFiles(files as unknown as BinaryFileData[])
    );
    conn.persistence?.on('synced', applyAll);

    // Awareness: własna tożsamość + kursory innych
    const aw = conn.awareness;
    const me: LocalAwarenessState = {
      user: {
        name: username || makeGuestName(aw.clientID),
        color: pickUserColor(aw.clientID),
      },
    };
    aw.setLocalState(me);
    const onAwareness = () => {
      const collaborators = collaboratorsFromAwareness(aw);
      setPeers(collaborators.size);
      api.updateScene({ collaborators });
    };
    aw.on('change', onAwareness);

    if (shouldExposeApi()) {
      window.__excalidrawAPI = api;
      window.__proto = {
        exportPng: async () => {
          const blob = await exportToBlob({
            elements: api.getSceneElements(),
            appState: api.getAppState(),
            files: api.getFiles(),
            mimeType: 'image/png',
          });
          return blob.size;
        },
        counts: () => binding.counts(),
        peers: () => collaboratorsFromAwareness(aw).size,
        status: () => statusRef.current,
        synced: () => syncedRef.current,
        addFunction: (spec, x = 0, y = 0) => {
          const { element, file } = buildFunctionElement(spec, { x, y });
          api.addFiles([file]);
          api.updateScene({
            elements: [...api.getSceneElementsIncludingDeleted(), element],
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
          return element.id;
        },
      };
    }

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      flushPending();
      aw.off('change', onAwareness);
      unobserve();
      unobserveFiles();
      conn.destroy();
      connRef.current = null;
      bindingRef.current = null;
      if (window.__excalidrawAPI === api) {
        delete window.__excalidrawAPI;
        delete window.__proto;
      }
    };
  }, [api, boardId, username, applyRemote, flushPending]);

  // --- kursor -> awareness ---------------------------------------------------

  const handlePointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: 'pointer' | 'laser' };
      button: 'down' | 'up';
    }) => {
      const aw = connRef.current?.awareness;
      if (!aw) return;
      const now = Date.now();
      if (payload.button === 'up' && now - lastPointerPushRef.current < POINTER_THROTTLE_MS) return;
      lastPointerPushRef.current = now;
      aw.setLocalStateField('pointer', payload.pointer);
      aw.setLocalStateField('button', payload.button);
      const sel = api?.getAppState().selectedElementIds;
      if (sel) aw.setLocalStateField('selectedElementIds', sel);
    },
    [api]
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
    () => (
      <div className="flex items-center gap-2">
        <span
          data-testid="proto-status"
          data-status={status}
          data-synced={synced ? '1' : '0'}
          className={`rounded-md px-2 py-1 text-xs font-medium ${
            status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
          title={`Yjs: ${status}${synced ? ', zsynchronizowano' : ''}`}
        >
          {status === 'connected'
            ? `online · ${peers + 1}`
            : status === 'connecting'
              ? 'łączę…'
              : 'offline'}
        </span>
        <FunctionPanel editingSpec={editingSpec} onAdd={addFunction} onUpdate={updateFunction} />
      </div>
    ),
    [status, synced, peers, editingSpec, addFunction, updateFunction]
  );

  const uiOptions = useMemo(
    () => ({ canvasActions: { loadScene: false, saveToActiveFile: false } }),
    []
  );

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      data-testid="proto-board"
      data-board-id={boardId}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        renderTopRightUI={renderTopRightUI}
        langCode="pl-PL"
        handleKeyboardGlobally
        isCollaborating
        UIOptions={uiOptions}
        name={`EasyLesson proto ${boardId}`}
      />
    </div>
  );
}
