/**
 * Rzad awatarow uczestnikow rozmowy (inicjaly, ring gdy mowi, znaczniki mute/deafen,
 * menu kontekstowe na PPM dla innych userow). Wydzielone z voice-chat.tsx, 1:1.
 */
import { MicOff, HeadphoneOff } from 'lucide-react';
import type { VoiceParticipant } from '../VoiceChatContext';

export interface AvatarContextMenuState {
  x: number;
  y: number;
  userId: number;
  username: string;
}

interface Props {
  participants: VoiceParticipant[];
  currentUserId: number | undefined;
  isSpeaking: boolean;
  isDeafened: boolean;
  isRemoteMutedLocally: (userId: number) => boolean;
  getAvatarColorClass: (userId: number) => string;
  getInitials: (username: string) => string;
  onOpenContextMenu: (menu: AvatarContextMenuState) => void;
}

export function ParticipantAvatars({
  participants,
  currentUserId,
  isSpeaking,
  isDeafened,
  isRemoteMutedLocally,
  getAvatarColorClass,
  getInitials,
  onOpenContextMenu,
}: Props) {
  return (
    <div className="flex -space-x-1.5">
      {participants.map((participant) => {
        const avatarColorClass = getAvatarColorClass(participant.odUserId);
        const initials = getInitials(participant.username);
        const isCurrentUser = participant.odUserId === currentUserId;
        const mutedLocally = isRemoteMutedLocally(participant.odUserId);
        const showMutedMic = participant.isMuted;
        const showMutedHeadphones = mutedLocally || (isCurrentUser && isDeafened);

        return (
          <div
            key={participant.odUserId}
            onContextMenu={(e) => {
              if (isCurrentUser) return;
              e.preventDefault();
              onOpenContextMenu({
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
  );
}
