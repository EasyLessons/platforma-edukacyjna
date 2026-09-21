import { useCallback, useRef, MutableRefObject } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PeerConnection, VoiceParticipant, VoiceSettings } from './types';
import { getIceServers } from './constants';

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
  const pendingIceRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());

  const MAX_CONNECTION_RETRIES = 3;
  const CONNECTION_TIMEOUT = 10000; // 10 sekund
  const MAX_QUEUED_ICE = 50;

  const cleanupUserConnections = useCallback(
    (userId: number) => {
      console.log(`🎤 [VOICE] 🧹 Czyszczę wszystkie połączenia dla user ${userId}`);

      // Usuń z pending
      pendingConnectionsRef.current.delete(userId);

      // Clear retry attempts
      connectionRetriesRef.current.delete(userId);

      // Clear timeouts
      const timeout = connectionTimeoutsRef.current.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        connectionTimeoutsRef.current.delete(userId);
      }

      // Zamknij połączenie P2P
      const peerConn = peerConnectionsRef.current.get(userId);
      if (peerConn) {
        if (peerConn.audioElement) {
          peerConn.audioElement.pause();
          peerConn.audioElement.srcObject = null;
        }
        peerConn.pc.close();
        peerConnectionsRef.current.delete(userId);
      }

      // Usuń z listy uczestników
      setParticipants((prev) => prev.filter((p) => p.odUserId !== userId));

      // Wyczyść czas ostatniego sync
      lastSyncTimeRef.current.delete(userId);
    },
    [setParticipants]
  );

  const createPeerConnection = useCallback(
    async (remoteUserId: number, remoteUsername: string, isInitiator: boolean) => {
      if (!user || !localStreamRef.current) return;

      // Sprawdź czy już nie ma połączenia
      if (peerConnectionsRef.current.has(remoteUserId)) {
        console.log(`🎤 [VOICE] ⚠️ Połączenie z ${remoteUsername} już istnieje`);
        return;
      }

      // Sprawdź czy nie jest już w pending
      if (pendingConnectionsRef.current.has(remoteUserId)) {
        console.log(`🎤 [VOICE] ⚠️ Połączenie z ${remoteUsername} jest w trakcie`);
        return;
      }

      // Sprawdź retry count
      const retries = connectionRetriesRef.current.get(remoteUserId) || 0;
      if (retries >= MAX_CONNECTION_RETRIES) {
        console.log(`🎤 [VOICE] ❌ Zbyt dużo prób połączenia z ${remoteUsername} (${retries})`);
        return;
      }

      // Dodaj do pending
      pendingConnectionsRef.current.add(remoteUserId);
      connectionRetriesRef.current.set(remoteUserId, retries + 1);

      let finishCreation!: () => void;
      creationsRef.current.set(
        remoteUserId,
        new Promise<void>((resolve) => (finishCreation = resolve))
      );

      try {
        console.log(
          `🎤 [VOICE] Tworzę połączenie z ${remoteUsername} (initiator: ${isInitiator}, próba: ${retries + 1})`
        );

        // Set timeout for connection attempt
        const connectionTimeout = setTimeout(() => {
          console.log(`🎤 [VOICE] ⏰ Timeout połączenia z ${remoteUsername}`);
          cleanupUserConnections(remoteUserId);

          // Retry after delay if under limit
          if (retries + 1 < MAX_CONNECTION_RETRIES) {
            setTimeout(() => {
              console.log(`🎤 [VOICE] 🔁 Ponawiam połączenie z ${remoteUsername}`);
              createPeerConnection(remoteUserId, remoteUsername, isInitiator);
            }, 2000);
          }
        }, CONNECTION_TIMEOUT);

        connectionTimeoutsRef.current.set(remoteUserId, connectionTimeout);

        // Pobierz aktualne ICE servers (w tym Xirsys z API)
        const iceServers = await getIceServers();

        // 🚨 DEBUGGING: Tymczasowo wymuś TURN do testów (wyłącz w produkcji)
        const forceRelay = process.env.NODE_ENV === 'development'; // Tylko dev mode

        const rtcConfig: RTCConfiguration = {
          iceServers,
          iceCandidatePoolSize: 10,
          iceTransportPolicy: forceRelay ? 'relay' : 'all', // 'relay' = tylko TURN (wymusza)
        };

        if (forceRelay) {
          console.log(`🎤 [VOICE] 🚨 DEBUGGING: Wymuszam TURN relay (testowanie)`);
        }

        console.log(
          `🎤 [VOICE] ICE Servers:`,
          iceServers.map((s) => s.urls)
        );

        const pc = new RTCPeerConnection(rtcConfig);

        // Dodaj lokalny stream
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });

        // Obsługa remote stream
        pc.ontrack = (event) => {
          console.log(`🎤 [VOICE] ✅ Otrzymano audio stream od ${remoteUsername}`);

          const audio = new Audio();
          audio.srcObject = event.streams[0];
          audio.volume = settings.speakerVolume;

          // WAŻNE: Zapobieganie echo - nie odtwarzaj lokalnego audio
          audio.muted = false; // To jest remote stream, więc nie mute

          // Zapobieganie feedback loop
          if (audio.srcObject) {
            const stream = audio.srcObject as MediaStream;
            // Sprawdź czy to nie jest przypadkiem nasz własny stream
            if (localStreamRef.current && stream.id === localStreamRef.current.id) {
              console.log(`🎤 [VOICE] ⚠️ Ignoruję własny stream (zapobieganie echo)`);
              return;
            }
          }

          // iOS: element audio z autoplay/playsinline. play() poza gestem uzytkownika
          // moze zostac odrzucone (NotAllowedError) - wtedy UI pokazuje przycisk
          // "Wlacz dzwiek", ktory ponawia play() juz w gescie (resumeRemoteAudio).
          audio.autoplay = true;
          audio.setAttribute('playsinline', '');
          audio.play().catch((err) => {
            console.error('🎤 [VOICE] ❌ Błąd odtwarzania audio:', err);
            if ((err as { name?: string } | null)?.name === 'NotAllowedError') {
              onAudioBlocked?.();
            }
          });

          const existing = peerConnectionsRef.current.get(remoteUserId);
          if (existing) {
            existing.audioElement = audio;
          }
        };

        // ICE candidates - WAŻNE: relay = TURN działa!
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidateType = event.candidate.type; // host, srflx, relay
            const protocol = event.candidate.protocol;

            // relay = TURN server, to jest potrzebne dla różnych sieci!
            if (candidateType === 'relay') {
              console.log(`🎤 [VOICE] 🧊✅ RELAY candidate (TURN działa!): ${protocol}`);
            } else {
              console.log(`🎤 [VOICE] 🧊 ICE candidate: ${candidateType} (${protocol})`);
            }

            if (channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'voice-ice',
                payload: {
                  type: 'voice-ice',
                  fromUserId: user.id,
                  toUserId: remoteUserId,
                  candidate: event.candidate.toJSON(),
                },
              });
            }
          } else {
            console.log(`🎤 [VOICE] 🧊 ICE gathering complete`);
          }
        };

        // ICE connection state (ważne dla debugowania!)
        pc.oniceconnectionstatechange = () => {
          console.log(`🎤 [VOICE] 🧊 ICE state z ${remoteUsername}: ${pc.iceConnectionState}`);

          if (pc.iceConnectionState === 'connected') {
            console.log(`🎤 [VOICE] ✅ Połączenie P2P nawiązane z ${remoteUsername}!`);
          } else if (pc.iceConnectionState === 'failed') {
            console.log(`🎤 [VOICE] ❌ ICE failed - próbuję restart`);

            // Próbuj ICE restart
            try {
              pc.restartIce();
            } catch (error) {
              console.error(`🎤 [VOICE] Błąd ICE restart:`, error);

              // Jeśli restart nie działa, wyczyść i retry całe połączenie
              const retries = connectionRetriesRef.current.get(remoteUserId) || 0;
              if (retries < MAX_CONNECTION_RETRIES) {
                cleanupUserConnections(remoteUserId);
                setTimeout(() => {
                  createPeerConnection(remoteUserId, remoteUsername, isInitiator);
                }, 2000);
              }
            }
          } else if (pc.iceConnectionState === 'disconnected') {
            console.log(
              `🎤 [VOICE] ⚠️ ICE disconnected z ${remoteUsername} - czekam na reconnect...`
            );

            // Czekaj chwilę na automatyczny reconnect
            setTimeout(() => {
              if (pc.iceConnectionState === 'disconnected') {
                console.log(`🎤 [VOICE] ICE nadal disconnected - wymuszam restart`);
                try {
                  pc.restartIce();
                } catch (error) {
                  console.error(`🎤 [VOICE] Błąd ICE restart:`, error);
                }
              }
            }, 5000);
          }
        };

        // Stan połączenia
        pc.onconnectionstatechange = () => {
          console.log(`🎤 [VOICE] 📡 Connection state z ${remoteUsername}: ${pc.connectionState}`);

          if (pc.connectionState === 'connected') {
            // Połączenie udało się!
            pendingConnectionsRef.current.delete(remoteUserId);
            connectionRetriesRef.current.delete(remoteUserId); // Reset retry counter

            // Clear timeout
            const timeout = connectionTimeoutsRef.current.get(remoteUserId);
            if (timeout) {
              clearTimeout(timeout);
              connectionTimeoutsRef.current.delete(remoteUserId);
            }

            console.log(`🎤 [VOICE] ✅ Połączenie z ${remoteUsername} nawiązane pomyślnie!`);
          } else if (pc.connectionState === 'failed') {
            console.log(`🎤 [VOICE] ❌ Połączenie z ${remoteUsername} nieudane`);

            const retries = connectionRetriesRef.current.get(remoteUserId) || 0;
            cleanupUserConnections(remoteUserId);

            // Auto retry on failed connection
            if (retries < MAX_CONNECTION_RETRIES) {
              console.log(
                `🎤 [VOICE] 🔁 Auto-retry połączenia z ${remoteUsername} (próba ${retries + 1})`
              );
              setTimeout(
                () => {
                  createPeerConnection(remoteUserId, remoteUsername, isInitiator);
                },
                1000 * retries + 1000
              ); // Exponential backoff
            }
          } else if (pc.connectionState === 'disconnected') {
            console.log(`🎤 [VOICE] ⚠️ Połączenie z ${remoteUsername} rozłączone`);

            // Wait a bit and retry if still in voice chat
            setTimeout(() => {
              if (isInVoiceChatRef.current && !peerConnectionsRef.current.has(remoteUserId)) {
                const retries = connectionRetriesRef.current.get(remoteUserId) || 0;
                if (retries < MAX_CONNECTION_RETRIES) {
                  console.log(`🎤 [VOICE] 🔁 Reconnecting po ${remoteUsername}`);
                  createPeerConnection(remoteUserId, remoteUsername, isInitiator);
                }
              }
            }, 2000);
          }
        };

        // Zapisz połączenie
        peerConnectionsRef.current.set(remoteUserId, {
          odUserId: remoteUserId,
          username: remoteUsername,
          pc,
        });

        // Jeśli jesteśmy inicjatorem, wyślij offer
        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          channelRef.current?.send({
            type: 'broadcast',
            event: 'voice-offer',
            payload: {
              type: 'voice-offer',
              fromUserId: user.id,
              fromUsername: user.username,
              toUserId: remoteUserId,
              offer: pc.localDescription,
            },
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
      channelRef,
      localStreamRef,
      isInVoiceChatRef,
      onAudioBlocked,
    ]
  );

  /** Doklada kandydatow z kolejki, gdy polaczenie ma juz remoteDescription. */
  const flushPendingIce = useCallback(async (userId: number, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(userId);
    if (!queued?.length) return;
    pendingIceRef.current.delete(userId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('🎤 [VOICE] Pominięty kandydat ICE z kolejki:', error);
      }
    }
  }, []);

  /**
   * Kandydat ICE od drugiej strony. Jesli polaczenia jeszcze nie ma albo nie ma
   * remoteDescription, trafia do kolejki zamiast przepasc - druga strona wysyla
   * kandydatow zaraz po ofercie, wiec na wolnym telefonie wyprzedzaja jej obsluge.
   */
  const addRemoteIceCandidate = useCallback(
    async (fromUserId: number, candidate: RTCIceCandidateInit) => {
      const pc = peerConnectionsRef.current.get(fromUserId)?.pc;
      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (error) {
          console.warn('🎤 [VOICE] Nie udało się dodać kandydata ICE:', error);
        }
        return;
      }
      const queue = pendingIceRef.current.get(fromUserId) ?? [];
      if (queue.length < MAX_QUEUED_ICE) queue.push(candidate);
      pendingIceRef.current.set(fromUserId, queue);
    },
    []
  );

  const applyRemoteAnswer = useCallback(
    async (fromUserId: number, answer: RTCSessionDescriptionInit) => {
      const pc = peerConnectionsRef.current.get(fromUserId)?.pc;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(answer);
        await flushPendingIce(fromUserId, pc);
      } catch (error) {
        console.error('🎤 [VOICE] ❌ Błąd ustawiania answer:', error);
      }
    },
    [flushPendingIce]
  );

  const clearPendingIce = useCallback((userId?: number) => {
    if (userId === undefined) pendingIceRef.current.clear();
    else pendingIceRef.current.delete(userId);
  }, []);

  const handleOffer = useCallback(
    async (fromUserId: number, fromUsername: string, offer: RTCSessionDescriptionInit) => {
      if (!user || !localStreamRef.current) return;

      console.log(`🎤 [VOICE] 📬 Obsługuję offer od ${fromUsername}`);

      // Jesli polaczenie z ta osoba jest wlasnie budowane (np. po voice-sync),
      // poczekaj na nie. Wczesniej createPeerConnection wracal wtedy od razu
      // ("jest w trakcie"), a offer byl porzucany bez odpowiedzi - na wolnym
      // telefonie typowy scenariusz, konczacy sie brakiem polaczenia.
      const inFlight = creationsRef.current.get(fromUserId);
      if (inFlight) await inFlight;

      const existing = peerConnectionsRef.current.get(fromUserId);
      if (existing) {
        const { pc: existingPc } = existing;
        const isFreshResponder =
          existingPc.signalingState === 'stable' &&
          !existingPc.remoteDescription &&
          !existingPc.localDescription;

        if (existingPc.signalingState === 'have-local-offer') {
          // Kolizja ofert (glare): obie strony wyslaly offer jednoczesnie.
          // Rozstrzygniecie deterministyczne - ustepuje strona z nizszym id,
          // druga ignoruje przychodzacy offer i czeka na answer na swoj.
          const weYield = user.id < fromUserId;
          if (!weYield) {
            console.warn(`🎤 [VOICE] ↔️ Kolizja ofert z ${fromUsername} - zostaję przy swojej`);
            return;
          }
          console.warn(`🎤 [VOICE] ↔️ Kolizja ofert z ${fromUsername} - ustępuję`);
          cleanupUserConnections(fromUserId);
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else if (!isFreshResponder) {
          console.log(
            `🎤 [VOICE] ⚠️ Czyszczę istniejące połączenie z ${fromUsername} przed nowym offer`
          );
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
        console.error(`🎤 [VOICE] ❌ Nie udało się utworzyć połączenia dla ${fromUsername}`);
        return;
      }

      const pc = peerConn.pc;

      try {
        await pc.setRemoteDescription(offer);
        await flushPendingIce(fromUserId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channelRef.current?.send({
          type: 'broadcast',
          event: 'voice-answer',
          payload: {
            type: 'voice-answer',
            fromUserId: user.id,
            toUserId: fromUserId,
            answer: pc.localDescription,
          },
        });

        console.log(`🎤 [VOICE] ✅ Wysłano answer do ${fromUsername}`);
      } catch (error) {
        console.error(`🎤 [VOICE] ❌ Błąd podczas obsługi offer od ${fromUsername}:`, error);
        cleanupUserConnections(fromUserId);
      }
    },
    [
      user,
      createPeerConnection,
      cleanupUserConnections,
      channelRef,
      localStreamRef,
      flushPendingIce,
    ]
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
    handleOffer,
    addRemoteIceCandidate,
    applyRemoteAnswer,
    clearPendingIce,
    resumeRemoteAudio,
  };
}
