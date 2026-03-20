/**
 * errorHandler — tłumaczy błędy Axios i backendu na AppError.
 *
 * Jedno miejsce w projekcie które rozumie format błędów backendu.
 * Axios interceptor woła mapAxiosError() — reszta kodu widzi tylko AppError.
 */
import axios, { AxiosError } from 'axios';
import { AppError, ErrorCode } from './AppError';

/**
 * Format błędu z backendu (ApiResponse z success: false)
 *   { success: false, error: "Email zajęty", timestamp: "..." }
 */
interface BackendErrorBody {
  success: false;
  error?: string;
  code?: string;
  detail?: string; // fallback dla starych endpointów (main.py)
}

/**
 * Zamienia AxiosError na AppError.
 * Wywoływane w response interceptorze client.ts.
 */
export function mapAxiosError(err: unknown): AppError {
  // Błąd sieciowy (brak połączenia, timeout, CORS)
  if (!axios.isAxiosError(err)) {
    return new AppError('Nieoczekiwany błąd', ErrorCode.UNKNOWN, 0);
  }

  const axiosErr = err as AxiosError<BackendErrorBody>;

  // Brak odpowiedzi (sieć, timeout)
  if (!axiosErr.response) {
    return new AppError('Brak połączenia z serwerem', ErrorCode.NETWORK_ERROR, 0);
  }

  const { status, data } = axiosErr.response;

  // Wyciągnij komunikat
  const message = data?.error || data?.detail || httpStatusMessage(status);

  // Wyciągnij kod błędu
  const code = data?.code || resolveCode(status);

  return new AppError(message, code, status);
}

function resolveCode(status: number): string {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION_ERROR;
    case 401:
      return ErrorCode.AUTH_ERROR;
    case 403:
      return ErrorCode.AUTH_ERROR;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    default:
      return ErrorCode.APP_ERROR;
  }
}

function httpStatusMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'Nieprawidłowe dane',
    401: 'Wymagane logowanie',
    403: 'Brak dostępu',
    404: 'Nie znaleziono',
    409: 'Konflikt danych',
    422: 'Błąd walidacji',
    429: 'Zbyt wiele żądań',
    500: 'Błąd serwera',
    503: 'Serwis niedostępny',
  };
  return messages[status] ?? `Błąd HTTP ${status}`;
}
