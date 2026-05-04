import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeToken, isTokenExpired, getTokenUserId, refreshAccessToken } from './tokenService';

vi.mock('./tokenStore', () => ({
  getAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
  clearSession: vi.fn(),
}));

import { setAccessToken } from './tokenStore';

// Helper: tworzy prawdziwy base64 JWT z podanym payload
function makeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${header}.${body}.fakesig`;
}

const NOW = Math.floor(Date.now() / 1000);

describe('decodeToken', () => {
  it('dekoduje poprawny JWT i zwraca payload', () => {
    const token = makeJwt({ sub: '1', exp: NOW + 3600, iat: NOW });
    const result = decodeToken(token);
    expect(result).toMatchObject({ sub: '1', exp: NOW + 3600 });
  });

  it('zwraca null dla pustego stringa', () => {
    expect(decodeToken('')).toBeNull();
  });

  it('zwraca null gdy brak segmentu payload', () => {
    expect(decodeToken('onlyone')).toBeNull();
  });

  it('zwraca null dla niepoprawnego base64 w payload', () => {
    expect(decodeToken('header.!!!.sig')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('zwraca false gdy token wygasa daleko w przyszłości', () => {
    const token = makeJwt({ sub: '1', exp: NOW + 3600, iat: NOW });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('zwraca true gdy token wygasa za mniej niż 30 sekund (buffer)', () => {
    const token = makeJwt({ sub: '1', exp: NOW + 10, iat: NOW });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('zwraca true gdy token już wygasł', () => {
    const token = makeJwt({ sub: '1', exp: NOW - 100, iat: NOW - 200 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('zwraca true dla niepoprawnego tokenu', () => {
    expect(isTokenExpired('invalid')).toBe(true);
  });
});

describe('getTokenUserId', () => {
  it('zwraca id użytkownika jako liczbę', () => {
    const token = makeJwt({ sub: '42', exp: NOW + 3600, iat: NOW });
    expect(getTokenUserId(token)).toBe(42);
  });

  it('zwraca NaN gdy sub nie jest numeryczny', () => {
    const token = makeJwt({ sub: 'abc', exp: NOW + 3600, iat: NOW });
    expect(getTokenUserId(token)).toBeNaN();
  });

  it('zwraca null dla niepoprawnego tokenu', () => {
    expect(getTokenUserId('invalid')).toBeNull();
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('zwraca nowy token i wywołuje setAccessToken', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { access_token: 'new-token' } }),
    } as Response);

    const result = await refreshAccessToken();

    expect(result).toBe('new-token');
    expect(setAccessToken).toHaveBeenCalledWith('new-token');
  });

  it('rzuca błąd gdy response.ok === false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    await expect(refreshAccessToken()).rejects.toThrow('Refresh failed');
  });

  it('rzuca błąd gdy brak access_token w odpowiedzi', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await expect(refreshAccessToken()).rejects.toThrow('No token on refresh response');
  });

  it('przy dwóch równoczesnych wywołaniach fetch jest wołany tylko raz', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { access_token: 'token' } }),
    } as Response);

    await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});