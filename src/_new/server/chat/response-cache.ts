/**
 * Cache odpowiedzi asystenta po tresci pytania (case-insensitive, po trim).
 * W pamieci procesu - te same ograniczenia co rate-limit.ts.
 */

interface CachedResponse {
  response: string;
  timestamp: number;
}

export interface ResponseCache {
  get(message: string, now?: number): string | null;
  set(message: string, response: string, now?: number): void;
  cleanup(now?: number): void;
  readonly size: number;
}

const keyOf = (message: string) => message.toLowerCase().trim();

export function createResponseCache(ttlMs: number): ResponseCache {
  const cache = new Map<string, CachedResponse>();

  return {
    get(message, now = Date.now()) {
      const key = keyOf(message);
      const cached = cache.get(key);
      if (!cached) return null;
      if (now - cached.timestamp < ttlMs) return cached.response;
      cache.delete(key);
      return null;
    },
    set(message, response, now = Date.now()) {
      cache.set(keyOf(message), { response, timestamp: now });
    },
    cleanup(now = Date.now()) {
      for (const [key, cached] of cache.entries()) {
        if (now - cached.timestamp > ttlMs) cache.delete(key);
      }
    },
    get size() {
      return cache.size;
    },
  };
}
