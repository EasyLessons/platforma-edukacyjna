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

import { useState } from 'react';
import { useBoardRealtime } from '@/app/context/BoardRealtimeContext';
import { useAuth } from '@/app/context/AuthContext';
import { Plus, Check, Eye } from 'lucide-react';
import VoiceChat from './VoiceChat';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 KOLORY AWATARÓW (losowane na podstawie user_id)
// ═══════════════════════════════════════════════════════════════════════════

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
];

const getAvatarColor = (userId: number) => {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
};

const getInitials = (username: string) => {
  return username.slice(0, 2).toUpperCase();
};

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
  userRole?: 'owner' | 'editor' | 'viewer'; // 🆕 Rola użytkownika
}

export function OnlineUsers({ onFollowUser, userRole }: OnlineUsersProps) {
  const { onlineUsers, isConnected } = useBoardRealtime();
  const { user: currentUser } = useAuth();
  const [linkCopied, setLinkCopied] = useState(false);

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

  return (
    <div className="absolute top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      <div className="flex items-center gap-3">
        {/* 🆕 VOICE CHAT - obok listy online */}
        <VoiceChat />

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300"></div>

        {/* Status połączenia */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600 font-medium">
            {onlineUsers.length} {onlineUsers.length === 1 ? 'osoba' : 'osób'} online
          </span>
        </div>

        {/* Separator */}
        {onlineUsers.length > 0 && <div className="w-px h-6 bg-gray-300"></div>}

        {/* Awatary użytkowników */}
        <div className="flex -space-x-2">
          {onlineUsers.map((onlineUser, index) => {
            const isCurrentUser = onlineUser.user_id === currentUser?.id;
            const color = getAvatarColor(onlineUser.user_id);
            const initials = getInitials(onlineUser.username);
            const hasViewport =
              onlineUser.viewport_x !== undefined && onlineUser.viewport_y !== undefined;

            // Unikalny klucz: user_id + timestamp lub index (naprawia duplikaty)
            const uniqueKey = `${onlineUser.user_id}-${onlineUser.online_at || index}`;

            // Handler kliknięcia - przeniesienie do viewport użytkownika
            const handleClick = () => {
              if (!isCurrentUser && hasViewport && onFollowUser) {
                console.log(
                  '👁️ Kliknięto użytkownika:',
                  onlineUser.username,
                  'viewport:',
                  onlineUser.viewport_x,
                  onlineUser.viewport_y,
                  onlineUser.viewport_scale
                );
                onFollowUser(
                  onlineUser.user_id,
                  onlineUser.viewport_x!,
                  onlineUser.viewport_y!,
                  onlineUser.viewport_scale || 1
                );
              }
            };

            return (
              <div
                key={uniqueKey}
                onClick={handleClick}
                className={`
                  relative group w-10 h-10 rounded-full 
                  ${color} 
                  flex items-center justify-center 
                  text-white text-sm font-bold
                  transition-transform hover:scale-110 hover:z-10
                  ${
                    !isCurrentUser && hasViewport
                      ? 'ring-4 ring-green-400 cursor-pointer shadow-lg'
                      : 'ring-2 ring-white'
                  }
                `}
                title={onlineUser.username}
              >
                {initials}

                {/* 🆕 Ikonka oka - widoczna zawsze gdy można przejść do widoku */}
                {!isCurrentUser && hasViewport && (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 shadow-md border-2 border-white">
                    <Eye size={12} className="text-white" />
                  </div>
                )}

                {/* Tooltip */}
                <div
                  className="
                  absolute top-12 right-0 
                  bg-gray-800 text-white text-xs 
                  px-2 py-1 rounded 
                  whitespace-nowrap
                  opacity-0 group-hover:opacity-100
                  transition-opacity
                  pointer-events-none
                  z-50
                "
                >
                  {onlineUser.username}
                  {isCurrentUser && userRole && ` (${userRole})`}
                  {!isCurrentUser && hasViewport && ' - Przejdź do widoku'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Separator przed przyciskiem zaproszenia */}
        <div className="w-px h-6 bg-gray-300"></div>

        {/* Przycisk kopiowania linku / zaproszenia */}
        <button
          onClick={handleCopyLink}
          className={`
            relative group w-10 h-10 rounded-full 
            flex items-center justify-center 
            text-white text-sm font-bold
            ring-2 ring-white
            transition-all hover:scale-110 hover:z-10
            ${linkCopied ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}
          `}
          title={linkCopied ? 'Skopiowano!' : 'Kopiuj link do tablicy'}
        >
          {linkCopied ? <Check size={18} /> : <Plus size={18} />}

          {/* Tooltip */}
          <div
            className="
            absolute top-12 right-0 
            bg-gray-800 text-white text-xs 
            px-2 py-1 rounded 
            whitespace-nowrap
            opacity-0 group-hover:opacity-100
            transition-opacity
            pointer-events-none
          "
          >
            {linkCopied ? 'Link skopiowany!' : 'Kopiuj link do tablicy'}
          </div>
        </button>
      </div>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 PRZYKŁAD UŻYCIA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * W WhiteboardCanvas.tsx:
 *
 * <div className="relative w-full h-full">
 *   <OnlineUsers />
 *   <Toolbar ... />
 *   <canvas ... />
 * </div>
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
