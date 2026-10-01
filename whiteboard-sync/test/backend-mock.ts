/**
 * Atrapa backendu FastAPI dla testów: podmienia globalny fetch i odpowiada na
 * GET /api/v1/whiteboard/{id}/access zależnie od tokenu.
 */

import { vi } from 'vitest';

export interface AccessResponse {
  status: number;
  role?: string;
  can_edit?: boolean;
}

export function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify({ success: status < 400, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** fetch odpowiadający na /access według mapy token -> odpowiedź. */
export function mockAccess(byToken: Record<string, AccessResponse>) {
  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get('Authorization') ?? '';
    const token = auth.replace(/^Bearer /, '');
    const access = byToken[token] ?? { status: 401 };
    if (access.status !== 200) return jsonResponse(access.status, null);
    return jsonResponse(200, {
      has_access: true,
      user_id: 7,
      username: `user-${token}`,
      role: access.role,
      can_edit: access.can_edit,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
