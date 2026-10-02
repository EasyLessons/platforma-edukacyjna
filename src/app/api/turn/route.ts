/**
 * /api/turn - lista ICE (STUN + krotkotrwale poswiadczenia TURN Xirsys) dla voice chatu.
 *
 * Route Handler Next.js: sekret Xirsys nie opuszcza serwera (audyt SEC-05).
 * Kolejnosc bramek jak w /api/chat: rate limit per IP -> token Bearer sprawdzany
 * przez backend (`authenticateChatRequest`, fail-closed) -> Xirsys.
 * Logika: src/_new/server/turn. Przeplyw: docs/architecture/pipelines.md par. 5.
 */
import { NextRequest, NextResponse } from 'next/server';

import { authenticateChatRequest } from '@/_new/server/chat/auth';
import { createRateLimiter, getClientIp } from '@/_new/server/chat/rate-limit';
import { getIceServers } from '@/_new/server/turn/get-ice-servers';

// Odpowiedz zawiera poswiadczenia per zadanie - nigdy nie prerenderuj ani nie cache'uj.
export const dynamic = 'force-dynamic';

// Klient pyta raz na ~20 s (cache w voice-chat/constants.ts), wiec 60/min starcza
// takze dla calej klasy za jednym NAT-em. Stan w pamieci procesu, jak w /api/chat.
const rateLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
  blockDurationMs: 60 * 1000,
});

setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000).unref?.();

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  if (!rateLimiter.check(getClientIp(req.headers))) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429, headers: NO_STORE });
  }

  const auth = await authenticateChatRequest(
    req.headers.get('authorization'),
    fetch,
    req.headers.get('x-request-id')
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }

  // getIceServers nigdy nie rzuca: przy braku konfiguracji/awarii Xirsys oddaje same STUN.
  const { iceServers, source } = await getIceServers();
  return NextResponse.json({ iceServers, source }, { headers: NO_STORE });
}
