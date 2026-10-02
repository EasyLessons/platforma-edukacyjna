/**
 * Kontekst rozmowy przy tablicy (Daily). Poza `DailyCallProvider` hook zwraca null -
 * dzięki temu przycisk "Rozmowa" po prostu się nie renderuje (demo, gość, tryb `legacy`).
 */
import { createContext, useContext } from 'react';

/** idle - brak rozmowy; loading - pobieranie pokoju i tokenu; active - okno rozmowy otwarte. */
export type CallStatus = 'idle' | 'loading' | 'active';

/**
 * disabled - rozmowy wyłączone na serwerze (brak klucza Daily);
 * unsupported - przeglądarka nie da mikrofonu (http, przeglądarka w aplikacji, stary iOS);
 * error - reszta (sieć, błąd dostawcy, brak endpointu) - można ponowić.
 */
export type CallNoticeKind = 'disabled' | 'unsupported' | 'error';

export interface CallNotice {
  kind: CallNoticeKind;
  message: string;
}

export interface DailyCallContextValue {
  status: CallStatus;
  /** Użytkownik przeszedł ekran wejścia Daily i jest w rozmowie. */
  isJoined: boolean;
  isMuted: boolean;
  /** Okno zwinięte do belki (rozmowa trwa dalej). */
  minimized: boolean;
  notice: CallNotice | null;
  start: () => Promise<void>;
  leave: () => void;
  toggleMinimized: () => void;
  toggleMute: () => void;
  dismissNotice: () => void;
}

export const DailyCallContext = createContext<DailyCallContextValue | null>(null);

export function useDailyCall(): DailyCallContextValue | null {
  return useContext(DailyCallContext);
}
