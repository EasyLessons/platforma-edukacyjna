/**
 * X-Request-ID w apiClient (etap O3): każde żądanie ma id, id z odpowiedzi trafia do AppError.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { apiClient } from './client';
import { apiMock, resetApiMock, restoreApiMock } from '@/test/mocks/apiClientMock';
import { AppError } from '../errors';

beforeEach(() => resetApiMock());
afterAll(() => restoreApiMock());

describe('apiClient — X-Request-ID', () => {
  it('dodaje nagłówek X-Request-ID do każdego żądania', async () => {
    apiMock.onGet('/api/v1/health').reply(200, { success: true, data: { status: 'ok' } });

    await apiClient.get('/api/v1/health');
    await apiClient.get('/api/v1/health');

    const ids = apiMock.history.get.map((req) => req.headers?.['X-Request-ID']);
    expect(ids[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(ids[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('nie nadpisuje id podanego jawnie w config (ponowienie po refreshu)', async () => {
    apiMock.onGet('/api/v1/health').reply(200, { success: true, data: {} });

    await apiClient.get('/api/v1/health', { headers: { 'X-Request-ID': 'moje-id-1' } });

    expect(apiMock.history.get[0].headers?.['X-Request-ID']).toBe('moje-id-1');
  });

  it('błąd HTTP: AppError.requestId pochodzi z nagłówka odpowiedzi backendu', async () => {
    apiMock
      .onGet('/api/v1/boards/9')
      .reply(
        404,
        { success: false, error: 'Nie ma', request_id: 'z-ciala' },
        { 'x-request-id': 'z-naglowka' }
      );

    const err = await apiClient.get('/api/v1/boards/9').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(404);
    expect((err as AppError).requestId).toBe('z-naglowka');
  });

  it('błąd HTTP bez nagłówka: requestId z ciała ApiResponse', async () => {
    apiMock
      .onGet('/api/v1/boards/9')
      .reply(404, { success: false, error: 'Nie ma', request_id: 'z-ciala' });

    const err = await apiClient.get('/api/v1/boards/9').catch((e) => e);

    expect((err as AppError).requestId).toBe('z-ciala');
  });

  it('błąd sieci: requestId to id wysłane przez klienta', async () => {
    apiMock.onGet('/api/v1/boards/9').networkError();

    const err = await apiClient
      .get('/api/v1/boards/9', { headers: { 'X-Request-ID': 'wyslane-1' } })
      .catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).isNetworkError()).toBe(true);
    expect((err as AppError).requestId).toBe('wyslane-1');
  });
});
