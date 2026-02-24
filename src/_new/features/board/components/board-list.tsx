/**
 * BOARD LIST
 *
 * Wyświetla listę tablic z obsługą:
 * - Loading / Error / Empty states
 * - Sortowania i filtrowania (dane z parent)
 *
 */

'use client';

import { useMemo } from 'react';
import { Loader2, Layout } from 'lucide-react';
import { BoardCard } from './board-card';
import { useBoards } from '../hooks/use-boards';
import { sortBoards, filterBoards } from '../utils/helpers';
import type { SortBy, FilterOwner } from '../utils/helpers';

interface BoardListProps {
  workspaceId: number;
  sortBy: SortBy;
  filterOwner: FilterOwner;
  currentUsername: string;
}

export function BoardList({ workspaceId, sortBy, filterOwner, currentUsername }: BoardListProps) {
  // DATA
  // ================================

  const { boards, loading, error } = useBoards({ workspaceId });

  // Computed - sortowanie i filtrowanie
  const processedBoards = useMemo(() => {
    const filtered = filterBoards(boards, filterOwner, currentUsername);
    const sorted = sortBoards(filtered, sortBy);
    return sorted;
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
        <BoardCard key={board.id} board={board} workspaceId={workspaceId} />
      ))}
    </div>
  );
}
