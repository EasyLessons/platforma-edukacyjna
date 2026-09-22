/**
 * Transport dla prototypu: HocuspocusProvider (ten sam pakiet, którego używa
 * ścieżka Yjs obecnego silnika - `@hocuspocus/provider` jest już w deps) +
 * opcjonalna persystencja w IndexedDB (`y-indexeddb`), bez backendu.
 *
 * Serwer: `npm run proto:yjs` (scripts/proto-yjs-server.mjs, bez auth) albo
 * usługa `proto-yjs` w docker-compose (profil `proto`).
 * URL z NEXT_PUBLIC_PROTO_YJS_URL, domyślnie ws://localhost:1234.
 */

import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Awareness } from 'y-protocols/awareness';

export const DEFAULT_PROTO_YJS_URL = 'ws://localhost:1234';

export function getProtoYjsUrl(): string {
  return process.env.NEXT_PUBLIC_PROTO_YJS_URL || DEFAULT_PROTO_YJS_URL;
}

export interface ProtoConnection {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  awareness: Awareness;
  persistence: IndexeddbPersistence | null;
  destroy: () => void;
}

export interface ConnectOptions {
  boardId: string;
  url?: string;
  /** Persystencja lokalna w IndexedDB (domyślnie włączona; testy e2e mogą ją wyłączyć). */
  indexeddb?: boolean;
  onStatus?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  onSynced?: () => void;
}

export function connectProtoBoard(opts: ConnectOptions): ProtoConnection {
  const doc = new Y.Doc();
  const name = `proto-excalidraw:${opts.boardId}`;

  const provider = new HocuspocusProvider({
    url: opts.url ?? getProtoYjsUrl(),
    name,
    document: doc,
    onStatus: ({ status }) => opts.onStatus?.(status),
    onSynced: () => opts.onSynced?.(),
  });

  const persistence = opts.indexeddb === false ? null : new IndexeddbPersistence(name, doc);

  // provider.awareness jest null tylko gdy jawnie przekazano `awareness: null`
  const awareness = provider.awareness as Awareness;

  return {
    doc,
    provider,
    awareness,
    persistence,
    destroy: () => {
      provider.destroy();
      persistence?.destroy();
      doc.destroy();
    },
  };
}
