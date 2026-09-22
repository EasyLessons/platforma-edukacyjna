/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        VOICE CHAT COMPONENT
 *                   UI rozmowy glosowej na tablicy
 * ═══════════════════════════════════════════════════════════════════════════
 * Panel: awatary uczestnikow + przyciski (mikrofon, sluchawki, ustawienia, rozlacz)
 * z rozwijanymi menu. Wydzielone (1:1) do osobnych plikow: dzwieki UI
 * (audio-cues.ts), poziom mikrofonu (use-mic-level-meter.ts), nazwy urzadzen
 * (use-audio-device-names.ts), toast (use-voice-toast.ts), hover panelu
 * (use-hover-controls.ts), awatary (voice-chat-participants.tsx), grupa
 * przycisk+menu (voice-control-group.tsx), menu urzadzen (voice-device-menu.tsx),
 * modal ustawien (voice-chat-settings.tsx).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Settings, Headphones, HeadphoneOff, Check, PhoneOff } from 'lucide-react';
import { useVoiceChat } from '../VoiceChatContext';
import VoiceChatSettings from './voice-chat-settings';
import { useUserAvatar } from '@/_new/shared/hooks/use-user-avatar';
import { Button } from '@/_new/shared/ui/button';
import { useAuth } from '@/_new/lib/auth';
import { playVoiceCue } from './audio-cues';
import { useMicLevelMeter } from './use-mic-level-meter';
import { useAudioDeviceNames } from './use-audio-device-names';
import { useVoiceToast } from './use-voice-toast';
import { useHoverControls } from './use-hover-controls';
import { ParticipantAvatars, type AvatarContextMenuState } from './voice-chat-participants';
import { VoiceControlGroup } from './voice-control-group';
import { VoiceDeviceMenu } from './voice-device-menu';

interface VoiceChatProps {
  className?: string;
  isVisible?: boolean;
}

