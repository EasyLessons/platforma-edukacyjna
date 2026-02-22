/**
 * WORKSPACE CARD
 *
 * Wyświetla workspace jako klikalne kafelek z ikoną, nazwą i akcjami.
 *
 */

'use client';

import { Star, MoreVertical, Users, Grid3x3 } from 'lucide-react';
import { getIconComponent, getColorClass } from '../utils/helpers';
import { formatWorkspaceMemberCount, formatWorkspaceBoardCount } from '../utils/helpers';
import type { Workspace } from '../types';

interface WorkspaceCardProps {
  workspace: Workspace;
  isActive?: boolean;
  onClick?: () => void;
  onToggleFavourite?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onLeave?: () => void;
  variant?: 'default' | 'compact';
  showMenu?: boolean;
}

export function WorkspaceCard({
  workspace,
  isActive = false,
  onClick,
  onToggleFavourite,
  onEdit,
  onDelete,
  onLeave,
  variant = 'default',
  showMenu = true,
}: WorkspaceCardProps) {
  const Icon = getIconComponent(workspace.icon);
  const colorClass = getColorClass(workspace.bg_color);

  // HANDLERS
  // ================================
  const handleFavouriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavourite?.();
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Otwórz dropdown menu
  };

  // RENDERS
  // ================================

  // Compact version
  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={`
          relative w-full p-2 rounded-lg transition-all cursor-pointer
          ${isActive ? 'bg-green-50 ring-2 ring-green-500' : 'hover:bg-gray-50'}
        `}
        title={workspace.name}
      >
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center mx-auto`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>

        {/* Favourite badge */}
        {workspace.is_favourite && (
          <div className="absolute top-1 right-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          </div>
        )}
      </button>
    );
  }

  // Default version
  return (
    <div
      onClick={onClick}
      className={`
        group relative p-4 rounded-xl transition-all cursor-pointer
        ${isActive ? 'bg-green-50 ring-2 ring-green-500' : 'hover:bg-gray-50'}
      `}
    >
      {/* Content */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name */}
          <h3 className="font-semibold text-gray-900 truncate mb-1">{workspace.name}</h3>

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{formatWorkspaceMemberCount(workspace.member_count)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Grid3x3 size={12} />
              <span>{formatWorkspaceBoardCount(workspace.board_count)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions (show on hover) */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Favourite */}
        <button
          onClick={handleFavouriteClick}
          className="p-1.5 hover:bg-white rounded-lg transition-colors"
          title={workspace.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
        >
          <Star
            className={`w-4 h-4 ${
              workspace.is_favourite
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-400 hover:text-yellow-400'
            }`}
          />
        </button>

        {/* Menu */}
        {showMenu && (
          <button
            onClick={handleMenuClick}
            className="p-1.5 hover:bg-white rounded-lg transition-colors"
            title="Więcej opcji"
          >
            <MoreVertical className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Owner badge */}
      {workspace.is_owner && (
        <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded">
          Właściciel
        </div>
      )}
    </div>
  );
}
