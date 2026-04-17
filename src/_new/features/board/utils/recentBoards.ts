import type { Board } from '../types';

export const RECENT_BOARDS_KEY = 'recent_boards';

export type RecentBoard = Board & { workspaceName?: string };

export function addRecentBoard(board: RecentBoard) {
  if (typeof window === 'undefined') return;
  try {
    const existing = localStorage.getItem(RECENT_BOARDS_KEY);
    let boards: RecentBoard[] = existing ? JSON.parse(existing) : [];
    
    // Remove if already exists to move it to the top
    boards = boards.filter(b => b.id !== board.id);
    
    // Add to top
    // We update the last_opened field locally just to make it fresh locally
    boards.unshift({ ...board, last_opened: new Date().toISOString() });
    
    // Keep max 20
    boards = boards.slice(0, 20);
    
    localStorage.setItem(RECENT_BOARDS_KEY, JSON.stringify(boards));
  } catch (err) {
    console.error('Failed to add recent board:', err);
  }
}

export function getRecentBoards(): RecentBoard[] {
  if (typeof window === 'undefined') return [];
  try {
    const existing = localStorage.getItem(RECENT_BOARDS_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (err) {
    console.error('Failed to get recent boards:', err);
    return [];
  }
}

export function removeRecentBoard(id: number) {
  if (typeof window === 'undefined') return;
  try {
    const existing = localStorage.getItem(RECENT_BOARDS_KEY);
    if (!existing) return;
    let boards: RecentBoard[] = JSON.parse(existing);
    boards = boards.filter(b => b.id !== id);
    localStorage.setItem(RECENT_BOARDS_KEY, JSON.stringify(boards));
  } catch (err) {
    console.error('Failed to remove recent board:', err);
  }
}
