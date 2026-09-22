/**
 * Regresja: { success: false } przy HTTP 2xx ma byc AppError, nie goly { response }.
 * Scenariusz wykryty przez testy interceptora (PR #69, tam oznaczony it.fails).
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { apiClient } from './client';
import { apiMock, resetApiMock, restoreApiMock } from '@/test/mocks/apiClientMock';
import { AppError } from '../errors';

beforeEach(() => resetApiMock());
afterAll(() => restoreApiMock());

describe('apiClient - { success: false } przy HTTP 200', () => {
  it('odrzuca AppError z komunikatem i kodem z ciala', async () => {
    apiMock
      .onGet('/api/v1/me')
      .reply(200, { success: false, error: 'Nie ma', code: 'NOT_FOUND', timestamp: 'x' });

    const err = await apiClient.get('/api/v1/me').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).message).toBe('Nie ma');
    expect((err as AppError).code).toBe('NOT_FOUND');
    expect((err as AppError).status).toBe(200);
  });

  it('nie uruchamia refreshu tokenu (status 2xx to nie 401)', async () => {
    apiMock.onGet('/api/v1/me').reply(200, { success: false, error: 'Nie' });

    await expect(apiClient.get('/api/v1/me')).rejects.toBeInstanceOf(AppError);
    expect(apiMock.history.get).toHaveLength(1);
  });
});
