/**
 * Rate limit per IP dla /api/chat - okno przesuwne + blokada po przekroczeniu.
 *
 * Stan trzymany w pamieci procesu (Map). Dziala poprawnie na jednej, dlugo
 * zyjacej instancji serwera; przy serverless/wielu instancjach kazda ma wlasna
 * mape (docs/architecture/pipelines.md par. 4). Wtedy: wspoldzielony store (Redis).
 */

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  blockDurationMs: number;
}

interface RequestLog {
  timestamps: number[];
  blockUntil?: number;
}

export interface RateLimiter {
  /** true = przepusc, false = zablokowany / limit przekroczony */
  check(ip: string, now?: number): boolean;
  /** Usuwa wpisy bez aktywnych zadan i bez blokady. */
  cleanup(now?: number): void;
  readonly size: number;
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const log = new Map<string, RequestLog>();

  return {
    check(ip, now = Date.now()) {
      const entry = log.get(ip) ?? { timestamps: [] };

      if (entry.blockUntil !== undefined) {
        if (now < entry.blockUntil) return false;
        entry.blockUntil = undefined;
      }

      entry.timestamps = entry.timestamps.filter((t) => now - t < options.windowMs);

      if (entry.timestamps.length >= options.maxRequests) {
        entry.blockUntil = now + options.blockDurationMs;
        log.set(ip, entry);
        console.warn(`⚠️ Rate limit exceeded for IP: ${ip.substring(0, 10)}...`);
        return false;
      }

      entry.timestamps.push(now);
      log.set(ip, entry);
      return true;
    },
    cleanup(now = Date.now()) {
      for (const [ip, entry] of log.entries()) {
        const active = entry.timestamps.some((t) => now - t < options.windowMs);
        const blocked = entry.blockUntil !== undefined && now < entry.blockUntil;
        if (!active && !blocked) log.delete(ip);
      }
    },
    get size() {
      return log.size;
    },
  };
}

/** Adres klienta z naglowkow proxy (Vercel/compose) - pierwszy z X-Forwarded-For. */
export function getClientIp(headers: { get(name: string): string | null }): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  );
}
