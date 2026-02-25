/**
 * WORKSPACE SIDEBAR
 *
 * Dashboard-specific layout dla workspace'ów.
 * Wszystkie akcje na workspace zarządza WorkspaceCard.
 * Sidebar zarządza tylko CREATE (globalna akcja).
 *
 */

'use client';

import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { Input } from '@/_new/shared/ui/input';
import { WorkspaceList } from '@/_new/features/workspace/components/workspace-list';
import { WorkspaceCreateModal } from '@/_new/features/workspace/components/workspace-create-modal';
import { WorkspaceEditModal } from '@/_new/features/workspace/components/workspace-edit-modal';
import { WorkspaceMembersModal } from '@/_new/features/workspace/components/workspace-members-modal';
import { ConfirmationModal } from '@/_new/shared/ui/confirmation-modal';
import { Workspace } from '@/workspace_api/api';
import { WorkspaceCreateRequest, WorkspaceUpdateRequest } from '@/_new/features/workspace/types';

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  activeWorkspaceId: number | null;
  onWorkspaceSelect: (workspaceId: number) => void;
  onCreateWorkspace: (data: WorkspaceCreateRequest) => Promise<Workspace>;
  onUpdateWorkspace: (id: number, data: WorkspaceUpdateRequest) => Promise<Workspace>;
  onDeleteWorkspace: (id: number) => Promise<void>;
  onLeaveWorkspace: (id: number) => Promise<void>;
  onToggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
}

export default function WorkspaceSidebarNew({
  workspaces,
  loading,
  error,
  activeWorkspaceId,
  onWorkspaceSelect,
  onCreateWorkspace,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onLeaveWorkspace,
  onToggleFavourite,
}: WorkspaceSidebarProps) {
  // UI STATE
  // ================================

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // MODAL STATE
  // ================================
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [membersWorkspace, setMembersWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [leavingWorkspace, setLeavingWorkspace] = useState<Workspace | null>(null);

  // HANDLERS
  // ================================

  const handleDeleteConfirm = async () => {
    if (!deletingWorkspace) return;
    try {
      await onDeleteWorkspace(deletingWorkspace.id);
      setDeletingWorkspace(null);
    } catch (err) {
      console.error('Error deleting workspace:', err);
      alert('Nie udało się usunąć przestrzeni');
    }
  };

  const handleLeaveConfirm = async () => {
    if (!leavingWorkspace) return;
    try {
      await onLeaveWorkspace(leavingWorkspace.id);
      setLeavingWorkspace(null);
    } catch (err) {
      console.error('Error leaving workspace:', err);
      alert('Nie udało się opuścić przestrzeni');
    }
  };

  // RENDER
  // ================================

  return (
    <>
      <div
        className={`${
          isCollapsed ? 'w-[72px]' : 'w-[350px]'
        } h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col sticky top-[64px] transition-all duration-300`}
      >
        {/* HEADER */}

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Przestrzenie
                </h2>
                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-semibold">
                  {workspaces.length}
                </span>
              </div>
            )}

            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="border border-gray-200 shadow-sm"
              title={isCollapsed ? 'Rozwiń sidebar' : 'Zwiń sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
          </div>

          {/* Search Input */}
          {!isCollapsed && (
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj przestrzeni..."
              leftIcon={<Search size={16} />}
            />
          )}
          {isCollapsed && (
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsCollapsed(false)}
              className="border border-gray-200 shadow-sm"
              title="Rozwiń aby wyszukać"
            >
              <Search size={18} />
            </Button>
          )}
        </div>

        {/* WORKSPACE LIST */}

        <div className="flex-1 overflow-y-auto">
          <WorkspaceList
            workspaces={workspaces}
            loading={loading}
            error={error}
            searchQuery={searchQuery}
            activeWorkspaceId={activeWorkspaceId}
            onWorkspaceSelect={onWorkspaceSelect}
            onToggleFavourite={onToggleFavourite}
            onEditClick={setEditingWorkspace}
            onMembersClick={setMembersWorkspace}
            onDeleteClick={setDeletingWorkspace}
            onLeaveClick={setLeavingWorkspace}
            variant={isCollapsed ? 'compact' : 'default'}
            showStats={!isCollapsed}
          />
        </div>

        {/* FOOTER */}
        <div className="py-5 bg-gray-50 flex justify-center">
          {isCollapsed ? (
            <Button size="icon" onClick={() => setShowCreateModal(true)} title="Dodaj przestrzeń">
              <Plus size={20} />
            </Button>
          ) : (
            <div className="w-3/4">
              {/* Stats */}
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
                <span>Ulubione: {workspaces.filter((w) => w.is_favourite).length}</span>
                <span className="mx-3">•</span>
                <span>Wszystkie: {workspaces.length}</span>
              </div>

              <Button
                leftIcon={<Plus size={20} />}
                onClick={() => setShowCreateModal(true)}
                className="w-full"
              >
                Dodaj przestrzeń
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* MODALS — jeden zestaw dla całego sidebara */}

      <WorkspaceCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await onCreateWorkspace(data);
        }}
      />

      {editingWorkspace && (
        <WorkspaceEditModal
          isOpen={!!editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          workspace={editingWorkspace}
          onSubmit={async (data) => {
            await onUpdateWorkspace(editingWorkspace.id, data);
          }}
        />
      )}

      <WorkspaceMembersModal
        isOpen={!!membersWorkspace}
        onClose={() => setMembersWorkspace(null)}
        workspace={membersWorkspace}
      />

      <ConfirmationModal
        isOpen={!!deletingWorkspace}
        onClose={() => setDeletingWorkspace(null)}
        onConfirm={handleDeleteConfirm}
        title="Usuń przestrzeń?"
        message={
          <>
            Czy na pewno chcesz usunąć <strong>"{deletingWorkspace?.name}"</strong>?
            <br />
            <br />
            <span className="text-red-600 font-semibold">
              Wszystkie tablice zostaną trwale usunięte!
            </span>
          </>
        }
        confirmText="Usuń przestrzeń"
        confirmVariant="destructive"
      />

      <ConfirmationModal
        isOpen={!!leavingWorkspace}
        onClose={() => setLeavingWorkspace(null)}
        onConfirm={handleLeaveConfirm}
        title="Opuść przestrzeń?"
        message={
          <>
            Czy na pewno chcesz opuścić <strong>"{leavingWorkspace?.name}"</strong>?
            <br />
            <br />
            Stracisz dostęp do wszystkich tablic w tej przestrzeni.
          </>
        }
        confirmText="Opuść przestrzeń"
        cancelText="Zostań"
        confirmVariant="destructive"
      />
    </>
  );
}
