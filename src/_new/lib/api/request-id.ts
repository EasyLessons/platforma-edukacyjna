/**
 * X-Request-ID po stronie klienta (etap O3 z docs/architecture/OBSERWOWALNOSC-PLAN.md).
 *
 * Każde żądanie z apiClient dostaje własny identyfikator. Backend (core/request_id.py)
 * odbija go w nagłówku odpowiedzi i w polu `request_id` błędów, więc użytkownik może
 * podać go przy zgłoszeniu, a my odnajdujemy jedną linię w logach JSON.
 *
 * Format zgodny z walidacją backendu: [A-Za-z0-9._-]{1,64}. uuid v4 bez myślników
 * daje 32 znaki hex — taki sam kształt jak identyfikatory generowane po stronie serwera.
 */
export const REQUEST_ID_HEADER = 'X-Request-ID';

export function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID().replace(/-/g, '');
  }
  // Starsze przeglądarki / kontekst bez Web Crypto — id nie musi być kryptograficznie
  // losowy, ma tylko odróżniać żądania w logach.
  let out = '';
  while (out.length < 32) out += Math.random().toString(16).slice(2);
  return out.slice(0, 32);
}

/** Czyta id z nagłówków (Axios normalizuje nazwy do lower-case, ale nie zawsze). */
export function readRequestIdHeader(headers: unknown): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const h = headers as Record<string, unknown>;
  const value = h[REQUEST_ID_HEADER.toLowerCase()] ?? h[REQUEST_ID_HEADER];
  return typeof value === 'string' && value ? value : undefined;
}
