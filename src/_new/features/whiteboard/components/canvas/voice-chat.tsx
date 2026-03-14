/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        VOICE CHAT COMPONENT
 *                   UI dla voice chat na tablicy
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Settings,
  Headphones,
  HeadphoneOff,
  ChevronDown,
  Check,
  PhoneOff,
} from 'lucide-react';
import { useVoiceChat } from '@/app/context/VoiceChatContext';
import VoiceChatSettings from './voice-chat-settings';
import { useUserAvatar } from '@/_new/shared/hooks/use-user-avatar';
import { Button } from '@/_new/shared/ui/button';
import { useAuth } from '@/app/context/AuthContext';

interface VoiceChatProps {
  className?: string;
  isVisible?: boolean;
}

interface AvatarContextMenuState {
  x: number;
  y: number;
  userId: number;
  username: string;
}

export default function VoiceChat({ className = '', isVisible = false }: VoiceChatProps) {
  const voiceChat = useVoiceChat();
  const { getAvatarColorClass, getInitials } = useUserAvatar();
  const { user: currentUser } = useAuth();

  const [isHovered, setIsHovered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [areControlsMounted, setAreControlsMounted] = useState(false);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [toastState, setToastState] = useState<{ id: number; message: string } | null>(null);
  const [isToastExiting, setIsToastExiting] = useState(false);
  const [joinPulse, setJoinPulse] = useState(false);
  const [inputDeviceName, setInputDeviceName] = useState('Domyslne');
  const [outputDeviceName, setOutputDeviceName] = useState('Domyslne');
  const [micLevel, setMicLevel] = useState(0);
  const [mutedRemoteUserIds, setMutedRemoteUserIds] = useState<number[]>([]);
  const [avatarContextMenu, setAvatarContextMenu] = useState<AvatarContextMenuState | null>(null);

  const previousIsInVoiceRef = useRef(false);
  const previousSpeakerVolumeRef = useRef(1);
  const previousMutedRef = useRef(false);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const controlsUnmountTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const toastExitTimerRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const avatarContextMenuRef = useRef<HTMLDivElement>(null);

  // Jeśli nie ma VoiceChatProvider, nie renderuj nic
  if (!voiceChat) {
    return null;
  }

  const {
    isInVoiceChat,
    isConnecting,
    participants,
    isMuted,
    isSpeaking,
    joinVoiceChat,
    leaveVoiceChat,
    toggleMute,
    setMuted,
    settings,
    updateSettings,
  } = voiceChat;

  const shouldRender = isVisible || participants.length > 0 || isInVoiceChat;

  const playNaturalCue = useCallback(
    (kind: 'join' | 'deafen' | 'undeafen' | 'leave' | 'mic-on' | 'mic-off' | 'menu') => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // Miękki "klik" z lekkim szumem zamiast ostrego beepa.
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < channel.length; i += 1) {
          channel[i] = (Math.random() * 2 - 1) * Math.exp((-6 * i) / channel.length);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = kind === 'join' ? 2600 : kind === 'menu' ? 2100 : 1800;

        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.0001;
        noiseGain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';

        if (kind === 'join') {
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
        } else if (kind === 'undeafen') {
          osc.frequency.setValueAtTime(500, now);
          osc.frequency.exponentialRampToValueAtTime(640, now + 0.1);
        } else if (kind === 'deafen') {
          osc.frequency.setValueAtTime(620, now);
          osc.frequency.exponentialRampToValueAtTime(420, now + 0.1);
        } else if (kind === 'mic-on') {
          osc.frequency.setValueAtTime(530, now);
          osc.frequency.exponentialRampToValueAtTime(690, now + 0.09);
        } else if (kind === 'mic-off') {
          osc.frequency.setValueAtTime(690, now);
          osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
        } else if (kind === 'menu') {
          osc.frequency.setValueAtTime(620, now);
          osc.frequency.exponentialRampToValueAtTime(700, now + 0.07);
        } else {
          osc.frequency.setValueAtTime(450, now);
          osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);
        }

        oscGain.gain.value = 0.0001;
        oscGain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + 0.13);
        osc.start(now);
        osc.stop(now + 0.15);

        window.setTimeout(() => {
          ctx.close().catch(() => {});
        }, 260);
      } catch {
        // best-effort audio feedback
      }
    },
    []
  );

  const refreshDeviceNames = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const input = devices.find((d) => d.kind === 'audioinput');
      const output = devices.find((d) => d.kind === 'audiooutput');

      setInputDeviceName(input?.label || 'Domyslne');
      setOutputDeviceName(output?.label || 'Domyslne');
    } catch {
      setInputDeviceName('Domyslne');
      setOutputDeviceName('Domyslne');
    }
  }, []);

  const clearToastTimers = useCallback(() => {
    if (toastExitTimerRef.current) {
      window.clearTimeout(toastExitTimerRef.current);
      toastExitTimerRef.current = null;
    }
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string) => {
      clearToastTimers();
      setToastState({ id: Date.now() + Math.floor(Math.random() * 1000), message });
      setIsToastExiting(false);

      toastExitTimerRef.current = window.setTimeout(() => setIsToastExiting(true), 2600);
      toastTimerRef.current = window.setTimeout(() => {
        setToastState(null);
        setIsToastExiting(false);
      }, 3200);
    },
    [clearToastTimers]
  );

  useEffect(() => {
    const wasInVoice = previousIsInVoiceRef.current;

    if (isInVoiceChat && !wasInVoice) {
      playNaturalCue('join');
      setJoinPulse(true);
      showToast('Pomyslnie dolaczono do czatu.');

      const pulseTimer = window.setTimeout(() => setJoinPulse(false), 1200);
      previousIsInVoiceRef.current = isInVoiceChat;

      return () => {
        window.clearTimeout(pulseTimer);
      };
    }

    if (!isInVoiceChat && wasInVoice) {
      showToast('Wyszedles z czatu glosowego.');
    }

    previousIsInVoiceRef.current = isInVoiceChat;
  }, [isInVoiceChat, playNaturalCue, showToast]);

  useEffect(() => {
    if (!isInVoiceChat) {
      setIsDeafened(false);
      setShowMicMenu(false);
      setShowSpeakerMenu(false);
      setAvatarContextMenu(null);
    }
  }, [isInVoiceChat]);

  useEffect(() => {
    refreshDeviceNames();
    const onDeviceChange = () => refreshDeviceNames();
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
    };
  }, [refreshDeviceNames]);

  useEffect(() => {
    const closeContextMenu = () => {
      // no-op, handled in mousedown with target checks
    };
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, []);

  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent) => {
      const targetNode = e.target as Node;
      const clickedInsideRoot = !!rootRef.current?.contains(targetNode);
      const clickedInsideContext = !!avatarContextMenuRef.current?.contains(targetNode);

      if (!clickedInsideRoot) {
        setShowMicMenu(false);
        setShowSpeakerMenu(false);
      }

      if (!clickedInsideRoot && !clickedInsideContext) {
        setAvatarContextMenu(null);
      }
    };

    window.addEventListener('mousedown', handlePointerDownOutside);
    return () => window.removeEventListener('mousedown', handlePointerDownOutside);
  }, []);

  useEffect(() => {
    return () => {
      clearToastTimers();
      if (hoverCloseTimerRef.current) {
        window.clearTimeout(hoverCloseTimerRef.current);
      }
      if (controlsUnmountTimerRef.current) {
        window.clearTimeout(controlsUnmountTimerRef.current);
      }
    };
  }, [clearToastTimers]);

  useEffect(() => {
    if (!showMicMenu || !isInVoiceChat) {
      setMicLevel(0);
      return;
    }

    let isMounted = true;
    let frameId = 0;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    const startMeter = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext();

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!isMounted) return;

          analyser.getByteFrequencyData(data);
          const avg = data.reduce((acc, val) => acc + val, 0) / data.length;
          const normalized = Math.min(avg / 100, 1);
          setMicLevel(normalized);
          frameId = requestAnimationFrame(tick);
        };

        tick();
      } catch {
        setMicLevel(0);
      }
    };

    startMeter();

    return () => {
      isMounted = false;
      if (frameId) cancelAnimationFrame(frameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, [showMicMenu, isInVoiceChat]);

  if (!shouldRender) {
    return null;
  }

  const isRemoteMutedLocally = (userId: number) => mutedRemoteUserIds.includes(userId);

  const handleToggleMic = () => {
    if (!isInVoiceChat || isDeafened) return;
    toggleMute();
    playNaturalCue(isMuted ? 'mic-on' : 'mic-off');
  };

  const handleJoinOrToggleMicMenu = async () => {
    if (!isInVoiceChat) {
      await joinVoiceChat();
      setShowMicMenu(true);
      setShowSpeakerMenu(false);
      return;
    }

    setShowMicMenu((prev) => !prev);
    setShowSpeakerMenu(false);
  };

  const handleToggleSpeakerMenu = async () => {
    if (!isInVoiceChat) {
      await joinVoiceChat();
      setShowSpeakerMenu(true);
      setShowMicMenu(false);
      return;
    }

    setShowSpeakerMenu((prev) => !prev);
    setShowMicMenu(false);
  };

  const handleToggleDeafen = () => {
    if (!isInVoiceChat) return;

    if (!isDeafened) {
      playNaturalCue('deafen');
      previousSpeakerVolumeRef.current = settings.speakerVolume > 0 ? settings.speakerVolume : 1;
      previousMutedRef.current = isMuted;
      updateSettings({ speakerVolume: 0 });
      setMuted(true);
      setIsDeafened(true);
      return;
    }

    playNaturalCue('undeafen');
    updateSettings({ speakerVolume: previousSpeakerVolumeRef.current });
    setMuted(previousMutedRef.current);
    setIsDeafened(false);
  };

  const handleDisconnect = () => {
    leaveVoiceChat();
    setShowMicMenu(false);
    setShowSpeakerMenu(false);
    playNaturalCue('leave');
    showToast('Wyszedles z czatu glosowego.');
  };

  const toggleLocalMuteForUser = (userId: number) => {
    setMutedRemoteUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <>
      <div ref={rootRef} className={`relative ml-auto w-fit ${className}`}>
        <div
          onMouseEnter={() => {
            if (hoverCloseTimerRef.current) {
              window.clearTimeout(hoverCloseTimerRef.current);
              hoverCloseTimerRef.current = null;
            }

            if (controlsUnmountTimerRef.current) {
              window.clearTimeout(controlsUnmountTimerRef.current);
              controlsUnmountTimerRef.current = null;
            }

            setAreControlsMounted(true);
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            if (hoverCloseTimerRef.current) {
              window.clearTimeout(hoverCloseTimerRef.current);
            }

            hoverCloseTimerRef.current = window.setTimeout(() => {
              setIsHovered(false);
              setShowMicMenu(false);
              setShowSpeakerMenu(false);

              if (controlsUnmountTimerRef.current) {
                window.clearTimeout(controlsUnmountTimerRef.current);
              }

              controlsUnmountTimerRef.current = window.setTimeout(() => {
                setAreControlsMounted(false);
              }, 420);
            }, 2000);
          }}
          className={`h-14 px-4 rounded-2xl border flex items-center justify-between transition-all duration-500 ease-in-out ${
            joinPulse
              ? 'border-green-400 shadow-[0_0_0_2px_rgba(74,222,128,0.25),0_6px_18px_rgba(34,197,94,0.25)]'
              : isHovered
                ? 'border-gray-300/80 shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                : 'border-transparent shadow-none'
          } ${
            isHovered
              ? 'bg-white/95 backdrop-blur-xl border-gray-300/80 shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
              : 'bg-transparent border-transparent shadow-none px-0 justify-end h-10 w-fit'
          }`}
        >
          <div className={`flex items-center min-w-0 transition-all duration-500 ease-in-out ${isHovered ? 'gap-2' : 'gap-0'}`}>
            <div className="flex -space-x-1.5">
              {participants.map((participant) => {
                const avatarColorClass = getAvatarColorClass(participant.odUserId);
                const initials = getInitials(participant.username);
                const isCurrentUser = participant.odUserId === currentUser?.id;
                const mutedLocally = isRemoteMutedLocally(participant.odUserId);
                const showMutedMic = participant.isMuted;
                const showMutedHeadphones = mutedLocally || (isCurrentUser && isDeafened);

                return (
                  <div
                    key={participant.odUserId}
                    onContextMenu={(e) => {
                      if (isCurrentUser) return;
                      e.preventDefault();
                      setAvatarContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        userId: participant.odUserId,
                        username: participant.username,
                      });
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm border-2 border-white transition-all ${avatarColorClass} ${
                      participant.isSpeaking || (isCurrentUser && isSpeaking)
                        ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-white'
                        : ''
                    }`}
                    style={{
                      opacity: mutedLocally ? 0.45 : 1,
                      filter: mutedLocally ? 'grayscale(0.3)' : 'none',
                    }}
                    title={participant.username}
                  >
                    {initials}

                    {showMutedMic && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-500 border border-white flex items-center justify-center">
                        <MicOff className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}

                    {showMutedHeadphones && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border border-white flex items-center justify-center">
                        <HeadphoneOff className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {areControlsMounted && (
            <div
              className={`flex items-center gap-1 transition-all duration-400 ease-in-out ${
                isHovered ? 'opacity-100 translate-x-0 ml-6' : 'opacity-0 translate-x-2 ml-0 pointer-events-none'
              }`}
            >
              <div className="relative flex items-center gap-0">
                <div className="flex items-center rounded-lg border border-gray-300 bg-gray-100/90 overflow-hidden h-9 transition-all duration-300 ease-in-out">
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    disabled={!isInVoiceChat || isConnecting || isDeafened}
                    className={`w-8 h-9 flex items-center justify-center transition-colors ${
                      isMuted || isDeafened
                        ? 'text-red-600 bg-red-50 hover:bg-red-100'
                        : 'text-gray-700 hover:bg-gray-200'
                    } ${!isInVoiceChat || isConnecting || isDeafened ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isMuted || isDeafened ? 'Odblokuj mikrofon' : 'Wycisz mikrofon'}
                  >
                    {isMuted || isDeafened ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleJoinOrToggleMicMenu}
                    disabled={isConnecting}
                    className="w-7 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-200 border-l border-gray-300 transition-colors ease-in-out"
                    title="Menu mikrofonu"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMicMenu ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {showMicMenu && (
                  <div
                    className="absolute top-full right-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-2xl z-50 p-4 space-y-4 animate-[menuIn_220ms_ease-out_forwards]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-800">Urzadzenie nagrywania</p>
                      <p className="text-xs text-gray-500 truncate">{inputDeviceName}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-800">Glosnosc mikrofonu</p>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.microphoneVolume}
                        onChange={(e) =>
                          updateSettings({ microphoneVolume: parseFloat(e.target.value) })
                        }
                        className="w-full accent-gray-700"
                      />
                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all duration-100"
                          style={{ width: `${Math.round(micLevel * 100)}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMicMenu(false);
                        setShowSettings(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 px-3 py-2 text-sm text-gray-700"
                    >
                      <Settings className="w-4 h-4" />
                      Ustawienia glosu
                    </button>
                  </div>
                )}
            </div>

              <div className="relative flex items-center gap-0">
                <div className="flex items-center rounded-lg border border-gray-300 bg-gray-100/90 overflow-hidden h-9 transition-all duration-300 ease-in-out">
                  <button
                    type="button"
                    onClick={handleToggleDeafen}
                    disabled={!isInVoiceChat || isConnecting}
                    className={`w-8 h-9 flex items-center justify-center transition-colors ${
                      isDeafened
                        ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                        : 'text-gray-700 hover:bg-gray-200'
                    } ${!isInVoiceChat || isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isDeafened ? 'Wlacz dzwiek kanalu' : 'Wycisz kanal u siebie'}
                  >
                    {isDeafened ? (
                      <HeadphoneOff className="w-4 h-4" />
                    ) : (
                      <Headphones className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleSpeakerMenu}
                    disabled={isConnecting}
                    className="w-7 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-200 border-l border-gray-300 transition-colors ease-in-out"
                    title="Menu sluchawek"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSpeakerMenu ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {showSpeakerMenu && (
                  <div
                    className="absolute top-full right-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-2xl z-50 p-4 space-y-4 animate-[menuIn_220ms_ease-out_forwards]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-800">Urzadzenie odtwarzania</p>
                      <p className="text-xs text-gray-500 truncate">{outputDeviceName}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-800">Glosnosc wyjscia</p>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.speakerVolume}
                        onChange={(e) =>
                          updateSettings({ speakerVolume: parseFloat(e.target.value) })
                        }
                        className="w-full accent-gray-700"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSpeakerMenu(false);
                        setShowSettings(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 px-3 py-2 text-sm text-gray-700"
                    >
                      <Settings className="w-4 h-4" />
                      Ustawienia glosu
                    </button>
                  </div>
                )}
            </div>

              <Button
                type="button"
                variant="secondary"
                size="iconSm"
                onClick={() => setShowSettings(true)}
                disabled={!isInVoiceChat || isConnecting}
                className="rounded-xl border border-gray-300 bg-gray-100/90 text-gray-700 hover:bg-gray-200 h-9 w-9"
                title="Ogolne ustawienia dzwieku"
              >
                <Settings className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="iconSm"
                onClick={handleDisconnect}
                disabled={!isInVoiceChat || isConnecting}
                className="rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 h-9 w-9"
                title="Rozlacz"
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
            </div>
          )}

        </div>
        <style jsx>{`
          @keyframes menuIn {
            from {
              opacity: 0;
              transform: translateY(-6px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}</style>
      </div>

      {toastState && (
        <div className="fixed inset-x-0 bottom-8 z-[1200] pointer-events-none flex justify-center px-4">
          <div
            className={`whiteboard-toast-base ${isToastExiting ? 'whiteboard-toast-exit' : 'whiteboard-toast-enter'}`}
          >
            <span className="inline-flex items-center gap-2">
              <Check className="w-4 h-4 text-gray-300" />
              {toastState.message}
            </span>
          </div>
        </div>
      )}

      {avatarContextMenu && (
        <div
          ref={avatarContextMenuRef}
          className="fixed z-[170] min-w-[220px] rounded-xl border border-gray-200 bg-white shadow-xl p-1.5"
          style={{ left: avatarContextMenu.x, top: avatarContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              toggleLocalMuteForUser(avatarContextMenu.userId);
              setAvatarContextMenu(null);
            }}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <span>
              Wycisz: <span className="font-medium">{avatarContextMenu.username}</span>
            </span>
            {isRemoteMutedLocally(avatarContextMenu.userId) && <Check className="w-4 h-4 text-green-600" />}
          </button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && <VoiceChatSettings onClose={() => setShowSettings(false)} />}
    </>
  );
}
