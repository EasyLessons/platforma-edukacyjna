/**
 * useErrorHandler — globalny handler błędów AppError w komponentach.
 *
 * Zamiast pisać w każdym komponencie:
 *   catch (err) {
 *     if (err instanceof AppError && err.isUnauthorized()) router.push('/login');
 *     if (err instanceof AppError) setError(err.message);
 *   }
 *
 * Piszesz:
 *   const handleError = useErrorHandler();
 *   catch (err) { handleError(err); }
 *
 * Lub z opcjami:
 *   const handleError = useErrorHandler({ onUnauthorized: () => router.push('/login') });
 *
 * Zwraca też pomocnicze funkcje do obsługi błędów w konkretnych kontekstach.
 */
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppError } from '@/_new/lib/errors';

interface ErrorHandlerOptions {
  /** Nadpisuje domyślny redirect na /login przy 401 */
  onUnauthorized?: () => void;
  /** Wywołwane przy 403 - np. konto niezweryfikowane */
  onForbidden?: (err: AppError) => void | Promise<void>;
  /** Wywołane dla każdego błędu — np. toast/snackbar */
  onError?: (message: string) => void;
  /** Wywołane przy błędach sieciowych */
  onNetworkError?: () => void;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const router = useRouter();

  const handleError = useCallback(
    async (err: unknown): Promise<string> => {
      // Nieznany błąd (nie AppError)
      if (!(err instanceof AppError)) {
        const message = err instanceof Error ? err.message : 'Nieoczekiwany błąd';
        options.onError?.(message);
        return message;
      }

      // 401 - wyloguj lub przekieruj
      if (err.isUnauthorized()) {
        if (options.onUnauthorized) {
          options.onUnauthorized();
        } else {
          router.push('/login');
        }
        return err.message;
      }

      // 403 - brak dostępu
      if (err.isForbidden()) {
        if (options.onForbidden) {
          await options.onForbidden(err);
        } else {
          options.onError?.(err.message);
        }
        return err.message;
      }

      // Błąd sieciowy
      if (err.isNetworkError()) {
        const message = 'Brak połączenia z serwerem. Sprawdź połączenie i spróbuj ponownie.';
        options.onNetworkError?.();
        options.onError?.(message);
        return message;
      }

      // Pozostałe błędy - zwróć wiadomość i wywołaj callback
      options.onError?.(err.message);
      return err.message;
    },
    [router, options]
  );

  /**
   * Czy błąd to konkretny kod — przydatne do warunkowego UI.
   *
   * Użycie:
   *   if (isError(err, 'CONFLICT')) setFieldError('email', err.message);
   */
  const isError = useCallback((err: unknown, code: string): err is AppError => {
    return err instanceof AppError && err.code === code;
  }, []);

  return { handleError, isError };
}
