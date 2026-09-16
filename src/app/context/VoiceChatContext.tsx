import { useWebRTCConnections } from './voice-chat/useWebRTCConnections';
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        VOICE CHAT CONTEXT
 *                   WebRTC P2P Voice Communication
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🎯 CEL:
 * Zarządza połączeniami głosowymi między użytkownikami na tablicy.
 * Używa WebRTC dla audio P2P + Supabase Broadcast do sygnalizacji.
 *
 * 📡 TECHNOLOGIA:
 * - WebRTC RTCPeerConnection → audio stream P2P
 * - Supabase Broadcast → wymiana offer/answer/ICE candidates
 * - MediaDevices API → dostęp do mikrofonu
 *
 * 🔄 JAK TO DZIAŁA:
 * 1. User A klika "Dołącz" → getUserMedia() → broadcast "voice-join"
 * 2. User B otrzymuje "voice-join" → tworzy RTCPeerConnection
 * 3. Wymiana SDP offer/answer przez Supabase Broadcast
 * 4. Wymiana ICE candidates → połączenie P2P
 * 5. Audio stream płynie bezpośrednio A ↔ B
 */

('use client');

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/_new/lib/auth';

// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPY
// ═══════════════════════════════════════════════════════════════════════════

import {
  VoiceParticipant,
  VoiceSettings,
  VoiceChatContextType,
  PeerConnection,
  VoiceEvent,
} from './voice-chat/types';

export type { VoiceParticipant, VoiceSettings, VoiceChatContextType, PeerConnection, VoiceEvent };

// ═══════════════════════════════════════════════════════════════════════════
// 🎁 CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const VoiceChatContext = createContext<VoiceChatContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 📦 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

import { DEFAULT_SETTINGS, getIceServers } from './voice-chat/constants';
import { useVoiceDetection } from './voice-chat/useVoiceDetection';
import { useVoiceSignaling } from './voice-chat/useVoiceSignaling';

