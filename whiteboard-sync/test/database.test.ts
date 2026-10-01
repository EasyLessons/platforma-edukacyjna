import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseHandlers, SERVICE_TOKEN_HEADER } from '../src/database';
import { jsonResponse } from './backend-mock';

const BACKEND = 'http://backend.test';
const noSleep = vi.fn(async () => undefined);

afterEach(() => {
  vi.unstubAllGlobals();
  noSleep.mockClear();
});

/** fetch zwracający kolejne odpowiedzi (statusy albo wyjątki). */
function sequence(...steps: Array<number | Error>) {
  const fetchMock = vi.fn(async () => {
    const step = steps.shift() ?? 200;
    if (step instanceof Error) throw step;
    return jsonResponse(step, step === 200 ? { success: true, snapshot: null } : null);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const headersOf = (call: unknown[]) => new Headers((call[1] as RequestInit).headers);
const state = new Uint8Array([1, 2, 3]);

describe('store', () => {
  it('zapisuje kluczem serwisu, nie tokenem usera', async () => {
    const fetchMock = sequence(200);
    const db = createDatabaseHandlers({ backendUrl: BACKEND, serviceToken: 'svc', sleep: noSleep });

    await db.store({ documentName: '5', state, context: { token: 'user-token' } });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BACKEND}/api/v1/whiteboard/5/doc`);
    expect(init.method).toBe('POST');
    expect(headersOf(fetchMock.mock.calls[0]).get(SERVICE_TOKEN_HEADER)).toBe('svc');
    expect(headersOf(fetchMock.mock.calls[0]).get('Authorization')).toBeNull();
    expect(JSON.parse(init.body as string)).toEqual({ snapshot: 'AQID' });
  });

  it('bez klucza serwisu - zapas: token usera', async () => {
    const fetchMock = sequence(200);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = createDatabaseHandlers({ backendUrl: BACKEND, sleep: noSleep });

    await db.store({ documentName: '5', state, context: { token: 'user-token' } });

    expect(headersOf(fetchMock.mock.calls[0]).get('Authorization')).toBe('Bearer user-token');
  });

  it('5xx i błąd sieci -> ponowienie z backoffem, potem sukces', async () => {
    const fetchMock = sequence(503, new TypeError('fetch failed'), 200);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = createDatabaseHandlers({
      backendUrl: BACKEND,
      serviceToken: 'svc',
      storeRetryDelaysMs: [10, 20, 30],
      sleep: noSleep,
    });

    await db.store({ documentName: '5', state, context: {} });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(noSleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([10, 20]);
  });

  it('wyczerpane ponowienia -> głośny log, ale bez wyjątku (wyjątek zabiłby proces)', async () => {
    const fetchMock = sequence(500, 500, 500);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = createDatabaseHandlers({
      backendUrl: BACKEND,
      serviceToken: 'svc',
      storeRetryDelaysMs: [1, 1],
      sleep: noSleep,
    });

    await expect(db.store({ documentName: '5', state, context: {} })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(error.mock.calls[0][0])).toMatch(/ZAPIS NIEUDANY.*500/);
  });

  it('401/403/404 -> bez ponawiania, log', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const status of [401, 403, 404]) {
      const fetchMock = sequence(status);
      const db = createDatabaseHandlers({ backendUrl: BACKEND, serviceToken: 'svc', sleep: noSleep });
      await db.store({ documentName: '5', state, context: {} });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(error.mock.lastCall?.[0])).toContain(String(status));
    }
  });

  it('nowszy zapis tej samej tablicy przerywa starszy, który czeka na ponowienie', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bodies: string[] = [];
    let first = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(init.body as string);
        if (first) {
          first = false;
          return jsonResponse(503, null);
        }
        return jsonResponse(200, { success: true });
      })
    );
    let releaseSleep: () => void = () => undefined;
    const db = createDatabaseHandlers({
      backendUrl: BACKEND,
      serviceToken: 'svc',
      storeRetryDelaysMs: [1000],
      sleep: () => new Promise<void>((r) => (releaseSleep = r)),
    });

    const older = db.store({ documentName: '5', state: new Uint8Array([1]), context: {} });
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    await db.store({ documentName: '5', state: new Uint8Array([2]), context: {} });
    releaseSleep();
    await older;

    // starszy (503) nie wysłał się ponownie po nowszym - w bazie zostaje nowszy stan
    expect(bodies.map((b) => JSON.parse(b).snapshot)).toEqual(['AQ==', 'Ag==']);
  });

  it('brak klucza i brak tokenu usera -> bez wołania backendu', async () => {
    const fetchMock = sequence(200);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = createDatabaseHandlers({ backendUrl: BACKEND, sleep: noSleep });
    await db.store({ documentName: '5', state, context: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetch', () => {
  it('zwraca snapshot jako bajty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { snapshot: 'AQID', updated_at: null }))
    );
    const db = createDatabaseHandlers({ backendUrl: BACKEND, serviceToken: 'svc', sleep: noSleep });
    expect(Array.from((await db.fetch({ documentName: '5', context: {} }))!)).toEqual([1, 2, 3]);
  });

  it('brak snapshotu -> null (nowa tablica)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { snapshot: null })));
    const db = createDatabaseHandlers({ backendUrl: BACKEND, serviceToken: 'svc', sleep: noSleep });
    expect(await db.fetch({ documentName: '5', context: {} })).toBeNull();
  });

  it('błąd odczytu -> wyjątek, NIE pusty dokument (pusty nadpisałby bazę przy zapisie)', async () => {
    sequence(503, 503);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = createDatabaseHandlers({
      backendUrl: BACKEND,
      serviceToken: 'svc',
      readRetryDelaysMs: [1],
      sleep: noSleep,
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(db.fetch({ documentName: '5', context: {} })).rejects.toMatchObject({
      message: expect.stringMatching(/503/),
      reason: 'server-unavailable',
    });
  });
});
