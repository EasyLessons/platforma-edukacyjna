/**
 * Zarzadzanie polaczeniami P2P (RTCPeerConnection per user): tworzenie, retry,
 * restart ICE, obsluga offer/answer, sprzatanie. Zdarzenia pc (ICE, stany) sa w
 * peer-connection-events.ts, kolejka kandydatow w ice-candidate-queue.ts,
 * elementy <audio> w remote-audio.ts. Zachowanie 1:1 z wersja monolityczna.
 */
import { useCallback, useRef, MutableRefObject } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PeerConnection, VoiceParticipant, VoiceSettings } from './types';
import { isRenegotiationOfSameSession, restartIceOnConnection } from './iceRestart';
import { addOrQueueIceCandidate, createIceCandidateQueue } from './ice-candidate-queue';
import { attachRemoteAudio, closePeerConnection, replaceAudioElement } from './remote-audio';
import {
  CONNECTION_TIMEOUT_MS,
  MAX_CONNECTION_RETRIES,
  attachPeerConnectionEvents,
  buildRtcConfiguration,
} from './peer-connection-events';
import { createLogger } from '@/_new/lib/logger';

const log = createLogger('voice-chat/useWebRTCConnections');

export function useWebRTCConnections(
  user: { id: number; username: string } | null,
  settings: VoiceSettings,
  localStreamRef: MutableRefObject<MediaStream | null>,
  channelRef: MutableRefObject<RealtimeChannel | null>,
  isInVoiceChatRef: MutableRefObject<boolean>,
  setParticipants: React.Dispatch<React.SetStateAction<VoiceParticipant[]>>,
  onAudioBlocked?: () => void
) {
  const peerConnectionsRef = useRef<Map<number, PeerConnection>>(new Map());
  const pendingConnectionsRef = useRef<Set<number>>(new Set());
  const connectionRetriesRef = useRef<Map<number, number>>(new Map());
  const connectionTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const lastSyncTimeRef = useRef<Map<string | number, number>>(new Map());
  // Trwajace budowanie polaczenia per user - handleOffer czeka na nie zamiast
  // porzucac offer (patrz komentarz w handleOffer).
  const creationsRef = useRef<Map<number, Promise<void>>>(new Map());
  // Kandydaci ICE, ktorzy przyszli, zanim polaczenie mialo remoteDescription.
  const iceQueueRef = useRef(createIceCandidateQueue());

  const cleanupUserConnections = useCallback(
    (userId: number) => {
      log.info(`🧹 Czyszczę wszystkie połączenia dla user ${userId}`);

      pendingConnectionsRef.current.delete(userId);
      connectionRetriesRef.current.delete(userId);

      const timeout = connectionTimeoutsRef.current.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        connectionTimeoutsRef.current.delete(userId);
      }

      const peerConn = peerConnectionsRef.current.get(userId);
      if (peerConn) {
        closePeerConnection(peerConn);
        peerConnectionsRef.current.delete(userId);
      }

      setParticipants((prev) => prev.filter((p) => p.odUserId !== userId));
      lastSyncTimeRef.current.delete(userId);
    },
    [setParticipants]
  );

  const sendToPeer = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      channelRef.current?.send({ type: 'broadcast', event, payload: { type: event, ...payload } });
    },
    [channelRef]
  );

  /** Restart ICE na istniejacym pc (logika w iceRestart.ts); tylko w trakcie rozmowy. */
  const restartIceConnection = useCallback(
    async (remoteUserId: number, remoteUsername: string): Promise<boolean> => {
      if (!user || !isInVoiceChatRef.current) return false;
      const peerConn = peerConnectionsRef.current.get(remoteUserId);
      if (!peerConn) return false;
      return restartIceOnConnection({
        user,
        remoteUserId,
        remoteUsername,
        pc: peerConn.pc,
        sendOffer: (offer) =>
          sendToPeer('voice-offer', {
            fromUserId: user.id,
            fromUsername: user.username,
            toUserId: remoteUserId,
            offer,
          }),
      });
    },
    [user, isInVoiceChatRef, sendToPeer]
  );

  const createPeerConnection = useCallback(
    async (remoteUserId: number, remoteUsername: string, isInitiator: boolean) => {
      if (!user || !localStreamRef.current) return;

      if (peerConnectionsRef.current.has(remoteUserId)) {
        log.info(`⚠️ Połączenie z ${remoteUsername} już istnieje`);
        return;
      }
      if (pendingConnectionsRef.current.has(remoteUserId)) {
        log.info(`⚠️ Połączenie z ${remoteUsername} jest w trakcie`);
        return;
      }
      const retries = connectionRetriesRef.current.get(remoteUserId) || 0;
      if (retries >= MAX_CONNECTION_RETRIES) {
        log.info(`❌ Zbyt dużo prób połączenia z ${remoteUsername} (${retries})`);
        return;
      }

      pendingConnectionsRef.current.add(remoteUserId);
      connectionRetriesRef.current.set(remoteUserId, retries + 1);

      let finishCreation!: () => void;
      creationsRef.current.set(
        remoteUserId,
        new Promise<void>((resolve) => (finishCreation = resolve))
      );

      try {
        log.info(
          `Tworzę połączenie z ${remoteUsername} (initiator: ${isInitiator}, próba: ${retries + 1})`
        );

        // Timeout proby polaczenia -> cleanup + ponowna proba (do limitu)
        const connectionTimeout = setTimeout(() => {
          log.info(`⏰ Timeout połączenia z ${remoteUsername}`);
          cleanupUserConnections(remoteUserId);
          if (retries + 1 < MAX_CONNECTION_RETRIES) {
            setTimeout(() => {
              log.info(`🔁 Ponawiam połączenie z ${remoteUsername}`);
              createPeerConnection(remoteUserId, remoteUsername, isInitiator);
            }, 2000);
          }
        }, CONNECTION_TIMEOUT_MS);
        connectionTimeoutsRef.current.set(remoteUserId, connectionTimeout);

        const pc = new RTCPeerConnection(await buildRtcConfiguration());

        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });

        pc.ontrack = (event) => {
          const audio = attachRemoteAudio({
            stream: event.streams[0],
            volume: settings.speakerVolume,
            localStreamId: localStreamRef.current?.id ?? null,
            remoteUsername,
            onAudioBlocked,
          });
          if (!audio) return;
          const existing = peerConnectionsRef.current.get(remoteUserId);
          if (existing) replaceAudioElement(existing, audio);
        };

        attachPeerConnectionEvents(pc, {
          remoteUserId,
          remoteUsername,
          sendIceCandidate: (candidate) =>
            sendToPeer('voice-ice', { fromUserId: user.id, toUserId: remoteUserId, candidate }),
          restartIce: () => void restartIceConnection(remoteUserId, remoteUsername),
          onConnected: () => {
            pendingConnectionsRef.current.delete(remoteUserId);
            connectionRetriesRef.current.delete(remoteUserId);
            const timeout = connectionTimeoutsRef.current.get(remoteUserId);
            if (timeout) {
              clearTimeout(timeout);
              connectionTimeoutsRef.current.delete(remoteUserId);
            }
          },
          onFailed: () => {
            const failedRetries = connectionRetriesRef.current.get(remoteUserId) || 0;
            cleanupUserConnections(remoteUserId);
            if (failedRetries < MAX_CONNECTION_RETRIES) {
              log.info(`🔁 Auto-retry połączenia z ${remoteUsername} (próba ${failedRetries + 1})`);
              setTimeout(
                () => {
                  createPeerConnection(remoteUserId, remoteUsername, isInitiator);
                },
                1000 * failedRetries + 1000
              ); // Exponential backoff
            }
          },
          isStillActive: () =>
            isInVoiceChatRef.current && peerConnectionsRef.current.get(remoteUserId)?.pc === pc,
        });

        peerConnectionsRef.current.set(remoteUserId, {
          odUserId: remoteUserId,
          username: remoteUsername,
          pc,
        });

        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendToPeer('voice-offer', {
            fromUserId: user.id,
            fromUsername: user.username,
            toUserId: remoteUserId,
            offer: pc.localDescription,
          });
        }
      } finally {
        creationsRef.current.delete(remoteUserId);
        finishCreation();
      }
    },
    [
      user,
      settings.speakerVolume,
      cleanupUserConnections,
      restartIceConnection,
      sendToPeer,
      localStreamRef,
      isInVoiceChatRef,
      onAudioBlocked,
    ]
  );

  /** Kandydat ICE od drugiej strony - do pc albo do kolejki (patrz ice-candidate-queue). */
  const addRemoteIceCandidate = useCallback(
    (fromUserId: number, candidate: RTCIceCandidateInit) =>
      addOrQueueIceCandidate(
        iceQueueRef.current,
        fromUserId,
        peerConnectionsRef.current.get(fromUserId)?.pc,
        candidate
      ),
    []
  );

  const applyRemoteAnswer = useCallback(
    async (fromUserId: number, answer: RTCSessionDescriptionInit) => {
      const pc = peerConnectionsRef.current.get(fromUserId)?.pc;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(answer);
        await iceQueueRef.current.flush(fromUserId, pc);
      } catch (error) {
        log.error('❌ Błąd ustawiania answer:', error);
      }
    },
    []
  );

  const clearPendingIce = useCallback((userId?: number) => {
    iceQueueRef.current.clear(userId);
  }, []);

  /** Ustawia oferte na pc i odsyla answer (wspolne dla nowego pc i restartu ICE). */
  const answerOffer = useCallback(
    async (pc: RTCPeerConnection, fromUserId: number, offer: RTCSessionDescriptionInit) => {
      if (!user) return;
      await pc.setRemoteDescription(offer);
      await iceQueueRef.current.flush(fromUserId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendToPeer('voice-answer', {
        fromUserId: user.id,
        toUserId: fromUserId,
        answer: pc.localDescription,
      });
    },
    [user, sendToPeer]
  );

  const handleOffer = useCallback(
    async (fromUserId: number, fromUsername: string, offer: RTCSessionDescriptionInit) => {
      if (!user || !localStreamRef.current) return;

      log.info(`📬 Obsługuję offer od ${fromUsername}`);

      // Jesli polaczenie z ta osoba jest wlasnie budowane (np. po voice-sync),
      // poczekaj na nie - inaczej offer bylby porzucany bez odpowiedzi.
      const inFlight = creationsRef.current.get(fromUserId);
      if (inFlight) await inFlight;

      const existing = peerConnectionsRef.current.get(fromUserId);
      if (existing) {
        const { pc: existingPc } = existing;
        const isFreshResponder =
          existingPc.signalingState === 'stable' &&
          !existingPc.remoteDescription &&
          !existingPc.localDescription;

        // Restart ICE od peera: ta sama sesja (ten sam fingerprint DTLS), nowa
        // oferta. Negocjujemy NA ISTNIEJACYM pc - bez zamykania, bez nowego <audio>.
        const isIceRestart =
          existingPc.signalingState === 'stable' &&
          !!existingPc.remoteDescription &&
          isRenegotiationOfSameSession(existingPc.remoteDescription.sdp, offer.sdp);

        if (isIceRestart) {
          log.info(`🔁 Oferta restartu ICE od ${fromUsername} - renegocjuję w miejscu`);
          try {
            await answerOffer(existingPc, fromUserId, offer);
          } catch (error) {
            log.error(`❌ Renegocjacja z ${fromUsername} nieudana:`, error);
            cleanupUserConnections(fromUserId);
          }
          return;
        }

        if (existingPc.signalingState === 'have-local-offer') {
          // Kolizja ofert (glare): obie strony wyslaly offer jednoczesnie.
          // Rozstrzygniecie deterministyczne - ustepuje strona z nizszym id.
          const weYield = user.id < fromUserId;
          if (!weYield) {
            log.warn(`↔️ Kolizja ofert z ${fromUsername} - zostaję przy swojej`);
            return;
          }
          log.warn(`↔️ Kolizja ofert z ${fromUsername} - ustępuję`);
          cleanupUserConnections(fromUserId);
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else if (!isFreshResponder) {
          log.info(`⚠️ Czyszczę istniejące połączenie z ${fromUsername} przed nowym offer`);
          cleanupUserConnections(fromUserId);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        // Swiezy responder (bez opisow) po prostu dostaje ten offer.
      }

      if (!peerConnectionsRef.current.has(fromUserId)) {
        await createPeerConnection(fromUserId, fromUsername, false);
        const stillBuilding = creationsRef.current.get(fromUserId);
        if (stillBuilding) await stillBuilding;
      }

      const peerConn = peerConnectionsRef.current.get(fromUserId);
      if (!peerConn) {
        log.error(`❌ Nie udało się utworzyć połączenia dla ${fromUsername}`);
        return;
      }

      try {
        await answerOffer(peerConn.pc, fromUserId, offer);
        log.info(`✅ Wysłano answer do ${fromUsername}`);
      } catch (error) {
        log.error(`❌ Błąd podczas obsługi offer od ${fromUsername}:`, error);
        cleanupUserConnections(fromUserId);
      }
    },
    [user, createPeerConnection, cleanupUserConnections, localStreamRef, answerOffer]
  );

  /** Ponawia odtwarzanie zablokowanego audio - wolac z obslugi klikniecia. */
  const resumeRemoteAudio = useCallback(async (): Promise<boolean> => {
    let allPlaying = true;
    for (const { audioElement } of peerConnectionsRef.current.values()) {
      if (!audioElement) continue;
      try {
        await audioElement.play();
      } catch {
        allPlaying = false;
      }
    }
    return allPlaying;
  }, []);

  return {
    peerConnectionsRef,
    pendingConnectionsRef,
    connectionRetriesRef,
    connectionTimeoutsRef,
    lastSyncTimeRef,
    cleanupUserConnections,
    createPeerConnection,
    restartIceConnection,
    handleOffer,
    addRemoteIceCandidate,
    applyRemoteAnswer,
    clearPendingIce,
    resumeRemoteAudio,
  };
}
