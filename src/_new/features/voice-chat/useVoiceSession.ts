/**
 * Cykl zycia rozmowy: dolaczenie (mikrofon -> kanal -> ogloszenie -> sync -> watchdog),
 * przerwanie nieudanego dolaczania, wyjscie. Wydzielone z VoiceChatContext, logika
 * i kolejnosc krokow 1:1 (patrz komentarze w joinVoiceChat).
 */
import { useCallback, useRef, type MutableRefObject } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PeerConnection, VoiceParticipant, VoiceSettings } from './types';
import {
  getVoiceSupportIssue,
  mapGetUserMediaError,
  voiceError as makeVoiceError,
  type VoiceError,
} from './mediaSupport';
import { closePeerConnection } from './remote-audio';
import { startConnectionWatchdog } from './connection-watchdog';
import { createLogger } from '@/_new/lib/logger';

const log = createLogger('voice-chat/useVoiceSession');

interface Deps {
  user: { id: number; username: string } | null;
  settings: VoiceSettings;
  isInVoiceChat: boolean;
  isInVoiceChatRef: MutableRefObject<boolean>;
  channelRef: MutableRefObject<RealtimeChannel | null>;
  localStreamRef: MutableRefObject<MediaStream | null>;
  peerConnectionsRef: MutableRefObject<Map<number, PeerConnection>>;
  pendingConnectionsRef: MutableRefObject<Set<number>>;
  connectionRetriesRef: MutableRefObject<Map<number, number>>;
  connectionTimeoutsRef: MutableRefObject<Map<number, NodeJS.Timeout>>;
  lastSyncTimeRef: MutableRefObject<Map<string | number, number>>;
  setParticipants: React.Dispatch<React.SetStateAction<VoiceParticipant[]>>;
  setIsInVoiceChat: (v: boolean) => void;
  setIsConnecting: (v: boolean) => void;
  setVoiceError: (e: VoiceError | null) => void;
  onLeft: () => void;
  setupVoiceChannel: () => Promise<RealtimeChannel | null>;
  startVoiceDetection: () => void;
  stopVoiceDetection: () => void;
  cleanupUserConnections: (userId: number) => void;
  clearPendingIce: (userId?: number) => void;
  createPeerConnection: (id: number, username: string, isInitiator: boolean) => Promise<void>;
  restartIceConnection: (id: number, username: string) => Promise<boolean>;
}

