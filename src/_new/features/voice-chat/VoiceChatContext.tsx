'use client';

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
} from './types';

export type { VoiceParticipant, VoiceSettings, VoiceChatContextType, PeerConnection, VoiceEvent };

// ═══════════════════════════════════════════════════════════════════════════
// 🎁 CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const VoiceChatContext = createContext<VoiceChatContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 📦 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

import { DEFAULT_SETTINGS } from './constants';
import { useVoiceDetection } from './useVoiceDetection';
import { useVoiceSignaling } from './useVoiceSignaling';
import { useWebRTCConnections } from './useWebRTCConnections';
import {
  getVoiceSupportIssue,
  mapGetUserMediaError,
  voiceError as makeVoiceError,
  type VoiceError,
} from './mediaSupport';

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
  const [voiceError, setVoiceError] = useState<VoiceError | null>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  // Blokada podwojnego tapniecia w trakcie dolaczania (czeste na telefonie).
  const isJoiningRef = useRef(false);

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

  const onAudioBlocked = useCallback(() => setIsAudioBlocked(true), []);

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
    restartIceConnection,
    handleOffer,
    addRemoteIceCandidate,
    applyRemoteAnswer,
    clearPendingIce,
    resumeRemoteAudio,
  } = useWebRTCConnections(
    user,
    settings,
    localStreamRef,
    channelRef,
    isInVoiceChatRef,
    setParticipants,
    onAudioBlocked
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
    leaveVoiceChatRef,
    applyRemoteAnswer,
    addRemoteIceCandidate,
    clearPendingIce
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

  /**
   * Sprzata wszystko po nieudanym dolaczeniu: mikrofon, detekcje glosu,
   * polaczenia P2P i kanal. Wczesniej po odmowie mikrofonu kanal zostawal
   * otwarty, a stan byl pol-dolaczony.
   */
  const abortJoin = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    stopVoiceDetection();

    peerConnectionsRef.current.forEach((_peerConn, userId) => cleanupUserConnections(userId));
    pendingConnectionsRef.current.clear();
    connectionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    connectionTimeoutsRef.current.clear();
    clearPendingIce();

    if (joinTimeoutRef.current) {
      clearInterval(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }

    const channel = channelRef.current;
    channelRef.current = null;
    channel?.unsubscribe();

    isInVoiceChatRef.current = false;
    setIsInVoiceChat(false);
    setParticipants([]);
    setIsSpeaking(false);
  }, [
    stopVoiceDetection,
    cleanupUserConnections,
    clearPendingIce,
    peerConnectionsRef,
    pendingConnectionsRef,
    connectionTimeoutsRef,
  ]);

  const joinVoiceChat = useCallback(async (): Promise<boolean> => {
    if (!user || isInVoiceChat || isJoiningRef.current) return false;

    setVoiceError(null);

    // 1) Czy w ogole warto probowac? Przegladarki wbudowane (Messenger itp.),
    //    brak https albo brak API - komunikat od razu, bez otwierania kanalu.
    const supportIssue = getVoiceSupportIssue();
    if (supportIssue) {
      console.warn(`🎤 [VOICE] Czat głosowy niedostępny: ${supportIssue.code}`);
      setVoiceError(supportIssue);
      return false;
    }

    isJoiningRef.current = true;
    setIsConnecting(true);

    try {
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
      clearPendingIce();
      setParticipants([]);

      // Stop poprzedni stream jeśli istnieje
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // 2) Mikrofon PRZED kanalem. Zgoda na mikrofon to pierwsza rzecz, ktora
      //    moze sie nie udac - lepiej dowiedziec sie o tym, zanim cokolwiek
      //    otworzymy, i jak najblizej klikniecia (iOS wiaze uprawnienia do
      //    audio z gestem uzytkownika).
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Z ustawien (domyslnie true). Wczesniej hardcode `true`, a przelacznik
            // "Echo cancellation" w panelu ustawien nie robil nic.
            echoCancellation: settings.echoCancellation,
            noiseSuppression: settings.noiseSupression,
            autoGainControl: true,
            sampleRate: 44100, // Wysoka jakość audio
            sampleSize: 16,
            channelCount: 1, // Mono dla lepszej wydajności
          },
        });
      } catch (error) {
        console.error('🎤 [VOICE] Błąd dostępu do mikrofonu:', error);
        setVoiceError(mapGetUserMediaError(error));
        return false;
      }

      localStreamRef.current = stream;

      // 3) Kanal sygnalizacji (czekamy na SUBSCRIBED)
      const channel = await setupVoiceChannel();
      if (!channel) {
        console.error('🎤 [VOICE] Nie można utworzyć kanału voice');
        abortJoin();
        setVoiceError(makeVoiceError('channel-failed'));
        return false;
      }
      console.log('🎤 [VOICE] ✅ Kanał voice gotowy, kontynuuję...');

      // Ustaw głośność mikrofonu
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        // Jeśli push-to-talk, wycisz na start
        audioTrack.enabled = !settings.pushToTalk;

        // Diagnostyka echa: co ZAZADALISMY vs co przegladarka FAKTYCZNIE ustawila
        // (echoCancellation, sampleRate itd. - patrz raport 21.09 o echu, test B).
        const constraints = audioTrack.getConstraints();
        console.log(`🎤 [VOICE] Audio track constraints:`, constraints);
        console.log(`🎤 [VOICE] Audio track settings:`, audioTrack.getSettings?.());
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
            if (peerConn.pc.connectionState === 'disconnected') {
              // Chwilowy zanik sieci: najpierw restart ICE na tym samym pc
              // (tania sciezka, bez nowego <audio>). Odtworzenie od zera dopiero
              // gdy przejdzie w `failed`/`closed` (galaz nizej).
              console.log(
                `🎤 [VOICE] 🔍 Połączenie z ${peerConn.username} rozłączone - restart ICE`
              );
              void restartIceConnection(odUserId, peerConn.username);
            } else if (
              peerConn.pc.connectionState === 'failed' ||
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
      return true;
    } catch (error) {
      console.error('🎤 [VOICE] Błąd dołączania do voice chat:', error);
      abortJoin();
      setVoiceError(makeVoiceError('unknown'));
      return false;
    } finally {
      isJoiningRef.current = false;
      setIsConnecting(false);
    }
  }, [
    user,
    isInVoiceChat,
    settings,
    startVoiceDetection,
    createPeerConnection,
    restartIceConnection,
    setupVoiceChannel,
    abortJoin,
    clearPendingIce,
  ]);

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
    clearPendingIce();
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
    setIsAudioBlocked(false);
  }, [user, stopVoiceDetection, cleanupUserConnections, clearPendingIce]);

  const clearVoiceError = useCallback(() => setVoiceError(null), []);

  const resumeAudio = useCallback(async () => {
    const ok = await resumeRemoteAudio();
    if (ok) setIsAudioBlocked(false);
  }, [resumeRemoteAudio]);

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

      // Echo cancellation / noise suppression w TRAKCIE rozmowy: applyConstraints
      // na zywym torze (best effort - jesli przegladarka nie wspiera zmiany w locie,
      // nowa wartosc i tak trafi do getUserMedia przy nastepnym dolaczeniu).
      if (
        (newSettings.echoCancellation !== undefined || newSettings.noiseSupression !== undefined) &&
        localStreamRef.current
      ) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        audioTrack
          ?.applyConstraints?.({
            echoCancellation: updated.echoCancellation,
            noiseSuppression: updated.noiseSupression,
            autoGainControl: true,
          })
          ?.catch((error: unknown) => {
            console.warn(
              '🎤 [VOICE] applyConstraints nieudane (zadziała od następnego dołączenia):',
              error
            );
          });
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
        voiceError,
        isAudioBlocked,
        clearVoiceError,
        resumeAudio,
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
