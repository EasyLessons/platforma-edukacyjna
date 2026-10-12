/**
 * Tłumaczenie błędów rozmowy na komunikat w UI.
 *
 * Start rozmowy: `POST /api/v1/whiteboard/{id}/call` - rozróżniamy po polu `code` odpowiedzi,
 * nie po statusie HTTP (ten sam status niesie różne przyczyny: 409, 429, 503). Treści błędu
 * z backendu NIE pokazujemy - każdy znany kod ma własny komunikat, a nieznany kod, 404/405
 * i błąd sieci kończą się ogólnym "spróbuj ponownie". Nigdy wyjątkiem.
 *
 * Trwająca rozmowa: zdarzenie `error` z Daily (`noticeFromDailyError`) - m.in. wyrzucenie
 * uczestników przy wygaśnięciu pokoju.
 *
 * Ponowienie jest ZAWSZE ręczne (przycisk w komunikacie). Żadnego automatycznego odpytywania
 * endpointu: backend ma limit 10 żądań/min na użytkownika i 30/h na IP.
 */
import { AppError } from '@/_new/lib/errors';
import type { CallNotice } from './call-context';

export const CALL_MESSAGES = {
  disabled: 'Rozmowa chwilowo niedostępna.',
  unavailable: 'Rozmowa chwilowo niedostępna - spróbuj ponownie za chwilę.',
  notStarted: 'Rozmowa jeszcze się nie zaczęła - poczekaj, aż nauczyciel ją rozpocznie.',
  ending: 'Rozmowa właśnie się kończy - poproś nauczyciela o rozpoczęcie nowej.',
  createNotAllowed: 'To konto nie może jeszcze rozpoczynać rozmów.',
  emailNotVerified: 'Potwierdź adres e-mail, aby korzystać z rozmów.',
  rateLimited: 'Zbyt wiele prób - spróbuj ponownie za chwilę.',
  busy: 'Rozmowa jest właśnie uruchamiana - spróbuj ponownie za chwilę.',
  userLimit: 'Dzienny limit rozmów dla tego konta został wyczerpany.',
  monthlyLimit: 'Limit rozmów w tym miesiącu wyczerpany.',
  failed: 'Nie udało się połączyć z rozmową. Spróbuj ponownie.',
  interrupted: 'Rozmowa została przerwana. Dołącz ponownie.',
  roomExpired: 'Rozmowa została zakończona (limit czasu pokoju). Nauczyciel może rozpocząć nową.',
  ended: 'Rozmowa została zakończona. Nauczyciel może rozpocząć nową.',
  entryExpired: 'Czas na dołączenie do rozmowy minął. Spróbuj ponownie.',
  full: 'W rozmowie jest już komplet uczestników.',
} as const;

const disabled: CallNotice = { kind: 'disabled', message: CALL_MESSAGES.disabled, retry: false };
const unavailable: CallNotice = { kind: 'error', message: CALL_MESSAGES.unavailable, retry: true };
const failed: CallNotice = { kind: 'error', message: CALL_MESSAGES.failed, retry: true };
const emailNotVerified: CallNotice = {
  kind: 'info',
  message: CALL_MESSAGES.emailNotVerified,
  retry: false,
};

/** Kody z kontraktu endpointu rozmowy (backend: whiteboard/call.py, call_guard.py, call_usage.py). */
const START_NOTICES = new Map<string, CallNotice>([
  // Rozmowy wyłączone na serwerze: brak klucza Daily albo wyłącznik CALL_ENABLED.
  ['VOICE_NOT_CONFIGURED', disabled],
  ['VOICE_DISABLED', disabled],
  // Dołączający (uczeń) bez aktywnego pokoju - pokój tworzy tylko właściciel przestrzeni.
  ['VOICE_CALL_NOT_STARTED', { kind: 'info', message: CALL_MESSAGES.notStarted, retry: true }],
  ['VOICE_CALL_ENDING', { kind: 'info', message: CALL_MESSAGES.ending, retry: true }],
  [
    'VOICE_CREATE_NOT_ALLOWED',
    { kind: 'info', message: CALL_MESSAGES.createNotAllowed, retry: false },
  ],
  ['VOICE_EMAIL_NOT_VERIFIED', emailNotVerified],
  ['RATE_LIMITED', { kind: 'info', message: CALL_MESSAGES.rateLimited, retry: true }],
  ['VOICE_CALL_BUSY', { kind: 'info', message: CALL_MESSAGES.busy, retry: true }],
  ['VOICE_USER_LIMIT', { kind: 'info', message: CALL_MESSAGES.userLimit, retry: false }],
  ['VOICE_MONTHLY_LIMIT', { kind: 'info', message: CALL_MESSAGES.monthlyLimit, retry: false }],
  ['VOICE_PROVIDER_LIMIT', unavailable],
  ['VOICE_PROVIDER_ERROR', unavailable],
  ['VOICE_PROVIDER_TIMEOUT', unavailable],
  ['VOICE_GUARD_UNAVAILABLE', unavailable],
  ['VOICE_USAGE_UNAVAILABLE', unavailable],
]);

export function noticeFromStartError(err: unknown): CallNotice {
  if (!(err instanceof AppError)) return failed;
  // AUTH_ERROR to kod ogólny: 403 = konto bez potwierdzonego e-maila (get_current_user),
  // 401 = sesja (obsługuje ją klient API) - dlatego tu, wyjątkowo, patrzymy też na status.
  if (err.code === 'AUTH_ERROR') return err.status === 403 ? emailNotVerified : failed;
  return START_NOTICES.get(err.code) ?? failed;
}

/**
 * Błąd krytyczny z Daily w trakcie rozmowy albo przy wejściu (`event.error.type`).
 * Pokój ma `exp` i wyrzuca uczestników po czasie (`exp-room`; `ejected` = limit pobytu z tokenu,
 * ustawiony na ten sam moment) - to zwykły koniec rozmowy, nie awaria.
 */
export function noticeFromDailyError(type: string | undefined): CallNotice {
  switch (type) {
    case 'exp-room':
    case 'ejected':
      return { kind: 'info', message: CALL_MESSAGES.roomExpired, retry: false };
    case 'no-room':
      return { kind: 'info', message: CALL_MESSAGES.ended, retry: true };
    case 'exp-token':
      // Token jest ważny 5 min i służy tylko do wejścia - ponowienie pobiera nowy.
      return { kind: 'info', message: CALL_MESSAGES.entryExpired, retry: true };
    case 'meeting-full':
      return { kind: 'info', message: CALL_MESSAGES.full, retry: true };
    default:
      return { kind: 'error', message: CALL_MESSAGES.interrupted, retry: true };
  }
}

/** Do logów: tylko kod i status - bez treści odpowiedzi (mogłaby zawierać token). */
export function describeError(err: unknown): { code?: string; status?: number; name?: string } {
  if (err instanceof AppError) return { code: err.code, status: err.status };
  return { name: (err as { name?: string } | null)?.name ?? 'unknown' };
}
