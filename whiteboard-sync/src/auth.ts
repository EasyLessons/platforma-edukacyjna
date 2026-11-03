/**
 * auth.ts
 *
 * onAuthenticate dla Hocuspocus - nie weryfikuje tokenu JWT samodzielnie, tylko deleguje do FastAPI.
 * FastAPI jest jednym źródłem prawdy - weryfikuje token JWT oraz membership i rolę w tablicy.
 * Wyjątek: dokumenty demo (`demo-<id>`, patrz demo.ts) wchodzą bez tokenu i bez backendu.
 *
 * Rola viewer dostaje połączenie tylko do odczytu (`connection.readOnly`): Hocuspocus odrzuca
 * wtedy jej aktualizacje dokumentu, ale awareness (kursor, obecność) działa dalej.
 */

import { demoSessions, isDemoDocument, type DemoSessions } from './demo';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

interface AccessCheckData {
  has_access: boolean;
  user_id: number;
  username: string;
  role?: string;
  can_edit?: boolean;
  /** Limit zywych elementow wg planu wlasciciela przestrzeni; brak/null = bez limitu. */
  element_limit?: number | null;
}

export interface AuthContext {
  userId: number;
  username: string;
  token: string;
  canEdit: boolean;
  /** Limit zywych elementow tablicy (null = bez limitu), stały dla połączenia. */
  elementLimit: number | null;
  /** Gość na tablicy demo: bez konta, bez zapisu do bazy. */
  demo?: boolean;
}

/** Powód odmowy autoryzacji, na podstawie którego klient decyduje,
 * czy usunać lokalną kopię tablicy. */
export type AuthFailureReason =
  | 'token-expired'
  | 'access-denied'
  | 'server-unavailable'
  | 'demo-expired'
  | 'demo-full';

function authFailure(message: string, reason: AuthFailureReason): Error {
  return Object.assign(new Error(message), { reason });
}

interface AuthenticatePayload {
  token?: string;
  documentName: string;
  connection?: { readOnly: boolean };
  /** Instancja serwera Hocuspocus - z niej bierzemy liczbę osób połączonych z sesją demo. */
  instance?: { documents: Map<string, { getConnectionsCount(): number }> };
}

/** Wejście na tablicę demo: bez tokenu i bez backendu; sesje, limity i wygasanie w demo.ts. */
function authenticateDemo(
  demo: DemoSessions,
  { documentName, connection, instance }: AuthenticatePayload
): AuthContext {
  const connections = instance?.documents.get(documentName)?.getConnectionsCount() ?? 0;
  const refusal = demo.admit(documentName, connections);
  if (refusal === 'demo-expired') throw authFailure('Sesja demo wygasła', refusal);
  if (refusal) throw authFailure('Za dużo osób w demo', refusal);
  if (connection) connection.readOnly = false;
  return {
    userId: -1,
    username: 'Gość',
    token: '',
    canEdit: true,
    elementLimit: demo.config.elementLimit,
    demo: true,
  };
}

/** `onAuthenticate` z wybraną rejestracją sesji demo (testy podają własną; produkcja: demoSessions). */
export function createAuthenticate(demo: DemoSessions = demoSessions) {
  return async function authenticate(payload: AuthenticatePayload): Promise<AuthContext> {
    if (isDemoDocument(payload.documentName)) return authenticateDemo(demo, payload);
    return authenticateUser(payload);
  };
}

export const onAuthenticate = createAuthenticate();

async function authenticateUser({
  token,
  documentName,
  connection,
}: AuthenticatePayload): Promise<AuthContext> {
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
  // Brak pola = backend sprzed wprowadzenia ról (kolejność wdrożenia: najpierw backend).
  // Zostawiamy wtedy dotychczasowe zachowanie zamiast blokować edycję wszystkim.
  const canEdit = body.data.can_edit !== false;
  if (connection) connection.readOnly = !canEdit;

  // Brak pola albo wartosc nieliczbowa/ujemna = bez limitu (stary backend nie blokuje edycji).
  const raw = body.data.element_limit;
  const elementLimit =
    typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : null;

  return { userId: body.data.user_id, username: body.data.username, token, canEdit, elementLimit };
}
