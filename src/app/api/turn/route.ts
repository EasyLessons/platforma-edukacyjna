/**
 * /api/turn - lista ICE (STUN + krotkotrwale poswiadczenia TURN Xirsys) dla voice chatu.
 *
 * Route Handler Next.js: sekret Xirsys nie opuszcza serwera (audyt SEC-05).
 * Kolejnosc bramek: naglowek Bearer (brak/zly format -> 401 bez dotykania licznika
 * i backendu) -> token sprawdzany przez backend (`authenticateChatRequest`,
 * fail-closed) -> rate limit per UZYTKOWNIK -> Xirsys.
 *
 * Limit jest liczony PO autoryzacji i per userId, a nie per IP jak w /api/chat:
 * klasa siedzi za jednym NAT-em, wiec licznik per IP pozwalalby niezalogowanemu
 * z tej samej sieci (petla zadan bez tokenu) odciac wszystkim TURN. Zadania
 * nieautoryzowane nie zuzywaja niczyjego limitu i nigdy nie docieraja do Xirsys.
 * Logika: src/_new/server/turn. Przeplyw: docs/architecture/pipelines.md par. 5.
 */
import { NextRequest, NextResponse } from 'next/server';

import { authenticateChatRequest } from '@/_new/server/chat/auth';
import { createRateLimiter, getClientIp } from '@/_new/server/chat/rate-limit';
import { getIceServers } from '@/_new/server/turn/get-ice-servers';

// Odpowiedz zawiera poswiadczenia per zadanie - nigdy nie prerenderuj ani nie cache'uj.
export const dynamic = 'force-dynamic';

// Klient pyta raz na ~20 s (cache w voice-chat/constants.ts), wiec 60/min na
// uzytkownika to duzy zapas. Stan w pamieci procesu, jak w /api/chat.
const rateLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
  blockDurationMs: 60 * 1000,
});

setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000).unref?.();

const NO_STORE = { 'Cache-Control': 'no-store' };

const BEARER_HEADER = /^Bearer\s+\S+$/i;

export async function GET(req: NextRequest) {
  const authorization = req.headers.get('authorization');
  // Bez tokenu nie ma czego sprawdzac: 401 od razu, bez licznika i bez zapytania do backendu.
  if (!authorization || !BEARER_HEADER.test(authorization)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const auth = await authenticateChatRequest(authorization, fetch, req.headers.get('x-request-id'));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }

  // Backend potwierdzil token, ale nie oddal id (nie powinno sie zdarzyc) -> kubelek per IP.
  const rateLimitKey =
    auth.userId !== null ? `user:${auth.userId}` : `ip:${getClientIp(req.headers)}`;
  if (!rateLimiter.check(rateLimitKey)) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429, headers: NO_STORE });
  }

  // getIceServers nigdy nie rzuca: przy braku konfiguracji/awarii Xirsys oddaje same STUN.
  const { iceServers, source } = await getIceServers();
  return NextResponse.json({ iceServers, source }, { headers: NO_STORE });
}
