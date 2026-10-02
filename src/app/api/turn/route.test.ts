// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockAuthenticate, mockGetIceServers } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockGetIceServers: vi.fn(),
}));

vi.mock('@/_new/server/chat/auth', () => ({ authenticateChatRequest: mockAuthenticate }));
vi.mock('@/_new/server/turn/get-ice-servers', () => ({ getIceServers: mockGetIceServers }));

import { GET } from './route';

let ipCounter = 0;
const nextIp = () => `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

const makeRequest = (token: string | null, ip: string = nextIp()) =>
  new Request('http://localhost/api/turn', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }) as Parameters<typeof GET>[0];

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mockAuthenticate.mockReset();
  mockGetIceServers.mockReset();
  mockGetIceServers.mockResolvedValue({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:t', username: 'u', credential: 'c' },
    ],
    source: 'xirsys',
  });
});

describe('GET /api/turn', () => {
  it('401 bez tokenu - bez zapytania do backendu i bez Xirsys', async () => {
    const res = await GET(makeRequest(null));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockGetIceServers).not.toHaveBeenCalled();
  });

  it('401 gdy backend odrzuca token - nie dotyka Xirsys', async () => {
    mockAuthenticate.mockResolvedValue({ ok: false, status: 401, error: 'unauthorized' });

    const res = await GET(makeRequest('zly'));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(mockGetIceServers).not.toHaveBeenCalled();
  });

  it('503 gdy backend auth niedostepny (fail-closed)', async () => {
    mockAuthenticate.mockResolvedValue({ ok: false, status: 503, error: 'auth_unavailable' });

    const res = await GET(makeRequest('tok'));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'auth_unavailable' });
    expect(mockGetIceServers).not.toHaveBeenCalled();
  });

  it('200 z lista ICE dla zalogowanego, bez cache HTTP', async () => {
    mockAuthenticate.mockResolvedValue({ ok: true, userId: 7 });

    const res = await GET(makeRequest('tok'));

    expect(res.status).toBe(200);
    expect(mockAuthenticate.mock.calls[0][0]).toBe('Bearer tok');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:t', username: 'u', credential: 'c' },
      ],
      source: 'xirsys',
    });
  });

  it('awaria Xirsys: 200 z samymi STUN, bez szczegolow bledu', async () => {
    mockAuthenticate.mockResolvedValue({ ok: true, userId: 7 });
    mockGetIceServers.mockResolvedValue({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      source: 'stun',
    });

    const res = await GET(makeRequest('tok'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      source: 'stun',
    });
  });

  it('rate limit per uzytkownik: 61. zadanie w minucie -> 429, przed Xirsys', async () => {
    mockAuthenticate.mockResolvedValue({ ok: true, userId: 101 });

    for (let i = 0; i < 60; i++) {
      expect((await GET(makeRequest('tok'))).status).toBe(200);
    }
    mockGetIceServers.mockClear();

    // Zmiana IP nie pomaga - licznik jest per userId.
    const res = await GET(makeRequest('tok'));

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limit' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(mockGetIceServers).not.toHaveBeenCalled();

    // Inny uzytkownik z tego samego IP nie jest objety blokada.
    mockAuthenticate.mockResolvedValue({ ok: true, userId: 102 });
    expect((await GET(makeRequest('tok2', '203.0.113.77'))).status).toBe(200);
  });

  it('regresja: zadania bez tokenu / ze zlym tokenem nie zuzywaja limitu zalogowanych z tego IP', async () => {
    const ip = '203.0.113.88';
    mockAuthenticate.mockImplementation(async (header: string | null) =>
      header === 'Bearer good'
        ? { ok: true, userId: 201 }
        : { ok: false, status: 401, error: 'unauthorized' }
    );

    for (let i = 0; i < 70; i++) {
      expect((await GET(makeRequest(null, ip))).status).toBe(401);
      expect((await GET(makeRequest('bad', ip))).status).toBe(401);
    }

    const res = await GET(makeRequest('good', ip));

    expect(res.status).toBe(200);
    expect(mockGetIceServers).toHaveBeenCalledTimes(1);
  });

  it('brak userId w odpowiedzi backendu -> limit per IP (awaryjnie)', async () => {
    mockAuthenticate.mockResolvedValue({ ok: true, userId: null });
    const ip = '203.0.113.99';

    for (let i = 0; i < 60; i++) {
      expect((await GET(makeRequest('tok', ip))).status).toBe(200);
    }

    expect((await GET(makeRequest('tok', ip))).status).toBe(429);
    expect((await GET(makeRequest('tok'))).status).toBe(200);
  });
});
