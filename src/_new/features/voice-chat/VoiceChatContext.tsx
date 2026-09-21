'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        VOICE CHAT CONTEXT
 *                   WebRTC P2P Voice Communication
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Provider sklada hooki o jednej odpowiedzialnosci (zachowanie 1:1 z wersja
 * monolityczna, patrz PR "voice-chat split"):
 * - useVoiceSettings      - ustawienia (localStorage) + natychmiastowe zastosowanie
 * - useWebRTCConnections  - polaczenia P2P (peer-connection-events, ice-candidate-queue, remote-audio)
 * - useVoiceSignaling     - kanal Supabase i zdarzenia voice-*
 * - useVoiceDetection     - wskaznik "mowi"
 * - useVoiceSession       - dolaczenie / wyjscie / watchdog (connection-watchdog)
 * - useMicControls        - mute, push-to-talk, skrot klawiszowy
 *
 * Przeplyw: 1) getUserMedia -> 2) kanal voice:{boardId} -> 3) voice-join ->
 * 4) offer/answer/ICE przez Broadcast -> 5) audio P2P (Xirsys TURN gdy trzeba).
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

import {
  VoiceParticipant,
  VoiceSettings,
  VoiceChatContextType,
  PeerConnection,
  VoiceEvent,
} from './types';
import type { VoiceError } from './mediaSupport';
import { useVoiceDetection } from './useVoiceDetection';
import { useVoiceSignaling } from './useVoiceSignaling';
import { useWebRTCConnections } from './useWebRTCConnections';
import { useVoiceSettings } from './useVoiceSettings';
import { useVoiceSession } from './useVoiceSession';
import { useMicControls } from './useMicControls';

export type { VoiceParticipant, VoiceSettings, VoiceChatContextType, PeerConnection, VoiceEvent };

const VoiceChatContext = createContext<VoiceChatContextType | undefined>(undefined);

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
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<VoiceError | null>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isInVoiceChatRef = useRef(false);
  const isMutedRef = useRef(false);

  // Refs do funkcji (rozwiazuje cykliczna zaleznosc w setupVoiceChannel)
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

  // Ustawienia: getter mapy polaczen odwoluje sie do peerConnectionsRef zdefiniowanego
  // nizej (wolany dopiero przy updateSettings, wiec juz po inicjalizacji).
  const { settings, updateSettings } = useVoiceSettings(
    () => peerConnectionsRef.current,
    localStreamRef
  );

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

  useEffect(() => {
    createPeerConnectionRef.current = createPeerConnection;
  }, [createPeerConnection]);
  useEffect(() => {
    handleOfferRef.current = handleOffer;
  }, [handleOffer]);

  const { startVoiceDetection, stopVoiceDetection } = useVoiceDetection(
    localStreamRef,
    channelRef,
    user?.id,
    setIsSpeaking
  );

  const onLeft = useCallback(() => setIsSpeaking(false), []);

  const session = useVoiceSession({
    user,
    settings,
    isInVoiceChat,
    isInVoiceChatRef,
    channelRef,
    localStreamRef,
    peerConnectionsRef,
    pendingConnectionsRef,
    connectionRetriesRef,
    connectionTimeoutsRef,
    lastSyncTimeRef,
    setParticipants,
    setIsInVoiceChat,
    setIsConnecting,
    setVoiceError,
    onLeft,
    setupVoiceChannel,
    startVoiceDetection,
    stopVoiceDetection,
    cleanupUserConnections,
    clearPendingIce,
    createPeerConnection,
    restartIceConnection,
  });

  const leaveVoiceChat = useCallback(() => {
    session.leaveVoiceChat();
    setIsMuted(false);
    setIsAudioBlocked(false);
  }, [session]);

  const { toggleMute, setMuted, startTalking, stopTalking } = useMicControls({
    user,
    settings,
    isInVoiceChat,
    isMuted,
    setIsMuted,
    localStreamRef,
    channelRef,
  });

  const clearVoiceError = useCallback(() => setVoiceError(null), []);

  const resumeAudio = useCallback(async () => {
    const ok = await resumeRemoteAudio();
    if (ok) setIsAudioBlocked(false);
  }, [resumeRemoteAudio]);

  // Sync ref z aktualna wersja funkcji + wyjscie z rozmowy przy odmontowaniu
  useEffect(() => {
    leaveVoiceChatRef.current = leaveVoiceChat;
  }, [leaveVoiceChat]);
  useEffect(() => {
    return () => {
      leaveVoiceChatRef.current?.();
    };
  }, []);

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
        joinVoiceChat: session.joinVoiceChat,
        leaveVoiceChat,
        toggleMute,
        setMuted: setMuted,
        updateSettings,
        startTalking,
        stopTalking,
      }}
    >
      {children}
    </VoiceChatContext.Provider>
  );
}

export function useVoiceChat() {
  const context = useContext(VoiceChatContext);
  return context; // Moze byc null jesli nie ma providera
}

export function useVoiceChatRequired() {
  const context = useContext(VoiceChatContext);
  if (!context) {
    throw new Error('useVoiceChatRequired must be used within VoiceChatProvider');
  }
  return context;
}
