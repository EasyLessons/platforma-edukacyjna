/**
 * WORKSPACE LIST
 *
 * Wyświetla listę workspace'ów użytkownika z obsługą:
 * - Filtrowania
 * - Sortowania (ulubione na górze)
 * - Loading/Error/Empty states
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Star, Plus } from 'lucide-react';
import { WorkspaceCard } from './workspaceCard';
import { boardKeys } from '@/_new/features/board/hooks/useBoard';
import { fetchBoards } from '@/_new/features/board/api/boardApi';
import {
  sortWorkspacesByFavourite,
  sortWorkspacesByCustomOrder,
  filterWorkspacesByQuery,
} from '../utils/helpers';
import type {
  Workspace,
  WorkspaceCardActions,
  WorkspaceDragState,
  WorkspaceDragHandlers,
} from '../types';

interface WorkspaceListProps {
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  activeWorkspaceId?: number | null;
  isCollapsed?: boolean;
  customOrder?: number[];
  onWorkspaceSelect?: (workspaceId: number, workspaceName: string) => void;
  onToggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
  onAction: WorkspaceCardActions;
  dragState: WorkspaceDragState;
  dragHandlers: WorkspaceDragHandlers;
  onCreateClick?: () => void;
}

export function WorkspaceList({
  workspaces,
  loading,
  error,
  searchQuery,
  activeWorkspaceId,
  isCollapsed = false,
  customOrder,
  onWorkspaceSelect,
  onToggleFavourite,
  onAction,
  dragState,
  dragHandlers,
  onCreateClick,
}: WorkspaceListProps) {
  // COMPUTED
  // ================================

  // Filtering & sorting
  const processedWorkspaces = useMemo(() => {
    const filtered = filterWorkspacesByQuery(workspaces, searchQuery);
    return customOrder
      ? sortWorkspacesByCustomOrder(filtered, customOrder)
      : sortWorkspacesByFavourite(filtered);
  }, [workspaces, searchQuery, customOrder]);

  const favouriteCount = processedWorkspaces.filter((w) => w.is_favourite).length;

  const queryClient = useQueryClient();
  const handlePrefetch = useCallback(
    (workspaceId: number) => {
      void queryClient.prefetchQuery({
        queryKey: boardKeys.workspace(workspaceId),
        queryFn: () => fetchBoards(workspaceId),
        staleTime: 10 * 60 * 1000,
      });
    },
    [queryClient]
  );

  // RENDERS
  // ================================

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="mb-1 px-2">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <div className="w-10 h-10 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-xl animate-pulse flex-shrink-0" />
              {!isCollapsed && (
                <div
                  className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-pulse"
                  style={{ width: `${55 + ((i * 13) % 35)}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 p-4">
        <p className={`text-red-500 text-sm text-center ${isCollapsed ? 'text-lg' : ''}`}>
          {isCollapsed ? '❌' : `Błąd: ${error}`}
        </p>
      </div>
    );
  }

  // Empty state
  if (workspaces.length === 0) {
    if (isCollapsed) return null;
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 text-center">
        <p className="text-gray-500 text-sm font-medium">Brak przestrzeni</p>
        <p className="text-gray-400 text-xs mt-1">Stwórz pierwszą przestrzeń poniżej</p>
      </div>
    );
  }

  // No result state
  if (processedWorkspaces.length === 0 && searchQuery) {
    return (
      <div className="flex items-center justify-center flex-1 py-8 px-4">
        <p className="text-gray-500 text-sm text-center">Nie znaleziono przestrzeni</p>
      </div>
    );
  }

  // Workspace list
  return (
    <div className="flex-1 overflow-y-auto px-2 py-1 gap-0.5 flex flex-col">
      {/* Nagłówek "Ulubione" — tylko gdy są ulubione i sidebar rozwinięty */}
      {!isCollapsed && favouriteCount > 0 && (
        <div className="px-2 pt-2 pb-0.5">
          <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-widest flex items-center gap-1">
            Ulubione
          </h3>
        </div>
      )}

      {processedWorkspaces.map((workspace, index) => {
        // Separator między ostatnim ulubionym a pierwszym zwykłym
        const prev = processedWorkspaces[index - 1];
        const isFirstNormal = !workspace.is_favourite && (index === 0 || prev?.is_favourite);

        return (
          <div key={workspace.id} className="mb-0" onMouseEnter={() => handlePrefetch(workspace.id)} onTouchStart={() => handlePrefetch(workspace.id)}>
            {!isCollapsed && isFirstNormal && (
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4 px-2">
                Przestrzenie
              </h3>
            )}
            <WorkspaceCard
              workspace={workspace}
              isActive={workspace.id === activeWorkspaceId}
              isCollapsed={isCollapsed}
              onSelect={onWorkspaceSelect}
              onToggleFavourite={onToggleFavourite}
              onAction={onAction}
              dragState={dragState}
              dragHandlers={dragHandlers}
            />
          </div>
        );
      })}

      {!isCollapsed && onCreateClick && (
        <div className="mt-1 px-1">
          <button
            onClick={onCreateClick}
            className="w-full relative flex items-center gap-1.5 pr-2 pl-[18px] py-2 rounded-md transition-colors duration-100 cursor-pointer group shadow-none bg-transparent hover:bg-gray-100"
          >
            <div className="relative flex items-center  justify-center flex-shrink-0 w-[28px] h-[28px]">
              <Plus size={30} className="ml-2 text-gray-500 group-hover:text-gray-700 transition-colors stroke-[2.5]" />
            </div>
            <div className="ml-1 flex-1 min-w-0 flex items-center gap-1.5 pr-1">
              <span className="text-[16px] font-medium text-gray-500 group-hover:text-gray-900 transition-colors truncate">
                Nowa przestrzeń
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
