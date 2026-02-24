/**
 * WORKSPACE CARD
 *
 * Card zarządza wszystkimi akcjami dotyczącymi workspace:
 * - Toggle favourite
 * - Edit workspace
 * - View/manage members
 * - Delete workspace (owner)
 * - Leave workspace (member)
 *
 */

'use client';

import { useState } from 'react';
import { Star, Users, Grid3x3 } from 'lucide-react';
import { WorkspaceDropdownMenu } from './workspace-dropdown-menu';
import { WorkspaceFormModal } from './workspace-form-modal';
import { WorkspaceMembersModal } from './workspace-members-modal';
import { ConfirmationModal } from '@/_new/shared/ui/confirmation-modal';
import { useWorkspaces } from '../hooks/use-workspaces';
import {
  getIconComponent,
  getColorClass,
  formatWorkspaceMemberCount,
  formatWorkspaceBoardCount,
} from '../utils/helpers';
import type { Workspace } from '../types';

interface WorkspaceCardProps {
  workspace: Workspace;
  isActive?: boolean;
  onSelect?: (workspaceId: number) => void;
  variant?: 'default' | 'compact';
  showActions?: boolean;
}

export function WorkspaceCard({
  workspace,
  isActive = false,
  onSelect,
  variant = 'default',
  showActions = true,
}: WorkspaceCardProps) {
  // STATE & DATA
  // ================================
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const { toggleFavourite, deleteWorkspace, leaveWorkspace } = useWorkspaces();

  const Icon = getIconComponent(workspace.icon);
  const colorClass = getColorClass(workspace.bg_color);

  // HANDLERS
  // ================================
  const handleClick = () => {
    onSelect?.(workspace.id);
  };

  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavourite(workspace.id, !workspace.is_favourite);
    } catch (err) {
      console.error('Error toggling favourite:', err);
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleMembers = () => {
    setShowMembersModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteWorkspace(workspace.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting workspace:', err);
      alert('Nie udało się usunąć przestrzeni');
    }
  };

  const handleLeaveConfirm = async () => {
    try {
      await leaveWorkspace(workspace.id);
      setShowLeaveConfirm(false);
    } catch (err) {
      console.error('Error leaving workspace:', err);
      alert('Nie udało się opuścić przestrzeni');
    }
  };

  // RENDERS
  // ================================

  // Compact version
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`
            relative w-full p-2 rounded-lg transition-all cursor-pointer
            ${isActive ? 'bg-green-50 ring-2 ring-green-500' : 'hover:bg-gray-50'}
          `}
          title={workspace.name}
          aria-label={workspace.name}
        >
          {/* Icon */}
          <div
            className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center mx-auto shadow-sm`}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>

          {/* Favourite badge */}
          {workspace.is_favourite && (
            <div className="absolute top-1 right-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            </div>
          )}

          {/* Owner badge */}
          {workspace.is_owner && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
              <div className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-medium rounded">
                Owner
              </div>
            </div>
          )}
        </button>

        {/* Modals */}
        {showEditModal && (
          <WorkspaceFormModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            mode="edit"
            workspace={workspace}
          />
        )}

        {showMembersModal && (
          <WorkspaceMembersModal
            isOpen={showMembersModal}
            onClose={() => setShowMembersModal(false)}
            workspace={workspace}
          />
        )}
      </>
    );
  }

  // Default version
  return (
    <>
      <div
        onClick={handleClick}
        className={`
          group relative p-4 rounded-xl transition-all cursor-pointer border-2
          ${
            isActive
              ? 'bg-green-50 border-green-500 shadow-md'
              : 'border-transparent hover:bg-gray-50 hover:shadow-sm'
          }
        `}
        aria-label={`Workspace: ${workspace.name}`}
      >
        {/* Content */}
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0 shadow-md transition-transform group-hover:scale-105`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <h3 className="font-semibold text-gray-900 truncate mb-1">{workspace.name}</h3>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1" title="Liczba członków">
                <Users size={12} />
                <span>{formatWorkspaceMemberCount(workspace.member_count)}</span>
              </div>
              <div className="flex items-center gap-1" title="Liczba tablic">
                <Grid3x3 size={12} />
                <span>{formatWorkspaceBoardCount(workspace.board_count)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions (show on hover) */}
        {showActions && (
          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Favourite */}
            <button
              onClick={handleToggleFavourite}
              className="p-1.5 hover:bg-white rounded-lg transition-colors shadow-sm"
              title={workspace.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
              aria-label={workspace.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            >
              <Star
                className={`w-4 h-4 transition-colors ${
                  workspace.is_favourite
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-400 hover:text-yellow-400'
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            <WorkspaceDropdownMenu
              workspace={workspace}
              onEdit={handleEdit}
              onMembers={handleMembers}
              onDelete={() => setShowDeleteConfirm(true)}
              onLeave={() => setShowLeaveConfirm(true)}
            />
          </div>
        )}

        {/* Owner badge */}
        {workspace.is_owner && (
          <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded">
            Właściciel
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* ========================= */}

      {/* Edit Modal */}
      <WorkspaceFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        workspace={workspace}
      />

      {/* Members Modal */}
      <WorkspaceMembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        workspace={workspace}
      />

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Usuń przestrzeń?"
        message={
          <>
            Czy na pewno chcesz usunąć <strong>"{workspace.name}"</strong>?
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

      {/* Leave Confirmation */}
      <ConfirmationModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveConfirm}
        title="Opuść przestrzeń?"
        message={
          <>
            Czy na pewno chcesz opuścić <strong>"{workspace.name}"</strong>?
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
