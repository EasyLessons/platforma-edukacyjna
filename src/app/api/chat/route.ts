/**
 * /api/chat - asystent matematyczny (Gemini). Route Handler Next.js, nie FastAPI.
 *
 * Ten plik tylko sklada kolejnosc bramek; logika zyje w src/_new/server/chat:
 * rate-limit.ts (limit per IP), auth.ts (token -> backend /auth/me),
 * response-cache.ts (cache odpowiedzi), prompt.ts, gemini.ts (model + fallback).
 * Przeplyw: docs/architecture/pipelines.md par. 4.
 */
import { NextRequest, NextResponse } from 'next/server';

import { authenticateChatRequest } from '@/_new/server/chat/auth';
import { CHAT_CONFIG } from '@/_new/server/chat/config';
import { askTutor } from '@/_new/server/chat/gemini';
import { buildChatPrompt } from '@/_new/server/chat/prompt';
import { createRateLimiter, getClientIp } from '@/_new/server/chat/rate-limit';
import { createResponseCache } from '@/_new/server/chat/response-cache';

// Stan w pamieci procesu (jedna instancja serwera) - ograniczenie opisane w pipelines.md.
const rateLimiter = createRateLimiter({
  maxRequests: CHAT_CONFIG.RATE_LIMIT_REQUESTS,
  windowMs: CHAT_CONFIG.RATE_LIMIT_WINDOW_MS,
  blockDurationMs: CHAT_CONFIG.BLOCK_DURATION_MS,
});
const responseCache = createResponseCache(CHAT_CONFIG.CACHE_TTL_MS);

setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
setInterval(() => responseCache.cleanup(), 15 * 60 * 1000);

const reply = (response: string, error: string, status: number) =>
  NextResponse.json({ response, error }, { status });

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1) Rate limit po IP - PRZED tokenem, zeby spam bez tokenu nie obciazal backendu.
    if (!rateLimiter.check(getClientIp(req.headers))) {
      return reply('⏳ Za dużo pytań! Poczekaj chwilę i spróbuj ponownie.', 'rate_limit', 429);
    }

    // 2) Uwierzytelnienie - przed body i przed cache (endpoint wola platne Gemini).
    const auth = await authenticateChatRequest(
      req.headers.get('authorization'),
      fetch,
      req.headers.get('x-request-id')
    );
    if (!auth.ok) {
      return reply(
        auth.error === 'unauthorized'
          ? 'Zaloguj się, aby korzystać z asystenta AI. 🔐'
          : 'Asystent AI jest chwilowo niedostępny. Spróbuj ponownie za chwilę.',
        auth.error,
        auth.status
      );
    }

    // 3) Walidacja body
    const { message, context } = await req.json();
    if (!message || typeof message !== 'string') {
      return reply('Proszę wpisz pytanie! 📝', 'invalid_message', 400);
    }
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < CHAT_CONFIG.MIN_MESSAGE_LENGTH) {
      return reply('Pytanie jest za krótkie! Napisz więcej 😊', 'too_short', 400);
    }
    if (trimmedMessage.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
      return reply('Pytanie jest za długie! Maksymalnie 1000 znaków.', 'too_long', 400);
    }

    // 4) Cache
    const cachedResponse = responseCache.get(trimmedMessage);
    if (cachedResponse) {
      return NextResponse.json({
        response: cachedResponse,
        cached: true,
        responseTime: Date.now() - startTime,
      });
    }

    // 5) Gemini (glowny model -> lite -> odpowiedz awaryjna)
    const answer = await askTutor(buildChatPrompt(trimmedMessage, context));
    responseCache.set(trimmedMessage, answer.text);

    if (answer.kind === 'fallback') {
      return NextResponse.json({
        response: answer.text,
        cached: false,
        apiUsed: false,
        fallback: true,
        model: 'none',
        responseTime: Date.now() - startTime,
      });
    }
    return NextResponse.json({
      response: answer.text,
      cached: false,
      apiUsed: true,
      model: answer.model,
      responseTime: Date.now() - startTime,
    });
  } catch (error) {
    console.error('❌ Chat API Error:', error);
    const message = (error as { message?: string } | null)?.message ?? '';

    if (message.includes('API_KEY')) {
      return reply(
        'Błąd konfiguracji API. Skontaktuj się z administratorem.',
        'api_key_error',
        500
      );
    }
    if (message.includes('quota') || message.includes('limit')) {
      return reply('Przekroczono limit API. Spróbuj ponownie za chwilę.', 'quota_exceeded', 429);
    }
    return reply('Ups, coś poszło nie tak! 😅 Spróbuj ponownie.', 'internal_error', 500);
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Math Tutor AI',
    model: CHAT_CONFIG.GEMINI_MODEL,
    fallbackModel: CHAT_CONFIG.GEMINI_MODEL_FALLBACK,
    cacheSize: responseCache.size,
    activeUsers: rateLimiter.size,
  });
}
