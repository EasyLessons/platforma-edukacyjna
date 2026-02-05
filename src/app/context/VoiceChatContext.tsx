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

'use client';

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
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPY
// ═══════════════════════════════════════════════════════════════════════════

export interface VoiceParticipant {
  odUserId: number;
  username: string;
  isSpeaking: boolean;
  isMuted: boolean;
  volume: number; // 0-1
}

export interface VoiceSettings {
  microphoneVolume: number; // 0-1
  speakerVolume: number; // 0-1
  pushToTalk: boolean;
  pushToTalkKey: string; // np. 'Space', 'KeyV'
  noiseSupression: boolean;
  echoCancellation: boolean;
}

interface PeerConnection {
  odUserId: number;
  username: string;
  pc: RTCPeerConnection;
  audioElement?: HTMLAudioElement;
}

type VoiceEvent =
  | { type: 'voice-join'; userId: number; username: string }
  | { type: 'voice-leave'; userId: number }
  | { type: 'voice-sync'; userId: number; username: string; isMuted: boolean } // Odpowiedź "jestem w voice chat"
  | { type: 'voice-request-sync'; userId: number } // Prośba o sync od nowego użytkownika
  | {
      type: 'voice-offer';
      fromUserId: number;
      fromUsername: string;
      toUserId: number;
      offer: RTCSessionDescriptionInit;
    }
  | {
      type: 'voice-answer';
      fromUserId: number;
      toUserId: number;
      answer: RTCSessionDescriptionInit;
    }
  | { type: 'voice-ice'; fromUserId: number; toUserId: number; candidate: RTCIceCandidateInit }
  | { type: 'voice-mute'; userId: number; isMuted: boolean }
  | { type: 'voice-speaking'; userId: number; isSpeaking: boolean };

interface VoiceChatContextType {
  // Stan
  isInVoiceChat: boolean;
  isConnecting: boolean;
  participants: VoiceParticipant[];
  settings: VoiceSettings;
  isMuted: boolean;
  isSpeaking: boolean;

  // Akcje
  joinVoiceChat: () => Promise<void>;
  leaveVoiceChat: () => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  updateSettings: (settings: Partial<VoiceSettings>) => void;

