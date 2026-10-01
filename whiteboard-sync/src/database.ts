/**
 * database.ts
 *
 * Odczyt i zapis snapshotu Y.Doc przez FastAPI (GET/POST /api/v1/whiteboard/{id}/doc).
 *
 * Uwierzytelnienie: klucz serwis-serwis (SYNC_SERVICE_TOKEN -> nagłówek X-Sync-Service-Token).
 * Token usera z chwili połączenia NIE nadaje się do zapisu: access token żyje 15 min, a połączenie
 * WebSocket trwa całą lekcję - zapis po tym czasie dostawał 401 i przepadał (odtworzone 01.10.2026).
 * Token usera zostaje tylko jako zapas, gdy klucz nie jest skonfigurowany (stare wdrożenie).
 *
 * Zapis: błędy przejściowe (sieć, 5xx, 429) ponawiane z rosnącym odstępem (łącznie ~5 min);
 * w tym czasie Hocuspocus trzyma dokument w pamięci (zwalnia go dopiero po zakończeniu store).
 * Snapshot to pełny stan dokumentu, więc nowszy zapis tej samej tablicy przerywa starszy.
 * `store` NIGDY nie rzuca: Hocuspocus 2.15 rzuca błąd zapisu dalej z miejsca, którego nikt nie
 * czeka (unhandled rejection = koniec procesu w Node 20) - po wyczerpaniu prób tylko logujemy.
 *
 * Odczyt: nieudany rzuca (powód `server-unavailable`, klient ponawia połączenie). Pusty dokument
 * zamiast prawdziwego nadpisałby potem bazę przy pierwszym zapisie.
 */

import { Database } from '@hocuspocus/extension-database';
import type { AuthContext } from './auth';

export const SERVICE_TOKEN_HEADER = 'X-Sync-Service-Token';
const DEFAULT_READ_RETRY_DELAYS_MS = [1_000, 3_000];
const DEFAULT_STORE_RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000, 60_000, 60_000, 60_000, 60_000];

interface DocumentData {
  snapshot: string | null;
}

export interface DatabaseOptions {
  backendUrl: string;
  serviceToken?: string;
  /** Odstępy kolejnych prób odczytu po błędzie przejściowym (długość = liczba ponowień). */
  readRetryDelaysMs?: number[];
  /** Jw. dla zapisu. */
  storeRetryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}

class PermanentError extends Error {}
class SupersededError extends Error {}

function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

export function createDatabaseHandlers({
  backendUrl,
  serviceToken,
  readRetryDelaysMs = DEFAULT_READ_RETRY_DELAYS_MS,
  storeRetryDelaysMs = DEFAULT_STORE_RETRY_DELAYS_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: DatabaseOptions) {
  let warnedFallback = false;
  /** Numer ostatniego zapisu per tablica - starszy zapis w trakcie ponowień się wycofuje. */
  const storeGeneration = new Map<string, number>();
  let storeCounter = 0;

  function authHeaders(documentName: string, context: unknown): Record<string, string> {
    if (serviceToken) return { [SERVICE_TOKEN_HEADER]: serviceToken };
    const token = (context as AuthContext | undefined)?.token;
    if (!token) throw new PermanentError(`${documentName}: brak SYNC_SERVICE_TOKEN i tokenu usera`);
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(
        '[whiteboard-sync] brak SYNC_SERVICE_TOKEN - zapis tokenem usera, który wygasa po 15 min połączenia'
      );
    }
    return { Authorization: `Bearer ${token}` };
  }

  /** Wywołanie z ponowieniami dla błędów przejściowych. */
  async function request(
    label: string,
    url: string,
    init: RequestInit,
    retryDelaysMs: number[],
    isCurrent: () => boolean = () => true
  ): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      if (!isCurrent()) throw new SupersededError(label);
      let failure: string;
      try {
        const res = await fetch(url, init);
        if (res.ok) return res;
        failure = `${label} -> ${res.status}`;
        if (!isTransientStatus(res.status)) throw new PermanentError(failure);
      } catch (err) {
        if (err instanceof PermanentError) throw err;
        failure = `${label}: ${(err as Error).message}`;
      }
      if (attempt >= retryDelaysMs.length) throw new Error(`${failure} (po ${attempt + 1} próbach)`);
      const delay = retryDelaysMs[attempt];
      console.warn(`[whiteboard-sync] ${failure}, ponowienie za ${delay} ms`);
      await sleep(delay);
    }
  }

  return {
    fetch: async ({ documentName, context }: { documentName: string; context: unknown }) => {
      let res: Response;
      try {
        res = await request(
          `fetch ${documentName}: GET /doc`,
          `${backendUrl}/api/v1/whiteboard/${documentName}/doc`,
          { headers: authHeaders(documentName, context) },
          readRetryDelaysMs
        );
      } catch (err) {
        console.error(`[whiteboard-sync] odczyt nieudany: ${(err as Error).message}`);
        // Klient dostaje odmowę z tym powodem i ponawia połączenie (nie kasuje kopii lokalnej).
        throw Object.assign(err as Error, { reason: 'server-unavailable' });
      }
      const body = (await res.json()) as { data: DocumentData };
      if (!body.data.snapshot) return null;
      return new Uint8Array(Buffer.from(body.data.snapshot, 'base64'));
    },

    store: async ({
      documentName,
      state,
      context,
    }: {
      documentName: string;
      state: Uint8Array;
      context: unknown;
    }) => {
      // Licznik globalny, nie per tablica - po usunięciu wpisu numer nie może się powtórzyć.
      const generation = ++storeCounter;
      storeGeneration.set(documentName, generation);
      const isCurrent = () => storeGeneration.get(documentName) === generation;
      try {
        await request(
          `store ${documentName}: POST /doc`,
          `${backendUrl}/api/v1/whiteboard/${documentName}/doc`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders(documentName, context) },
            body: JSON.stringify({ snapshot: Buffer.from(state).toString('base64') }),
          },
          storeRetryDelaysMs,
          isCurrent
        );
      } catch (err) {
        if (err instanceof SupersededError) return;
        // Bez rzucania - patrz komentarz na górze pliku.
        console.error(`[whiteboard-sync] ZAPIS NIEUDANY: ${(err as Error).message}`);
      } finally {
        if (isCurrent()) storeGeneration.delete(documentName);
      }
    },
  };
}

export const database = new Database(
  createDatabaseHandlers({
    backendUrl: process.env.BACKEND_URL ?? 'http://localhost:8000',
    serviceToken: process.env.SYNC_SERVICE_TOKEN || undefined,
  })
);
