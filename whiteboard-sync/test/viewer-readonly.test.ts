/**
 * Prawdziwy serwer Hocuspocus z naszym onAuthenticate i dwaj klienci (HocuspocusProvider przez ws):
 * zmiana od viewera nie trafia do dokumentu na serwerze ani do innych osób.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hocuspocus } from '@hocuspocus/server';
import { HocuspocusProvider } from '@hocuspocus/provider';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { onAuthenticate } from '../src/auth';
import { mockAccess } from './backend-mock';

const BOARD = '42';
let server: Hocuspocus;
let port: number;
const providers: HocuspocusProvider[] = [];

beforeEach(async () => {
  // Node 20 nie ma globalnego WebSocket, a provider Hocuspocus 2.x z niego korzysta.
  vi.stubGlobal('WebSocket', WebSocket);
  mockAccess({
    editor: { status: 200, role: 'editor', can_edit: true },
    viewer: { status: 200, role: 'viewer', can_edit: false },
  });
  port = 20000 + Math.floor(Math.random() * 20000);
  server = new Hocuspocus({ port, quiet: true, onAuthenticate });
  await server.listen();
});

afterEach(async () => {
  for (const p of providers.splice(0)) p.destroy();
  await server.destroy();
  vi.unstubAllGlobals();
});

function connect(token: string): Promise<{ doc: Y.Doc; provider: HocuspocusProvider }> {
  const doc = new Y.Doc();
  return new Promise((resolve, reject) => {
    const provider = new HocuspocusProvider({
      url: `ws://127.0.0.1:${port}`,
      name: BOARD,
      document: doc,
      token,
      onSynced: () => resolve({ doc, provider }),
      onAuthenticationFailed: ({ reason }) => reject(new Error(reason)),
    });
    providers.push(provider);
  });
}

const serverMap = () => server.documents.get(BOARD)?.getMap<number>('elements');
const waitFor = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 25));
  }
};

describe('rola viewer na serwerze', () => {
  it('zmiana od viewera nie trafia do dokumentu na serwerze ani do edytora', async () => {
    const editor = await connect('editor');
    editor.doc.getMap<number>('elements').set('od-edytora', 1);
    await waitFor(() => serverMap()?.get('od-edytora') === 1);

    const viewer = await connect('viewer');
    // viewer widzi treść
    expect(viewer.doc.getMap<number>('elements').get('od-edytora')).toBe(1);

    viewer.doc.getMap<number>('elements').set('od-viewera', 2);
    // kontrola: kolejna zmiana edytora dociera, więc kanał działa - a zmiana viewera nie
    editor.doc.getMap<number>('elements').set('kontrola', 3);
    await waitFor(() => serverMap()?.get('kontrola') === 3);
    await waitFor(() => viewer.doc.getMap<number>('elements').get('kontrola') === 3);

    expect(serverMap()?.has('od-viewera')).toBe(false);
    expect(editor.doc.getMap<number>('elements').has('od-viewera')).toBe(false);
  });

  it('edytor zapisuje normalnie', async () => {
    const editor = await connect('editor');
    editor.doc.getMap<number>('elements').set('x', 5);
    await waitFor(() => serverMap()?.get('x') === 5);
  });
});
