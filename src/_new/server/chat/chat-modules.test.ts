// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createRateLimiter, getClientIp } from './rate-limit';
import { createResponseCache } from './response-cache';
import { isQuotaError } from './gemini';
import { buildChatPrompt } from './prompt';

describe('createRateLimiter', () => {
  const make = () => createRateLimiter({ maxRequests: 3, windowMs: 1000, blockDurationMs: 5000 });

  it('przepuszcza do limitu, potem blokuje', () => {
    const rl = make();
    expect(rl.check('ip', 0)).toBe(true);
    expect(rl.check('ip', 10)).toBe(true);
    expect(rl.check('ip', 20)).toBe(true);
    expect(rl.check('ip', 30)).toBe(false);
  });

  it('blokada trwa blockDurationMs, nawet gdy okno juz minelo', () => {
    const rl = make();
    for (let i = 0; i < 4; i++) rl.check('ip', i);
    expect(rl.check('ip', 2000)).toBe(false); // okno minelo, ale blokada do 5003
    expect(rl.check('ip', 5100)).toBe(true);
  });

  it('okno przesuwne: stare zadania wypadaja z limitu', () => {
    const rl = make();
    rl.check('ip', 0);
    rl.check('ip', 0);
    rl.check('ip', 0);
    expect(rl.check('ip', 1500)).toBe(true);
  });

  it('liczy per IP', () => {
    const rl = make();
    for (let i = 0; i < 3; i++) rl.check('a', 0);
    expect(rl.check('a', 1)).toBe(false);
    expect(rl.check('b', 1)).toBe(true);
    expect(rl.size).toBe(2);
  });

  it('cleanup usuwa wpisy bez aktywnych zadan i bez blokady', () => {
    const rl = make();
    rl.check('idle', 0);
    for (let i = 0; i < 4; i++) rl.check('blocked', 0);
    rl.cleanup(3000);
    expect(rl.size).toBe(1); // 'blocked' zostaje (blokada do 5000)
    rl.cleanup(6000);
    expect(rl.size).toBe(0);
  });

  it('getClientIp: pierwszy z X-Forwarded-For, potem X-Real-IP, potem unknown', () => {
    const h = (map: Record<string, string>) => ({ get: (n: string) => map[n] ?? null });
    expect(getClientIp(h({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1');
    expect(getClientIp(h({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(getClientIp(h({}))).toBe('unknown');
  });
});

describe('createResponseCache', () => {
  it('zwraca odpowiedz w TTL, ignoruje wielkosc liter i spacje', () => {
    const cache = createResponseCache(1000);
    cache.set('  Jak Liczyc Pochodne? ', 'odp', 0);
    expect(cache.get('jak liczyc pochodne?', 500)).toBe('odp');
    expect(cache.size).toBe(1);
  });

  it('po TTL zwraca null i usuwa wpis', () => {
    const cache = createResponseCache(1000);
    cache.set('q', 'odp', 0);
    expect(cache.get('q', 1000)).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('cleanup usuwa tylko przeterminowane', () => {
    const cache = createResponseCache(1000);
    cache.set('stare', 'a', 0);
    cache.set('nowe', 'b', 900);
    cache.cleanup(1500);
    expect(cache.get('stare', 1500)).toBeNull();
    expect(cache.get('nowe', 1500)).toBe('b');
  });
});

describe('gemini helpers', () => {
  it('isQuotaError rozpoznaje limity Gemini po tresci bledu', () => {
    expect(isQuotaError(new Error('429 Resource has been exhausted'))).toBe(true);
    expect(isQuotaError(new Error('quota exceeded'))).toBe(true);
    expect(isQuotaError(new Error('API_KEY invalid'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });

  it('buildChatPrompt dokleja kontekst tablicy tylko gdy jest', () => {
    const withCtx = buildChatPrompt('pytanie', 'x = 2');
    const noCtx = buildChatPrompt('pytanie');
    expect(withCtx).toContain('KONTEKST TABLICY');
    expect(withCtx).toContain('x = 2');
    expect(noCtx).not.toContain('KONTEKST TABLICY');
    expect(noCtx.endsWith('pytanie')).toBe(true);
    vi.restoreAllMocks();
  });
});
