/**
 * Handlery zdarzen RTCPeerConnection (ICE, stan polaczenia) i konfiguracja RTC.
 * Wydzielone z useWebRTCConnections.createPeerConnection - logika i logi 1:1,
 * zaleznosci przez callbacki, zero Reacta.
 */
import { getIceServers } from './constants';
import { createLogger } from '@/_new/lib/logger';

const log = createLogger('voice-chat/peer-connection-events');

export const MAX_CONNECTION_RETRIES = 3;
export const CONNECTION_TIMEOUT_MS = 10000;

/** Konfiguracja RTC: STUN/TURN (w tym Xirsys) + w developmencie wymuszony relay do testow TURN. */
export async function buildRtcConfiguration(): Promise<RTCConfiguration> {
  const iceServers = await getIceServers();
  const forceRelay = process.env.NODE_ENV === 'development';
  if (forceRelay) {
    log.info(`🚨 DEBUGGING: Wymuszam TURN relay (testowanie)`);
  }
  log.info(
    `ICE Servers:`,
    iceServers.map((s) => s.urls)
  );
  return {
    iceServers,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: forceRelay ? 'relay' : 'all',
  };
}

export interface PeerEventContext {
  remoteUserId: number;
  remoteUsername: string;
  /** Wysyla kandydata ICE do peera przez kanal sygnalizacji. */
  sendIceCandidate: (candidate: RTCIceCandidateInit) => void;
  /** Restart ICE na tym samym pc (nowa oferta z iceRestart). */
  restartIce: () => void;
  /** Polaczenie nawiazane: sprzatanie pending/retry/timeout. */
  onConnected: () => void;
  /** Polaczenie padlo: cleanup + ewentualny retry od zera (decyzja u wolajacego). */
  onFailed: () => void;
  /** Czy to pc wciaz jest aktualnym polaczeniem tego usera i rozmowa trwa. */
  isStillActive: () => boolean;
}

/** Podpina onicecandidate / oniceconnectionstatechange / onconnectionstatechange. */
export function attachPeerConnectionEvents(pc: RTCPeerConnection, ctx: PeerEventContext): void {
  const { remoteUsername } = ctx;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateType = event.candidate.type; // host, srflx, relay
      const protocol = event.candidate.protocol;
      if (candidateType === 'relay') {
        log.debug(`🧊✅ RELAY candidate (TURN działa!): ${protocol}`);
      } else {
        log.debug(`🧊 ICE candidate: ${candidateType} (${protocol})`);
      }
      ctx.sendIceCandidate(event.candidate.toJSON());
    } else {
      log.debug(`🧊 ICE gathering complete`);
    }
  };

  pc.oniceconnectionstatechange = () => {
    log.debug(`🧊 ICE state z ${remoteUsername}: ${pc.iceConnectionState}`);

    if (pc.iceConnectionState === 'connected') {
      log.info(`✅ Połączenie P2P nawiązane z ${remoteUsername}!`);
    } else if (pc.iceConnectionState === 'failed') {
      // Restart ICE = nowa oferta z iceRestart:true na tym samym pc (samo
      // pc.restartIce() nigdy nie wysylalo oferty - patrz #49).
      log.info(`❌ ICE failed z ${remoteUsername} - restart ICE`);
      ctx.restartIce();
    } else if (pc.iceConnectionState === 'disconnected') {
      log.info(`⚠️ ICE disconnected z ${remoteUsername} - czekam na reconnect...`);
      // Chwila na samoistny powrot (consent freshness), potem restart ICE.
      setTimeout(() => {
        if (pc.iceConnectionState === 'disconnected') {
          log.info(`ICE nadal disconnected - restart ICE`);
          ctx.restartIce();
        }
      }, 5000);
    }
  };

  pc.onconnectionstatechange = () => {
    log.debug(`📡 Connection state z ${remoteUsername}: ${pc.connectionState}`);

    if (pc.connectionState === 'connected') {
      ctx.onConnected();
      log.info(`✅ Połączenie z ${remoteUsername} nawiązane pomyślnie!`);
    } else if (pc.connectionState === 'failed') {
      log.info(`❌ Połączenie z ${remoteUsername} nieudane`);
      ctx.onFailed();
    } else if (pc.connectionState === 'disconnected') {
      log.info(`⚠️ Połączenie z ${remoteUsername} rozłączone`);
      // 2 s na samoistny powrot, potem restart ICE na tym samym pc.
      setTimeout(() => {
        if (ctx.isStillActive() && pc.connectionState === 'disconnected') {
          log.info(`🔁 Nadal rozłączone z ${remoteUsername} - restart ICE`);
          ctx.restartIce();
        }
      }, 2000);
    }
  };
}
