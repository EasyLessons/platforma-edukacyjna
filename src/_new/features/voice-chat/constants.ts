import { VoiceSettings } from './types';
import { createLogger } from '@/_new/lib/logger';
// Glebokie importy zamiast barrela `@/_new/lib/auth`: ten modul nie potrzebuje
// AuthContext (React), tylko odczytu i odswiezenia tokenu.
import { getAccessToken } from '@/_new/lib/auth/tokenStore';
import { refreshAccessToken } from '@/_new/lib/auth/tokenService';

const log = createLogger('voice-chat/constants');

export const DEFAULT_SETTINGS: VoiceSettings = {
  microphoneVolume: 1,
  speakerVolume: 1,
  pushToTalk: false,
  pushToTalkKey: 'Space',
  noiseSupression: true,
  echoCancellation: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌐 WEBRTC ICE SERVERS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
//
// Poswiadczenia TURN (Xirsys) wydaje SERWER: GET /api/turn z access tokenem
// (src/app/api/turn/route.ts, logika w src/_new/server/turn). Sekret konta
// Xirsys nie moze trafic do bundla przegladarki (audyt SEC-05) - w tym pliku
// nie ma i nie moze byc zadnej zmiennej z sekretem ani wywolania API Xirsys.

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * Lista awaryjna: STUN + publiczny OpenRelay (mniej niezawodny). Uzywana, gdy
 * /api/turn nie oddal serwerow Xirsys (brak tokenu, blad, limit, brak konfiguracji).
 * numb.viagenie.ca usuniety 17.09.2026: domena nie ma juz rekordu DNS, a martwy
 * serwer TURN tylko wydluzal zbieranie kandydatow ICE.
 */
const getFallbackIceServers = (): RTCIceServer[] => [
  ...STUN_SERVERS,
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const TURN_ENDPOINT = '/api/turn';
const TURN_REQUEST_TIMEOUT_MS = 8_000;
/**
 * Dolaczenie do rozmowy tworzy po jednym RTCPeerConnection na uczestnika niemal
 * jednoczesnie - jedno zadanie do /api/turn obsluguje cala te serie. TTL jest
 * wyraznie krotszy niz zywotnosc poswiadczen Xirsys (60 s).
 */
const ICE_CACHE_TTL_MS = 20_000;

let iceCache: { servers: RTCIceServer[]; expiresAt: number } | null = null;
let iceInFlight: Promise<RTCIceServer[] | null> | null = null;

/** Tylko dla testow - czysci cache listy ICE. */
export function resetIceServersCache(): void {
  iceCache = null;
  iceInFlight = null;
}

function isIceServerList(value: unknown): value is RTCIceServer[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((s) => {
      const urls = (s as { urls?: unknown } | null)?.urls;
      return typeof urls === 'string' || Array.isArray(urls);
    })
  );
}

/** Serwery z /api/turn albo null, gdy nie ma z nich pozytku (wtedy lista awaryjna). */
async function fetchTurnIceServers(): Promise<RTCIceServer[] | null> {
  const token = getAccessToken();
  // Bez tokenu serwer i tak odmowi (401) - nie wysylamy zadania.
  if (!token) return null;

  const send = (accessToken: string) =>
    fetch(TURN_ENDPOINT, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(TURN_REQUEST_TIMEOUT_MS),
    });

  let response = await send(token);
  if (response.status === 401) {
    // Access token wygasl w trakcie lekcji - odswiez raz i ponow (jak czat AI).
    response = await send(await refreshAccessToken());
  }
  if (!response.ok) {
    log.warn('/api/turn odpowiedzial statusem', response.status);
    return null;
  }

  // Nie logujemy tresci odpowiedzi - zawiera login/haslo TURN.
  const data: unknown = await response.json();
  const { iceServers, source } = (data ?? {}) as { iceServers?: unknown; source?: unknown };
  if (source !== 'xirsys' || !isIceServerList(iceServers)) return null;
  return iceServers;
}

export const getIceServers = async (): Promise<RTCIceServer[]> => {
  if (iceCache && iceCache.expiresAt > Date.now()) {
    return iceCache.servers;
  }

  try {
    iceInFlight ??= fetchTurnIceServers().finally(() => {
      iceInFlight = null;
    });
    const servers = await iceInFlight;
    if (servers) {
      log.info('✅ Serwery ICE z /api/turn:', servers.length);
      iceCache = { servers, expiresAt: Date.now() + ICE_CACHE_TTL_MS };
      return servers;
    }
  } catch (error) {
    log.error('❌ /api/turn niedostepny:', error instanceof Error ? error.message : 'blad');
  }

  log.info('⚠️ Używam fallback TURN serwerów');
  return getFallbackIceServers();
};

// Tymczasowy sync fallback dla inicjalizacji
export const getBasicIceServers = (): RTCIceServer[] => {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Fallback TURN
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];
};

export const RTC_CONFIG_BASIC: RTCConfiguration = {
  iceServers: getBasicIceServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
};
