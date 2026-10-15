/**
 * Limit zywych elementow: prawdziwy Hocuspocus + klienci. Nadmiar jest cofany tombstonem,
 * edycja i gumka przechodza, smieci w mapie nie zatruwaja dokumentu.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hocuspocus } from '@hocuspocus/server';
import { HocuspocusProvider } from '@hocuspocus/provider';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { onAuthenticate } from '../src/auth';
import { elementLimit, ELEMENTS_KEY } from '../src/element-limit';
import { mockAccess } from './backend-mock';

const BOARD = '77';
const LIMIT = 10;
let server: Hocuspocus;
let port: number;
const providers: HocuspocusProvider[] = [];

const el = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'rectangle',
  version: 1,
  versionNonce: 5,
  isDeleted: false,
  ...extra,
});

beforeEach(async () => {
  vi.stubGlobal('WebSocket', WebSocket);
  mockAccess({
    a: { status: 200, role: 'editor', can_edit: true, element_limit: LIMIT },
    b: { status: 200, role: 'editor', can_edit: true, element_limit: LIMIT },
    free: { status: 200, role: 'editor', can_edit: true, element_limit: null },
    legacy: { status: 200, role: 'editor', can_edit: true },
  });
  port = 20000 + Math.floor(Math.random() * 20000);
  server = new Hocuspocus({ port, quiet: true, onAuthenticate, extensions: [elementLimit] });
  await server.listen();
});

afterEach(async () => {
  for (const p of providers.splice(0)) p.destroy();
  await server.destroy();
  vi.unstubAllGlobals();
});

function connect(token: string, name = BOARD): Promise<{ doc: Y.Doc; provider: HocuspocusProvider }> {
  const doc = new Y.Doc();
  return new Promise((resolve, reject) => {
    const provider = new HocuspocusProvider({
      url: `ws://127.0.0.1:${port}`,
      name,
      document: doc,
      token,
      onSynced: () => resolve({ doc, provider }),
      onAuthenticationFailed: ({ reason }) => reject(new Error(reason)),
    });
    providers.push(provider);
  });
}

type El = { isDeleted?: boolean; version?: number; x?: number };
const serverMap = (name = BOARD) => server.documents.get(name)?.getMap<unknown>(ELEMENTS_KEY);
const liveOnServer = (name = BOARD) => {
  let n = 0;
  serverMap(name)?.forEach((v) => {
    if ((v as El)?.isDeleted !== true) n++;
  });
  return n;
};
const waitFor = async (check: () => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 25));
  }
};
const settle = () => new Promise((r) => setTimeout(r, 300));

function fill(doc: Y.Doc, n: number, key = ELEMENTS_KEY, prefix = 'e') {
  doc.transact(() => {
    const m = doc.getMap<unknown>(key);
    for (let i = 0; i < n; i++) m.set(`${prefix}${i}`, el(`${prefix}${i}`));
  });
}

describe('limit elementow', () => {
  it('11. element jest cofany tombstonem u serwera i drugiego klienta', async () => {
    const a = await connect('a');
    const b = await connect('b');
    fill(a.doc, LIMIT);
    await waitFor(() => liveOnServer() === LIMIT);

    a.doc.getMap<unknown>(ELEMENTS_KEY).set('nadmiar', el('nadmiar'));
    await waitFor(() => (serverMap()?.get('nadmiar') as El)?.isDeleted === true);
    await waitFor(() => (b.doc.getMap<unknown>(ELEMENTS_KEY).get('nadmiar') as El)?.isDeleted === true);
    expect((serverMap()?.get('nadmiar') as El).version).toBe(2);
    expect(liveOnServer()).toBe(LIMIT);
  });

  it('edycja i gumka przy pelnej tablicy przechodza, potem nowy element wchodzi', async () => {
    const a = await connect('a');
    fill(a.doc, LIMIT);
    await waitFor(() => liveOnServer() === LIMIT);
    const m = a.doc.getMap<unknown>(ELEMENTS_KEY);

    m.set('e0', el('e0', { x: 50, version: 2 })); // edycja
    await waitFor(() => (serverMap()?.get('e0') as El)?.x === 50);

    m.set('e1', el('e1', { isDeleted: true, version: 2 })); // gumka
    await waitFor(() => liveOnServer() === LIMIT - 1);

    m.set('nowy', el('nowy'));
    await waitFor(() => serverMap()?.has('nowy') === true);
    await settle();
    expect((serverMap()?.get('nowy') as El).isDeleted).toBe(false);
    expect(liveOnServer()).toBe(LIMIT);
  });

  it('przelaczenie isDeleted true -> false przy pelnej tablicy jest cofniete', async () => {
    const a = await connect('a');
    fill(a.doc, LIMIT);
    a.doc.getMap<unknown>(ELEMENTS_KEY).set('skasowany', el('skasowany', { isDeleted: true }));
    await waitFor(() => serverMap()?.has('skasowany') === true && liveOnServer() === LIMIT);

    a.doc
      .getMap<unknown>(ELEMENTS_KEY)
      .set('skasowany', el('skasowany', { isDeleted: false, version: 2 }));
    await settle();
    expect((serverMap()?.get('skasowany') as El).isDeleted).toBe(true);
    expect(liveOnServer()).toBe(LIMIT);
  });

  it('smieci (Y.Map, liczba, tablica, null) ponad limitem sa usuwane i dokument sie koduje', async () => {
    const a = await connect('a');
    fill(a.doc, LIMIT);
    await waitFor(() => liveOnServer() === LIMIT);

    a.doc.transact(() => {
      const m = a.doc.getMap<unknown>(ELEMENTS_KEY);
      m.set('ym', new Y.Map());
      m.set('num', 5);
      m.set('arr', [1, 2]);
      m.set('nul', null);
    });
    await settle();
    for (const k of ['ym', 'num', 'arr', 'nul']) expect(serverMap()?.has(k)).toBe(false);
    expect(() => Y.encodeStateAsUpdate(server.documents.get(BOARD)!)).not.toThrow();
  });

  it('dwoch klientow przy 9/10: dokladnie jeden nowy zywy', async () => {
    const a = await connect('a');
    const b = await connect('b');
    fill(a.doc, LIMIT - 1);
    await waitFor(() => liveOnServer() === LIMIT - 1);
    await waitFor(() => b.doc.getMap<unknown>(ELEMENTS_KEY).size === LIMIT - 1);

    a.doc.getMap<unknown>(ELEMENTS_KEY).set('od-a', el('od-a'));
    b.doc.getMap<unknown>(ELEMENTS_KEY).set('od-b', el('od-b'));
    await waitFor(() => serverMap()?.has('od-a') === true && serverMap()?.has('od-b') === true);
    await settle();
    expect(liveOnServer()).toBe(LIMIT);
  });

  it('brak limitu (null / brak pola) i stary klucz elements nie sa limitowane', async () => {
    const free = await connect('free', '101');
    fill(free.doc, LIMIT + 5);
    await waitFor(() => liveOnServer('101') === LIMIT + 5);

    const legacy = await connect('legacy', '102');
    fill(legacy.doc, LIMIT + 5);
    await waitFor(() => liveOnServer('102') === LIMIT + 5);

    const a = await connect('a', '103');
    fill(a.doc, LIMIT + 3, 'elements', 's');
    await waitFor(() => server.documents.get('103')?.getMap('elements').size === LIMIT + 3);
  });

  it('tablica zaladowana ponad limitem: kolejny element odrzucony', async () => {
    const seed = await connect('free', '104');
    fill(seed.doc, 12);
    await waitFor(() => liveOnServer('104') === 12);

    const a = await connect('a', '104');
    a.doc.getMap<unknown>(ELEMENTS_KEY).set('trzynasty', el('trzynasty'));
    await settle();
    expect(liveOnServer('104')).toBe(12);
  });
});
