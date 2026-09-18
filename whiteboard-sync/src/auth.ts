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
}

export async function onAuthenticate({
  token,
  documentName,
}: {
  token?: string;
  documentName: string;
}): Promise<AuthContext> {
  if (!token) throw new Error('Brak tokenu');

  const boardId = Number(documentName);
  if (Number.isNaN(boardId)) throw new Error('Nieprawidłowe id tablicy');

  const res = await fetch(`${BACKEND_URL}/api/v1/whiteboard/${boardId}/access`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Brak dostępu do tablicy (status ${res.status})`);

  const body = (await res.json()) as { data: AccessCheckData };
  return { userId: body.data.user_id, username: body.data.username };
}
