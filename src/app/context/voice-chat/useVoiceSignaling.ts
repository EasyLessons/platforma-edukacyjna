import { useCallback, MutableRefObject, useRef, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { VoiceParticipant, VoiceEvent, PeerConnection } from './types';

export function useVoiceSignaling(
  boardId: string | null,
  user: { id: number; username: string } | null,
  channelRef: MutableRefObject<RealtimeChannel | null>,
  isInVoiceChatRef: MutableRefObject<boolean>,
  isMutedRef: MutableRefObject<boolean>,
  localStreamRef: MutableRefObject<MediaStream | null>,
  setParticipants: React.Dispatch<React.SetStateAction<VoiceParticipant[]>>,
  cleanupUserConnections: (userId: number) => void,
  peerConnectionsRef: MutableRefObject<Map<number, PeerConnection>>,
  pendingConnectionsRef: MutableRefObject<Set<number>>,
  connectionRetriesRef: MutableRefObject<Map<number, number>>,
  connectionTimeoutsRef: MutableRefObject<Map<number, NodeJS.Timeout>>,
  lastSyncTimeRef: MutableRefObject<Map<string | number, number>>,
  createPeerConnectionRef: MutableRefObject<
    ((remoteUserId: number, remoteUsername: string, isInitiator: boolean) => Promise<void>) | null
  >,
  handleOfferRef: MutableRefObject<
    | ((
        fromUserId: number,
        fromUsername: string,
        offer: RTCSessionDescriptionInit
      ) => Promise<void>)
    | null
  >,
  leaveVoiceChatRef: MutableRefObject<(() => void) | null>
) {
  const setupVoiceChannel = useCallback((): Promise<RealtimeChannel | null> => {
    return new Promise((resolve) => {
      if (!user || !boardId) {
        resolve(null);
        return;
      }

      // Jeśli kanał już istnieje i jest subskrybowany, użyj go
      if (channelRef.current) {
        resolve(channelRef.current);
        return;
      }

      console.log(`🎤 [VOICE] Tworzę kanał voice:${boardId}`);

      const channel = supabase.channel(`voice:${boardId}`, {
        config: {
          broadcast: { ack: false },
        },
      });

      channel
        .on('broadcast', { event: 'voice-join' }, ({ payload }) => {
          const { userId, username } = payload as VoiceEvent & { type: 'voice-join' };
          if (userId === user.id) return;

          console.log(`🎤 [VOICE] ${username} dołączył do voice chat`);

          // 🧹 ZAWSZE czyść istniejące połączenia tego użytkownika
          const existingConn = peerConnectionsRef.current.get(userId);
          if (existingConn) {
            console.log(`🎤 [VOICE] 🧹 Czyszczę stare połączenie z ${username} przed nowym`);
            if (existingConn.audioElement) {
              existingConn.audioElement.pause();
              existingConn.audioElement.srcObject = null;
            }
            existingConn.pc.close();
            peerConnectionsRef.current.delete(userId);
          }

          // Clear pending i retry dla tego użytkownika
          pendingConnectionsRef.current.delete(userId);
          connectionRetriesRef.current.delete(userId);
          const timeout = connectionTimeoutsRef.current.get(userId);
          if (timeout) {
            clearTimeout(timeout);
            connectionTimeoutsRef.current.delete(userId);
          }
          lastSyncTimeRef.current.delete(userId);

          // Dodaj do listy uczestników (fresh)
          setParticipants((prev) => {
            const filtered = prev.filter((p) => p.odUserId !== userId);
            return [
              ...filtered,
              { odUserId: userId, username, isSpeaking: false, isMuted: false, volume: 1 },
            ];
          });

          // Jeśli my jesteśmy w voice chat, odpowiedz voice-sync i utwórz NOWE połączenie
          if (isInVoiceChatRef.current && localStreamRef.current) {
            // Małe opóźnienie żeby cleanup się zakończył
            setTimeout(() => {
              console.log(`🎤 [VOICE] Wysyłam voice-sync do ${username}`);

              // Odpowiedz że my też jesteśmy w voice chat
              channel.send({
                type: 'broadcast',
                event: 'voice-sync',
                payload: {
                  type: 'voice-sync',
                  userId: user.id,
                  username: user.username,
                  isMuted: isMutedRef.current,
                },
              });

              // Utwórz NOWE połączenie P2P (jako initiator) - używamy ref
              createPeerConnectionRef.current?.(userId, username, true);
            }, 300);
          }
        })
        // Obsługa voice-sync - odpowiedź od kogoś kto już jest w voice chat
        .on('broadcast', { event: 'voice-sync' }, ({ payload }) => {
          const {
            userId,
            username,
            isMuted: remoteMuted,
          } = payload as VoiceEvent & { type: 'voice-sync' };
          if (userId === user.id) return;

          // Throttle voice-sync messages (max 1 per 2 seconds per user)
          const now = Date.now();
          const lastSync = lastSyncTimeRef.current.get(userId) || 0;
          if (now - lastSync < 2000) {
            return; // Throttle - ignore
          }
          lastSyncTimeRef.current.set(userId, now);

          console.log(`🎤 [VOICE] Otrzymano voice-sync od ${username} (muted: ${remoteMuted})`);

          // Dodaj do listy uczestników jeśli jeszcze nie ma lub aktualizuj
          setParticipants((prev) => {
            const filtered = prev.filter((p) => p.odUserId !== userId);
            return [
              ...filtered,
              { odUserId: userId, username, isSpeaking: false, isMuted: remoteMuted, volume: 1 },
            ];
          });

          // Jeśli jesteśmy w voice chat i NIE mamy połączenia - utwórz jako responder
          if (isInVoiceChatRef.current && localStreamRef.current) {
            const existingConn = peerConnectionsRef.current.get(userId);
            const needsConnection =
              !existingConn ||
              existingConn.pc.connectionState === 'failed' ||
              existingConn.pc.connectionState === 'disconnected' ||
              existingConn.pc.connectionState === 'closed';

            if (needsConnection && !pendingConnectionsRef.current.has(userId)) {
              // Wyczyść stare jeśli istnieje
              if (existingConn) {
                if (existingConn.audioElement) {
                  existingConn.audioElement.pause();
                  existingConn.audioElement.srcObject = null;
                }
                existingConn.pc.close();
                peerConnectionsRef.current.delete(userId);
              }

              connectionRetriesRef.current.delete(userId);
              createPeerConnectionRef.current?.(userId, username, false);
            }
          }
        })
        // Obsługa voice-request-sync
        .on('broadcast', { event: 'voice-request-sync' }, ({ payload }) => {
          const { userId: requestingUserId } = payload as VoiceEvent & {
            type: 'voice-request-sync';
          };
          if (requestingUserId === user.id) return;

          if (isInVoiceChatRef.current && localStreamRef.current) {
            const delay = Math.random() * 300 + 100;
            setTimeout(() => {
              channel.send({
                type: 'broadcast',
                event: 'voice-sync',
                payload: {
                  type: 'voice-sync',
                  userId: user.id,
                  username: user.username,
                  isMuted: isMutedRef.current,
                },
              });
            }, delay);
          }
        })
        .on('broadcast', { event: 'voice-leave' }, ({ payload }) => {
          const { userId } = payload as VoiceEvent & { type: 'voice-leave' };
          if (userId === user.id) return;

          console.log(`🎤 [VOICE] User ${userId} opuścił voice chat`);
          cleanupUserConnections(userId);
        })
        .on('broadcast', { event: 'voice-offer' }, async ({ payload }) => {
          const { fromUserId, fromUsername, toUserId, offer } = payload as VoiceEvent & {
            type: 'voice-offer';
          };
          if (toUserId !== user.id) return;

          await handleOfferRef.current?.(fromUserId, fromUsername, offer);
        })
        .on('broadcast', { event: 'voice-answer' }, async ({ payload }) => {
          const { fromUserId, toUserId, answer } = payload as VoiceEvent & { type: 'voice-answer' };
          if (toUserId !== user.id) return;

          const pc = peerConnectionsRef.current.get(fromUserId)?.pc;
          if (pc) {
            await pc.setRemoteDescription(answer);
          }
        })
        .on('broadcast', { event: 'voice-ice' }, async ({ payload }) => {
          const { fromUserId, toUserId, candidate } = payload as VoiceEvent & { type: 'voice-ice' };
          if (toUserId !== user.id) return;

          const pc = peerConnectionsRef.current.get(fromUserId)?.pc;
          if (pc) {
            await pc.addIceCandidate(candidate);
          }
        })
        .on('broadcast', { event: 'voice-mute' }, ({ payload }) => {
          const { userId, isMuted } = payload as VoiceEvent & { type: 'voice-mute' };
          if (userId === user.id) return;

          setParticipants((prev) =>
            prev.map((p) => (p.odUserId === userId ? { ...p, isMuted } : p))
          );
        })
        .on('broadcast', { event: 'voice-speaking' }, ({ payload }) => {
          const { userId, isSpeaking } = payload as VoiceEvent & { type: 'voice-speaking' };
          if (userId === user.id) return;

          setParticipants((prev) =>
            prev.map((p) => (p.odUserId === userId ? { ...p, isSpeaking } : p))
          );
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`🎤 [VOICE] ✅ Kanał voice:${boardId} SUBSCRIBED`);
            channelRef.current = channel;
            resolve(channel);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`🎤 [VOICE] ❌ Kanał voice błąd: ${status}`);
            resolve(null);
          }
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, user?.id, user?.username, cleanupUserConnections]);

  // 🛡️ Cleanup kanału przy zmianie boardId - wywołaj pełny leaveVoiceChat
  const prevBoardIdRef = useRef(boardId);
  useEffect(() => {
    // Jeśli boardId się zmienił i byliśmy w voice chat - opuść
    if (prevBoardIdRef.current !== boardId && prevBoardIdRef.current !== null) {
      if (isInVoiceChatRef.current) {
        console.log('🎤 [VOICE] BoardId się zmienił - opuszczam voice chat');
        leaveVoiceChatRef.current?.();
      } else if (channelRef.current) {
        // Nie byliśmy w voice chat ale kanał istnieje - wyczyść
        console.log('🎤 [VOICE] Czyszczę kanał voice przy zmianie boardId');
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    }
    prevBoardIdRef.current = boardId;
  }, [boardId]);

  return { setupVoiceChannel };
}
