/**
 * Scenariusz utraty zapisu (odtworzony ręcznie 01.10.2026 z TTL tokenu 1 min): token usera
 * wygasa w trakcie otwartego połączenia, a zmiany nadal mają trafić do bazy.
 *
 * Prawdziwy serwer Hocuspocus z naszym onAuthenticate i rozszerzeniem Database; atrapa backendu
 * odrzuca token usera po "wygaśnięciu" (401), a klucz serwisu przyjmuje zawsze.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { HocuspocusProvider } from '@hocuspocus/provider';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { onAuthenticate } from '../src/auth';
import { createDatabaseHandlers, SERVICE_TOKEN_HEADER } from '../src/database';
import { jsonResponse } from './backend-mock';

const BOARD = '9';
const SERVICE = 'svc-secret';
let tokenExpired = false;
let storedSnapshot: string | null = null;
let server: Hocuspocus;
let port: number;
let provider: HocuspocusProvider | null = null;

/** Atrapa FastAPI: /access i /doc z prawdziwą semantyką tokenów. */
function backendFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const userOk = headers.get('Authorization') === 'Bearer user' && !tokenExpired;
  const serviceOk = headers.get(SERVICE_TOKEN_HEADER) === SERVICE;
  const path = String(url);

  if (path.endsWith('/access')) {
    if (!userOk) return Promise.resolve(jsonResponse(401, null));
    return Promise.resolve(
      jsonResponse(200, { has_access: true, user_id: 1, username: 'u', role: 'editor', can_edit: true })
    );
  }
  if (!userOk && !serviceOk) return Promise.resolve(jsonResponse(401, null));
  if (init?.method === 'POST') {
    storedSnapshot = (JSON.parse(init.body as string) as { snapshot: string }).snapshot;
    return Promise.resolve(jsonResponse(200, { success: true }));
  }
  return Promise.resolve(jsonResponse(200, { snapshot: storedSnapshot, updated_at: null }));
}

async function startServer(serviceToken?: string) {
  port = 20000 + Math.floor(Math.random() * 20000);
  server = new Hocuspocus({
    port,
    quiet: true,
    debounce: 50,
    maxDebounce: 100,
    onAuthenticate,
    extensions: [
      new Database(
        createDatabaseHandlers({
          backendUrl: 'http://backend.test',
          serviceToken,
          readRetryDelaysMs: [],
          storeRetryDelaysMs: [],
        })
      ),
    ],
  });
  await server.listen();
}

beforeEach(() => {
  tokenExpired = false;
  storedSnapshot = null;
  vi.stubGlobal('WebSocket', WebSocket);
  vi.stubGlobal('fetch', vi.fn(backendFetch));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  provider?.destroy();
  provider = null;
  await server.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function connect(): Promise<Y.Doc> {
  const doc = new Y.Doc();
  await new Promise<void>((resolve) => {
    provider = new HocuspocusProvider({
      url: `ws://127.0.0.1:${port}`,
      name: BOARD,
      document: doc,
      token: 'user',
      onSynced: () => resolve(),
    });
  });
  return doc;
}

function storedValue(): string | undefined {
  if (!storedSnapshot) return undefined;
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(storedSnapshot, 'base64'));
  return doc.getMap<string>('m').get('v');
}

const waitFor = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 25));
  }
};

describe('zapis po wygaśnięciu tokenu usera', () => {
  it('z kluczem serwisu: zmiana po wygaśnięciu tokenu trafia do bazy', async () => {
    await startServer(SERVICE);
    const doc = await connect();

    doc.getMap<string>('m').set('v', 'przed');
    await waitFor(() => storedValue() === 'przed');

    tokenExpired = true;
    doc.getMap<string>('m').set('v', 'po');
    await waitFor(() => storedValue() === 'po');
  });

  it('kontrola - bez klucza (stare zachowanie): zmiana po wygaśnięciu tokenu NIE trafia do bazy', async () => {
    await startServer(undefined);
    const doc = await connect();

    doc.getMap<string>('m').set('v', 'przed');
    await waitFor(() => storedValue() === 'przed');

    tokenExpired = true;
    doc.getMap<string>('m').set('v', 'po');
    await new Promise((r) => setTimeout(r, 400));
    expect(storedValue()).toBe('przed');
  });
});
