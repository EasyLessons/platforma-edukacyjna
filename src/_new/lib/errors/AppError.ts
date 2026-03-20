/**
 * AppError — unified error class dla całego frontendu.
 *
 * Zamiast łapać stringi lub AxiosError w komponentach,
 * zawsze rzucamy i łapiemy AppError z typowanymi polami.
 *
 * Przykład użycia w komponencie:
 *
 *   try {
 *     await registerUser(data);
 *   } catch (err) {
 *     if (err instanceof AppError) {
 *       if (err.code === 'CONFLICT') setError('Email już zajęty');
 *       if (err.isUnauthorized()) router.push('/login');
 *     }
 *   }
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;

    Object.setPrototypeOf(this, AppError.prototype);
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isConflict(): boolean {
    return this.status === 409;
  }

  isValidation(): boolean {
    return this.status === 404;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  isRetryable(): boolean {
    return this.isNetworkError() || this.isServerError();
  }
}

/** Kody błędów zsynchronizowane z backendem */
export const ErrorCode = {
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  APP_ERROR: 'APP_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
