/**
 * auth.ts
 *
 * onAuthenticate dla Hocuspocus - nie weryfikuje tokenu JWT samodzielnie, tylko deleguje do FastAPI.
 * FastAPI jest jednym źródłem prawdy - weryfikuje token JWT oraz membership w tablicy.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

interface AccessCheckData {
  has_access: boolean;
  user_id: number;
  username: string;
}

export interface AuthContext {
  userId: number;
  username: string;
  token: string;
}

/** Powód odmowy autoryzacji, na podstawie którego klient decyduje, 
 * czy usunać lokalną kopię tablicy. */
export type AuthFailureReason = 'token-expired' | 'access-denied' | 'server-unavailable';

function authFailure(message: string, reason: AuthFailureReason): Error {
  return Object.assign(new Error(message), { reason });
}

export async function onAuthenticate({
  token,
  documentName,
}: {
  token?: string;
  documentName: string;
}): Promise<AuthContext> {
  if (!token) throw authFailure('Brak tokenu', 'token-expired');

  const boardId = Number(documentName);
  if (Number.isNaN(boardId)) throw authFailure('Nieprawidłowe id tablicy', 'access-denied');

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/v1/whiteboard/${boardId}/access`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Backend nieosgiągalny - to nie odmowa dostępu.
    throw authFailure('Serwer niedostępny', 'server-unavailable');
  }
  
  if (res.status === 401) throw authFailure('Token wygasł lub nieprawidłowy', 'token-expired');
  if (res.status >= 500) throw authFailure(`Serwer niedostępny (status ${res.status})`, 'server-unavailable');
  if (!res.ok) throw authFailure(`Brak dostępu do tablicy (status ${res.status})`, 'access-denied');

  const body = (await res.json()) as { data: AccessCheckData };
  return { userId: body.data.user_id, username: body.data.username, token };
}
