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
import { Loader2, Users, Star } from 'lucide-react';
import { WorkspaceCard } from './workspace-card';
import { sortWorkspacesByFavourite, filterWorkspacesByQuery } from '../utils/helpers';
import type { Workspace } from '../types';

interface WorkspaceListProps {
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  activeWorkspaceId?: number | null;
  onWorkspaceSelect?: (workspaceId: number) => void;
  onToggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
  onEditClick: (workspace: Workspace) => void;
  onMembersClick: (workspace: Workspace) => void;
  onDeleteClick: (workspace: Workspace) => void;
  onLeaveClick: (workspace: Workspace) => void;
  variant?: 'default' | 'compact';
  showStats?: boolean;
}

export function WorkspaceList({
  workspaces,
  loading,
  error,
  searchQuery,
  activeWorkspaceId,
  onWorkspaceSelect,
  onToggleFavourite,
  onEditClick,
  onMembersClick,
  onDeleteClick,
  onLeaveClick,
  variant = 'default',
  showStats = true,
}: WorkspaceListProps) {
  // COMPUTED
  // ================================

  // Filtering & sorting
  const processedWorkspaces = useMemo(() => {
    const filtered = filterWorkspacesByQuery(workspaces, searchQuery);
    const sorted = sortWorkspacesByFavourite(filtered);
    return sorted;
  }, [workspaces, searchQuery]);

  // RENDERS
  // ================================

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          <p className="text-sm text-gray-500">Ładowanie przestrzeni...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Wystąpił błąd</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Brak przestrzeni</h3>
        <p className="text-gray-600 text-sm">Stwórz swoją pierwszą przestrzeń aby zacząć pracę</p>
      </div>
    );
  }

  // No result state
  if (processedWorkspaces.length === 0 && searchQuery) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 mb-2">Nie znaleziono przestrzeni</p>
          <p className="text-xs text-gray-400">Spróbuj innego zapytania lub wyczyść wyszukiwanie</p>
        </div>
      </div>
    );
  }

  // Workspace list
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {showStats && (
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
            Ulubione
          </h3>
        </div>
      )}
      {/* List */}
          {processedWorkspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isActive={workspace.id === activeWorkspaceId}
              onSelect={onWorkspaceSelect}
              onToggleFavourite={onToggleFavourite}
              onEditClick={onEditClick}
              onMembersClick={onMembersClick}
              onDeleteClick={onDeleteClick}
              onLeaveClick={onLeaveClick}
              variant={variant}
            />
          ))}
    </div>
  );
}
