/**
 * Tłumaczenie błędów startu rozmowy na komunikat w UI. Kody z kontraktu
 * `POST /api/v1/whiteboard/{id}/call`: 503 VOICE_NOT_CONFIGURED, 502 VOICE_PROVIDER_ERROR,
 * 504 VOICE_PROVIDER_TIMEOUT, 404, 429. Backend bez tego endpointu (404/405) i błąd sieci
 * kończą się zwykłym "spróbuj ponownie" - nigdy wyjątkiem.
 */
import { AppError } from '@/_new/lib/errors';
import type { CallNotice } from './call-context';

export const CALL_MESSAGES = {
  disabled: 'Rozmowy głosowe są chwilowo wyłączone.',
  failed: 'Nie udało się połączyć z rozmową. Spróbuj ponownie.',
  rateLimited: 'Zbyt wiele prób połączenia. Odczekaj chwilę i spróbuj ponownie.',
  interrupted: 'Rozmowa została przerwana. Dołącz ponownie.',
} as const;

/** Kody, dla których komunikat backendu jest techniczny - pokazujemy własny. */
const GENERIC_VOICE_CODES = new Set(['VOICE_PROVIDER_ERROR', 'VOICE_PROVIDER_TIMEOUT']);

export function noticeFromStartError(err: unknown): CallNotice {
  if (err instanceof AppError) {
    if (err.code === 'VOICE_NOT_CONFIGURED') {
      return { kind: 'disabled', message: CALL_MESSAGES.disabled };
    }
    if (err.status === 429) {
      return { kind: 'error', message: CALL_MESSAGES.rateLimited };
    }
    // Pozostałe kody VOICE_* (np. wyczerpany miesięczny limit rozmów) niosą komunikat
    // napisany dla użytkownika - pokazujemy go zamiast ogólnego.
    if (err.code.startsWith('VOICE_') && !GENERIC_VOICE_CODES.has(err.code) && err.message) {
      return { kind: 'error', message: err.message };
    }
  }
  return { kind: 'error', message: CALL_MESSAGES.failed };
}

/** Do logów: tylko kod i status - bez treści odpowiedzi (mogłaby zawierać token). */
export function describeError(err: unknown): { code?: string; status?: number; name?: string } {
  if (err instanceof AppError) return { code: err.code, status: err.status };
  return { name: (err as { name?: string } | null)?.name ?? 'unknown' };
}
