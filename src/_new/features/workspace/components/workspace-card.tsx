/**
 * WORKSPACE CARD
 *
 * Prosty ("głupi") komponent karty workspace'a na sidebarze. Odpowiada za UI.
 * State'y i handlery dostaje w propsach.
 *
 * Zawiera:
 * - wersje default (extended) i compact
 * - ikonę workspace'a
 * - nazwę workspace'a
 * - dropdown menu zawierające przyciski favourite, delete/leave,  members.
 *
 */

'use client';

import { Star, Users, Grid3x3 } from 'lucide-react';
import { WorkspaceDropdownMenu } from './workspace-dropdown-menu';
import {
  getIconComponent,
  getColorClass,
} from '../utils/helpers';
import { Button } from '@/_new/shared/ui/button';
import type { Workspace } from '../types';

interface WorkspaceCardProps {
  workspace: Workspace;
  isActive?: boolean;
  onSelect?: (workspaceId: number) => void;
  onToggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
  onDeleteClick: (workspace: Workspace) => void;
  onLeaveClick: (workspace: Workspace) => void;
  onEditClick: (workspace: Workspace) => void;
  onMembersClick: (workspace: Workspace) => void;
  variant?: 'default' | 'compact';
  showActions?: boolean;
}

export function WorkspaceCard({
  workspace,
  isActive = false,
  onSelect,
  onToggleFavourite,
  onDeleteClick,
  onLeaveClick,
  onEditClick,
  onMembersClick,
  variant = 'default',
  showActions = true,
}: WorkspaceCardProps) {
  // DERIVED
  // ================================

  const Icon = getIconComponent(workspace.icon);
  const colorClass = getColorClass(workspace.bg_color);

  // HANDLERS
  // ================================
  const handleClick = () => {
    onSelect?.(workspace.id);
  };

  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onToggleFavourite(workspace.id, !workspace.is_favourite);
  };

  // RENDERS
  // ================================

  // Compact version
  if (variant === 'compact') {
    return (
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
      </button>
    );
  }

  // Default version
  return (
    <div
      onClick={handleClick}
      className={`
          group relative p-4 rounded-xl transition-all cursor-pointer border-2
          ${
            isActive
              ? 'bg-green-100 border-green-500 shadow-md'
              : !workspace.is_favourite ? 'border-transparent hover:bg-gray-100 hover:shadow-sm'
              : 'border-transparent bg-yellow-50 hover:shadow-sm'
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
          <h3
            className={`text-sm font-medium flex-1 truncate ${
              isActive ? 'text-green-700' : 'text-gray-700 group-hover:text-gray-900'
            }`}
          >
            {workspace.name}
          </h3>

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1" title="Liczba członków">
              <Users size={12} />
              <span>{workspace.member_count}</span>
            </div>
            <div className="flex items-center gap-1" title="Liczba tablic">
              <Grid3x3 size={12} />
              <span>{workspace.board_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions (show on hover) */}
      {showActions && (
        <div className="absolute top-1 right-3 column gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Favourite */}
          <Button
            variant="secondary"
            size="iconSm"
            onClick={handleToggleFavourite}
            className={
              workspace.is_favourite
                ? 'bg-yellow-100 hover:bg-yellow-200'
                : 'hover:bg-yellow-200'
            }
            title={workspace.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            aria-label={workspace.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <Star
              size={14}
              className={
                workspace.is_favourite ? 'text-yellow-600 fill-yellow-600' : 'text-gray-600'
              }
            />
          </Button>

          {/* Dropdown Menu */}
          <WorkspaceDropdownMenu
            workspace={workspace}
            onEdit={() => onEditClick(workspace)}
            onMembers={() => onMembersClick(workspace)}
            onDelete={() => onDeleteClick(workspace)}
            onLeave={() => onLeaveClick(workspace)}
          />
        </div>
      )}
    </div>
  );
}
