/**
 * API rozmowy przy tablicy (Daily). Backend tworzy/odświeża pokój i wydaje meeting token;
 * klucz Daily nigdy nie trafia do przeglądarki.
 *
 * `token` to poświadczenie wejścia do rozmowy - nie logować i nie wkładać do adresu strony.
 */
import { apiClient } from '@/_new/lib/api';
import { AppError, ErrorCode } from '@/_new/lib/errors';

export interface BoardCall {
  room_url: string;
  token: string;
  expires_at: string;
}

/**
 * Adres pokoju trafia do `src` ramki z uprawnieniami do mikrofonu, kamery i ekranu, a daily-js
 * dokleja do niego token (`?t=`) i sam sprawdza tylko, czy to napis. Dlatego wpuszczamy
 * wyłącznie `https://<konto>.daily.co/...` - obca domena dostałaby token i uprawnienia,
 * a `javascript:` wykonałby się w naszym originie.
 */
export function isDailyRoomUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.hostname.endsWith('.daily.co') &&
    url.username === '' &&
    url.password === '' &&
    url.port === ''
  );
}

export async function createBoardCall(boardId: number): Promise<BoardCall> {
  const res = await apiClient.post<BoardCall>(`/api/v1/whiteboard/${boardId}/call`);
  const data = res.data as Partial<BoardCall> | null | undefined;
  // Odpowiedź 2xx bez pokoju albo tokenu (np. starszy backend, proxy) traktujemy jak błąd,
  // zamiast przekazywać `undefined` do Daily.
  if (!data || typeof data.room_url !== 'string' || typeof data.token !== 'string') {
    throw new AppError('Nieprawidłowa odpowiedź serwera rozmowy', ErrorCode.APP_ERROR, 0);
  }
  if (!isDailyRoomUrl(data.room_url)) {
    throw new AppError('Nieprawidłowy adres pokoju rozmowy', ErrorCode.APP_ERROR, 0);
  }
  return { room_url: data.room_url, token: data.token, expires_at: data.expires_at ?? '' };
}
