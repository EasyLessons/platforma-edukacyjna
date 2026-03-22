/**
 * WORKSPACE MEMBERS MODAL
 *
 * Modal z listą członków workspace'a.
 * Owner może usuwać członków i zmieniać ich role.
 *
 */

'use client';

import { useRef } from 'react';
import { X, Crown, Users as UsersIcon, Loader2, Trash2, Eye, Edit3 } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { DashboardButton } from '@/app/dashboard/Components/DashboardButton';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { useWorkspaceMembers } from '../hooks/useWorkspaceMember';
import { ROLE_LABELS, ROLE_COLORS } from '../utils/constants';
import type { Workspace } from '../types';

interface WorkspaceMebmersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
}

export function WorkspaceMembersModal({ isOpen, onClose, workspace }: WorkspaceMebmersModalProps) {
  // STATE
  // ================================

  const {
    members,
    loading,
    error,
    removingMemberId,
    changingRoleMemberId,
    removeMember,
    changeRole,
  } = useWorkspaceMembers({
    workspaceId: workspace?.id || null,
    autoLoad: isOpen,
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // HANDLERS
  // ================================

  const handleClose = () => {
    onClose();
  };

  const handleRemoveMember = async (userId: number, username: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć ${username} z tej przestrzeni?`)) {
      return;
    }

    try {
      await removeMember(userId);
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Nie udało się usunąć członka. Spróbuj ponownie.');
    }
  };

  const handleChangeRole = async (
    userId: number,
    currentRole: string,
    newRole: 'owner' | 'editor' | 'viewer'
  ) => {
    if (currentRole === newRole) return;

    try {
      await changeRole(userId, newRole);
    } catch (err) {
      console.error('Error changing role:', err);
      alert('Nie udało się zmienić roli. Spróbuj ponownie.');
    }
  };

  // MODAL BEHAVIOR
  // ================================

  useModal({
    isOpen,
    onClose: handleClose,
    modalRef,
    preventCloseWhen: () => !!removingMemberId || !!changingRoleMemberId,
  });

  // HELPERS
  // ================================

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown size={14} className="text-amber-600" />;
      case 'editor':
        return <Edit3 size={14} className="text-blue-600" />;
      case 'viewer':
        return <Eye size={14} className="text-gray-600" />;
      default:
        return null;
    }
  };

  // RENDER
  // ================================

  if (!isOpen || !workspace) return null;

  return (
    <div className="dashboard-modal-overlay">
      <div
        ref={modalRef}
        className="dashboard-modal-surface max-w-2xl"
      >
        {/* Header */}
        <div className="dashboard-modal-header">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-hover)]">
              <UsersIcon size={20} className="text-gray-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Członkowie</h2>
              <p className="text-sm text-gray-500">{workspace.name}</p>
            </div>
          </div>

          <DashboardButton variant="secondary" onClick={handleClose} aria-label="Zamknij" className="h-9 w-9 rounded-full p-0">
            <X size={20} />
          </DashboardButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-gray-700" />
                <p className="text-sm text-gray-500">Ładowanie członków...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-2">Wystąpił błąd</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}

          {/* Members List */}
          {!loading && !error && (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className={`flex items-center justify-between p-4 ${member.is_owner ? 'bg-yellow-50' : 'bg-gray-50 hover:bg-gray-100'} bg-gray-50 rounded-lg transition-colors`}
                >
                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{member.username}</h3>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{member.email}</p>
                    {member.full_name && (
                      <p className="text-xs text-gray-400 truncate">{member.full_name}</p>
                    )}
                  </div>

                  {/* Role & Actions */}
                  <div className="flex items-center gap-3 ml-4">
                    {/* Role Badge/Selector */}
                    {workspace.is_owner && !member.is_owner ? (
                      // Owner może zmieniać role innych członków
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleChangeRole(
                            member.user_id,
                            member.role,
                            e.target.value as 'owner' | 'editor' | 'viewer'
                          )
                        }
                        disabled={changingRoleMemberId === member.user_id}
                        className={`
                          px-3 py-1.5 rounded-lg text-sm text-black font-medium
                          border border-gray-300 bg-white
                          focus:outline-none focus:ring-2 focus:ring-gray-400
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        <option value="editor">Edytor</option>
                        <option value="viewer">Widz</option>
                      </select>
                    ) : (
                      // Nie-owner widzi tylko badge
                      <div
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${ROLE_COLORS[member.role]}`}
                      >
                        {getRoleIcon(member.role)}
                        <span>{ROLE_LABELS[member.role]}</span>
                      </div>
                    )}

                    {/* Remove Button (tylko dla owner, nie można usunąć siebie) */}
                    {workspace.is_owner && !member.is_owner && (
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => handleRemoveMember(member.user_id, member.username)}
                        disabled={removingMemberId === member.user_id}
                        className="text-red-600 hover:bg-red-200"
                        aria-label="Usuń członka"
                      >
                        {removingMemberId === member.user_id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty State */}
              {members.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UsersIcon size={32} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500">Brak członków</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dashboard-modal-footer !justify-between">
          <div className="text-sm text-gray-500">
            <span>
              Łącznie:{' '}
              <span className="font-medium text-gray-900">
                {members.length} {members.length === 1 ? 'uczestnik' : 'uczestników'}
              </span>
            </span>
          </div>

          <DashboardButton variant="secondary" onClick={handleClose} className="w-full max-w-[160px]">
            Zamknij
          </DashboardButton>
        </div>
      </div>
    </div>
  );
}
