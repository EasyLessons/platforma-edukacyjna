/**
 * WORKSPACE SIDEBAR
 *
 * Dashboard-specific layout dla workspace'ów.
 * Zarządza: UI state (collapsed, search, modals).
 * Dane i callbacki otrzymuje z page.tsx przez propsy.
 *
 * Pytania:
 * - Czy jest sens przechowywać customOrder w localStorage?
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { Input } from '@/_new/shared/ui/input';
import { WorkspaceList } from '@/_new/features/workspace/components/workspace-list';
import { WorkspaceCreateModal } from '@/_new/features/workspace/components/workspace-create-modal';
import { WorkspaceEditModal } from '@/_new/features/workspace/components/workspace-edit-modal';
import { WorkspaceMembersModal } from '@/_new/features/workspace/components/workspace-members-modal';
import { WorkspaceInviteModal } from '@/_new/features/workspace/components/workspace-invite-modal';
import { ConfirmationModal } from '@/_new/shared/ui/confirmation-modal';
import { useWorkspaces } from '@/_new/features/workspace/hooks/use-workspaces';
import {
  Workspace,
  WorkspaceCardActions,
  WorkspaceDragState,
  WorkspaceDragHandlers,
} from '@/_new/features/workspace/types';

const STORAGE_KEY = 'workspace_order';

interface WorkspaceSidebarProps {
  activeWorkspaceId: number | null;
  onWorkspaceSelect: (workspaceId: number, workspaceName: string) => void;
}

export default function WorkspaceSidebar({
  activeWorkspaceId,
  onWorkspaceSelect,
}: WorkspaceSidebarProps) {
  // STATE
  // ================================
  const {
    workspaces,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    leaveWorkspace,
    toggleFavourite,
  } = useWorkspaces();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [customOrder, setCustomOrder] = useState<number[]>([]);
  const dragState: WorkspaceDragState = { draggedId, dragOverId };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [membersWorkspace, setMembersWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [leavingWorkspace, setLeavingWorkspace] = useState<Workspace | null>(null);
  const [invitingWorkspace, setInvitingWorkspace] = useState<Workspace | null>(null);

  const cardActions: WorkspaceCardActions = useMemo(
    () => ({
      edit: setEditingWorkspace,
      members: setMembersWorkspace,
      delete: setDeletingWorkspace,
      leave: setLeavingWorkspace,
      invite: setInvitingWorkspace,
    }),
    []
  );

  // EFFECTS
  // ================================

  // Wczytaj kolejność z localStorage przy starcie komponentu
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCustomOrder(JSON.parse(saved));
    } catch (e) {
      console.error('Błąd wczytywania kolejności workspace:', e);
    }
  }, []);

  // Synchronizuj kolejność przy zmianie listy Workspace'ów
  useEffect(() => {
    if (workspaces.length === 0) return;
    setCustomOrder((prev) => {
      const ids = workspaces.map((w) => w.id);
      const newIds = ids.filter((id) => !prev.includes(id));
      const filtered = prev.filter((id) => ids.includes(id));
      return [...filtered, ...newIds];
    });
  }, [workspaces]);

  // Zapisz kolejność do localStorage przy zmianie customOrder
  useEffect(() => {
    if (customOrder.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customOrder));
    }
  }, [customOrder]);

  // HANDLERS
  // ================================
  const dragHandlers: WorkspaceDragHandlers = useMemo(
    () => ({
      onDragStart: (e, id) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
      },
      onDragEnd: () => {
        setDraggedId(null);
        setDragOverId(null);
      },
      onDragOver: (e, id) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedId && draggedId !== id) setDragOverId(id);
      },
      onDragLeave: () => setDragOverId(null),
      onDrop: (e, targetId) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) {
          setDragOverId(null);
          return;
        }
        setCustomOrder((prev) => {
          const next = [...prev];
          const from = next.indexOf(draggedId);
          const to = next.indexOf(targetId);
          if (from === -1 || to === -1) return prev;
          next.splice(from, 1);
          next.splice(to, 0, draggedId);
          return next;
        });
        setDragOverId(null);
      },
    }),
    [draggedId]
  );

  const handleDeleteConfirm = async () => {
    if (!deletingWorkspace) return;
    try {
      await deleteWorkspace(deletingWorkspace.id);
      setDeletingWorkspace(null);
    } catch (err) {
      console.error('Error deleting workspace:', err);
      alert('Nie udało się usunąć przestrzeni');
    }
  };

  const handleLeaveConfirm = async () => {
    if (!leavingWorkspace) return;
    try {
      await leaveWorkspace(leavingWorkspace.id);
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
        <div className="p-4 border-b border-gray-200 bg-gray-50">
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

          {!isCollapsed && (
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Wyszukaj przestrzenie..."
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

        {/* LISTA */}
        <WorkspaceList
          workspaces={workspaces}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          activeWorkspaceId={activeWorkspaceId}
          isCollapsed={isCollapsed}
          customOrder={customOrder}
          onWorkspaceSelect={onWorkspaceSelect}
          onToggleFavourite={toggleFavourite}
          onAction={cardActions}
          dragState={dragState}
          dragHandlers={dragHandlers}
        />

        {/* FOOTER */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {isCollapsed ? (
            <div className="flex justify-center">
              <Button size="icon" onClick={() => setShowCreateModal(true)} title="Dodaj przestrzeń">
                <Plus size={20} />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
                <span>Ulubione: {workspaces.filter((w) => w.is_favourite).length}</span>
                <span>Wszystkie: {workspaces.length}</span>
              </div>
              <Button
                leftIcon={<Plus size={20} />}
                onClick={() => setShowCreateModal(true)}
                className="w-full"
              >
                Dodaj przestrzeń
              </Button>
            </>
          )}
        </div>
      </div>

      {/* MODALS */}
      <WorkspaceCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await createWorkspace(data);
          setShowCreateModal(false);
        }}
      />

      {editingWorkspace && (
        <WorkspaceEditModal
          isOpen={!!editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          workspace={editingWorkspace}
          onSubmit={async (data) => {
            await updateWorkspace(editingWorkspace.id, data);
            setEditingWorkspace(null);
          }}
        />
      )}

      {invitingWorkspace && (
        <WorkspaceInviteModal
          isOpen={!!invitingWorkspace}
          onClose={() => setInvitingWorkspace(null)}
          workspace={invitingWorkspace}
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
