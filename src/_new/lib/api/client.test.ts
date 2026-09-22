/**
 * Testy interceptorów apiClient (client.ts):
 *  - rozpakowanie { success, data } → data,
 *  - 401 / 403 "Not authenticated" → refresh → ponowienie z nowym tokenem,
 *  - współdzielony refresh przy równoległych 401,
 *  - nieudany refresh: ścieżka publiczna vs chroniona,
 *  - wyjątki: endpointy auth, drugi 401 po ponowieniu, błąd sieci.
 *
 * tokenService jest zamockowany (refresh idzie przez fetch, tu nie chcemy sieci).
 * tokenStore jest PRAWDZIWY: to zwykły stan modułu, a dzięki temu sprawdzamy
 * realny efekt (getAccessToken() po refreshu / po clearSession) zamiast liczby
 * wywołań. logoutAndRedirect jest mockiem, więc wyczyszczenie tokenu w teście
 * nieudanego refreshu pochodzi wyłącznie z clearSession() w client.ts.
 *
 * X-Request-ID jest testowane osobno w client.request-id.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './client';
import { apiMock, resetApiMock } from '@/test/mocks/apiClientMock';
import { getAccessToken, setAccessToken, removeAccessToken } from '../auth/tokenStore';
import { refreshAccessToken, logoutAndRedirect, isPublicPath } from '../auth/tokenService';
import { AppError, ErrorCode } from '../errors';

vi.mock('../auth/tokenService', () => ({
  refreshAccessToken: vi.fn(),
  logoutAndRedirect: vi.fn(),
  isPublicPath: vi.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Deferredy utworzone w teście - rozstrzygane w afterEach, żeby refreshPromise
 *  w client.ts nie wisiał między testami. */
const pendingDeferreds: Deferred<string>[] = [];

function deferredRefresh(): Deferred<string> {
  const d = deferred<string>();
  pendingDeferreds.push(d);
  vi.mocked(refreshAccessToken).mockReturnValue(d.promise);
  return d;
}

/** Rozstrzyga promise po `ms`, bez fake timers. */
function settlesWithin(promise: Promise<unknown>, ms: number) {
  return Promise.race([
    promise.then(
      () => 'resolved' as const,
      () => 'rejected' as const
    ),
    new Promise<'pending'>((res) => setTimeout(() => res('pending'), ms)),
  ]);
}

/**
 * Nagłówki Authorization w kolejności przyjścia żądań do adaptera.
 * UWAGA: nie czytamy ich z apiMock.history - adapter trzyma tam referencję do
 * tego samego obiektu config, który interceptor potem mutuje przy ponowieniu,
 * więc history[0] "widziałby" już nowy token. Rejestrujemy w momencie żądania.
 */
const seenAuth: (string | undefined)[] = [];

/** Rejestruje Authorization i odpowiada 200 tylko z NOWYM tokenem, inaczej `unauthorized`. */
function replyOkOnlyWithNewToken(
  url: string,
  data: unknown,
  unauthorized: [number, unknown?] = [401, { detail: 'Token expired' }]
) {
  apiMock.onGet(url).reply((config) => {
    const auth = config.headers?.['Authorization'] as string | undefined;
    seenAuth.push(auth);
    return auth === `Bearer ${NEW_TOKEN}` ? [200, { success: true, data }] : unauthorized;
  });
}

/** Rejestruje Authorization i zawsze odpowiada podanym statusem. */
function replyAlways(url: string, status: number, body?: unknown) {
  apiMock.onGet(url).reply((config) => {
    seenAuth.push(config.headers?.['Authorization'] as string | undefined);
    return [status, body];
  });
}

const OLD_TOKEN = 'old-token';
const NEW_TOKEN = 'new-token';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  setAccessToken(OLD_TOKEN);
  window.location.pathname = '/dashboard';
  vi.mocked(isPublicPath).mockReturnValue(false);
  vi.mocked(refreshAccessToken).mockResolvedValue(NEW_TOKEN);
});

afterEach(async () => {
  // Domknij ewentualny wiszący refresh, żeby refreshPromise w client.ts wrócił do null
  for (const d of pendingDeferreds.splice(0)) d.resolve(NEW_TOKEN);
  await Promise.resolve();
  resetApiMock();
  seenAuth.length = 0;
  removeAccessToken();
  window.location.pathname = '/';
});

// ─── Rozpakowanie odpowiedzi ────────────────────────────────────────────────

