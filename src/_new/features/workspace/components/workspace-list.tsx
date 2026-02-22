/**
 * WORKSPACE LIST
 *
 * Wyświetla listę workspace'ów użytkownika z obsługą:
 * - Wyszukiwania
 * - Sortowania (ulubione na górze)
 * - Loading state
 * - Error state
 * - Empty state
 *
 */

'use client';

import { useState, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { WorkspaceCard } from './workspace-card';
import { WorkspaceEmptyState } from './workspace-empty-state';
import { useWorkspaces } from '../hooks/use-workspaces';
import { sortWorkspacesByFavourite, filterWorkspacesByQuery } from '../utils/helpers';

interface WorkspaceListProps {
  onWorkspaceClick?: (workspaceId: number) => void;
  onCreateClick?: () => void;
  activeWorkspaceId?: number | null;
  showSearch?: boolean;
}

export function WorkspaceList({
  onWorkspaceClick,
  onCreateClick,
  activeWorkspaceId,
  showSearch = true,
}: WorkspaceListProps) {
  // STATE & DATA
  // ================================

  const { workspaces, loading, error, toggleFavourite, deleteWorkspace, leaveWorkspace } =
    useWorkspaces();

  const [searchQuery, setSearchQuery] = useState('');

  const processedWorkspaces = useMemo(() => {
    const filtered = filterWorkspacesByQuery(workspaces, searchQuery);
    const sorted = sortWorkspacesByFavourite(filtered);
    return sorted;
  }, [workspaces, searchQuery]);

  // HANDLERS
  // ================================

  const handleWorkspaceClick = (workspaceId: number) => {
    onWorkspaceClick?.(workspaceId);
  };

  const handleToggleFavourite = async (workspaceId: number, isFavourite: boolean) => {
    try {
      await toggleFavourite(workspaceId, !isFavourite);
    } catch (err) {
      console.error('Error toggling favourite:', err);
    }
  };

  const handleDelete = async (workspaceId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę przestrzeń?')) return;

    try {
      await deleteWorkspace(workspaceId);
    } catch (err) {
      console.error('Error deleting workspace:', err);
      alert('Nie udało się usunąć przestrzeni');
    }
  };

  const handleLeave = async (workspaceId: number) => {
    if (!confirm('Czy na pewno chcesz opuścić tę przestrzeń?')) return;

    try {
      await leaveWorkspace(workspaceId);
    } catch (err) {
      console.error('Error leaving workspace:', err);
      alert('Nie udało się opuścić przestrzeni');
    }
  };

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
    return <WorkspaceEmptyState onCreateClick={() => onCreateClick?.()} variant="full" />;
  }

  // Workspace list
  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      {showSearch && (
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj przestrzeni..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      )}

      {/* Workspace grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {processedWorkspaces.length === 0 ? (
          // No results
          <div className="text-center py-12">
            <p className="text-gray-500">Nie znaleziono przestrzeni</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-sm text-green-600 hover:underline mt-2"
              >
                Wyczyść wyszukiwanie
              </button>
            )}
          </div>
        ) : (
          // Workspace cards
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processedWorkspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                isActive={workspace.id === activeWorkspaceId}
                onClick={() => handleWorkspaceClick(workspace.id)}
                onToggleFavourite={() =>
                  handleToggleFavourite(workspace.id, workspace.is_favourite)
                }
                onDelete={workspace.is_owner ? () => handleDelete(workspace.id) : undefined}
                onLeave={!workspace.is_owner ? () => handleLeave(workspace.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
        <span>Ulubione: {workspaces.filter((w) => w.is_favourite).length}</span>
        <span className="mx-3">•</span>
        <span>Wszystkie: {workspaces.length}</span>
      </div>
    </div>
  );
}
