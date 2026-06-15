import { describe, it, expect } from 'vitest';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { mapAxiosError } from './errorHandler';
import { AppError, ErrorCode } from './AppError';

function makeAxiosError(
  status: number,
  data?: Record<string, unknown>
): AxiosError {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    data: data ?? {},
    headers: {},
    config: error.config!,
    statusText: String(status),
  } as AxiosResponse;
  return error;
}

// ─── mapAxiosError ─────────────────────────────────────────────────────────

describe('mapAxiosError', () => {
  it('nie-AxiosError → AppError z kodem UNKNOWN i statusem 0', () => {
    const result = mapAxiosError(new Error('coś poszło nie tak'));
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.status).toBe(0);
  });

  it('AxiosError bez response (brak sieci) → NETWORK_ERROR, status 0', () => {
    const error = new AxiosError('Network Error');
    // brak error.response
    const result = mapAxiosError(error);
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(result.status).toBe(0);
    expect(result.isNetworkError()).toBe(true);
  });

  it('400 z data.error → message z backendu + kod VALIDATION_ERROR', () => {
    const result = mapAxiosError(makeAxiosError(400, { error: 'Nieprawidłowy email' }));
    expect(result.message).toBe('Nieprawidłowy email');
    expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(result.status).toBe(400);
  });

  it('400 bez data.error → fallback httpStatusMessage', () => {
    const result = mapAxiosError(makeAxiosError(400, {}));
    expect(result.message).toBe('Nieprawidłowe dane');
    expect(result.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('401 → AUTH_ERROR + fallback message "Wymagane logowanie"', () => {
    const result = mapAxiosError(makeAxiosError(401, {}));
    expect(result.code).toBe(ErrorCode.AUTH_ERROR);
    expect(result.message).toBe('Wymagane logowanie');
    expect(result.isUnauthorized()).toBe(true);
  });

  it('403 → AUTH_ERROR', () => {
    const result = mapAxiosError(makeAxiosError(403, {}));
    expect(result.code).toBe(ErrorCode.AUTH_ERROR);
    expect(result.isForbidden()).toBe(true);
  });

  it('404 z data.detail (stary format) → message z detail', () => {
    const result = mapAxiosError(makeAxiosError(404, { detail: 'Użytkownik nie znaleziony' }));
    expect(result.message).toBe('Użytkownik nie znaleziony');
    expect(result.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('409 z data.code → użyj kodu z backendu zamiast resolve', () => {
    const result = mapAxiosError(makeAxiosError(409, { error: 'Konflikt', code: 'EMAIL_TAKEN' }));
    expect(result.code).toBe('EMAIL_TAKEN');
    expect(result.status).toBe(409);
  });

  it('500 → kod APP_ERROR', () => {
    const result = mapAxiosError(makeAxiosError(500, {}));
    expect(result.code).toBe(ErrorCode.APP_ERROR);
    expect(result.isServerError()).toBe(true);
  });

  it('503 → kod APP_ERROR + isServerError()', () => {
    const result = mapAxiosError(makeAxiosError(503, {}));
    expect(result.code).toBe(ErrorCode.APP_ERROR);
    expect(result.isServerError()).toBe(true);
  });

  it('418 (nieznany status) → "Błąd HTTP 418" jako message', () => {
    const result = mapAxiosError(makeAxiosError(418, {}));
    expect(result.message).toBe('Błąd HTTP 418');
    expect(result.code).toBe(ErrorCode.APP_ERROR);
  });

  it('data.error ma wyższy priorytet niż data.detail', () => {
    const result = mapAxiosError(makeAxiosError(400, {
      error: 'Główny komunikat',
      detail: 'Zapasowy komunikat',
    }));
    expect(result.message).toBe('Główny komunikat');
  });
});
