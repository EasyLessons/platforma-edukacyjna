/**
 * Poswiadczenia TURN (Xirsys) pobierane PO STRONIE SERWERA Next.js.
 *
 * Dlaczego serwer, a nie przegladarka (audyt SEC-05): poprzednio front wolal
 * Xirsys bezposrednio z `NEXT_PUBLIC_XIRSYS_IDENT/SECRET` w bundlu, czyli sekret
 * konta Xirsys byl publiczny (view-source) i kazdy mogl generowac poswiadczenia
 * TURN na nasz koszt. Teraz sekret zyje tylko w env serwera (`XIRSYS_*`, bez
 * `NEXT_PUBLIC_`), a przegladarka dostaje z `/api/turn` wylacznie krotkotrwale
 * poswiadczenia TURN (username/credential), ktore Xirsys generuje per zadanie.
 *
 * Zasady:
 * - Brak env lub awaria Xirsys => same STUN Google (`source: 'stun'`); nigdy
 *   nie rzucamy i nie przekazujemy szczegolow bledu wolajacemu.
 * - Bez cache po stronie serwera: Xirsys wydaje poswiadczenia wazne domyslnie
 *   60 s, wiec wspoldzielenie ich miedzy zadaniami grozi wydaniem wygaslych.
 *   Zadanie do Xirsys jest takie samo jak dotad z przegladarki (PUT + format urls).
 * - Nie logujemy poswiadczen ani odpowiedzi Xirsys - tylko krotki powod awarii.
 */

export const STUN_FALLBACK_SERVERS: readonly RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const XIRSYS_TIMEOUT_MS = 5_000;
const XIRSYS_API_BASE = 'https://global.xirsys.net/_turn';

export interface IceServersResult {
  iceServers: RTCIceServer[];
  source: 'xirsys' | 'stun';
}

interface XirsysConfig {
  ident: string;
  secret: string;
  channel: string;
}

/**
 * PRZEJSCIOWO: dopoki na Vercelu nie ma `XIRSYS_*`, czytamy stare
 * `NEXT_PUBLIC_XIRSYS_*` - ale tylko tutaj, na serwerze. Nazwa jest skladana
 * dynamicznie, zeby Next nie wstawil wartosci do zadnego bundla (podmienia
 * wylacznie doslowne `process.env.NEXT_PUBLIC_...`). Do usuniecia po rotacji
 * sekretu (docs/security/AUDYT-2026-09.md, SEC-05).
 */
function readXirsysEnv(name: 'IDENT' | 'SECRET' | 'CHANNEL'): string | undefined {
  return process.env[`XIRSYS_${name}`] || process.env[`NEXT_PUBLIC_XIRSYS_${name}`] || undefined;
}

function getXirsysConfig(): XirsysConfig | null {
  const ident = readXirsysEnv('IDENT');
  const secret = readXirsysEnv('SECRET');
  const channel = readXirsysEnv('CHANNEL');
  if (!ident || !secret || !channel) return null;
  return { ident, secret, channel };
}

function isIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== 'object') return false;
  const urls = (value as { urls?: unknown }).urls;
  return (
    typeof urls === 'string' ||
    (Array.isArray(urls) && urls.length > 0 && urls.every((u) => typeof u === 'string'))
  );
}

/**
 * Xirsys (`PUT /_turn/<channel>`, body `{ format: 'urls' }`) odpowiada
 * `{ s: 'ok', v: { iceServers: { username, urls: [...], credential } } }`.
 * Inne warianty (`v.iceServers` jako tablica, `v` jako tablica) obslugujemy
 * tak samo jak poprzedni kod w przegladarce. Z wpisow zostaja tylko pola
 * RTCIceServer - nic ponad to nie trafia do klienta.
 */
export function parseXirsysResponse(body: unknown): RTCIceServer[] {
  if (!body || typeof body !== 'object') return [];
  const { s, v } = body as { s?: unknown; v?: unknown };
  if (s !== 'ok' || !v) return [];

  const candidates: unknown[] = [];
  if (Array.isArray(v)) {
    candidates.push(...v);
  } else if (typeof v === 'object') {
    const ice = (v as { iceServers?: unknown }).iceServers;
    if (Array.isArray(ice)) {
      candidates.push(...ice);
    } else if (ice && typeof ice === 'object') {
      const { urls, username, credential } = ice as {
        urls?: unknown;
        username?: unknown;
        credential?: unknown;
      };
      const urlList = Array.isArray(urls) ? urls : typeof urls === 'string' ? [urls] : [];
      for (const url of urlList) {
        candidates.push({ urls: url, username, credential });
      }
    }
  }

  return candidates.filter(isIceServer).map((srv) => {
    const out: RTCIceServer = { urls: srv.urls };
    if (typeof srv.username === 'string') out.username = srv.username;
    if (typeof srv.credential === 'string') out.credential = srv.credential;
    return out;
  });
}

async function fetchXirsysIceServers(
  config: XirsysConfig,
  fetchImpl: typeof fetch
): Promise<RTCIceServer[]> {
  const auth = Buffer.from(`${config.ident}:${config.secret}`).toString('base64');
  const response = await fetchImpl(`${XIRSYS_API_BASE}/${encodeURIComponent(config.channel)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ format: 'urls' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(XIRSYS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return parseXirsysResponse(await response.json());
}

const stunOnly = (): IceServersResult => ({
  iceServers: [...STUN_FALLBACK_SERVERS],
  source: 'stun',
});

/**
 * Pelna lista ICE: STUN Google + (jesli skonfigurowano i Xirsys odpowiedzial)
 * serwery TURN z krotkotrwalymi poswiadczeniami. Nigdy nie rzuca - kazda
 * awaria konczy sie sama lista STUN (`source: 'stun'`).
 */
export async function getIceServers(fetchImpl: typeof fetch = fetch): Promise<IceServersResult> {
  const config = getXirsysConfig();
  if (!config) return stunOnly();

  try {
    const turnServers = await fetchXirsysIceServers(config, fetchImpl);
    if (turnServers.length === 0) {
      throw new Error('pusta lista serwerow');
    }
    return { iceServers: [...STUN_FALLBACK_SERVERS, ...turnServers], source: 'xirsys' };
  } catch (error) {
    // Tylko nazwa i komunikat bledu - bez obiektu odpowiedzi i bez naglowkow.
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'nieznany blad';
    console.warn(`[turn] Xirsys niedostepny, zwracam same STUN (${reason})`);
    return stunOnly();
  }
}
