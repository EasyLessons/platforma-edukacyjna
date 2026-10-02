/**
 * Kontekst rozmowy przy tablicy (Daily). Poza `DailyCallProvider` hook zwraca null -
 * dzięki temu przycisk "Rozmowa" po prostu się nie renderuje (demo, gość, tryb `legacy`).
 */
import { createContext, useContext } from 'react';

/** idle - brak rozmowy; loading - pobieranie pokoju i tokenu; active - okno rozmowy otwarte. */
export type CallStatus = 'idle' | 'loading' | 'active';

/**
 * disabled - rozmowy wyłączone na serwerze (brak klucza Daily, wyłącznik);
 * unsupported - przeglądarka nie da mikrofonu (http, przeglądarka w aplikacji, stary iOS);
 * info - zwykły stan, nie awaria (rozmowa jeszcze się nie zaczęła, limit, koniec czasu pokoju);
 * error - awaria (sieć, błąd dostawcy, brak endpointu, zerwane połączenie).
 */
export type CallNoticeKind = 'disabled' | 'unsupported' | 'info' | 'error';

export interface CallNotice {
  kind: CallNoticeKind;
  message: string;
  /** Czy pokazać "Spróbuj ponownie". Ponowienie jest zawsze ręczne - nic nie odpytuje serwera samo. */
  retry: boolean;
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
