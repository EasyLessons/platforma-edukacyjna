// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { getIceServers, parseXirsysResponse, STUN_FALLBACK_SERVERS } from './get-ice-servers';

const xirsysOk = (urls: string[] = ['turn:x.xirsys.com:80?transport=udp']) =>
  new Response(
    JSON.stringify({
      s: 'ok',
      v: { iceServers: { username: 'u1', urls, credential: 'c1' } },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

const XIRSYS_ENV_NAMES = [
  'XIRSYS_IDENT',
  'XIRSYS_SECRET',
  'XIRSYS_CHANNEL',
  'NEXT_PUBLIC_XIRSYS_IDENT',
  'NEXT_PUBLIC_XIRSYS_SECRET',
  'NEXT_PUBLIC_XIRSYS_CHANNEL',
];

function stubXirsysEnv() {
  vi.stubEnv('XIRSYS_IDENT', 'ident-1');
  vi.stubEnv('XIRSYS_SECRET', 'sekret-1');
  vi.stubEnv('XIRSYS_CHANNEL', 'easylesson');
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // CI i lokalne .env moga miec ustawione stare zmienne - test startuje od zera.
  for (const name of XIRSYS_ENV_NAMES) vi.stubEnv(name, '');
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('getIceServers - brak konfiguracji', () => {
  it.each([
    ['brak wszystkich', {}],
    ['brak sekretu', { XIRSYS_IDENT: 'i', XIRSYS_CHANNEL: 'c' }],
    ['brak kanalu', { XIRSYS_IDENT: 'i', XIRSYS_SECRET: 's' }],
  ])('%s -> same STUN, zero zapytan do Xirsys', async (_opis, env) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const fetchImpl = vi.fn();

    const result = await getIceServers(fetchImpl);

    expect(result).toEqual({ iceServers: [...STUN_FALLBACK_SERVERS], source: 'stun' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('getIceServers - Xirsys', () => {
  it('sukces: PUT z Basic auth na kanal, STUN + TURN z poswiadczeniami', async () => {
    stubXirsysEnv();
    const fetchImpl = vi.fn().mockResolvedValue(xirsysOk(['turn:a:80', 'turns:a:443']));

    const result = await getIceServers(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://global.xirsys.net/_turn/easylesson');
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('ident-1:sekret-1').toString('base64')}`
    );
    expect(JSON.parse(init.body)).toEqual({ format: 'urls' });

    expect(result.source).toBe('xirsys');
    expect(result.iceServers).toEqual([
      ...STUN_FALLBACK_SERVERS,
      { urls: 'turn:a:80', username: 'u1', credential: 'c1' },
      { urls: 'turns:a:443', username: 'u1', credential: 'c1' },
    ]);
  });

  it('przejsciowy fallback: stare NEXT_PUBLIC_XIRSYS_* dzialaja po stronie serwera', async () => {
    vi.stubEnv('NEXT_PUBLIC_XIRSYS_IDENT', 'stary-ident');
    vi.stubEnv('NEXT_PUBLIC_XIRSYS_SECRET', 'stary-sekret');
    vi.stubEnv('NEXT_PUBLIC_XIRSYS_CHANNEL', 'stary-kanal');
    const fetchImpl = vi.fn().mockResolvedValue(xirsysOk());

    const result = await getIceServers(fetchImpl);

    expect(result.source).toBe('xirsys');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://global.xirsys.net/_turn/stary-kanal');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('stary-ident:stary-sekret').toString('base64')}`
    );
  });

  it('nowe XIRSYS_* maja pierwszenstwo przed starymi NEXT_PUBLIC_XIRSYS_*', async () => {
    stubXirsysEnv();
    vi.stubEnv('NEXT_PUBLIC_XIRSYS_IDENT', 'stary-ident');
    vi.stubEnv('NEXT_PUBLIC_XIRSYS_SECRET', 'stary-sekret');
    vi.stubEnv('NEXT_PUBLIC_XIRSYS_CHANNEL', 'stary-kanal');
    const fetchImpl = vi.fn().mockResolvedValue(xirsysOk());

    await getIceServers(fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://global.xirsys.net/_turn/easylesson');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('ident-1:sekret-1').toString('base64')}`
    );
  });

  it('sekret konta nie trafia do wyniku', async () => {
    stubXirsysEnv();
    const fetchImpl = vi.fn().mockResolvedValue(xirsysOk());

    const result = await getIceServers(fetchImpl);

    expect(JSON.stringify(result)).not.toContain('sekret-1');
    expect(JSON.stringify(result)).not.toContain('ident-1');
  });

  it('kazde wywolanie pyta Xirsys o swieze poswiadczenia (bez cache)', async () => {
    stubXirsysEnv();
    const fetchImpl = vi.fn().mockImplementation(async () => xirsysOk());

    await getIceServers(fetchImpl);
    await getIceServers(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['HTTP 401', () => new Response('{}', { status: 401 })],
    ['HTTP 500', () => new Response('boom', { status: 500 })],
    ['s != ok', () => new Response(JSON.stringify({ s: 'error', v: 'bad key' }), { status: 200 })],
    ['pusta lista', () => new Response(JSON.stringify({ s: 'ok', v: {} }), { status: 200 })],
    ['niepoprawny JSON', () => new Response('<html>', { status: 200 })],
  ])('awaria Xirsys (%s) -> same STUN, bez wyjatku', async (_opis, makeResponse) => {
    stubXirsysEnv();
    const fetchImpl = vi.fn().mockImplementation(async () => makeResponse());

    const result = await getIceServers(fetchImpl);

    expect(result).toEqual({ iceServers: [...STUN_FALLBACK_SERVERS], source: 'stun' });
  });

  it('fetch rzuca (timeout/siec) -> same STUN, w logu nie ma sekretu', async () => {
    stubXirsysEnv();
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));

    const result = await getIceServers(fetchImpl);

    expect(result).toEqual({ iceServers: [...STUN_FALLBACK_SERVERS], source: 'stun' });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('timeout');
    expect(logged).not.toContain('sekret-1');
    expect(logged).not.toContain(Buffer.from('ident-1:sekret-1').toString('base64'));
  });
});

describe('parseXirsysResponse', () => {
  it('format Xirsys: v.iceServers = { username, urls[], credential }', () => {
    expect(
      parseXirsysResponse({
        s: 'ok',
        v: { iceServers: { username: 'u', urls: ['turn:a', 'turn:b'], credential: 'c' } },
      })
    ).toEqual([
      { urls: 'turn:a', username: 'u', credential: 'c' },
      { urls: 'turn:b', username: 'u', credential: 'c' },
    ]);
  });

  it('v.iceServers jako tablica RTCIceServer', () => {
    expect(
      parseXirsysResponse({
        s: 'ok',
        v: {
          iceServers: [{ urls: ['turn:a'], username: 'u', credential: 'c' }, { urls: 'stun:s' }],
        },
      })
    ).toEqual([{ urls: ['turn:a'], username: 'u', credential: 'c' }, { urls: 'stun:s' }]);
  });

  it('v jako tablica; wpisy bez urls odrzucone, nadmiarowe pola obciete', () => {
    expect(
      parseXirsysResponse({
        s: 'ok',
        v: [{ urls: 'turn:a', username: 'u', credential: 'c', extra: 1 }, { username: 'x' }, null],
      })
    ).toEqual([{ urls: 'turn:a', username: 'u', credential: 'c' }]);
  });

  it.each([null, 'ok', { s: 'ok' }, { s: 'error', v: {} }, { v: [] }])(
    'smieci -> pusta lista (%o)',
    (body) => {
      expect(parseXirsysResponse(body)).toEqual([]);
    }
  );
});