export function useVoiceSession(d: Deps) {
  const {
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
  } = d;

  // Blokada podwojnego tapniecia w trakcie dolaczania (czeste na telefonie).
  const isJoiningRef = useRef(false);
  // Uchwyt watchdoga polaczen (interval) - czyszczony przy wyjsciu.
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendSelf = useCallback(
    (event: 'voice-join' | 'voice-request-sync' | 'voice-leave') => {
      if (!user) return;
      const payload =
        event === 'voice-join'
          ? { type: event, userId: user.id, username: user.username }
          : { type: event, userId: user.id };
      channelRef.current?.send({ type: 'broadcast', event, payload });
    },
    [user, channelRef]
  );

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, [localStreamRef]);

  const clearConnectionBookkeeping = useCallback(() => {
    pendingConnectionsRef.current.clear();
    lastSyncTimeRef.current.clear();
    connectionRetriesRef.current.clear();
    connectionTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    connectionTimeoutsRef.current.clear();
    clearPendingIce();
  }, [
    pendingConnectionsRef,
    lastSyncTimeRef,
    connectionRetriesRef,
    connectionTimeoutsRef,
    clearPendingIce,
  ]);

  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  /**
   * Sprzata wszystko po nieudanym dolaczeniu: mikrofon, detekcje glosu,
   * polaczenia P2P i kanal. Wczesniej po odmowie mikrofonu kanal zostawal
   * otwarty, a stan byl pol-dolaczony.
   */
  const abortJoin = useCallback(() => {
    stopLocalStream();
    stopVoiceDetection();

    peerConnectionsRef.current.forEach((_peerConn, userId) => cleanupUserConnections(userId));
    clearConnectionBookkeeping();
    stopWatchdog();

    const channel = channelRef.current;
    channelRef.current = null;
    channel?.unsubscribe();

    isInVoiceChatRef.current = false;
    setIsInVoiceChat(false);
    setParticipants([]);
    onLeft();
  }, [
    stopLocalStream,
    stopVoiceDetection,
    peerConnectionsRef,
    cleanupUserConnections,
    clearConnectionBookkeeping,
    stopWatchdog,
    channelRef,
    isInVoiceChatRef,
    setIsInVoiceChat,
    setParticipants,
    onLeft,
  ]);

  const joinVoiceChat = useCallback(async (): Promise<boolean> => {
    if (!user || isInVoiceChat || isJoiningRef.current) return false;

    setVoiceError(null);

    // 1) Czy w ogole warto probowac? Przegladarki wbudowane (Messenger itp.),
    //    brak https albo brak API - komunikat od razu, bez otwierania kanalu.
    const supportIssue = getVoiceSupportIssue();
    if (supportIssue) {
      log.warn(`Czat głosowy niedostępny: ${supportIssue.code}`);
      setVoiceError(supportIssue);
      return false;
    }

    isJoiningRef.current = true;
    setIsConnecting(true);

    try {
      // CLEAN START - wyczysc WSZYSTKO przed dolaczeniem
      log.info('🧹 Clean start - czyszczę wszystkie poprzednie połączenia...');
      peerConnectionsRef.current.forEach((peerConn) => closePeerConnection(peerConn));
      peerConnectionsRef.current.clear();
      clearConnectionBookkeeping();
      setParticipants([]);
      stopLocalStream();

      // 2) Mikrofon PRZED kanalem. Zgoda na mikrofon to pierwsza rzecz, ktora
      //    moze sie nie udac - lepiej dowiedziec sie o tym, zanim cokolwiek
      //    otworzymy, i jak najblizej klikniecia (iOS wiaze uprawnienia do
      //    audio z gestem uzytkownika).
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Z ustawien (domyslnie true) - przelacznik "Echo cancellation" w panelu.
            echoCancellation: settings.echoCancellation,
            noiseSuppression: settings.noiseSupression,
            autoGainControl: true,
            sampleRate: 44100, // Wysoka jakosc audio
            sampleSize: 16,
            channelCount: 1, // Mono dla lepszej wydajnosci
          },
        });
      } catch (error) {
        log.error('Błąd dostępu do mikrofonu:', error);
        setVoiceError(mapGetUserMediaError(error));
        return false;
      }

      localStreamRef.current = stream;

      // 3) Kanal sygnalizacji (czekamy na SUBSCRIBED)
      const channel = await setupVoiceChannel();
      if (!channel) {
        log.error('Nie można utworzyć kanału voice');
        abortJoin();
        setVoiceError(makeVoiceError('channel-failed'));
        return false;
      }
      log.info('✅ Kanał voice gotowy, kontynuuję...');

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        // Jesli push-to-talk, wycisz na start
        audioTrack.enabled = !settings.pushToTalk;
        // Diagnostyka echa: co ZAZADALISMY vs co przegladarka FAKTYCZNIE ustawila
        log.debug(`Audio track constraints:`, audioTrack.getConstraints());
        log.debug(`Audio track settings:`, audioTrack.getSettings?.());
      }

      setIsInVoiceChat(true);
      startVoiceDetection();

      // 4) Ogloszenie + my na liscie uczestnikow
      sendSelf('voice-join');
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

      // 5) request-sync po 0,5 s i 2 s (backup); po 5 s tylko gdy nadal brak polaczen P2P
      setTimeout(() => {
        if (isInVoiceChatRef.current) {
          log.info('Wysyłam voice-request-sync...');
          sendSelf('voice-request-sync');
        }
      }, 500);
      setTimeout(() => {
        if (isInVoiceChatRef.current) {
          log.info('Backup voice-request-sync...');
          sendSelf('voice-request-sync');
        }
      }, 2000);
      setTimeout(() => {
        if (isInVoiceChatRef.current && peerConnectionsRef.current.size === 0) {
          log.info('⚠️ Brak połączeń P2P - wysyłam force request-sync');
          sendSelf('voice-request-sync');
        }
      }, 5000);

      // 6) Watchdog polaczen co 10 s
      stopWatchdog();
      watchdogRef.current = startConnectionWatchdog({
        userId: user.id,
        isInVoiceChatRef,
        channelRef,
        peerConnectionsRef,
        connectionRetriesRef,
        restartIceConnection,
        createPeerConnection,
      });

      log.info('Dołączono do voice chat!');
      return true;
    } catch (error) {
      log.error('Błąd dołączania do voice chat:', error);
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
    setVoiceError,
    setIsConnecting,
    peerConnectionsRef,
    clearConnectionBookkeeping,
    setParticipants,
    stopLocalStream,
    localStreamRef,
    setupVoiceChannel,
    abortJoin,
    setIsInVoiceChat,
    startVoiceDetection,
    sendSelf,
    isInVoiceChatRef,
    stopWatchdog,
    channelRef,
    connectionRetriesRef,
    restartIceConnection,
    createPeerConnection,
  ]);

  const leaveVoiceChat = useCallback(() => {
    if (!user) return;

    log.info('Opuszczam voice chat');

    stopWatchdog();
    peerConnectionsRef.current.forEach((_peerConn, userId) => cleanupUserConnections(userId));
    clearConnectionBookkeeping();
    stopLocalStream();
    stopVoiceDetection();

    sendSelf('voice-leave');

    // LAZY CLEANUP: usun kanal voice po opuszczeniu - male opoznienie,
    // zeby voice-leave zdazylo sie wyslac
    const channelToClose = channelRef.current;
    channelRef.current = null;
    if (channelToClose) {
      setTimeout(() => {
        log.info('Czyszczę kanał voice po opuszczeniu');
        channelToClose.unsubscribe();
      }, 100);
    }

    setIsInVoiceChat(false);
    setParticipants([]);
    onLeft();
  }, [
    user,
    stopWatchdog,
    peerConnectionsRef,
    cleanupUserConnections,
    clearConnectionBookkeeping,
    stopLocalStream,
    stopVoiceDetection,
    sendSelf,
    channelRef,
    setIsInVoiceChat,
    setParticipants,
    onLeft,
  ]);

  return { joinVoiceChat, leaveVoiceChat };
}
