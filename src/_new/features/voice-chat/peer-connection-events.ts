/**
 * Handlery zdarzen RTCPeerConnection (ICE, stan polaczenia) i konfiguracja RTC.
 * Wydzielone z useWebRTCConnections.createPeerConnection - logika i logi 1:1,
 * zaleznosci przez callbacki, zero Reacta.
 */
import { getIceServers } from './constants';

export const MAX_CONNECTION_RETRIES = 3;
export const CONNECTION_TIMEOUT_MS = 10000;

/** Konfiguracja RTC: STUN/TURN (w tym Xirsys) + w developmencie wymuszony relay do testow TURN. */
export async function buildRtcConfiguration(): Promise<RTCConfiguration> {
  const iceServers = await getIceServers();
  const forceRelay = process.env.NODE_ENV === 'development';
  if (forceRelay) {
    console.log(`🎤 [VOICE] 🚨 DEBUGGING: Wymuszam TURN relay (testowanie)`);
  }
  console.log(
    `🎤 [VOICE] ICE Servers:`,
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
        console.log(`🎤 [VOICE] 🧊✅ RELAY candidate (TURN działa!): ${protocol}`);
      } else {
        console.log(`🎤 [VOICE] 🧊 ICE candidate: ${candidateType} (${protocol})`);
      }
      ctx.sendIceCandidate(event.candidate.toJSON());
    } else {
      console.log(`🎤 [VOICE] 🧊 ICE gathering complete`);
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`🎤 [VOICE] 🧊 ICE state z ${remoteUsername}: ${pc.iceConnectionState}`);

    if (pc.iceConnectionState === 'connected') {
      console.log(`🎤 [VOICE] ✅ Połączenie P2P nawiązane z ${remoteUsername}!`);
    } else if (pc.iceConnectionState === 'failed') {
      // Restart ICE = nowa oferta z iceRestart:true na tym samym pc (samo
      // pc.restartIce() nigdy nie wysylalo oferty - patrz #49).
      console.log(`🎤 [VOICE] ❌ ICE failed z ${remoteUsername} - restart ICE`);
      ctx.restartIce();
    } else if (pc.iceConnectionState === 'disconnected') {
      console.log(`🎤 [VOICE] ⚠️ ICE disconnected z ${remoteUsername} - czekam na reconnect...`);
      // Chwila na samoistny powrot (consent freshness), potem restart ICE.
      setTimeout(() => {
        if (pc.iceConnectionState === 'disconnected') {
          console.log(`🎤 [VOICE] ICE nadal disconnected - restart ICE`);
          ctx.restartIce();
        }
      }, 5000);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`🎤 [VOICE] 📡 Connection state z ${remoteUsername}: ${pc.connectionState}`);

    if (pc.connectionState === 'connected') {
      ctx.onConnected();
      console.log(`🎤 [VOICE] ✅ Połączenie z ${remoteUsername} nawiązane pomyślnie!`);
    } else if (pc.connectionState === 'failed') {
      console.log(`🎤 [VOICE] ❌ Połączenie z ${remoteUsername} nieudane`);
      ctx.onFailed();
    } else if (pc.connectionState === 'disconnected') {
      console.log(`🎤 [VOICE] ⚠️ Połączenie z ${remoteUsername} rozłączone`);
      // 2 s na samoistny powrot, potem restart ICE na tym samym pc.
      setTimeout(() => {
        if (ctx.isStillActive() && pc.connectionState === 'disconnected') {
          console.log(`🎤 [VOICE] 🔁 Nadal rozłączone z ${remoteUsername} - restart ICE`);
          ctx.restartIce();
        }
      }, 2000);
    }
  };
}
