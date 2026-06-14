import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';
import { loginUser, registerUser, getCurrentUser, logoutUser, checkUser } from './authApi';
import { AppError } from '@new/lib/errors/AppError';
import { mockUser } from '../../../../test/mocks/authFixtures';

// Mockujemy auth żeby interceptor 401 nie próbował prawdziwego refresha
vi.mock('@new/lib/auth', () => ({
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
  clearSession: vi.fn(),
  refreshAccessToken: vi.fn().mockRejectedValue(new Error('Refresh failed')),
  logoutAndRedirect: vi.fn(),
  removeAccessToken: vi.fn(),
  getStoredUser: vi.fn(() => null),
  setStoredUser: vi.fn(),
  removeStoredUser: vi.fn(),
}));

const mock = new MockAdapter(apiClient, { onNoMatch: 'throwException' });

beforeEach(() => mock.reset());
afterAll(() => mock.restore());

describe('loginUser', () => {
  it('zwraca LoginResponse przy sukcesie', async () => {
    mock.onPost('/api/v1/auth/login').reply(200, {
      success: true,
      data: { access_token: 'tok', token_type: 'bearer', user: mockUser },
    });

    const result = await loginUser({ login: 'test@test.com', password: 'Pass1word' });

    expect(result).toEqual({ access_token: 'tok', token_type: 'bearer', user: mockUser });
  });

  it('rzuca AppError.isUnauthorized() dla 401', async () => {
    mock.onPost('/api/v1/auth/login').reply(401, {
      success: false,
      error: 'Nieautoryzowany',
    });

    await expect(loginUser({ login: 'x', password: 'y' })).rejects.toSatisfy(
      (err: unknown) => err instanceof AppError && err.isUnauthorized()
    );
  });

  it('rzuca AppError.isConflict() dla 409', async () => {
    mock.onPost('/api/v1/auth/login').reply(409, {
      success: false,
      error: 'Konflikt',
    });

    await expect(loginUser({ login: 'x', password: 'y' })).rejects.toSatisfy(
      (err: unknown) => err instanceof AppError && err.isConflict()
    );
  });

  it('rzuca AppError.isNetworkError() dla błędu sieciowego', async () => {
    mock.onPost('/api/v1/auth/login').networkError();

    await expect(loginUser({ login: 'x', password: 'y' })).rejects.toSatisfy(
      (err: unknown) => err instanceof AppError && err.isNetworkError()
    );
  });
});

describe('registerUser', () => {
  it('zwraca RegisterResponse przy sukcesie', async () => {
    mock.onPost('/api/v1/auth/register').reply(200, {
      success: true,
      data: { user_id: 1, email: 'test@test.com', message: 'OK' },
    });

    const result = await registerUser({
      username: 'alice',
      email: 'test@test.com',
      password: 'Pass1word',
      password_confirm: 'Pass1word',
    });

    expect(result).toEqual({ user_id: 1, email: 'test@test.com', message: 'OK' });
  });

  it('rzuca AppError.isConflict() dla 409 (email zajęty)', async () => {
    mock.onPost('/api/v1/auth/register').reply(409, {
      success: false,
      error: 'Email zajęty',
    });

    await expect(
      registerUser({ username: 'a', email: 'x@x.com', password: 'P1pass', password_confirm: 'P1pass' })
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof AppError && err.isConflict()
    );
  });
});

describe('getCurrentUser', () => {
  it('zwraca obiekt User przy sukcesie', async () => {
    mock.onGet('/api/v1/auth/me').reply(200, {
      success: true,
      data: { user: mockUser },
    });

    const result = await getCurrentUser();
    expect(result).toEqual(mockUser);
  });

  it('rzuca AppError.isUnauthorized() dla 401', async () => {
    // Interceptor po nieudanym refreshie sprawdza pathname === '/login' zanim odrzuci błąd.
    // Mockujemy pathname żeby nie wisiał na never-resolving promise.
    window.location.pathname = '/login';

    mock.onGet('/api/v1/auth/me').reply(401, {
      success: false,
      error: 'Brak tokenu',
    });

    await expect(getCurrentUser()).rejects.toSatisfy(
      (err: unknown) => err instanceof AppError && err.isUnauthorized()
    );
  });
});

describe('logoutUser', () => {
  it('kończy się sukcesem dla 200', async () => {
    mock.onPost('/api/v1/auth/logout').reply(200, {
      success: true,
      data: null,
    });

    await expect(logoutUser()).resolves.not.toThrow();
  });
});

describe('checkUser', () => {
  it('zwraca dane użytkownika przy sukcesie', async () => {
    mock.onPost('/api/v1/auth/check-user').reply(200, {
      success: true,
      data: { exists: true, verified: false, user_id: 5 },
    });

    const result = await checkUser('test@test.com');
    expect(result).toEqual({ exists: true, verified: false, user_id: 5 });
  });
});