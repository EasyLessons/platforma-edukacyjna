/**
 * Watchdog polaczen P2P (co 10 s) uruchamiany po dolaczeniu do rozmowy:
 * - brak polaczen -> voice-request-sync,
 * - `disconnected` -> restart ICE na tym samym pc (tania sciezka),
 * - `failed`/`closed` -> zamkniecie i odtworzenie od zera jako inicjator.
 * Wydzielone z VoiceChatContext.joinVoiceChat, logika i logi 1:1.
 */
import type { MutableRefObject } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PeerConnection } from './types';
import { closePeerConnection } from './remote-audio';

export const WATCHDOG_INTERVAL_MS = 10000;

interface Deps {
  userId: number;
  isInVoiceChatRef: MutableRefObject<boolean>;
  channelRef: MutableRefObject<RealtimeChannel | null>;
  peerConnectionsRef: MutableRefObject<Map<number, PeerConnection>>;
  connectionRetriesRef: MutableRefObject<Map<number, number>>;
  restartIceConnection: (remoteUserId: number, remoteUsername: string) => Promise<boolean>;
  createPeerConnection: (
    remoteUserId: number,
    remoteUsername: string,
    isInitiator: boolean
  ) => Promise<void>;
}

/** Startuje interwal; zwraca jego uchwyt (do clearInterval przy wyjsciu). */
export function startConnectionWatchdog(deps: Deps): ReturnType<typeof setInterval> {
  const {
    userId,
    isInVoiceChatRef,
    channelRef,
    peerConnectionsRef,
    connectionRetriesRef,
    restartIceConnection,
    createPeerConnection,
  } = deps;

  const interval = setInterval(() => {
    if (!isInVoiceChatRef.current) {
      clearInterval(interval);
      return;
    }

    console.log('🎤 [VOICE] 🔍 Weryfikacja połączeń P2P...');

    if (peerConnectionsRef.current.size === 0) {
      console.log('🎤 [VOICE] ⚠️ Brak aktywnych połączeń - próbuję sync');
      channelRef.current?.send({
        type: 'broadcast',
        event: 'voice-request-sync',
        payload: { type: 'voice-request-sync', userId },
      });
      return;
    }

    peerConnectionsRef.current.forEach((peerConn, odUserId) => {
      const state = peerConn.pc.connectionState;
      if (state === 'disconnected') {
        console.log(`🎤 [VOICE] 🔍 Połączenie z ${peerConn.username} rozłączone - restart ICE`);
        void restartIceConnection(odUserId, peerConn.username);
      } else if (state === 'failed' || state === 'closed') {
        console.log(
          `🎤 [VOICE] 🔍 Połączenie z ${peerConn.username} w złym stanie (${state}) - restartuję`
        );
        closePeerConnection(peerConn);
        peerConnectionsRef.current.delete(odUserId);
        connectionRetriesRef.current.delete(odUserId);
        setTimeout(() => {
          createPeerConnection(odUserId, peerConn.username, true);
        }, 500);
      } else {
        console.log(`🎤 [VOICE] ✅ Połączenie z ${peerConn.username} OK (${state})`);
      }
    });
  }, WATCHDOG_INTERVAL_MS);

  return interval;
}
