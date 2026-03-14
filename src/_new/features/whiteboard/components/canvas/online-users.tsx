/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        ONLINE USERS COMPONENT
 *                   Lista Użytkowników Online na Tablicy
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🎯 CEL:
 * Wyświetla awatary użytkowników którzy są aktualnie na tablicy.
 *
 * 📦 UŻYWANE W:
 * - WhiteboardCanvas.tsx → w prawym górnym rogu tablicy
 *
 * 🔄 JAK TO DZIAŁA:
 * 1. Pobiera listę użytkowników z useBoardRealtime()
 * 2. Wyświetla kolorowe awatary z inicjałami
 * 3. Pokazuje tooltip z pełnym imieniem
 * 4. Przycisk + pozwala skopiować link do tablicy (zaproszenie)
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useBoardRealtime, RemoteViewport } from '@/app/context/BoardRealtimeContext';
import { useAuth } from '@/app/context/AuthContext';
import { Check, Eye, EyeOff, Phone, Plus, Users } from 'lucide-react';
import VoiceChat from '@/_new/features/whiteboard/components/canvas/voice-chat';
import { useUserAvatar } from '@/_new/shared/hooks/use-user-avatar';
import { useVoiceChat } from '@/app/context/VoiceChatContext';
import { Button } from '@/_new/shared/ui/button';
import { useWhiteboardUiMetrics } from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';

// ═══════════════════════════════════════════════════════════════════════════
// 🧩 KOMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface OnlineUsersProps {
  onFollowUser?: (
    userId: number,
    viewportX: number,
    viewportY: number,
    viewportScale: number
  ) => void;
  onStopFollowing?: () => void;
  followingUserId?: number | null;
  userRole?: 'owner' | 'editor' | 'viewer';
}

