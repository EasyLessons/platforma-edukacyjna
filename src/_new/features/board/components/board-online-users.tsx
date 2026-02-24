/**
 * BOARD ONLINE USERS
 *
 * Wyświetla awatary użytkowników aktualnie online na tablicy.
 * Używane w board-card (kolumna desktop).
 *
 * Max 3 awatary — reszta jako "+N".
 * Brak użytkowników — myślnik.
 *
 */

import { getAvatarColor, getInitials } from '../utils/helpers';
import type { OnlineUser } from '@/_new/shared/types/user';

interface BoardOnlineUsersProps {
  users: OnlineUser[];
}

const MAX_VISIBLE = 3;

export function BoardOnlineUsers({ users }: BoardOnlineUsersProps) {
  if (users.length === 0) {
    return <span className="text-gray-400 text-xs font-medium">—</span>;
  }

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user, index) => (
        <div
          key={user.user_id}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center
            text-white text-xs font-semibold
            border-2 border-white shadow-sm
            hover:scale-110 transition-transform cursor-default
            ${getAvatarColor(user.user_id)}
          `}
          style={{ zIndex: MAX_VISIBLE - index }}
          title={user.username}
        >
          {getInitials(user.username)}
        </div>
      ))}

      {overflow > 0 && (
        <div
          className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-semibold border-2 border-white shadow-sm"
          style={{ zIndex: 0 }}
          title={`+${overflow} więcej`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