  // Push-to-talk
  startTalking: () => void;
  stopTalking: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎁 CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const VoiceChatContext = createContext<VoiceChatContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 📦 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS: VoiceSettings = {
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
// WAŻNE: Dla produkcji potrzebujesz WŁASNEGO TURN servera!
// Darmowe opcje:
// 1. Metered.ca (500MB/mies free) - https://www.metered.ca/stun-turn
// 2. Twilio (płatne ale niezawodne)
// 3. Self-hosted coturn
//
// Ustaw credentials w env variables:
// NEXT_PUBLIC_TURN_URL, NEXT_PUBLIC_TURN_USERNAME, NEXT_PUBLIC_TURN_CREDENTIAL

const getIceServers = async (): Promise<RTCIceServer[]> => {
  const servers: RTCIceServer[] = [
    // STUN servers (darmowe, do odkrywania publicznego IP)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // XIRSYS TURN - pobierz aktualne serwery z API
  // ═══════════════════════════════════════════════════════════════════════════
  const xirsysIdent = process.env.NEXT_PUBLIC_XIRSYS_IDENT;
  const xirsysSecret = process.env.NEXT_PUBLIC_XIRSYS_SECRET;
  const xirsysChannel = process.env.NEXT_PUBLIC_XIRSYS_CHANNEL;

  if (xirsysIdent && xirsysSecret && xirsysChannel) {
    try {
      console.log('🎤 [VOICE] 🔍 Pobieram serwery TURN z Xirsys API...');

      const auth = btoa(`${xirsysIdent}:${xirsysSecret}`);

      const response = await fetch(`https://global.xirsys.net/_turn/${xirsysChannel}`, {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format: 'urls' }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎤 [VOICE] ✅ Xirsys API response:', data);
        console.log('🎤 [VOICE] 📊 data.v struktura:', JSON.stringify(data.v, null, 2));

        if (data.s === 'ok' && data.v) {
          // Xirsys API może zwracać różne formaty
          let xirsysServers = [];

          if (data.v.iceServers && Array.isArray(data.v.iceServers)) {
            // Format 1: { v: { iceServers: [...] } }
            console.log('🎤 [VOICE] 📋 Format: v.iceServers array');
            xirsysServers = data.v.iceServers;
          } else if (Array.isArray(data.v)) {
            // Format 2: { v: [...] } - bezpośrednio array
            console.log('🎤 [VOICE] 📋 Format: v jest array');
            xirsysServers = data.v;
          } else if (typeof data.v === 'object') {
            // Format 3: może być { v: { stun: [...], turn: [...] } }
            console.log('🎤 [VOICE] 📋 Format: v jest object, sprawdzam właściwości');
            const vKeys = Object.keys(data.v);
            console.log('🎤 [VOICE] 🔑 Klucze w data.v:', vKeys);

            // Spróbuj różnych kluczy
            if (data.v.stun && data.v.turn) {
              xirsysServers = [...data.v.stun, ...data.v.turn];
            } else if (data.v.urls && Array.isArray(data.v.urls)) {
              xirsysServers = data.v.urls;
            } else if (data.v.iceServers) {
              // 🎯 XIRSYS SPECIFIC FORMAT: { iceServers: { username, urls[], credential } }
              const xirsysData = data.v.iceServers;
              if (
                xirsysData.urls &&
                Array.isArray(xirsysData.urls) &&
                xirsysData.username &&
                xirsysData.credential
              ) {
                console.log('🎤 [VOICE] 🎯 Konwertuję format Xirsys na RTCIceServer');

                // Przekształć format Xirsys: { username, urls[], credential }
                // Na standardowy: [{ urls: url1, username, credential }, { urls: url2, username, credential }]
                xirsysServers = xirsysData.urls.map((url: string) => ({
                  urls: url,
                  username: xirsysData.username,
                  credential: xirsysData.credential,
                }));

                console.log('🎤 [VOICE] ✅ Przekształcono Xirsys serwery:', xirsysServers.length);
              }
            } else {
              // Ostatnia próba - może to są bezpośrednio serwery ICE
              const firstValue = Object.values(data.v)[0];
              if (Array.isArray(firstValue)) {
                xirsysServers = firstValue;
              }
            }
          }

          console.log('🎤 [VOICE] 🎯 Xirsys servers do dodania:', xirsysServers);

          if (Array.isArray(xirsysServers) && xirsysServers.length > 0) {
            console.log('🎤 [VOICE] ✅ Dodaję serwery Xirsys:', xirsysServers.length);
            servers.push(...xirsysServers);
            return servers;
          } else {
            console.error('🎤 [VOICE] ❌ Nie mogę sparsować Xirsys serwerów:', xirsysServers);
          }
        } else {
          console.error('🎤 [VOICE] ❌ Xirsys API error:', data);
        }
      } else {
        console.error('🎤 [VOICE] ❌ Xirsys API HTTP error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('🎤 [VOICE] ❌ Xirsys API fetch error:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: Publiczne darmowe TURN serwery (mniej niezawodne)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🎤 [VOICE] ⚠️ Używam fallback TURN serwerów');
  servers.push(
    // NUMB (viagenie.ca) - darmowy publiczny TURN
    {
      urls: 'turn:numb.viagenie.ca:3478',
      username: 'webrtc@live.com',
      credential: 'muazkh',
    },
    {
      urls: 'turn:numb.viagenie.ca:3478?transport=tcp',
      username: 'webrtc@live.com',
      credential: 'muazkh',
    },
    // OpenRelay (metered.ca) - backup
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  );

  return servers;
};

// Tymczasowy sync fallback dla inicjalizacji
const getBasicIceServers = (): RTCIceServer[] => {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Fallback TURN
    {
      urls: 'turn:numb.viagenie.ca:3478',
      username: 'webrtc@live.com',
      credential: 'muazkh',
    },
  ];
};

const RTC_CONFIG_BASIC: RTCConfiguration = {
  iceServers: getBasicIceServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
};

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
  const peerConnectionsRef = useRef<Map<number, PeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs do śledzenia aktualnego stanu (potrzebne w event listenerach)
  const isInVoiceChatRef = useRef(false);
  const isMutedRef = useRef(false);
  
  // Refs do funkcji (rozwiązuje circular dependency w setupVoiceChannel)
  const createPeerConnectionRef = useRef<((remoteUserId: number, remoteUsername: string, isInitiator: boolean) => Promise<void>) | null>(null);
  const handleOfferRef = useRef<((fromUserId: number, fromUsername: string, offer: RTCSessionDescriptionInit) => Promise<void>) | null>(null);
  const leaveVoiceChatRef = useRef<(() => void) | null>(null);

  // Debounce i throttling
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<Map<string | number, number>>(new Map());
  const pendingConnectionsRef = useRef<Set<number>>(new Set());

  // Retry mechanizmy
  const connectionRetriesRef = useRef<Map<number, number>>(new Map());
  const connectionTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const MAX_CONNECTION_RETRIES = 3;
  const CONNECTION_TIMEOUT = 10000; // 10 sekund

  // Cleanup helper
  const cleanupUserConnections = useCallback((userId: number) => {
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
  }, []);

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
  // 🛡️ OPTYMALIZACJA: Kanał tworzony TYLKO gdy użytkownik dołączy do voice chat
  // To zapobiega tworzeniu niepotrzebnych kanałów Supabase dla każdego użytkownika

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
        const { userId: requestingUserId } = payload as VoiceEvent & { type: 'voice-request-sync' };
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

        setParticipants((prev) => prev.map((p) => (p.odUserId === userId ? { ...p, isMuted } : p)));
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

  // ───────────────────────────────────────────────────────────────────────
  // 🎙️ WEBRTC PEER CONNECTIONS
  // ───────────────────────────────────────────────────────────────────────

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
    [user, settings.speakerVolume, cleanupUserConnections]
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
    [user, createPeerConnection, cleanupUserConnections]
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

  const startVoiceDetection = useCallback(() => {
    if (!localStreamRef.current) return;

    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();

    const source = audioContextRef.current.createMediaStreamSource(localStreamRef.current);
    source.connect(analyserRef.current);

    analyserRef.current.fftSize = 256;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let wasSpeaking = false;

    speakingCheckIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Oblicz średnią głośność
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const speaking = average > 30; // Próg detekcji

      if (speaking !== wasSpeaking) {
        wasSpeaking = speaking;
        setIsSpeaking(speaking);

        // Broadcast speaking status
        channelRef.current?.send({
          type: 'broadcast',
          event: 'voice-speaking',
          payload: {
            type: 'voice-speaking',
            userId: user?.id,
            isSpeaking: speaking,
          },
        });
      }
    }, 100);
  }, [user]);

  const stopVoiceDetection = useCallback(() => {
    if (speakingCheckIntervalRef.current) {
      clearInterval(speakingCheckIntervalRef.current);
      speakingCheckIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
  }, []);

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