describe('apiClient - interceptor sukcesu', () => {
  it('rozpakowuje { success: true, data } do data', async () => {
    apiMock.onGet('/api/v1/me').reply(200, { success: true, data: { id: 7 }, timestamp: 'x' });

    const res = await apiClient.get('/api/v1/me');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ id: 7 });
  });

  it('odpowiedź bez wrappera (204 No Content) wraca jak jest', async () => {
    apiMock.onDelete('/api/v1/boards/1').reply(204);

    const res = await apiClient.delete('/api/v1/boards/1');

    expect(res.status).toBe(204);
    expect(res.data).toBeUndefined();
  });

  it('odpowiedź JSON bez pola success wraca bez zmian', async () => {
    apiMock.onGet('/api/v1/raw').reply(200, { items: [1, 2] });

    const res = await apiClient.get('/api/v1/raw');

    expect(res.data).toEqual({ items: [1, 2] });
  });

  it('{ success: false } przy HTTP 200 jest odrzucane', async () => {
    apiMock.onGet('/api/v1/me').reply(200, { success: false, error: 'Nie', timestamp: 'x' });

    await expect(apiClient.get('/api/v1/me')).rejects.toBeDefined();
  });

  // Naprawione w #76: odrzucenie z onFulfilled trafia teraz do mapAxiosError.
  it('{ success: false } przy HTTP 200 → AppError', async () => {
    apiMock.onGet('/api/v1/me').reply(200, { success: false, error: 'Nie', timestamp: 'x' });

    await expect(apiClient.get('/api/v1/me')).rejects.toBeInstanceOf(AppError);
  });
});

// ─── 401 → refresh → ponowienie ─────────────────────────────────────────────

describe('apiClient - 401 → refresh → ponowienie', () => {
  it('401 → refresh raz → setAccessToken → ponowienie z nowym Bearer i zwrot danych', async () => {
    replyOkOnlyWithNewToken('/api/v1/me', { id: 1 });

    const res = await apiClient.get('/api/v1/me');

    expect(res.data).toEqual({ id: 1 });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe(NEW_TOKEN);
    expect(apiMock.history).toHaveLength(2);
    expect(seenAuth).toEqual([`Bearer ${OLD_TOKEN}`, `Bearer ${NEW_TOKEN}`]);
    expect(logoutAndRedirect).not.toHaveBeenCalled();
  });

  it('403 z detail "Not authenticated" traktowane jak 401 (refresh + ponowienie)', async () => {
    replyOkOnlyWithNewToken('/api/v1/me', { id: 1 }, [403, { detail: 'Not authenticated' }]);

    const res = await apiClient.get('/api/v1/me');

    expect(res.data).toEqual({ id: 1 });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(seenAuth).toEqual([`Bearer ${OLD_TOKEN}`, `Bearer ${NEW_TOKEN}`]);
  });

  it('403 z innym detail NIE uruchamia refreshu → AppError isForbidden', async () => {
    apiMock.onGet('/api/v1/boards/9').reply(403, { detail: 'Brak dostępu do tablicy' });

    const err = await apiClient.get('/api/v1/boards/9').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).isForbidden()).toBe(true);
    expect((err as AppError).message).toBe('Brak dostępu do tablicy');
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(apiMock.history).toHaveLength(1);
  });

  it('równoległe 401 (3 żądania) → refresh DOKŁADNIE raz, wszystkie ponowione', async () => {
    const refresh = deferredRefresh();
    const urls = ['/api/v1/me', '/api/v1/boards/1/join', '/api/v1/boards/1/elements'];
    for (const url of urls) replyOkOnlyWithNewToken(url, { url });

    const all = Promise.all(urls.map((u) => apiClient.get(u)));

    // Czekamy, aż wszystkie trzy 401 dotrą do interceptora, ZANIM refresh się rozwiąże
    await vi.waitFor(() => expect(apiMock.history).toHaveLength(3));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);

    refresh.resolve(NEW_TOKEN);
    const results = await all;

    expect(results.map((r) => r.data)).toEqual(urls.map((url) => ({ url })));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(seenAuth).toEqual([
      ...Array(3).fill(`Bearer ${OLD_TOKEN}`),
      ...Array(3).fill(`Bearer ${NEW_TOKEN}`),
    ]);
  });

  it('po zakończonym refreshu kolejne 401 uruchamia NOWY refresh (refreshPromise wraca do null)', async () => {
    replyOkOnlyWithNewToken('/api/v1/me', 1);

    await apiClient.get('/api/v1/me');
    setAccessToken(OLD_TOKEN); // symulacja: token znowu nieważny
    await apiClient.get('/api/v1/me');

    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
  });
});

// ─── Nieudany refresh ───────────────────────────────────────────────────────