export default function VoiceChat({ className = '', isVisible = false }: VoiceChatProps) {
  const voiceChat = useVoiceChat();
  const { getAvatarColorClass, getInitials } = useUserAvatar();
  const { user: currentUser } = useAuth();

  const [showSettings, setShowSettings] = useState(false);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [joinPulse, setJoinPulse] = useState(false);
  const [mutedRemoteUserIds, setMutedRemoteUserIds] = useState<number[]>([]);
  const [avatarContextMenu, setAvatarContextMenu] = useState<AvatarContextMenuState | null>(null);

  const previousIsInVoiceRef = useRef(false);
  const previousSpeakerVolumeRef = useRef(1);
  const previousMutedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const avatarContextMenuRef = useRef<HTMLDivElement>(null);

  const closeMenus = () => {
    setShowMicMenu(false);
    setShowSpeakerMenu(false);
  };

  const { toastState, isToastExiting, showToast } = useVoiceToast();
  const { inputDeviceName, outputDeviceName } = useAudioDeviceNames();
  const { isHovered, areControlsMounted, onMouseEnter, onMouseLeave } =
    useHoverControls(closeMenus);

  const isInVoiceChat = voiceChat?.isInVoiceChat ?? false;
  const micLevel = useMicLevelMeter(showMicMenu && isInVoiceChat);

  // Dzwiek + toast przy wejsciu/wyjsciu z rozmowy
  useEffect(() => {
    const wasInVoice = previousIsInVoiceRef.current;

    if (isInVoiceChat && !wasInVoice) {
      playVoiceCue('join');
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
  }, [isInVoiceChat, showToast]);

  useEffect(() => {
    if (!isInVoiceChat) {
      setIsDeafened(false);
      setShowMicMenu(false);
      setShowSpeakerMenu(false);
      setAvatarContextMenu(null);
    }
  }, [isInVoiceChat]);

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

  // Jesli nie ma VoiceChatProvider, nie renderuj nic
  if (!voiceChat) {
    return null;
  }

  const {
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
  if (!shouldRender) {
    return null;
  }

  const isRemoteMutedLocally = (userId: number) => mutedRemoteUserIds.includes(userId);

  const handleToggleMic = () => {
    if (!isInVoiceChat || isDeafened) return;
    toggleMute();
    playVoiceCue(isMuted ? 'mic-on' : 'mic-off');
  };

  /** Klik w chevron: bez rozmowy = dolacz i otworz to menu; w rozmowie = przelacz menu. */
  const toggleMenuOrJoin = (menu: 'mic' | 'speaker') => async () => {
    const [setThis, setOther] =
      menu === 'mic' ? [setShowMicMenu, setShowSpeakerMenu] : [setShowSpeakerMenu, setShowMicMenu];
    if (!isInVoiceChat) {
      if (await joinVoiceChat()) {
        setThis(true);
        setOther(false);
      }
      return;
    }
    setThis((prev) => !prev);
    setOther(false);
  };

  const handleToggleDeafen = () => {
    if (!isInVoiceChat) return;

    if (!isDeafened) {
      playVoiceCue('deafen');
      previousSpeakerVolumeRef.current = settings.speakerVolume > 0 ? settings.speakerVolume : 1;
      previousMutedRef.current = isMuted;
      updateSettings({ speakerVolume: 0 });
      setMuted(true);
      setIsDeafened(true);
      return;
    }

    playVoiceCue('undeafen');
    updateSettings({ speakerVolume: previousSpeakerVolumeRef.current });
    setMuted(previousMutedRef.current);
    setIsDeafened(false);
  };

  const handleDisconnect = () => {
    leaveVoiceChat();
    closeMenus();
    playVoiceCue('leave');
    showToast('Wyszedles z czatu glosowego.');
  };

  const toggleLocalMuteForUser = (userId: number) => {
    setMutedRemoteUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const openSettingsFrom = (closeMenu: (open: boolean) => void) => () => {
    closeMenu(false);
    setShowSettings(true);
  };

  const controlsDisabled = !isInVoiceChat || isConnecting;
  const micOff = isMuted || isDeafened;

  return (
    <>
      <div ref={rootRef} className={`relative ml-auto w-fit ${className}`}>
        <div
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
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
          <div
            className={`flex items-center min-w-0 transition-all duration-500 ease-in-out ${isHovered ? 'gap-2' : 'gap-0'}`}
          >
            <ParticipantAvatars
              participants={participants}
              currentUserId={currentUser?.id}
              isSpeaking={isSpeaking}
              isDeafened={isDeafened}
              isRemoteMutedLocally={isRemoteMutedLocally}
              getAvatarColorClass={getAvatarColorClass}
              getInitials={getInitials}
              onOpenContextMenu={setAvatarContextMenu}
            />
          </div>

          {areControlsMounted && (
            <div
              className={`flex items-center gap-1 transition-all duration-400 ease-in-out ${
                isHovered
                  ? 'opacity-100 translate-x-0 ml-6'
                  : 'opacity-0 translate-x-2 ml-0 pointer-events-none'
              }`}
            >
              <VoiceControlGroup
                icon={micOff ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                title={micOff ? 'Odblokuj mikrofon' : 'Wycisz mikrofon'}
                onClick={handleToggleMic}
                disabled={controlsDisabled || isDeafened}
                activeClassName={micOff ? 'text-red-600 bg-red-50 hover:bg-red-100' : undefined}
                menuTitle="Menu mikrofonu"
                menuOpen={showMicMenu}
                onToggleMenu={toggleMenuOrJoin('mic')}
                menuDisabled={isConnecting}
                menu={
                  <VoiceDeviceMenu
                    deviceLabel="Urzadzenie nagrywania"
                    deviceName={inputDeviceName}
                    volumeLabel="Glosnosc mikrofonu"
                    volume={settings.microphoneVolume}
                    onVolumeChange={(value) => updateSettings({ microphoneVolume: value })}
                    micLevel={micLevel}
                    onOpenSettings={openSettingsFrom(setShowMicMenu)}
                  />
                }
              />

              <VoiceControlGroup
                icon={
                  isDeafened ? (
                    <HeadphoneOff className="w-4 h-4" />
                  ) : (
                    <Headphones className="w-4 h-4" />
                  )
                }
                title={isDeafened ? 'Wlacz dzwiek kanalu' : 'Wycisz kanal u siebie'}
                onClick={handleToggleDeafen}
                disabled={controlsDisabled}
                activeClassName={
                  isDeafened ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : undefined
                }
                menuTitle="Menu sluchawek"
                menuOpen={showSpeakerMenu}
                onToggleMenu={toggleMenuOrJoin('speaker')}
                menuDisabled={isConnecting}
                menu={
                  <VoiceDeviceMenu
                    deviceLabel="Urzadzenie odtwarzania"
                    deviceName={outputDeviceName}
                    volumeLabel="Glosnosc wyjscia"
                    volume={settings.speakerVolume}
                    onVolumeChange={(value) => updateSettings({ speakerVolume: value })}
                    onOpenSettings={openSettingsFrom(setShowSpeakerMenu)}
                  />
                }
              />

              <Button
                type="button"
                variant="secondary"
                size="iconSm"
                onClick={() => setShowSettings(true)}
                disabled={controlsDisabled}
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
                disabled={controlsDisabled}
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
            {isRemoteMutedLocally(avatarContextMenu.userId) && (
              <Check className="w-4 h-4 text-green-600" />
            )}
          </button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && <VoiceChatSettings onClose={() => setShowSettings(false)} />}
    </>
  );
}
