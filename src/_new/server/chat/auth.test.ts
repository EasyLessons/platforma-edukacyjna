// @vitest-environment node
import { vi, describe, it, expect, afterEach } from 'vitest';

import { authenticateChatRequest, getBackendUrl } from './auth';

const jsonResponse = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('authenticateChatRequest — nagłówek', () => {
  it.each([
    ['brak nagłówka', null],
    ['pusty nagłówek', ''],
    ['inny schemat niż Bearer', 'Basic dXNlcjpwYXNz'],
    ['Bearer bez tokenu', 'Bearer '],
  ])('401 i brak żądania do backendu: %s', async (_opis, header) => {
    const fetchImpl = vi.fn();

    const result = await authenticateChatRequest(header, fetchImpl);

    expect(result).toEqual({ ok: false, status: 401, error: 'unauthorized' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('authenticateChatRequest — odpowiedź backendu', () => {
  it('wysyła token do GET /api/v1/auth/me', async () => {
    vi.stubEnv('BACKEND_INTERNAL_URL', 'http://backend:8000');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: { user: { id: 7 } } }));

    await authenticateChatRequest('Bearer tok-123', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://backend:8000/api/v1/auth/me');
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-123' });
  });

  it('200 — wpuszcza i zwraca id usera', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: { user: { id: 42 } } }));

    expect(await authenticateChatRequest('Bearer ok', fetchImpl)).toEqual({ ok: true, userId: 42 });
  });

  it('200 z nieoczekiwanym body — wpuszcza bez id (backend potwierdził token)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nie-json', { status: 200 }));

    expect(await authenticateChatRequest('Bearer ok', fetchImpl)).toEqual({
      ok: true,
      userId: null,
    });
  });

  it.each([
    [401, 'zły lub wygasły token'],
    [403, 'konto niezweryfikowane'],
    [404, 'user usunięty'],
  ])('%i (%s) — odmawia jako unauthorized', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(status));

    expect(await authenticateChatRequest('Bearer x', fetchImpl)).toEqual({
      ok: false,
      status: 401,
      error: 'unauthorized',
    });
  });

  it('500 z backendu — odmawia (fail closed), nie wpuszcza', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500));

    expect(await authenticateChatRequest('Bearer x', fetchImpl)).toEqual({
      ok: false,
      status: 503,
      error: 'auth_unavailable',
    });
  });

  it('backend nieosiągalny / timeout — odmawia (fail closed), nie wpuszcza', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    expect(await authenticateChatRequest('Bearer x', fetchImpl)).toEqual({
      ok: false,
      status: 503,
      error: 'auth_unavailable',
    });
  });
});

describe('getBackendUrl', () => {
  it('preferuje serwerowe BACKEND_INTERNAL_URL', () => {
    vi.stubEnv('BACKEND_INTERNAL_URL', 'http://backend:8000');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    expect(getBackendUrl()).toBe('http://backend:8000');
  });

  it('bez BACKEND_INTERNAL_URL używa NEXT_PUBLIC_API_URL (przypadek Vercela)', () => {
    vi.stubEnv('BACKEND_INTERNAL_URL', '');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    expect(getBackendUrl()).toBe('https://api.example.com');
  });
});