describe('apiClient - nieudany refresh', () => {
  it('ścieżka chroniona → clearSession + logoutAndRedirect, promise NIE rozstrzyga się', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Refresh failed'));
    vi.mocked(isPublicPath).mockReturnValue(false);
    window.location.pathname = '/dashboard';
    apiMock.onGet('/api/v1/me').reply(401, { detail: 'Token expired' });

    const outcome = await settlesWithin(apiClient.get('/api/v1/me'), 50);

    expect(outcome).toBe('pending');
    expect(getAccessToken()).toBeNull(); // clearSession() z client.ts (logoutAndRedirect to mock)
    expect(logoutAndRedirect).toHaveBeenCalledTimes(1);
    expect(isPublicPath).toHaveBeenCalledWith('/dashboard');
    expect(apiMock.history).toHaveLength(1); // brak ponowienia
  });

  it('ścieżka publiczna → odrzucenie AppError 401, logoutAndRedirect wywołany', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Refresh failed'));
    vi.mocked(isPublicPath).mockReturnValue(true);
    window.location.pathname = '/demo';
    apiMock.onGet('/api/v1/auth/me').reply(401, { detail: 'Not authenticated' });

    const err = await apiClient.get('/api/v1/auth/me').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(401);
    expect((err as AppError).isUnauthorized()).toBe(true);
    expect((err as AppError).code).toBe(ErrorCode.AUTH_ERROR);
    expect(getAccessToken()).toBeNull();
    expect(logoutAndRedirect).toHaveBeenCalledTimes(1);
    expect(isPublicPath).toHaveBeenCalledWith('/demo');
  });

  it('nieudany refresh przy równoległych 401 odrzuca (lub zawiesza) wszystkie bez drugiego refreshu', async () => {
    const refresh = deferredRefresh();
    vi.mocked(isPublicPath).mockReturnValue(true);
    apiMock.onGet('/api/v1/a').reply(401);
    apiMock.onGet('/api/v1/b').reply(401);

    const results = Promise.allSettled([apiClient.get('/api/v1/a'), apiClient.get('/api/v1/b')]);
    await vi.waitFor(() => expect(apiMock.history).toHaveLength(2));

    refresh.reject(new Error('Refresh failed'));
    const settled = await results;

    expect(settled.map((s) => s.status)).toEqual(['rejected', 'rejected']);
    for (const s of settled) {
      expect((s as PromiseRejectedResult).reason).toBeInstanceOf(AppError);
    }
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(logoutAndRedirect).toHaveBeenCalledTimes(2);
  });
});

// ─── Wyjątki od refreshu ────────────────────────────────────────────────────

describe('apiClient - przypadki bez refreshu', () => {
  it.each(['/api/v1/auth/login', '/api/v1/auth/register'])(
    '401 na %s → bez refreshu, od razu AppError',
    async (url) => {
      apiMock.onPost(url).reply(401, { error: 'Nieprawidłowe dane logowania' });

      const err = await apiClient.post(url, { email: 'a@b.c' }).catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(401);
      expect((err as AppError).message).toBe('Nieprawidłowe dane logowania');
      expect(refreshAccessToken).not.toHaveBeenCalled();
      expect(logoutAndRedirect).not.toHaveBeenCalled();
      expect(apiMock.history).toHaveLength(1);
    }
  );

  it('ponowione żądanie (_retried) dostaje 401 drugi raz → brak drugiego refreshu, AppError', async () => {
    replyAlways('/api/v1/me', 401, { detail: 'Token expired' });

    const err = await apiClient.get('/api/v1/me').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(401);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    // oryginał + dokładnie jedno ponowienie (z nowym tokenem)
    expect(seenAuth).toEqual([`Bearer ${OLD_TOKEN}`, `Bearer ${NEW_TOKEN}`]);
    expect(logoutAndRedirect).not.toHaveBeenCalled();
  });

  it('błąd sieci → AppError z isNetworkError()', async () => {
    apiMock.onGet('/api/v1/me').networkError();

    const err = await apiClient.get('/api/v1/me').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).isNetworkError()).toBe(true);
    expect((err as AppError).status).toBe(0);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('timeout → AppError z isNetworkError()', async () => {
    apiMock.onGet('/api/v1/me').timeout();

    const err = await apiClient.get('/api/v1/me').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).isNetworkError()).toBe(true);
  });

  it('500 → AppError isServerError, bez refreshu', async () => {
    apiMock.onGet('/api/v1/me').reply(500, { error: 'Błąd serwera' });

    const err = await apiClient.get('/api/v1/me').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).isServerError()).toBe(true);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});

// ─── Request interceptor ────────────────────────────────────────────────────

describe('apiClient - request interceptor', () => {
  it('dodaje Authorization: Bearer <token> gdy token jest w tokenStore', async () => {
    replyAlways('/api/v1/me', 200, { success: true, data: null });

    await apiClient.get('/api/v1/me');

    expect(seenAuth).toEqual([`Bearer ${OLD_TOKEN}`]);
  });

  it('nie dodaje Authorization gdy brak tokenu', async () => {
    removeAccessToken();
    replyAlways('/api/v1/public', 200, { success: true, data: null });

    await apiClient.get('/api/v1/public');

    expect(seenAuth).toEqual([undefined]);
  });
});
