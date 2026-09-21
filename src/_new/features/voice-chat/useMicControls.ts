/**
 * Sterowanie mikrofonem w trakcie rozmowy: mute/unmute (z broadcastem voice-mute),
 * push-to-talk (startTalking/stopTalking + skrot klawiszowy). Wydzielone z
 * VoiceChatContext, zachowanie 1:1.
 */
import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { VoiceSettings } from './types';

interface Deps {
  user: { id: number; username: string } | null;
  settings: VoiceSettings;
  isInVoiceChat: boolean;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  localStreamRef: MutableRefObject<MediaStream | null>;
  channelRef: MutableRefObject<RealtimeChannel | null>;
}

export function useMicControls({
  user,
  settings,
  isInVoiceChat,
  isMuted,
  setIsMuted,
  localStreamRef,
  channelRef,
}: Deps) {
  const broadcastMute = useCallback(
    (muted: boolean) => {
      if (!user) return;
      channelRef.current?.send({
        type: 'broadcast',
        event: 'voice-mute',
        payload: { type: 'voice-mute', userId: user.id, isMuted: muted },
      });
    },
    [user, channelRef]
  );

  const setMuted = useCallback(
    (muted: boolean) => {
      if (!localStreamRef.current || !user) return;
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !muted;
        setIsMuted(muted);
        broadcastMute(muted);
      }
    },
    [user, localStreamRef, setIsMuted, broadcastMute]
  );

  const toggleMute = useCallback(() => setMuted(!isMuted), [setMuted, isMuted]);

  const startTalking = useCallback(() => {
    if (!settings.pushToTalk || !localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = true;
  }, [settings.pushToTalk, localStreamRef]);

  const stopTalking = useCallback(() => {
    if (!settings.pushToTalk || !localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = false;
  }, [settings.pushToTalk, localStreamRef]);

  // Skrot klawiszowy push-to-talk (tylko w rozmowie i tylko w trybie PTT)
  useEffect(() => {
    if (!isInVoiceChat || !settings.pushToTalk) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === settings.pushToTalkKey && !e.repeat) startTalking();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === settings.pushToTalkKey) stopTalking();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isInVoiceChat, settings.pushToTalk, settings.pushToTalkKey, startTalking, stopTalking]);

  return { toggleMute, setMuted, startTalking, stopTalking };
}
