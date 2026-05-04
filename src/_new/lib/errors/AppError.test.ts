import { describe, it, expect } from 'vitest';
import { AppError } from './AppError';

describe('AppError', () => {
  it('ustawia message, code i status', () => {
    const err = new AppError('Not found', 'NOT_FOUND', 404);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.status).toBe(404);
  });

  it('ustawia name === AppError', () => {
    const err = new AppError('err', 'CODE', 400);
    expect(err.name).toBe('AppError');
  });

  it('instanceof AppError działa', () => {
    const err = new AppError('err', 'CODE', 400);
    expect(err instanceof AppError).toBe(true);
  });

  it('instanceof Error działa', () => {
    const err = new AppError('err', 'CODE', 400);
    expect(err instanceof Error).toBe(true);
  });
});

describe('AppError.isUnauthorized', () => {
  it('zwraca true dla 401', () => {
    expect(new AppError('', '', 401).isUnauthorized()).toBe(true);
  });

  it('zwraca false dla innych statusów', () => {
    expect(new AppError('', '', 403).isUnauthorized()).toBe(false);
  });
});

describe('AppError.isForbidden', () => {
  it('zwraca true dla 403', () => {
    expect(new AppError('', '', 403).isForbidden()).toBe(true);
  });

  it('zwraca false dla 401', () => {
    expect(new AppError('', '', 401).isForbidden()).toBe(false);
  });
});

describe('AppError.isNotFound', () => {
  it('zwraca true dla 404', () => {
    expect(new AppError('', '', 404).isNotFound()).toBe(true);
  });

  it('zwraca false dla 403', () => {
    expect(new AppError('', '', 403).isNotFound()).toBe(false);
  });
});

describe('AppError.isConflict', () => {
  it('zwraca true dla 409', () => {
    expect(new AppError('', '', 409).isConflict()).toBe(true);
  });

  it('zwraca false dla 404', () => {
    expect(new AppError('', '', 404).isConflict()).toBe(false);
  });
});

describe('AppError.isValidation', () => {
  // TODO: likely copy-paste error — isValidation() zwraca status === 404, powinno być 422
  it('zwraca true dla 404 (obecne zachowanie)', () => {
    expect(new AppError('', '', 404).isValidation()).toBe(true);
  });

  it('zwraca false dla 422', () => {
    expect(new AppError('', '', 422).isValidation()).toBe(false);
  });
});

describe('AppError.isServerError', () => {
  it('zwraca true dla 500', () => {
    expect(new AppError('', '', 500).isServerError()).toBe(true);
  });

  it('zwraca true dla 503', () => {
    expect(new AppError('', '', 503).isServerError()).toBe(true);
  });

  it('zwraca false dla 499', () => {
    expect(new AppError('', '', 499).isServerError()).toBe(false);
  });
});

describe('AppError.isNetworkError', () => {
  it('zwraca true gdy code === NETWORK_ERROR', () => {
    expect(new AppError('', 'NETWORK_ERROR', 0).isNetworkError()).toBe(true);
  });

  it('zwraca false dla innego code nawet ze statusem 0', () => {
    expect(new AppError('', 'UNKNOWN', 0).isNetworkError()).toBe(false);
  });
});

describe('AppError.isRetryable', () => {
  it('zwraca true dla błędu sieciowego', () => {
    expect(new AppError('', 'NETWORK_ERROR', 0).isRetryable()).toBe(true);
  });

  it('zwraca true dla błędu serwera', () => {
    expect(new AppError('', 'APP_ERROR', 500).isRetryable()).toBe(true);
  });

  it('zwraca false dla 4xx', () => {
    expect(new AppError('', 'AUTH_ERROR', 401).isRetryable()).toBe(false);
  });
});