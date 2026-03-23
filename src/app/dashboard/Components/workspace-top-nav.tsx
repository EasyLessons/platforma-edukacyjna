'use client';

import { useMemo, useState } from 'react';
import { Loader2, Pencil, Star, UserPlus } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { DashboardButton } from './DashboardButton';
import { WorkspaceInviteModal } from '@/_new/features/workspace/components/workspaceInviteModal';
import { WorkspaceDropdownMenu } from '@/_new/features/workspace/components/workspaceDropdownMenu';
import { WorkspaceEditModal } from '@/_new/features/workspace/components/workspaceEditModal';
import { WorkspaceMembersModal } from '@/_new/features/workspace/components/workspaceMembersModal';
import { ConfirmationModal } from '@/_new/shared/ui/confirmation-modal';
import { useUserAvatar } from '@/_new/shared/hooks/use-user-avatar';
import { getColorClass, getIconComponent } from '@/_new/features/workspace/utils/helpers';
import { useWorkspaceMembers } from '@/_new/features/workspace/hooks/useWorkspaceMember';
import { ROLE_COLORS, ROLE_LABELS } from '@/_new/features/workspace/utils/constants';
import type {
  Workspace,
  WorkspaceUpdateRequest,
} from '@/_new/features/workspace/types';

interface WorkspaceTopNavProps {
  activeWorkspaceId: number | null;
  workspaces: Workspace[];
  toggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
  updateWorkspace: (id: number, data: WorkspaceUpdateRequest) => Promise<Workspace>;
  deleteWorkspace: (id: number) => Promise<void>;
  leaveWorkspace: (id: number) => Promise<void>;
}

export default function WorkspaceTopNav({
  activeWorkspaceId,
  workspaces,
  toggleFavourite,
  updateWorkspace,
  deleteWorkspace,
  leaveWorkspace,
}: WorkspaceTopNavProps) {
  const { getAvatarColorClass, getInitials } = useUserAvatar();

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null,
    [workspaces, activeWorkspaceId]
  );

  const { members, loading: membersLoading } = useWorkspaceMembers({
    workspace_id: activeWorkspaceId,
    autoLoad: !!activeWorkspaceId,
  });

  const [invitingWorkspace, setInvitingWorkspace] = useState<Workspace | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [membersWorkspace, setMembersWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [leavingWorkspace, setLeavingWorkspace] = useState<Workspace | null>(null);

  const WorkspaceIcon = activeWorkspace ? getIconComponent(activeWorkspace.icon) : null;
  const workspaceColorClass = activeWorkspace ? getColorClass(activeWorkspace.bg_color) : 'bg-gray-500';

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

  return (
    <>
      <div className="w-full shrink-0 bg-[var(--dash-panel)] ">
        
        {/* Biały pasek Navu */}
      <div className="flex items-center justify-between gap-4 bg-white px-4 py-3 sm:px-8 rounded-t-[2.5rem] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        
        <div className="min-w-0 flex items-center gap-3">
          {activeWorkspace && WorkspaceIcon && (
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-lg text-white shadow-sm ${workspaceColorClass}`}
            >
              <WorkspaceIcon size={16} className="text-white" />
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-gray-800">
              {activeWorkspace?.name || 'Wybierz przestrzeń'}
            </p>
          </div>
        </div>

        {activeWorkspace ? (
          <div className="flex items-center gap-2">
            <div className="hidden items-center pr-1 sm:flex">
              {membersLoading ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                </div>
              ) : (
                members.slice(0, 5).map((member, index) => {
                  const displayName = member.full_name || member.username;
                  const initials = getInitials(displayName);

                  return (
                    <div
                      key={member.user_id}
                      className={`group relative ${index === 0 ? '' : '-ml-2'} transition-transform hover:z-20 hover:scale-105`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white shadow-sm ${getAvatarColorClass(member.user_id)}`}
                      >
                        {initials}
                      </div>

                      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl group-hover:block">
                        <div className="flex min-w-[210px] items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColorClass(member.user_id)}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {displayName}
                            </p>
                            <p className="truncate text-xs text-gray-500">{member.email}</p>
                            <span
                              className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${ROLE_COLORS[member.role] || 'bg-gray-100 text-gray-800'}`}
                            >
                              {ROLE_LABELS[member.role] || member.role}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <DashboardButton
              variant="secondary"
              leftIcon={<UserPlus size={14} />}
              onClick={() => setInvitingWorkspace(activeWorkspace)}
              className="h-8 px-3 text-xs font-semibold"
              
            >
              Zaproś uczestników
            </DashboardButton>

            {activeWorkspace.is_owner && (
              <Button
                variant="primary"
                size="iconSm"
                onClick={() => setEditingWorkspace(activeWorkspace)}
                title="Zmień nazwę przestrzeni"
                className="dashboard-btn-secondary"
              >
                <Pencil size={15} className="text-gray-600" />
              </Button>
            )}

            <Button
              variant="primary"
              size="iconSm"
              onClick={() => toggleFavourite(activeWorkspace.id, !activeWorkspace.is_favourite)}
              title={
                activeWorkspace.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'
              }
              className={
                activeWorkspace.is_favourite
                  ? 'dashboard-btn-secondary bg-yellow-100 hover:bg-yellow-200'
                  : 'dashboard-btn-secondary'
              }
            >
              <Star
                size={15}
                className={
                  activeWorkspace.is_favourite ? 'fill-yellow-500 text-yellow-600' : 'text-gray-600'
                }
              />
            </Button>

            <WorkspaceDropdownMenu
              workspace={activeWorkspace}
              onEdit={() => setEditingWorkspace(activeWorkspace)}
              onMembers={() => setMembersWorkspace(activeWorkspace)}
              onDelete={() => setDeletingWorkspace(activeWorkspace)}
              onLeave={() => setLeavingWorkspace(activeWorkspace)}
            />
          </div>
        ) : (
          <span className="text-xs text-gray-500">Wybierz workspace z menu po lewej</span>
        )}
      </div>
      </div>

      {invitingWorkspace && (
        <WorkspaceInviteModal
          isOpen={!!invitingWorkspace}
          onClose={() => setInvitingWorkspace(null)}
          workspace={invitingWorkspace}
        />
      )}

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
