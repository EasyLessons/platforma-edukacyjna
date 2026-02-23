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
import { useModal } from '@/_new/shared/hooks/use-modal';
import { useWorkspaceMembers } from '../hooks/use-workspace-members';
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UsersIcon size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Członkowie</h2>
              <p className="text-sm text-gray-500">{workspace.name}</p>
            </div>
          </div>

          <Button variant="destructive" size="icon" onClick={handleClose} aria-label="Zamknij">
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
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
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">{member.username}</h3>
                      {member.is_owner && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                          Właściciel
                        </span>
                      )}
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
                          px-3 py-1.5 rounded-lg text-sm font-medium
                          border border-gray-300 bg-white
                          focus:outline-none focus:ring-2 focus:ring-green-500
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
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveMember(member.user_id, member.username)}
                        disabled={removingMemberId === member.user_id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
            <span>
              Łącznie:{' '}
              <span className="font-medium text-gray-900">
                {members.length}{' '}
                {members.length === 1 ? 'uczestnik' : 'uczestników'}
              </span>
            </span>
          </div>

          <Button variant="secondary" onClick={handleClose} className="w-full">
            Zamknij
          </Button>
        </div>
      </div>
    </div>
  );
}
