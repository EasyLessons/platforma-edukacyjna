/**
 * Wsparcie przegladarki dla czatu glosowego + tlumaczenie bledow na komunikaty.
 *
 * Wczesniej kazda porazka konczyla sie `alert()`, a przegladarki wbudowane
 * w aplikacje (Messenger, Facebook, Instagram — WKWebView na iOS) czesto w ogole
 * nie pokazuja alertow. Uzytkownik klikal "dolacz" i nic sie nie dzialo.
 * Tu kazda sciezka konczy sie komunikatem, ktory UI pokazuje w stronie.
 */

export type VoiceErrorCode =
  | 'in-app-browser'
  | 'insecure-context'
  | 'unsupported'
  | 'mic-denied'
  | 'mic-not-found'
  | 'mic-busy'
  | 'channel-failed'
  | 'unknown';

export interface VoiceError {
  code: VoiceErrorCode;
  message: string;
}

const MESSAGES: Record<VoiceErrorCode, string> = {
  'in-app-browser':
    'Otwórz tę tablicę w Safari lub Chrome, żeby dołączyć do rozmowy. Przeglądarka wbudowana w aplikację (np. Messenger, Facebook, Instagram) nie daje dostępu do mikrofonu.',
  'insecure-context':
    'Czat głosowy działa tylko przez bezpieczne połączenie (https). Otwórz stronę pod adresem https://.',
  unsupported:
    'Ta przeglądarka nie obsługuje czatu głosowego. Otwórz tablicę w aktualnym Safari lub Chrome.',
  'mic-denied':
    'Brak zgody na mikrofon. Zezwól na dostęp do mikrofonu w ustawieniach przeglądarki dla tej strony i spróbuj ponownie.',
  'mic-not-found': 'Nie znaleziono mikrofonu. Podłącz mikrofon i spróbuj ponownie.',
  'mic-busy':
    'Mikrofon jest zajęty przez inną aplikację (np. rozmowę telefoniczną). Zakończ ją i spróbuj ponownie.',
  'channel-failed':
    'Nie udało się połączyć z serwerem rozmowy. Sprawdź połączenie z internetem i spróbuj ponownie.',
  unknown: 'Nie udało się dołączyć do rozmowy. Spróbuj ponownie.',
};

export function voiceError(code: VoiceErrorCode): VoiceError {
  return { code, message: MESSAGES[code] };
}

/**
 * Przegladarki wbudowane w aplikacje Meta. Na iOS to WKWebView, w ktorym dostep
 * do mikrofonu zalezy od aplikacji-gospodarza — w praktyce zwykle go nie ma,
 * a prosba o zgode potrafi nigdy sie nie pojawic.
 */
const IN_APP_BROWSER_PATTERNS = [/FBAN/i, /FBAV/i, /FB_IAB/i, /Messenger/i, /Instagram/i];

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_BROWSER_PATTERNS.some((re) => re.test(userAgent));
}

/** Zwraca powod, dla ktorego nie warto nawet probowac, albo null gdy mozna. */
export function getVoiceSupportIssue(): VoiceError | null {
  if (typeof window === 'undefined') return voiceError('unsupported');

  if (isInAppBrowser(window.navigator.userAgent || '')) {
    return voiceError('in-app-browser');
  }
  if (window.isSecureContext === false) {
    return voiceError('insecure-context');
  }
  if (typeof window.navigator.mediaDevices?.getUserMedia !== 'function') {
    return voiceError('unsupported');
  }
  return null;
}

/** Mapuje wyjatek z getUserMedia na komunikat dla uzytkownika. */
export function mapGetUserMediaError(error: unknown): VoiceError {
  const name = (error as { name?: string } | null)?.name ?? '';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return voiceError('mic-denied');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return voiceError('mic-not-found');
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return voiceError('mic-busy');
    default:
      return voiceError('unknown');
  }
}
