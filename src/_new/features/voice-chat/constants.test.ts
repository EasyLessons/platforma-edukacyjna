/**
 * getIceServers po SEC-05: przegladarka nie zna sekretu Xirsys i nie wola jego
 * API - pyta wlasny serwer (/api/turn) z access tokenem, a przy kazdym
 * problemie spada na liste awaryjna (voice nie moze sie wysypac).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetAccessToken, mockRefresh } = vi.hoisted(() => ({
  mockGetAccessToken: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock('@/_new/lib/auth/tokenStore', () => ({ getAccessToken: mockGetAccessToken }));
vi.mock('@/_new/lib/auth/tokenService', () => ({ refreshAccessToken: mockRefresh }));

import { getIceServers, resetIceServersCache } from './constants';

const TURN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:x.xirsys.com:80', username: 'u', credential: 'c' },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn();

const expectFallback = (servers: RTCIceServer[]) => {
  const urls = servers.map((s) => s.urls);
  expect(urls).toContain('stun:stun.l.google.com:19302');
  expect(urls).toContain('turn:openrelay.metered.ca:80');
  expect(urls.some((u) => String(u).includes('xirsys'))).toBe(false);
};

beforeEach(() => {
  resetIceServersCache();
  fetchMock.mockReset();
  mockGetAccessToken.mockReset().mockReturnValue('tok');
  mockRefresh.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('getIceServers (klient)', () => {
  it('pobiera serwery z /api/turn z tokenem Bearer', async () => {
    fetchMock.mockResolvedValue(json({ iceServers: TURN, source: 'xirsys' }));

    const servers = await getIceServers();

    expect(servers).toEqual(TURN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/turn');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('bez tokenu: zadnego zadania, lista awaryjna', async () => {
    mockGetAccessToken.mockReturnValue(null);

    expectFallback(await getIceServers());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 -> odswieza token raz i ponawia', async () => {
    mockRefresh.mockResolvedValue('nowy');
    fetchMock
      .mockResolvedValueOnce(json({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(json({ iceServers: TURN, source: 'xirsys' }));

    expect(await getIceServers()).toEqual(TURN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer nowy');
  });

  it.each([
    ['401 i nieudany refresh', () => json({ error: 'unauthorized' }, 401)],
    ['429', () => json({ error: 'rate_limit' }, 429)],
    ['503', () => json({ error: 'auth_unavailable' }, 503)],
    ['serwer oddal same STUN', () => json({ iceServers: [TURN[0]], source: 'stun' })],
    ['smieci w odpowiedzi', () => json({ iceServers: 'x', source: 'xirsys' })],
    ['niepoprawny JSON', () => new Response('<html>', { status: 200 })],
  ])('%s -> lista awaryjna, bez wyjatku', async (_opis, makeResponse) => {
    mockRefresh.mockRejectedValue(new Error('refresh failed'));
    fetchMock.mockImplementation(async () => makeResponse());

    expectFallback(await getIceServers());
  });

  it('blad sieci -> lista awaryjna, bez wyjatku', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expectFallback(await getIceServers());
  });

  it('seria rownoleglych wywolan (wielu peerow) = jedno zadanie', async () => {
    fetchMock.mockImplementation(async () => json({ iceServers: TURN, source: 'xirsys' }));

    const results = await Promise.all([getIceServers(), getIceServers(), getIceServers()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r).toEqual(TURN);
  });

  it('cache 20 s: w oknie bez zadania, po oknie swieze poswiadczenia', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => json({ iceServers: TURN, source: 'xirsys' }));

    await getIceServers();
    vi.advanceTimersByTime(19_000);
    await getIceServers();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    await getIceServers();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('awaria nie jest cache-owana', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: 'auth_unavailable' }, 503))
      .mockResolvedValueOnce(json({ iceServers: TURN, source: 'xirsys' }));

    expectFallback(await getIceServers());
    expect(await getIceServers()).toEqual(TURN);
  });
});

describe('SEC-05: kod kliencki voice-chat nie zna Xirsys', () => {
  it('constants.ts nie odwoluje sie do zmiennych XIRSYS ani do API Xirsys', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/_new/features/voice-chat/constants.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/process\.env\.[A-Z_]*XIRSYS/);
    expect(source).not.toContain('xirsys.net');
    expect(source).not.toContain('btoa(');
  });
});
