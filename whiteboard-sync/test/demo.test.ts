/**
 * Tablica demo bez konta (src/demo.ts): jednostkowo (sesje, limity, wygasanie) i na prawdziwym
 * serwerze Hocuspocus z dwoma gośćmi - wejście bez tokenu, współdzielenie dokumentu, ZERO zapytań
 * do backendu (nic nie trafia do bazy), limit elementów i rozłączenie po upływie czasu sesji.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { HocuspocusProvider } from '@hocuspocus/provider';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { createAuthenticate, onAuthenticate } from '../src/auth';
import { createDatabaseHandlers } from '../src/database';
import { DEFAULT_DEMO_CONFIG, DemoSessions, demoConfigFromEnv, isDemoDocument } from '../src/demo';
import { elementLimit, ELEMENTS_KEY } from '../src/element-limit';
import { mockAccess } from './backend-mock';

const DOC = 'demo-AbCdEfGhIjKlMnOpQrStUv'; // 22 znaki jak createDemoSessionId()
const OTHER_DOC = 'demo-ZyXwVuTsRqPoNmLkJiHgFe';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isDemoDocument', () => {
  it.each([
    [DOC, true],
    ['demo-' + 'a'.repeat(16), true],
    ['demo-' + 'a'.repeat(64), true],
    ['demo-abc', false], // za krótkie - nie do zgadnięcia, więc nie wpuszczamy
    ['demo-' + 'a'.repeat(65), false],
    ['demo-' + 'a'.repeat(15) + '/', false],
    ['demo-' + 'a'.repeat(15) + '.', false],
    ['12', false], // prawdziwa tablica
    ['xdemo-' + 'a'.repeat(20), false],
    ['', false],
  ])('%s -> %s', (name, expected) => {
    expect(isDemoDocument(name)).toBe(expected);
  });
});

describe('DemoSessions', () => {
  let clock: number;
  const config = {
    ttlMs: 1000,
    expiredGraceMs: 5000,
    idleMs: 200,
    maxConnectionsPerDoc: 2,
    maxSessions: 2,
    elementLimit: 7,
  };
  const make = () => new DemoSessions(config, () => clock);
  beforeEach(() => {
    clock = 10_000;
  });

  it('pierwsze wejście zakłada sesję, kolejne dołączają', () => {
    const sessions = make();
    expect(sessions.admit(DOC, 0)).toBeNull();
    expect(sessions.admit(DOC, 1)).toBeNull();
    expect(sessions.size).toBe(1);
  });

  it('limit osób w jednej sesji -> demo-full', () => {
    const sessions = make();
    sessions.admit(DOC, 0);
    expect(sessions.admit(DOC, 2)).toBe('demo-full');
  });

  it('limit równoległych sesji -> demo-full, ale istniejące wpuszczają dalej', () => {
    const sessions = make();
    sessions.admit('demo-aaaaaaaaaaaaaaaaaaaa', 0);
    sessions.admit('demo-bbbbbbbbbbbbbbbbbbbb', 0);
    expect(sessions.admit(DOC, 0)).toBe('demo-full');
    expect(sessions.admit('demo-aaaaaaaaaaaaaaaaaaaa', 1)).toBeNull();
  });

  it('po upływie czasu sesji wejście jest odrzucane (demo-expired), aż do końca karencji', () => {
    const sessions = make();
    sessions.admit(DOC, 0);
    clock += config.ttlMs - 1;
    expect(sessions.admit(DOC, 1)).toBeNull();
    clock += 1;
    expect(sessions.admit(DOC, 1)).toBe('demo-expired');
    clock += config.expiredGraceMs - 1;
    expect(sessions.admit(DOC, 0)).toBe('demo-expired');
  });

  it('po karencji id jest znów wolne i zaczyna nową sesję', () => {
    const sessions = make();
    sessions.admit(DOC, 0);
    clock += config.ttlMs + config.expiredGraceMs;
    expect(sessions.admit(DOC, 0)).toBeNull();
  });

  it('sweep zamyka połączenia dokładnie raz, gdy sesja wygasła', () => {
    const sessions = make();
    const closeConnections = vi.fn();
    const server = {
      documents: new Map([[DOC, { getConnectionsCount: () => 2 }]]),
      closeConnections,
    } as never;
    sessions.admit(DOC, 0);

    sessions.sweep(server);
    expect(closeConnections).not.toHaveBeenCalled();

    clock += config.ttlMs;
    sessions.sweep(server);
    sessions.sweep(server);
    expect(closeConnections).toHaveBeenCalledTimes(1);
    expect(closeConnections).toHaveBeenCalledWith(DOC);
  });

  it('pusta sesja jest zapominana po idleMs i zwalnia miejsce, zajęta nie', () => {
    const sessions = make();
    const connected = new Map<string, { getConnectionsCount: () => number }>();
    const server = { documents: connected, closeConnections: vi.fn() } as never;
    sessions.admit('demo-aaaaaaaaaaaaaaaaaaaa', 0);
    sessions.admit('demo-bbbbbbbbbbbbbbbbbbbb', 0);
    connected.set('demo-aaaaaaaaaaaaaaaaaaaa', { getConnectionsCount: () => 1 });

    sessions.sweep(server); // zapamiętuje, że b jest puste
    clock += config.idleMs;
    sessions.sweep(server);

    expect(sessions.size).toBe(1);
    expect(sessions.admit(DOC, 0)).toBeNull(); // jest miejsce na nową
  });
});

describe('demoConfigFromEnv', () => {
  it('domyślne wartości, gdy env pusty albo błędny', () => {
    expect(demoConfigFromEnv({})).toEqual(DEFAULT_DEMO_CONFIG);
    expect(
      demoConfigFromEnv({ DEMO_SESSION_TTL_MINUTES: 'abc', DEMO_MAX_SESSIONS: '-3', DEMO_ELEMENT_LIMIT: '0' })
    ).toEqual(DEFAULT_DEMO_CONFIG);
  });

  it('wartości z env', () => {
    const config = demoConfigFromEnv({
      DEMO_SESSION_TTL_MINUTES: '30',
      DEMO_MAX_CONNECTIONS_PER_DOC: '3',
      DEMO_MAX_SESSIONS: '5',
      DEMO_ELEMENT_LIMIT: '100',
    });
    expect(config).toMatchObject({
      ttlMs: 30 * 60_000,
      maxConnectionsPerDoc: 3,
      maxSessions: 5,
      elementLimit: 100,
    });
  });
});

describe('onAuthenticate dla demo', () => {
  it('wpuszcza bez tokenu i bez pytania backendu, z prawem edycji i limitem elementów', async () => {
    const fetchMock = mockAccess({});
    const authenticate = createAuthenticate(new DemoSessions({ ...DEFAULT_DEMO_CONFIG, elementLimit: 42 }));
    const connection = { readOnly: true };

    const ctx = await authenticate({ documentName: DOC, connection });

    expect(ctx).toMatchObject({ demo: true, canEdit: true, elementLimit: 42, token: '' });
    expect(connection.readOnly).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('token wysłany przez klienta jest ignorowany (nie trafia do kontekstu)', async () => {
    mockAccess({});
    const ctx = await createAuthenticate(new DemoSessions())({ documentName: DOC, token: 'cokolwiek' });
    expect(ctx.token).toBe('');
  });

  it('powody odmowy: wygasła sesja i pełna sesja', async () => {
    mockAccess({});
    let now = 0;
    const sessions = new DemoSessions({ ...DEFAULT_DEMO_CONFIG, ttlMs: 1000, maxConnectionsPerDoc: 1 }, () => now);
    const authenticate = createAuthenticate(sessions);
    const reasonOf = async (promise: Promise<unknown>) =>
      promise.then(
        () => undefined,
        (err: { reason?: string }) => err.reason
      );
    const full = { documents: new Map([[DOC, { getConnectionsCount: () => 1 }]]) };

    await authenticate({ documentName: DOC });
    expect(await reasonOf(authenticate({ documentName: DOC, instance: full }))).toBe('demo-full');
    now = 1000;
    expect(await reasonOf(authenticate({ documentName: DOC }))).toBe('demo-expired');
  });

  it('numeryczne id i krótkie nazwy demo nadal wymagają tokenu / są odrzucane', async () => {
    mockAccess({});
    const reasonOf = async (name: string) =>
      onAuthenticate({ documentName: name, token: 'x' }).then(
        () => undefined,
        (err: { reason?: string }) => err.reason
      );
    expect(await onAuthenticate({ documentName: '12' }).catch((e) => e.reason)).toBe('token-expired');
    expect(await reasonOf('demo-abc')).toBe('access-denied');
  });
});

describe('database dla demo', () => {
  it('nie czyta i nie zapisuje niczego w backendzie', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const db = createDatabaseHandlers({ backendUrl: 'http://backend.test', serviceToken: 'svc' });

    expect(await db.fetch({ documentName: DOC, context: {} })).toBeNull();
    await db.store({ documentName: DOC, state: new Uint8Array([1, 2, 3]), context: {} });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('serwer z dwoma gośćmi', () => {
  let server: Hocuspocus;
  let port: number;
  let clock: number;
  let sessions: DemoSessions;
  let fetchMock: ReturnType<typeof mockAccess>;
  const providers: HocuspocusProvider[] = [];

  beforeEach(async () => {
    vi.stubGlobal('WebSocket', WebSocket);
    fetchMock = mockAccess({});
    clock = 1_000_000;
    sessions = new DemoSessions(
      { ...DEFAULT_DEMO_CONFIG, ttlMs: 60_000, maxConnectionsPerDoc: 2, elementLimit: 3 },
      () => clock
    );
    port = 20000 + Math.floor(Math.random() * 20000);
    server = new Hocuspocus({
      port,
      quiet: true,
      onAuthenticate: createAuthenticate(sessions),
      extensions: [
        new Database(createDatabaseHandlers({ backendUrl: 'http://backend.test', serviceToken: 'svc' })),
        elementLimit,
      ],
    });
    await server.listen();
  });

  afterEach(async () => {
    for (const p of providers.splice(0)) p.destroy();
    await server.destroy();
  });

  function join(name = DOC): Promise<{ doc: Y.Doc; provider: HocuspocusProvider; reasons: string[] }> {
    const doc = new Y.Doc();
    const reasons: string[] = [];
    return new Promise((resolve, reject) => {
      const provider = new HocuspocusProvider({
        url: `ws://127.0.0.1:${port}`,
        name,
        document: doc,
        token: 'demo',
        onSynced: () => resolve({ doc, provider, reasons }),
        onAuthenticationFailed: ({ reason }) => {
          reasons.push(reason);
          reject(Object.assign(new Error(reason), { reason }));
        },
      });
      providers.push(provider);
    });
  }

  const waitFor = async (check: () => boolean, ms = 3000) => {
    const end = Date.now() + ms;
    while (!check()) {
      if (Date.now() > end) throw new Error('timeout');
      await new Promise((r) => setTimeout(r, 25));
    }
  };
  const liveElements = (doc: Y.Doc) => {
    let n = 0;
    doc.getMap<{ isDeleted?: boolean }>(ELEMENTS_KEY).forEach((v) => {
      if (!v.isDeleted) n++;
    });
    return n;
  };
  const element = (id: string) => ({ id, type: 'rectangle', isDeleted: false, version: 1 });

  it('dwóch gości widzi swoje zmiany, a backend nie dostaje żadnego zapytania', async () => {
    const a = await join();
    const b = await join();

    a.doc.getMap(ELEMENTS_KEY).set('e1', element('e1'));
    await waitFor(() => b.doc.getMap(ELEMENTS_KEY).has('e1'));
    b.doc.getMap(ELEMENTS_KEY).set('e2', element('e2'));
    await waitFor(() => a.doc.getMap(ELEMENTS_KEY).has('e2'));

    a.provider.destroy();
    b.provider.destroy();
    await waitFor(() => !server.documents.has(DOC)); // dokument jest zwalniany i nie jest nigdzie zapisany
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trzecia osoba nie wejdzie do pełnej sesji (demo-full)', async () => {
    await join();
    await join();

    await expect(join()).rejects.toMatchObject({ reason: 'demo-full' });
  });

  it('limit elementów: nadmiar ponad limit demo jest cofany', async () => {
    const a = await join();
    for (const id of ['e1', 'e2', 'e3', 'e4', 'e5']) a.doc.getMap(ELEMENTS_KEY).set(id, element(id));

    await waitFor(() => liveElements(a.doc) === 3);
    await new Promise((r) => setTimeout(r, 150));
    expect(liveElements(a.doc)).toBe(3);
  });

  it('po upływie czasu sesji serwer rozłącza gości, a powrót jest odrzucany (demo-expired)', async () => {
    const a = await join();
    const b = await join();
    a.doc.getMap(ELEMENTS_KEY).set('e1', element('e1'));
    await waitFor(() => b.doc.getMap(ELEMENTS_KEY).has('e1'));

    clock += 60_000;
    sessions.sweep(server);

    await waitFor(() => server.getConnectionsCount() === 0);
    await expect(join()).rejects.toMatchObject({ reason: 'demo-expired' });
    // Inna sesja demo działa normalnie
    const other = await join(OTHER_DOC);
    expect(other.provider.isSynced).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
