/**
 * WORKSPACE LIST
 *
 * Wyświetla listę workspace'ów użytkownika z obsługą:
 * - Wyszukiwania
 * - Sortowania (ulubione na górze)
 * - CRUD operations (create, edit, delete, leave)
 * - Modals (create, edit, members)
 * - Loading/Error/Empty states
 *
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Loader2,
  MoreVertical,
  Settings as SettingsIcon,
  Users,
  Trash2,
  LogOut,
} from 'lucide-react';
import { WorkspaceCard } from './workspace-card';
import { WorkspaceFormModal } from './workspace-form-modal';
import { WorkspaceMembersModal } from './workspace-members-modal';
import { useWorkspaces } from '../hooks/use-workspaces';
import { sortWorkspacesByFavourite, filterWorkspacesByQuery } from '../utils/helpers';
import type { Workspace } from '../types';
import { Button } from '@/_new/shared/ui/button';

interface WorkspaceListProps {
  onWorkspaceClick?: (workspaceId: number) => void;
  activeWorkspaceId?: number | null;
  showSearch?: boolean;
  showCreateButton?: boolean;
}

export function WorkspaceList({
  onWorkspaceClick,
  activeWorkspaceId,
  showSearch = true,
  showCreateButton = false,
}: WorkspaceListProps) {
  // STATE & DATA
  // ================================

  const { workspaces, loading, error, toggleFavourite, deleteWorkspace, leaveWorkspace } =
    useWorkspaces();

  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

  // Delete/Leave confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<number | null>(null);

  // Computed - filtering & sorting
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

  const handleEdit = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setShowEditModal(true);
  };

  const handleMembers = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setShowMembersModal(true);
  };

  const handleDeleteConfirm = async (workspaceId: number) => {
    try {
      await deleteWorkspace(workspaceId);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting workspace:', err);
      alert('Nie udało się usunąć przestrzeni');
    }
  };

  const handleLeaveConfirm = async (workspaceId: number) => {
    try {
      await leaveWorkspace(workspaceId);
      setShowLeaveConfirm(null);
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
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Stwórz swoją pierwszą przestrzeń
          </h3>
          <p className="text-gray-600 mb-6 max-w-md">
            Przestrzenie pomagają organizować Twoją pracę i współpracować z innymi.
          </p>
          {showCreateButton && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Stwórz pierwszą przestrzeń
            </button>
          )}
        </div>

        {/* Create Modal */}
        <WorkspaceFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          mode="create"
          workspace={null}
        />
      </>
    );
  }

  // Workspace list
  return (
    <>
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
                <div key={workspace.id} className="relative group">
                  <WorkspaceCard
                    workspace={workspace}
                    isActive={workspace.id === activeWorkspaceId}
                    onClick={() => handleWorkspaceClick(workspace.id)}
                    onToggleFavourite={() =>
                      handleToggleFavourite(workspace.id, workspace.is_favourite)
                    }
                    variant="default"
                    showMenu={false}
                  />

                  {/* Actions Menu (overlay on card) */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                      <button className="p-1.5 bg-white rounded-lg shadow-md hover:bg-gray-50">
                        <MoreVertical className="w-4 h-4 text-gray-600" />
                      </button>

                      {/* Dropdown */}
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px] opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                        {workspace.is_owner ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(workspace);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <SettingsIcon size={14} />
                              Ustawienia
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMembers(workspace);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Users size={14} />
                              Członkowie
                            </button>
                            <div className="h-px bg-gray-200 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(workspace.id);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                              <Trash2 size={14} />
                              Usuń przestrzeń
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowLeaveConfirm(workspace.id);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                          >
                            <LogOut size={14} />
                            Opuść przestrzeń
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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

      {/* MODALS */}
      <WorkspaceFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
        workspace={null}
      />

      <WorkspaceFormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedWorkspace(null);
        }}
        mode="edit"
        workspace={selectedWorkspace}
      />

      <WorkspaceMembersModal
        isOpen={showMembersModal}
        onClose={() => {
          setShowMembersModal(false);
          setSelectedWorkspace(null);
        }}
        workspace={selectedWorkspace}
      />

      {/* DELETE CONFIRMATION */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Usuń przestrzeń?</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Czy na pewno chcesz usunąć tę przestrzeń? Wszystkie tablice zostaną trwale usunięte.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Anuluj
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
              >
                Usuń
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LEAVE CONFIRMATION */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Opuść przestrzeń?</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Czy na pewno chcesz opuścić tę przestrzeń? Stracisz dostęp do wszystkich tablic.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowLeaveConfirm(null)}
              >
                Anuluj
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleLeaveConfirm(showLeaveConfirm)}
              >
                Opuść
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
