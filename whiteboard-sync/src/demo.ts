/**
 * demo.ts
 *
 * Tablica demo bez konta (`/demo/<id>` na froncie, dokument `demo-<id>` tutaj).
 *
 * Co demo ma, a czego nie:
 *  - wejście BEZ tokenu i bez pytania backendu (gość nie ma konta), ale tylko dla dokumentów
 *    o nazwie `demo-` + 16-64 znaków [A-Za-z0-9_-] - id sesji losuje przeglądarka (128 bitów),
 *    więc link jest niezgadywalny; numeryczne id prawdziwych tablic tu nie wchodzą,
 *  - NIC nie trafia do bazy: `database.ts` pomija demo (ani odczyt, ani zapis), dokument żyje
 *    wyłącznie w pamięci serwera, dopóki ktoś jest połączony,
 *  - sesja wygasa: po `ttlMs` od pierwszego wejścia serwer rozłącza wszystkich, a ponowne wejście
 *    dostaje odmowę `demo-expired` (wpis pamiętamy jeszcze przez `expiredGraceMs`),
 *  - ograniczenia przed nadużyciem anonimowego wejścia: najwyżej `maxConnectionsPerDoc` osób
 *    w jednej sesji (`demo-full`), najwyżej `maxSessions` równoległych sesji (`demo-full`),
 *    wpisy bez połączeń są zwalniane po `idleMs`, a liczba elementów jest limitowana jak na
 *    planie Free (element-limit.ts, `elementLimit` w kontekście).
 *
 * Liczniki są w pamięci jednego procesu (jak reszta serwisu). Parametry z env, patrz `demoConfigFromEnv`.
 */

import type { Hocuspocus } from '@hocuspocus/server';

export const DEMO_DOCUMENT_PATTERN = /^demo-[A-Za-z0-9_-]{16,64}$/;

export function isDemoDocument(documentName: string): boolean {
  return DEMO_DOCUMENT_PATTERN.test(documentName);
}

export type DemoRefusal = 'demo-expired' | 'demo-full';

export interface DemoConfig {
  /** Jak długo trwa sesja od pierwszego wejścia. */
  ttlMs: number;
  /** Jak długo po wygaśnięciu pamiętamy sesję, żeby odrzucać powroty (potem id jest wolne). */
  expiredGraceMs: number;
  /** Sesja bez żadnego połączenia jest zapominana po tym czasie (zwalnia miejsce w `maxSessions`). */
  idleMs: number;
  maxConnectionsPerDoc: number;
  maxSessions: number;
  /** Limit żywych elementów w demo (jak plan Free dla zalogowanych; front pokazuje ostrzeżenie). */
  elementLimit: number;
}

const MINUTE = 60_000;

export const DEFAULT_DEMO_CONFIG: DemoConfig = {
  ttlMs: 180 * MINUTE,
  expiredGraceMs: 24 * 60 * MINUTE,
  idleMs: 10 * MINUTE,
  maxConnectionsPerDoc: 10,
  maxSessions: 200,
  elementLimit: 500,
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Konfiguracja z env (wartości niepoprawne = domyślne): DEMO_SESSION_TTL_MINUTES itd. */
export function demoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DemoConfig {
  const d = DEFAULT_DEMO_CONFIG;
  return {
    ttlMs: positiveInt(env.DEMO_SESSION_TTL_MINUTES, d.ttlMs / MINUTE) * MINUTE,
    expiredGraceMs: d.expiredGraceMs,
    idleMs: d.idleMs,
    maxConnectionsPerDoc: positiveInt(env.DEMO_MAX_CONNECTIONS_PER_DOC, d.maxConnectionsPerDoc),
    maxSessions: positiveInt(env.DEMO_MAX_SESSIONS, d.maxSessions),
    elementLimit: positiveInt(env.DEMO_ELEMENT_LIMIT, d.elementLimit),
  };
}

interface Session {
  startedAt: number;
  /** Od kiedy (wg `sweep`) nikt nie jest połączony; null = ktoś jest albo właśnie wchodzi. */
  emptySince: number | null;
  /** Połączenia zostały już zamknięte z powodu wygaśnięcia. */
  closed: boolean;
}

export class DemoSessions {
  private readonly sessions = new Map<string, Session>();

  constructor(
    readonly config: DemoConfig = demoConfigFromEnv(),
    private readonly now: () => number = Date.now
  ) {}

  get size(): number {
    return this.sessions.size;
  }

  private expired(session: Session, at: number): boolean {
    return at - session.startedAt >= this.config.ttlMs;
  }

  /**
   * Czy można wpuścić kolejną osobę do sesji `documentName`. `connections` to liczba osób
   * już połączonych z dokumentem. Zwraca powód odmowy albo null (wejście zarejestrowane).
   */
  admit(documentName: string, connections: number): DemoRefusal | null {
    const at = this.now();
    this.prune(at);
    const session = this.sessions.get(documentName);

    if (session) {
      if (this.expired(session, at)) return 'demo-expired';
      if (connections >= this.config.maxConnectionsPerDoc) return 'demo-full';
      session.emptySince = null;
      return null;
    }
    if (this.sessions.size >= this.config.maxSessions) return 'demo-full';
    this.sessions.set(documentName, { startedAt: at, emptySince: null, closed: false });
    return null;
  }

  /**
   * Zapomina sesje, które nie są już potrzebne: puste od `idleMs` (zwalnia miejsce w
   * `maxSessions`) i takie, które wygasły dawno temu (po `expiredGraceMs` id jest znów wolne).
   */
  prune(at: number = this.now()): void {
    for (const [name, session] of this.sessions) {
      const forgotten = at - session.startedAt >= this.config.ttlMs + this.config.expiredGraceMs;
      const abandoned =
        !this.expired(session, at) &&
        session.emptySince !== null &&
        at - session.emptySince >= this.config.idleMs;
      if (forgotten || abandoned) this.sessions.delete(name);
    }
  }

  /**
   * Cykliczne sprzątanie (index.ts, co ~30 s): zamyka połączenia sesji, której minął czas,
   * i zapamiętuje, od kiedy sesja jest pusta.
   */
  sweep(server: Pick<Hocuspocus, 'documents' | 'closeConnections'>): void {
    const at = this.now();
    for (const [name, session] of this.sessions) {
      const connected = server.documents.get(name)?.getConnectionsCount() ?? 0;
      if (connected > 0) session.emptySince = null;
      else if (session.emptySince === null) session.emptySince = at;

      if (this.expired(session, at) && !session.closed) {
        session.closed = true;
        server.closeConnections(name);
        console.log(`[whiteboard-sync] demo wygasło: ${name}`);
      }
    }
    this.prune(at);
  }
}

export const demoSessions = new DemoSessions();
