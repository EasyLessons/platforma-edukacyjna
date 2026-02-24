/**
 * BOARD HELPERS
 *
 * Funkcje pomocnicze używane w module board.
 *
 */

import { BOARD_ICONS, COLOR_MAP, GRADIENT_MAP, DEFAULT_BOARD_ICON, AVATAR_COLORS } from './constants';
import type { Board } from '../types';

// ICONS
// ================================

export const getIconComponent = (iconName: string) => {
  return (
    BOARD_ICONS[iconName as keyof typeof BOARD_ICONS] ||
    BOARD_ICONS[DEFAULT_BOARD_ICON as keyof typeof BOARD_ICONS]
  );
};

export const getColorClass = (color: string): string => {
  return COLOR_MAP[color] ?? 'bg-gray-500';
};

export const getGradientClass = (color: string): string => {
  return GRADIENT_MAP[color] ?? 'from-gray-400 to-gray-600';
};

// normalizeColor - Usuwa prefiks "bg-" jeśli istnieje.
// Zapewnia spójny format zapisu do bazy ("gray-500" nie "bg-gray-500").
export const normalizeColor = (color: string): string => {
  return color.replace(/^bg-/, '');
};

// AVATARS
// ================================

// getAvatarColor - Zwraca kolor awatara dla użytkownika online.
// Deterministyczny — ten sam user zawsze dostaje ten sam kolor.
export const getAvatarColor = (userId: number): string => {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
};

// getInitials - Zwraca inicjały z nazwy użytkownika (pierwsze 2 znaki).
export const getInitials = (username: string): string => {
  return username.slice(0, 2).toUpperCase();
};

// DATES
// ================================

// formatDate - Formatuje datę ISO na czytelny string po polsku.
// Zwraca relatywny czas ("5 min temu", "Wczoraj") lub datę lokalną.
export const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Nigdy';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Nieznana data';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Teraz';
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays === 1) return 'Wczoraj';
    if (diffDays < 7) return `${diffDays} dni temu`;

    return date.toLocaleDateString('pl-PL');
  } catch {
    return 'Nieznana data';
  }
};

// SORTING
// ================================

export type SortBy = 'recent' | 'name' | 'favourite';

// sortBoards - Sortuje tablice według wybranego kryterium.
export const sortBoards = (boards: Board[], sortBy: SortBy): Board[] => {
  return [...boards].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        // Najnowiej modyfikowane na górze
        if (!a.last_modified && !b.last_modified) return 0;
        if (!a.last_modified) return 1;
        if (!b.last_modified) return -1;
        return new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime();

      case 'name':
        return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });

      case 'favourite':
        // Ulubione na górze, potem najnowiej modyfikowane
        if (a.is_favourite && !b.is_favourite) return -1;
        if (!a.is_favourite && b.is_favourite) return 1;
        if (!a.last_modified && !b.last_modified) return 0;
        if (!a.last_modified) return 1;
        if (!b.last_modified) return -1;
        return new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime();

      default:
        return 0;
    }
  });
};

// FILTERING
// ================================

export type FilterOwner = 'all' | 'mine';

// filterBoards - Filtruje tablice według właściciela.
export const filterBoards = (
  boards: Board[],
  filter: FilterOwner,
  currentUsername: string
): Board[] => {
  if (filter === 'all') return boards;
  return boards.filter((b) => b.owner_username === currentUsername);
};