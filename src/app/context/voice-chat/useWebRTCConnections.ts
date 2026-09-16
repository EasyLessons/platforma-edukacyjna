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
  setParticipants: React.Dispatch<React.SetStateAction<VoiceParticipant[]>>
) {
  const peerConnectionsRef = useRef<Map<number, PeerConnection>>(new Map());
  const pendingConnectionsRef = useRef<Set<number>>(new Set());
  const connectionRetriesRef = useRef<Map<number, number>>(new Map());
  const connectionTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const lastSyncTimeRef = useRef<Map<string | number, number>>(new Map());

  const MAX_CONNECTION_RETRIES = 3;
  const CONNECTION_TIMEOUT = 10000; // 10 sekund

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

        audio.play().catch((err) => console.error('🎤 [VOICE] ❌ Błąd odtwarzania audio:', err));

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
    },
    [
      user,
      settings.speakerVolume,
      cleanupUserConnections,
      channelRef,
      localStreamRef,
      isInVoiceChatRef,
    ]
  );

  const handleOffer = useCallback(
    async (fromUserId: number, fromUsername: string, offer: RTCSessionDescriptionInit) => {
      if (!user || !localStreamRef.current) return;

      console.log(`🎤 [VOICE] 📬 Obsługuję offer od ${fromUsername}`);

      // Sprawdź czy już mamy połączenie - jeśli tak, wyczyść najpierw
      if (peerConnectionsRef.current.has(fromUserId)) {
        console.log(
          `🎤 [VOICE] ⚠️ Czyszczę istniejące połączenie z ${fromUsername} przed nowym offer`
        );
        cleanupUserConnections(fromUserId);

        // Krótkie opóźnienie żeby cleanup się zakończył
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Utwórz nowe połączenie
      await createPeerConnection(fromUserId, fromUsername, false);
      const peerConn = peerConnectionsRef.current.get(fromUserId);

      if (!peerConn) {
        console.error(`🎤 [VOICE] ❌ Nie udało się utworzyć połączenia dla ${fromUsername}`);
        return;
      }

      const pc = peerConn.pc;

      try {
        await pc.setRemoteDescription(offer);
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
    [user, createPeerConnection, cleanupUserConnections, channelRef, localStreamRef]
  );

  return {
    peerConnectionsRef,
    pendingConnectionsRef,
    connectionRetriesRef,
    connectionTimeoutsRef,
    lastSyncTimeRef,
    cleanupUserConnections,
    createPeerConnection,
    handleOffer,
  };
}
