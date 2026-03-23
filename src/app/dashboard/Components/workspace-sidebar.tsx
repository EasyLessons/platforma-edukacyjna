'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { DashboardButton } from './DashboardButton';
import { Input } from '@/_new/shared/ui/input';
import { WorkspaceList } from '@/_new/features/workspace/components/workspaceList';
import { WorkspaceCreateModal } from '@/_new/features/workspace/components/workspaceCreateModal';
import { WorkspaceEditModal } from '@/_new/features/workspace/components/workspaceEditModal';
import { WorkspaceMembersModal } from '@/_new/features/workspace/components/workspaceMembersModal';
import { WorkspaceInviteModal } from '@/_new/features/workspace/components/workspaceInviteModal';
import { ConfirmationModal } from '@/_new/shared/ui/confirmation-modal';
import {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceUpdateRequest,
  WorkspaceCardActions,
  WorkspaceDragState,
  WorkspaceDragHandlers,
} from '@/_new/features/workspace/types';

const STORAGE_KEY = 'workspace_order';

interface WorkspaceSidebarProps {
  activeWorkspaceId: number | null;
  onWorkspaceSelect: (workspaceId: number, workspaceName: string) => void;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  createWorkspace: (data: WorkspaceCreateRequest) => Promise<Workspace>;
  updateWorkspace: (id: number, data: WorkspaceUpdateRequest) => Promise<Workspace>;
  deleteWorkspace: (id: number) => Promise<void>;
  leaveWorkspace: (id: number) => Promise<void>;
  toggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
}

export default function WorkspaceSidebar({
  activeWorkspaceId,
  onWorkspaceSelect,
  workspaces,
  loading,
  error,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  leaveWorkspace,
  toggleFavourite,
}: WorkspaceSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCustomOrder(JSON.parse(saved));
    } catch (e) {
      console.error('Blad wczytywania kolejnosci workspace:', e);
    }
  }, []);

  useEffect(() => {
    if (workspaces.length === 0) return;
    setCustomOrder((prev) => {
      const ids = workspaces.map((w) => w.id);
      const newIds = ids.filter((id) => !prev.includes(id));
      const filtered = prev.filter((id) => ids.includes(id));
      const next = [...filtered, ...newIds];
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [workspaces]);

  useEffect(() => {
    if (customOrder.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customOrder));
    }
  }, [customOrder]);

  useEffect(() => {
    if (!isCollapsed) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isCollapsed]);

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
      alert('Nie udalo sie usunac przestrzeni');
    }
  };

  const handleLeaveConfirm = async () => {
    if (!leavingWorkspace) return;
    try {
      await leaveWorkspace(leavingWorkspace.id);
      setLeavingWorkspace(null);
    } catch (err) {
      console.error('Error leaving workspace:', err);
      alert('Nie udalo sie opuscic przestrzeni');
    }
  };

  return (
    <>
      <div
        className={`${
          isCollapsed ? 'w-[72px]' : 'w-[344px]'
        } h-[calc(100vh-64px)] bg-[var(--dash-panel)] flex flex-col sticky top-[64px] transition-all duration-300`}
      >
        <div className="p-4 bg-[var(--dash-panel)]">
          <div className="flex items-center justify-between mb-3">
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Przestrzenie
                </h2>
                <span className="text-xs text-gray-500 bg-[var(--dash-hover)] px-2 py-0.5 rounded-full font-medium">
                  {workspaces.length}
                </span>
              </div>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="bg-transparent"
              title={isCollapsed ? 'Rozwin sidebar' : 'Zwin sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
          </div>

          {!isCollapsed && (
            <Input
              ref={searchInputRef}
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
              onClick={() => {
                setIsCollapsed(false);
                requestAnimationFrame(() => {
                  searchInputRef.current?.focus();
                });
              }}
              className="bg-transparent"
              title="Rozwin aby wyszukac"
            >
              <Search size={18} />
            </Button>
          )}
        </div>

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

        <div className="p-4 bg-[var(--dash-panel)]">
          {isCollapsed ? (
            <div className="flex justify-center">
              <DashboardButton
                variant="primary"
                onClick={() => setShowCreateModal(true)}
                title="Dodaj przestrzen"
                className="h-10 w-10 rounded-full p-0"
              >
                <Plus size={20} />
              </DashboardButton>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
                <span>Ulubione: {workspaces.filter((w) => w.is_favourite).length}</span>
                <span>Wszystkie: {workspaces.length}</span>
              </div>
              <DashboardButton
                variant="primary"
                leftIcon={<Plus size={18} />}
                onClick={() => setShowCreateModal(true)}
                className="w-full justify-center"
              >
                Dodaj przestrzeń
              </DashboardButton>
            </>
          )}
        </div>
      </div>

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
        title="Usun przestrzen?"
        message={
          <>
            Czy na pewno chcesz usunac <strong>"{deletingWorkspace?.name}"</strong>?
            <br />
            <br />
            <span className="text-red-600 font-semibold">
              Wszystkie tablice zostana trwale usuniete!
            </span>
          </>
        }
        confirmText="Usun przestrzen"
        confirmVariant="destructive"
      />

      <ConfirmationModal
        isOpen={!!leavingWorkspace}
        onClose={() => setLeavingWorkspace(null)}
        onConfirm={handleLeaveConfirm}
        title="Opusc przestrzen?"
        message={
          <>
            Czy na pewno chcesz opuscic <strong>"{leavingWorkspace?.name}"</strong>?
            <br />
            <br />
            Stracisz dostep do wszystkich tablic w tej przestrzeni.
          </>
        }
        confirmText="Opusc przestrzen"
        cancelText="Zostan"
        confirmVariant="destructive"
      />
    </>
  );
}
