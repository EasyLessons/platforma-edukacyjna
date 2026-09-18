import { Database } from '@hocuspocus/extension-database';
import type { AuthContext } from './auth';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

interface DocumentData {
  snapshot: string | null;
}

export const database = new Database({
  fetch: async ({ documentName, context }) => {
    const token = (context as AuthContext | undefined)?.token;
    if (!token) {
      console.warn(
        `[whiteboard-sync] fetch ${documentName}: brak tokenu w context - pusty dokument`
      );
      return null;
    }

    const res = await fetch(`${BACKEND_URL}/api/v1/whiteboard/${documentName}/doc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`[whiteboard-sync] fetch ${documentName}: GET /doc -> ${res.status}`);
      return null;
    }

    const body = (await res.json()) as { data: DocumentData };
    if (!body.data.snapshot) return null;
    return Buffer.from(body.data.snapshot, 'base64');
  },

  store: async ({ documentName, state, context }) => {
    const token = (context as AuthContext | undefined)?.token;
    if (!token) {
      console.warn(
        `[whiteboard-sync] store ${documentName}: brak tokenu w context - nie zapisano dokumentu`
      );
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/v1/whiteboard/${documentName}/doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ snapshot: Buffer.from(state).toString('base64') }),
    });
    if (!res.ok) {
      console.error(`[whiteboard-sync] store ${documentName}: POST /doc -> ${res.status}`);
    }
  },
});
