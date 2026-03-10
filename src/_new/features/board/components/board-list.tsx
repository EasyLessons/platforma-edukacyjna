/**
 * BOARD LIST
 *
 * Wyświetla listę tablic z obsługą:
 * - Loading / Error / Empty states
 * - Sortowania i filtrowania (dane z parent)
 *
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Layout } from 'lucide-react';
import { BoardCard } from './board-card';
import { fetchBoardOnlineUsers } from '../api/board-api';
import { sortBoards, filterBoards } from '../utils/helpers';
import type { Board, BoardCardActions } from '../types';
import type { SortBy, FilterOwner } from '../utils/helpers';
import type { OnlineUser } from '@/_new/shared/types/user';

interface BoardListProps {
  boards: Board[];
  loading: boolean;
  error: string | null;
  sortBy: SortBy;
  filterOwner: FilterOwner;
  currentUsername: string;
  onSelect: (boardId: number) => void;
  onAction: BoardCardActions;
  onToggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
  onlineUsersEnabled?: boolean;
}

export function BoardList({
  boards,
  loading,
  error,
  sortBy,
  filterOwner,
  currentUsername,
  onAction,
  onSelect,
  onToggleFavourite,
  onlineUsersEnabled = true,
}: BoardListProps) {
  // DATA
  // ================================

  // Online Users - pobierane zbiorczo dla wszystkich tablic
  const [onlineUsersMap, setOnlineUsersMap] = useState<Record<number, OnlineUser[]>>({});
  useEffect(() => {
    if (!onlineUsersEnabled || boards.length === 0) return;

    const fetchAll = async () => {
      const results = await Promise.allSettled(
        boards.map((b) => fetchBoardOnlineUsers(b.id).then((users) => ({ boardId: b.id, users })))
      );

      const map: Record<number, OnlineUser[]> = {};
      for (const result of results) {
        if (result.status === 'fulfilled') {
          map[result.value.boardId] = result.value.users;
        }
      }
      setOnlineUsersMap(map);
    };

    fetchAll();
  }, [boards, onlineUsersEnabled]);

  // Computed - sortowanie i filtrowanie
  const processedBoards = useMemo(() => {
    const filtered = filterBoards(boards, filterOwner, currentUsername);
    return sortBoards(filtered, sortBy);
  }, [boards, sortBy, filterOwner, currentUsername]);

  // RENDERS
  // ================================

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          <p className="text-sm text-gray-500">Ładowanie tablic...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-red-600 mb-2">Wystąpił błąd</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state — brak tablic w workspace
  if (boards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Layout className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Brak tablic</h3>
        <p className="text-gray-600 text-sm">
          Stwórz pierwszą tablicę aby zacząć pracę w tej przestrzeni
        </p>
      </div>
    );
  }

  // No results state — filtry nic nie zwróciły
  if (processedBoards.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-gray-500 mb-1">Brak wyników</p>
          <p className="text-xs text-gray-400">Zmień kryteria filtrowania</p>
        </div>
      </div>
    );
  }

  // Lista tablic
  return (
    <div className="flex flex-col gap-2">
      {processedBoards.map((board) => (
        <BoardCard
          key={board.id}
          board={board}
          onlineUsers={onlineUsersMap[board.id] ?? []}
          onAction={onAction}
          onToggleFavourite={onToggleFavourite}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