export function VoiceChatProvider({
  boardId,
  children,
}: {
  boardId: string | null;
  children: ReactNode;
}) {
  const { user } = useAuth();

  // Stan
  const [isInVoiceChat, setIsInVoiceChat] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    // Załaduj ustawienia z localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voiceChatSettings');
      if (saved) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch {}
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Refs do śledzenia aktualnego stanu (potrzebne w event listenerach)
  const isInVoiceChatRef = useRef(false);
  const isMutedRef = useRef(false);

  // Refs do funkcji (rozwiązuje circular dependency w setupVoiceChannel)
  const createPeerConnectionRef = useRef<
    ((remoteUserId: number, remoteUsername: string, isInitiator: boolean) => Promise<void>) | null
  >(null);
  const handleOfferRef = useRef<
    | ((
        fromUserId: number,
        fromUsername: string,
        offer: RTCSessionDescriptionInit
      ) => Promise<void>)
    | null
  >(null);
  const leaveVoiceChatRef = useRef<(() => void) | null>(null);

  // Debounce i throttling
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {
    peerConnectionsRef,
    pendingConnectionsRef,
    connectionRetriesRef,
    connectionTimeoutsRef,
    lastSyncTimeRef,
    cleanupUserConnections,
    createPeerConnection,
    handleOffer,
  } = useWebRTCConnections(
    user,
    settings,
    localStreamRef,
    channelRef,
    isInVoiceChatRef,
    setParticipants
  );

  // Sync refs z state
  useEffect(() => {
    isInVoiceChatRef.current = isInVoiceChat;
  }, [isInVoiceChat]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // ───────────────────────────────────────────────────────────────────────
  // 📡 SUPABASE CHANNEL DLA VOICE - LAZY INITIALIZATION
  // ───────────────────────────────────────────────────────────────────────
  const { setupVoiceChannel } = useVoiceSignaling(
    boardId,
    user,
    channelRef,
    isInVoiceChatRef,
    isMutedRef,
    localStreamRef,
    setParticipants,
    cleanupUserConnections,
    peerConnectionsRef,
    pendingConnectionsRef,
    connectionRetriesRef,
    connectionTimeoutsRef,
    lastSyncTimeRef,
    createPeerConnectionRef,
    handleOfferRef,
    leaveVoiceChatRef
  );

  // 🔄 Sync refs z funkcjami (pozwala setupVoiceChannel używać aktualnych wersji)
  useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
  }, [createPeerConnection]);

  useEffect(() => {
    handleOfferRef.current = handleOffer;
  }, [handleOffer]);

  // Funkcja została zastąpiona przez cleanupUserConnections (zdefiniowana wyżej)

  // ───────────────────────────────────────────────────────────────────────
  // 🎤 VOICE DETECTION
  // ───────────────────────────────────────────────────────────────────────
  const { startVoiceDetection, stopVoiceDetection } = useVoiceDetection(
    localStreamRef,
    channelRef,
    user?.id,
    setIsSpeaking
  );

  // ───────────────────────────────────────────────────────────────────────
  // 🎮 AKCJE PUBLICZNE
  // ───────────────────────────────────────────────────────────────────────

  const joinVoiceChat = useCallback(async () => {
    if (!user || isInVoiceChat) return;

    setIsConnecting(true);

    try {
      // 🛡️ LAZY INIT: Utwórz kanał voice dopiero teraz (czekamy na SUBSCRIBED)
      const channel = await setupVoiceChannel();
      if (!channel) {
        console.error('🎤 [VOICE] Nie można utworzyć kanału voice');
        setIsConnecting(false);
        return;
      }
      console.log('🎤 [VOICE] ✅ Kanał voice gotowy, kontynuuję...');

      // 🧹 CLEAN START - wyczyść WSZYSTKO przed dołączeniem
      console.log('🎤 [VOICE] 🧹 Clean start - czyszczę wszystkie poprzednie połączenia...');

      // Stop wszystkie istniejące połączenia P2P
      peerConnectionsRef.current.forEach((peerConn) => {
        if (peerConn.audioElement) {
          peerConn.audioElement.pause();
          peerConn.audioElement.srcObject = null;
        }
        peerConn.pc.close();
      });
      peerConnectionsRef.current.clear();

      // Clear wszystkie stany
      pendingConnectionsRef.current.clear();
      lastSyncTimeRef.current.clear();
      connectionRetriesRef.current.clear();
      connectionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      connectionTimeoutsRef.current.clear();
      setParticipants([]);

      // Stop poprzedni stream jeśli istnieje
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Pobierz stream audio z lepszymi ustawieniami anty-echo
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, // ZAWSZE włącz echo cancellation
          noiseSuppression: settings.noiseSupression,
          autoGainControl: true,
          sampleRate: 44100, // Wysoka jakość audio
          sampleSize: 16,
          channelCount: 1, // Mono dla lepszej wydajności
        },
      });

      localStreamRef.current = stream;

      // Ustaw głośność mikrofonu
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        // Jeśli push-to-talk, wycisz na start
        audioTrack.enabled = !settings.pushToTalk;

        // Dodatkowe ustawienia anty-echo na poziomie track
        const constraints = audioTrack.getConstraints();
        console.log(`🎤 [VOICE] Audio track constraints:`, constraints);
      }

      setIsInVoiceChat(true);

      // Start voice detection
      startVoiceDetection();

      // Broadcast dołączenie
      channelRef.current?.send({
        type: 'broadcast',
        event: 'voice-join',
        payload: {
          type: 'voice-join',
          userId: user.id,
          username: user.username,
        },
      });

      // Dodaj siebie do uczestników
      setParticipants((prev) => [
        ...prev,
        {
          odUserId: user.id,
          username: user.username,
          isSpeaking: false,
          isMuted: false,
          volume: 1,
        },
      ]);

      // Po krótkim opóźnieniu wyślij request-sync żeby upewnić się że dostaniemy info o obecnych
      setTimeout(() => {
        if (isInVoiceChatRef.current) {
          console.log('🎤 [VOICE] Wysyłam voice-request-sync...');
          channelRef.current?.send({
            type: 'broadcast',
            event: 'voice-request-sync',
            payload: {
              type: 'voice-request-sync',
              userId: user.id,
            },
          });
        }
      }, 500);

      // Backup request po 2 sekundach
      setTimeout(() => {
        if (isInVoiceChatRef.current) {
          console.log('🎤 [VOICE] Backup voice-request-sync...');
          channelRef.current?.send({
            type: 'broadcast',
            event: 'voice-request-sync',
            payload: {
              type: 'voice-request-sync',
              userId: user.id,
            },
          });
        }
      }, 2000);

      // Trzeci backup po 5 sekundach dla pewności
      setTimeout(() => {
        if (isInVoiceChatRef.current) {
          // Sprawdź czy mamy połączenia - jeśli nie, wyślij jeszcze raz
          const otherParticipants = Array.from(peerConnectionsRef.current.keys());
          if (otherParticipants.length === 0) {
            console.log('🎤 [VOICE] ⚠️ Brak połączeń P2P - wysyłam force request-sync');
            channelRef.current?.send({
              type: 'broadcast',
              event: 'voice-request-sync',
              payload: {
                type: 'voice-request-sync',
                userId: user.id,
              },
            });
          }
        }
      }, 5000);

      // Dodatkowy mechanizm weryfikacji połączeń co 10 sekund
      const verifyInterval = setInterval(() => {
        if (!isInVoiceChatRef.current) {
          clearInterval(verifyInterval);
          return;
        }

        console.log('🎤 [VOICE] 🔍 Weryfikacja połączeń P2P...');

        // Sprawdź czy wszystkie połączenia P2P działają
        const currentParticipants = Array.from(peerConnectionsRef.current.keys());

        // Jeśli nie mamy żadnych połączeń ale jesteśmy w voice chat - wyślij request sync
        if (currentParticipants.length === 0) {
          console.log('🎤 [VOICE] ⚠️ Brak aktywnych połączeń - próbuję sync');
          channelRef.current?.send({
            type: 'broadcast',
            event: 'voice-request-sync',
            payload: {
              type: 'voice-request-sync',
              userId: user.id,
            },
          });
        } else {
          // Sprawdź stan każdego połączenia
          peerConnectionsRef.current.forEach((peerConn, odUserId) => {
            if (
              peerConn.pc.connectionState === 'failed' ||
              peerConn.pc.connectionState === 'disconnected' ||
              peerConn.pc.connectionState === 'closed'
            ) {
              console.log(
                `🎤 [VOICE] 🔍 Połączenie z ${peerConn.username} w złym stanie (${peerConn.pc.connectionState}) - restartuję`
              );

              // Cleanup i reconnect
              if (peerConn.audioElement) {
                peerConn.audioElement.pause();
                peerConn.audioElement.srcObject = null;
              }
              peerConn.pc.close();
              peerConnectionsRef.current.delete(odUserId);
              connectionRetriesRef.current.delete(odUserId);

              setTimeout(() => {
                createPeerConnection(odUserId, peerConn.username, true);
              }, 500);
            } else {
              console.log(
                `🎤 [VOICE] ✅ Połączenie z ${peerConn.username} OK (${peerConn.pc.connectionState})`
              );
            }
          });
        }
      }, 10000);

      // Store interval for cleanup
      joinTimeoutRef.current = verifyInterval as unknown as NodeJS.Timeout;

      console.log('🎤 [VOICE] Dołączono do voice chat!');
    } catch (error) {
      console.error('🎤 [VOICE] Błąd dostępu do mikrofonu:', error);
      alert('Nie udało się uzyskać dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki.');
    } finally {
      setIsConnecting(false);
    }
  }, [user, isInVoiceChat, settings, startVoiceDetection, createPeerConnection, setupVoiceChannel]);

  const leaveVoiceChat = useCallback(() => {
    if (!user) return;

    console.log('🎤 [VOICE] Opuszczam voice chat');

    // Clear timeouts
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      clearInterval(joinTimeoutRef.current); // może być interval też
      joinTimeoutRef.current = null;
    }
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    // Stop wszystkie połączenia
    peerConnectionsRef.current.forEach((peerConn, userId) => {
      cleanupUserConnections(userId);
    });

    // Clear pending connections
    pendingConnectionsRef.current.clear();
    lastSyncTimeRef.current.clear();
    connectionRetriesRef.current.clear();
    connectionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    connectionTimeoutsRef.current.clear();

    // Stop local stream
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    // Stop voice detection
    stopVoiceDetection();

    // Broadcast opuszczenie
    channelRef.current?.send({
      type: 'broadcast',
      event: 'voice-leave',
      payload: {
        type: 'voice-leave',
        userId: user.id,
      },
    });

    // 🛡️ LAZY CLEANUP: Usuń kanał voice po opłszczeniu
    // Małe opóźnienie żeby voice-leave zdążyło się wysłać
    const channelToClose = channelRef.current;
    channelRef.current = null;
    if (channelToClose) {
      setTimeout(() => {
        console.log('🎤 [VOICE] Czyszczę kanał voice po opuszczeniu');
        channelToClose.unsubscribe();
      }, 100);
    }

    setIsInVoiceChat(false);
    setParticipants([]);
    setIsSpeaking(false);
    setIsMuted(false);
  }, [user, stopVoiceDetection, cleanupUserConnections]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current || !user) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const newMuted = !isMuted;
      audioTrack.enabled = !newMuted;
      setIsMuted(newMuted);

      // Broadcast mute status
      channelRef.current?.send({
        type: 'broadcast',
        event: 'voice-mute',
        payload: {
          type: 'voice-mute',
          userId: user.id,
          isMuted: newMuted,
        },
      });
    }
  }, [isMuted, user]);

  const setMutedState = useCallback(
    (muted: boolean) => {
      if (!localStreamRef.current || !user) return;

      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !muted;
        setIsMuted(muted);

        channelRef.current?.send({
          type: 'broadcast',
          event: 'voice-mute',
          payload: {
            type: 'voice-mute',
            userId: user.id,
            isMuted: muted,
          },
        });
      }
    },
    [user]
  );

  const startTalking = useCallback(() => {
    if (!settings.pushToTalk || !localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = true;
    }
  }, [settings.pushToTalk]);

  const stopTalking = useCallback(() => {
    if (!settings.pushToTalk || !localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = false;
    }
  }, [settings.pushToTalk]);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };

      // Zapisz do localStorage
      localStorage.setItem('voiceChatSettings', JSON.stringify(updated));

      // Zastosuj zmiany
      if (newSettings.speakerVolume !== undefined) {
        // Aktualizuj głośność wszystkich audio elementów
        peerConnectionsRef.current.forEach((peerConn) => {
          if (peerConn.audioElement) {
            peerConn.audioElement.volume = newSettings.speakerVolume!;
          }
        });
      }

      if (newSettings.pushToTalk !== undefined && localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          // Jeśli przełączono na push-to-talk, wycisz
          audioTrack.enabled = !newSettings.pushToTalk;
        }
      }

      return updated;
    });
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // ⌨️ KEYBOARD SHORTCUTS (Push-to-Talk)
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isInVoiceChat || !settings.pushToTalk) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === settings.pushToTalkKey && !e.repeat) {
        startTalking();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === settings.pushToTalkKey) {
        stopTalking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isInVoiceChat, settings.pushToTalk, settings.pushToTalkKey, startTalking, stopTalking]);

  // ───────────────────────────────────────────────────────────────────────
  // 🧹 CLEANUP
  // ───────────────────────────────────────────────────────────────────────

  // Sync ref z aktualną wersją funkcji (ref zdefiniowany wyżej z innymi refami)
  useEffect(() => {
    leaveVoiceChatRef.current = leaveVoiceChat;
  }, [leaveVoiceChat]);

  useEffect(() => {
    return () => {
      // Użyj ref żeby zawsze mieć aktualną wersję funkcji
      leaveVoiceChatRef.current?.();
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // 🎁 CONTEXT VALUE
  // ───────────────────────────────────────────────────────────────────────

  return (
    <VoiceChatContext.Provider
      value={{
        isInVoiceChat,
        isConnecting,
        participants,
        settings,
        isMuted,
        isSpeaking,
        joinVoiceChat,
        leaveVoiceChat,
        toggleMute,
        setMuted: setMutedState,
        updateSettings,
        startTalking,
        stopTalking,
      }}
    >
      {children}
    </VoiceChatContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useVoiceChat() {
  const context = useContext(VoiceChatContext);
  return context; // Może być null jeśli nie ma providera
}

export function useVoiceChatRequired() {
  const context = useContext(VoiceChatContext);
  if (!context) {
    throw new Error('useVoiceChatRequired must be used within VoiceChatProvider');
  }
  return context;
}
