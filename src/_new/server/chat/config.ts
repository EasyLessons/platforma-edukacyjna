/**
 * Konfiguracja asystenta AI (Route Handler /api/chat).
 * Logika serwerowa czatu zyje w src/_new/server/chat (PR-A9 z REFAKTOR-PLAN.md);
 * src/app/api/chat/route.ts tylko ja sklada.
 */
export const CHAT_CONFIG = {
  // Rate limiting (per IP, w pamieci procesu - patrz rate-limit.ts)
  RATE_LIMIT_REQUESTS: 20,
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minuta
  BLOCK_DURATION_MS: 2 * 60 * 1000, // 2 minuty blokady

  // Cache odpowiedzi
  CACHE_TTL_MS: 30 * 60 * 1000, // 30 minut

  // Limity wiadomosci
  MAX_MESSAGE_LENGTH: 1000,
  MIN_MESSAGE_LENGTH: 1,

  // Gemini
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_MODEL_FALLBACK: 'gemini-2.5-flash-lite', // gdy glowny model przekroczy limit
  GEMINI_TEMPERATURE: 0.7,
  GEMINI_MAX_TOKENS: 12500,
} as const;

/** Klucz czytany leniwie, zeby testy i build bez env nie wybuchaly przy imporcie. */
export function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || '';
}