export function OnlineUsers({ onFollowUser, onStopFollowing, followingUserId, userRole }: OnlineUsersProps) {
  const { onlineUsers, isConnected, subscribeViewports } = useBoardRealtime();
  const { user: currentUser } = useAuth();
  const { getAvatarColorClass, getInitials } = useUserAvatar();
  const voiceChat = useVoiceChat();
  const metrics = useWhiteboardUiMetrics();
  const [linkCopied, setLinkCopied] = useState(false);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [toastState, setToastState] = useState<{ id: number; message: string } | null>(null);
  const [isToastExiting, setIsToastExiting] = useState(false);
  const prevIsInVoiceRef = useRef(false);

  // Trzymaj aktualny snapshot viewportów innych użytkowników
  const remoteViewportsRef = useRef<RemoteViewport[]>([]);
  useEffect(() => {
    const unsubscribe = subscribeViewports((viewports) => {
      remoteViewportsRef.current = viewports;
    });
    return unsubscribe;
  }, [subscribeViewports]);

  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('pl-PL', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const hasVoiceParticipants = (voiceChat?.participants.length ?? 0) > 0;
    if (!hasVoiceParticipants && !voiceChat?.isInVoiceChat) {
      setIsVoicePanelOpen(false);
    }
  }, [voiceChat?.participants.length, voiceChat?.isInVoiceChat]);

  useEffect(() => {
    const isInVoiceNow = !!voiceChat?.isInVoiceChat;

    if (prevIsInVoiceRef.current && !isInVoiceNow) {
      setIsToastExiting(false);
      setToastState({
        id: Date.now() + Math.floor(Math.random() * 1000),
        message: 'Wyszedles z czatu glosowego.',
      });
    }

    prevIsInVoiceRef.current = isInVoiceNow;
  }, [voiceChat?.isInVoiceChat]);

  useEffect(() => {
    if (!toastState) return;

    const exitTimer = window.setTimeout(() => setIsToastExiting(true), 2600);
    const hideTimer = window.setTimeout(() => {
      setToastState(null);
      setIsToastExiting(false);
    }, 3200);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [toastState]);

  // Kopiowanie linku do tablicy
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Nie udało się skopiować linku:', err);
    }
  };

  const handleVoiceButton = async () => {
    if (!voiceChat) return;

    if (!voiceChat.isInVoiceChat) {
      await voiceChat.joinVoiceChat();
      setIsVoicePanelOpen(true);
      return;
    }

    voiceChat.leaveVoiceChat();
    setIsVoicePanelOpen(false);
  };

  if (!isConnected) {
    return (
      <div className="absolute top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
          <span className="text-sm text-gray-500">Łączenie...</span>
        </div>
      </div>
    );
  }

  const shouldShowVoicePanel = isVoicePanelOpen || (voiceChat?.participants.length ?? 0) > 0;
  const shareIcon = linkCopied ? (
    <Check className="w-4 h-4" />
  ) : (
    <span className="relative inline-flex items-center justify-center">
      <Users className="w-4 h-4" />
      <Plus className="w-2.5 h-2.5 absolute -top-1 -right-1" />
    </span>
  );

  return (
    <div
      className="absolute z-50 flex flex-col items-end gap-3 w-fit"
      style={{
        top: `${metrics.onlineUsers.topOffset}px`,
        right: `${metrics.spacing.side}px`,
          maxWidth: metrics.isMobile ? 'calc(100vw - 10px)' : 'calc(100vw - 32px)',
      }}
    >
      <div
        className="w-fit max-w-full overflow-hidden bg-white/95 backdrop-blur-xl rounded-2xl border border-gray-300/80 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
        style={{
          height: `${metrics.onlineUsers.stripHeight}px`,
          paddingLeft: `${metrics.onlineUsers.stripPaddingX}px`,
          paddingRight: `${metrics.onlineUsers.stripPaddingX}px`,
        }}
      >
        <div className="h-full flex flex-nowrap items-center gap-3 transition-all duration-300 ease-in-out">
          {metrics.onlineUsers.showClock && (
            <div className="flex items-center text-gray-600 px-1">
            <span className="text-sm font-medium whitespace-nowrap">
              {currentTime || '--:--'}
            </span>
            </div>
          )}

          <div className="flex -space-x-1.5 shrink-0">
            {onlineUsers.map((onlineUser, index) => {
            const isCurrentUser = onlineUser.user_id === currentUser?.id;
            const isBeingFollowed = followingUserId === onlineUser.user_id;
            const avatarColorClass = getAvatarColorClass(onlineUser.user_id);
            const initials = getInitials(onlineUser.username);

            // Unikalny klucz: user_id + timestamp lub index (naprawia duplikaty)
            const uniqueKey = `${onlineUser.user_id}-${onlineUser.online_at || index}`;

            // Handler kliknięcia
            const handleClick = () => {
              if (isCurrentUser) return;

              // Jeśli już śledzimy tego użytkownika → zatrzymaj
              if (isBeingFollowed && onStopFollowing) {
                onStopFollowing();
                return;
              }

              if (!onFollowUser) return;

              // Pobierz ostatni znany viewport z subskrypcji
              const remoteVp = remoteViewportsRef.current.find(
                (v) => v.userId === onlineUser.user_id
              );
              onFollowUser(
                onlineUser.user_id,
                remoteVp?.x ?? 0,
                remoteVp?.y ?? 0,
                remoteVp?.scale ?? 1
              );
            };

            return (
              <div
                key={uniqueKey}
                onClick={handleClick}
                className={`
                  relative group w-8 h-8 rounded-full 
                  ${avatarColorClass} 
                  flex items-center justify-center 
                  text-white text-xs font-bold
                  transition-transform hover:scale-110 hover:z-10
                  ${
                    isBeingFollowed
                      ? 'ring-2 ring-blue-400 cursor-pointer shadow-md'
                      : !isCurrentUser
                        ? 'ring-2 ring-green-400 cursor-pointer shadow-md'
                        : 'ring-2 ring-white/90'
                  }
                `}
                title={onlineUser.username}
              >
                {initials}

                {/* Wskaźnik follow — zawsze widoczny dla innych użytkowników */}
                {!isCurrentUser && (
                  <div
                    className={`absolute -bottom-1 -right-1 rounded-full p-0.5 shadow-md border border-white ${
                      isBeingFollowed ? 'bg-blue-500 animate-pulse' : 'bg-green-500'
                    }`}
                  >
                    {isBeingFollowed ? (
                      <EyeOff size={10} className="text-white" />
                    ) : (
                      <Eye size={10} className="text-white" />
                    )}
                  </div>
                )}

                {/* Tooltip */}
                <div
                  className="
                  absolute top-10 right-0 
                  bg-gray-800 text-white text-xs 
                  px-2 py-1 rounded 
                  whitespace-nowrap
                  opacity-0 group-hover:opacity-100
                  transition-opacity
                  pointer-events-none
                  z-[260]
                "
                >
                  {onlineUser.username}
                  {isCurrentUser && userRole && ` (${userRole})`}
                  {!isCurrentUser && (isBeingFollowed ? ' – Kliknij aby przestać śledzić' : ' – Kliknij aby śledzić')}
                </div>
              </div>
            );
            })}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleVoiceButton}
            className={`hover-shine h-10 rounded-lg bg-gray-200 hover:bg-gray-200 text-gray-700 ${metrics.onlineUsers.compactButtons ? 'px-0 w-10 min-w-10 justify-center' : 'px-3'} whitespace-nowrap transition-all duration-300 ease-in-out shrink-0`}
            title="Czat głosowy"
            leftIcon={<Phone className="w-4 h-4" />}
          >
            {!metrics.onlineUsers.compactButtons && 'Czat głosowy'}
          </Button>

          <Button
            variant="dark"
            size="sm"
            onClick={handleCopyLink}
            className={`h-10 rounded-lg font-medium whitespace-nowrap transition-all duration-300 ease-in-out shrink-0 ${metrics.onlineUsers.compactButtons ? 'px-3 min-w-[106px] justify-center' : 'px-4'}`}
            title={linkCopied ? 'Skopiowano!' : 'Udostępnij tablicę'}
            leftIcon={shareIcon}
          >
            {linkCopied ? 'Skopiowano' : 'Udostępnij'}
          </Button>
        </div>
      </div>

      <VoiceChat isVisible={shouldShowVoicePanel} className="ml-auto" />

      {toastState && (
        <div className="fixed inset-x-0 bottom-8 z-[1200] pointer-events-none flex justify-center px-4">
          <div className={`whiteboard-toast-base ${isToastExiting ? 'whiteboard-toast-exit' : 'whiteboard-toast-enter'}`}>
            <span className="inline-flex items-center gap-2">
              <Check className="w-4 h-4 text-gray-300" />
              {toastState.message}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
