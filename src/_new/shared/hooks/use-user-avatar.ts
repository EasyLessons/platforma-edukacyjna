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
] as const;

export const getUserAvatarColorClass = (userId: number): string => {
  const normalizedId = Number.isFinite(userId) ? Math.abs(userId) : 0;
  return AVATAR_COLORS[normalizedId % AVATAR_COLORS.length];
};

export const getUserInitials = (displayName: string, maxChars = 2): string => {
  const normalized = displayName?.trim();

  if (!normalized) {
    return '?';
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, maxChars)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }

  return normalized.slice(0, maxChars).toUpperCase();
};

export function useUserAvatar() {
  return {
    getAvatarColorClass: getUserAvatarColorClass,
    getInitials: getUserInitials,
  };
}
