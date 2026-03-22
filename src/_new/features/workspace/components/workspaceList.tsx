/**
 * WORKSPACE LIST
 *
 * Wyświetla listę workspace'ów użytkownika z obsługą:
 * - Filtrowania
 * - Sortowania (ulubione na górze)
 * - Loading/Error/Empty states
 */

'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { WorkspaceCard } from './workspaceCard';
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
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {/* Nagłówek "Ulubione" — tylko gdy są ulubione i sidebar rozwinięty */}
      {!isCollapsed && favouriteCount > 0 && (
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
            Ulubione
          </h3>
        </div>
      )}

      {processedWorkspaces.map((workspace, index) => {
        // Separator między ostatnim ulubionym a pierwszym zwykłym
        const prev = processedWorkspaces[index - 1];
        const showSeparator = !isCollapsed && prev?.is_favourite && !workspace.is_favourite;

        return (
          <div key={workspace.id}>
            {showSeparator && <div className="h-px bg-gray-300 my-3 mx-4" />}
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
    </div>
  );
}
