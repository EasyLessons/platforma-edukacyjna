'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus, Search, FolderPlus, Home, Clock } from 'lucide-react';
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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  }, []);

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

  // Usunięty useEffect z auto-focusem, by zapobiec wyskakiwaniu klawiatury na mobile przy ładowaniu strony
  // Automatyczny focus został przeniesiony tylko do explicite interakcji użytkownika (np. kliknięcie w ikonę lupy)

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
        } h-[calc(100vh-64px)] bg-[var(--dash-panel)] border-r border-[var(--dash-border)] flex flex-col sticky top-[64px] transition-all duration-300 z-10`}
      >
        <div className="px-4 pt-6 pb-2 bg-[var(--dash-panel)]">
          <div className="flex items-center justify-between mb-4 group">
            {!isCollapsed && (
              <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Przestrzenie
                </h2>
                <div className="flex items-center gap-1 transition-opacity">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="h-6 w-6 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded p-0 bg-transparent flex justify-center items-center cursor-pointer"
                    title="Dodaj przestrzeń"
                  >
                    <FolderPlus size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`h-6 w-6 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded p-0 bg-transparent flex justify-center items-center cursor-pointer ${isCollapsed ? 'mx-auto' : ''}`}
              title={isCollapsed ? 'Rozwiń sidebar' : 'Zwiń sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen size={18} strokeWidth={2.5} /> : <PanelLeftClose size={18} strokeWidth={2.5} />}
            </button>
          </div>

          {!isCollapsed && (
            <div className="pt-2">
              <Input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj tablicy lub przestrzeni..."
                leftIcon={<Search size={18} className="text-gray-400" strokeWidth={2.5} />}
                className="bg-gray-100 border-transparent rounded-md focus:bg-gray-200/52 hover:bg-gray-100 focus:ring-0 transition-colors shadow-none h-[34px] text-[13px] placeholder:text-gray-500"
              />
            </div>
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
              className="w-full flex justify-center items-center bg-transparent hover:bg-gray-100 border-none text-gray-400 hover:text-gray-600"
              title="Rozwiń aby wyszukać"
            >
              <Search size={18} strokeWidth={2.5} />
            </Button>
          )}
        </div>

        {/* SYSTEM LINKS */}
        <div className="px-2 flex flex-col gap-[2px]">
          {!isCollapsed ? (
            <>
              <button
                className="relative w-full flex items-center gap-1.5 pr-2 py-2 rounded-md transition-colors duration-100 cursor-pointer group shadow-none bg-transparent hover:bg-gray-100"
              >
                <div className="w-[18px] pl-0.5 border-none" />
                <div className="relative flex items-center justify-center flex-shrink-0 w-[18px] h-[18px]">
                  <Home size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0 flex items-center text-left gap-1.5 pr-1">
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors truncate">
                    Strona główna
                  </span>
                </div>
              </button>
              <button
                className="relative w-full flex items-center gap-1.5 pr-2 py-2 rounded-md transition-colors duration-100 cursor-pointer group shadow-none bg-transparent hover:bg-gray-100"
              >
                <div className="w-[18px] pl-0.5 border-none" />
                <div className="relative flex items-center justify-center flex-shrink-0 w-[18px] h-[18px]">
                  <Clock size={17} className="text-gray-400 group-hover:text-gray-600 transition-colors" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0 flex items-center text-left gap-1.5 pr-1">
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors truncate">
                    Ostatnio używane
                  </span>
                </div>
              </button>
            </>
          ) : (
            <>
              <button
                className="relative w-full flex justify-center py-2 rounded-md transition-colors duration-100 cursor-pointer group hover:bg-gray-100"
                title="Strona główna"
              >
                <div className="relative flex items-center justify-center w-6 h-6">
                  <Home size={18} className="text-gray-400 group-hover:text-gray-600 transition-colors" strokeWidth={2.5} />
                </div>
              </button>
              <button
                className="relative w-full flex justify-center py-2 rounded-md transition-colors duration-100 cursor-pointer group hover:bg-gray-100"
                title="Ostatnio używane"
              >
                <div className="relative flex items-center justify-center w-6 h-6">
                  <Clock size={17} className="text-gray-400 group-hover:text-gray-600 transition-colors" strokeWidth={2.5} />
                </div>
              </button>
            </>
          )}
        </div>

        {/* SUBTELNY SEPARATOR */}
        <div className="px-5 mt-3 mb-1">
          <div className="h-[1px] bg-gray-200/50 w-full" />
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
          onCreateClick={() => setShowCreateModal(true)}
        />
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
