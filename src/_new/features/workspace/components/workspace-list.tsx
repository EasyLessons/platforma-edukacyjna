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
import { Loader2, Users } from 'lucide-react';
import { WorkspaceCard } from './workspace-card';
import { useWorkspaces } from '../hooks/use-workspaces';
import { sortWorkspacesByFavourite, filterWorkspacesByQuery } from '../utils/helpers';

interface WorkspaceListProps {
  searchQuery: string;
  onWorkspaceSelect?: (workspaceId: number) => void;
  activeWorkspaceId?: number | null;
  variant?: 'default' | 'compact';
  showStats?: boolean;
}

export function WorkspaceList({
  searchQuery,
  onWorkspaceSelect,
  activeWorkspaceId,
  variant = 'default',
  showStats = true,
}: WorkspaceListProps) {
  // DATA
  // ================================

  const { workspaces, loading, error } = useWorkspaces();

  // Computed - filtering & sorting
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

  // Workspace grid
  return (
    <div className="flex flex-col h-full">
      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div
          className={`
            grid gap-4
            ${
              variant === 'compact'
                ? 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }
          `}
        >
          {processedWorkspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isActive={workspace.id === activeWorkspaceId}
              onSelect={onWorkspaceSelect}
              variant={variant}
            />
          ))}
        </div>
      </div>

      {/* Stats Footer */}
      {showStats && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
          <span>Ulubione: {workspaces.filter((w) => w.is_favourite).length}</span>
          <span className="mx-3">•</span>
          <span>Wszystkie: {workspaces.length}</span>
        </div>
      )}
    </div>
  );
}
