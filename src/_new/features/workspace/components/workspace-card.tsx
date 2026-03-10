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
 */

'use client';

import { useState } from 'react';
import { Star, GripVertical, Settings } from 'lucide-react';
import { WorkspaceDropdownMenu } from './workspace-dropdown-menu';
import { getIconComponent, getColorClass } from '../utils/helpers';
import { Button } from '@/_new/shared/ui/button';
import type {
  Workspace,
  WorkspaceCardActions,
  WorkspaceDragState,
  WorkspaceDragHandlers,
} from '../types';

interface WorkspaceCardProps {
  workspace: Workspace;
  isActive?: boolean;
  isCollapsed?: boolean;
  onSelect?: (workspaceId: number, workspaceName: string) => void;
  onToggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
  onAction: WorkspaceCardActions;
  dragState?: WorkspaceDragState;
  dragHandlers?: WorkspaceDragHandlers;
}

export function WorkspaceCard({
  workspace,
  isActive = false,
  isCollapsed = false,
  onSelect,
  onToggleFavourite,
  onAction,
  dragState,
  dragHandlers,
}: WorkspaceCardProps) {
  // STATE
  // ================================
  const [isHovered, setIsHovered] = useState(false);

  // DERIVED
  // ================================

  const Icon = getIconComponent(workspace.icon);
  const colorClass = getColorClass(workspace.bg_color);

  const isDragging = dragState?.draggedId === workspace.id;
  const isDragOver = dragState?.dragOverId === workspace.id;

  // HANDLERS
  // ================================
  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onToggleFavourite(workspace.id, !workspace.is_favourite);
  };

  // RENDERS
  // ================================

  // Compact version
  if (isCollapsed) {
    return (
      <button
        onClick={() => onSelect?.(workspace.id, workspace.name)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={workspace.name}
        aria-label={workspace.name}
        className={`
          relative w-full flex justify-center p-2 rounded-lg
          transition-all duration-200 cursor-pointer
          ${isActive ? 'bg-green-100' : isHovered ? 'bg-gray-200/50' : ''}
        `}
      >
        {/* Pasek aktywności */}
        <div
          className={`
            absolute left-0 top-1/2 -translate-y-1/2
            bg-green-600 rounded-r-full transition-all duration-200
            ${isActive ? 'w-1 h-10' : isHovered ? 'w-0.5 h-10' : 'w-0 h-10'}
          `}
        />
        <div
          className={`w-10 h-10 ${colorClass} rounded-xl flex items-center justify-center shadow-sm`}
        >
          <Icon size={20} className="text-white" />
        </div>
      </button>
    );
  }

  // Default version
  return (
    <div
      className="relative mb-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Pasek aktywności po lewej */}
      <div
        className={`
          absolute left-0 top-1/2 -translate-y-1/2
          bg-green-600 rounded-r-full transition-all duration-200
          ${isActive ? 'w-1 h-10' : isHovered ? 'w-0.5 h-10' : 'w-0 h-10'}
        `}
      />

      {/* Wskaźnik drag-over */}
      {isDragOver && (
        <div className="absolute left-2 right-2 top-0 h-0.5 bg-green-500 rounded-full z-10" />
      )}

      <div
        draggable={!!dragHandlers}
        onDragStart={dragHandlers ? (e) => dragHandlers.onDragStart(e, workspace.id) : undefined}
        onDragEnd={dragHandlers?.onDragEnd}
        onDragOver={dragHandlers ? (e) => dragHandlers.onDragOver(e, workspace.id) : undefined}
        onDragLeave={dragHandlers?.onDragLeave}
        onDrop={dragHandlers ? (e) => dragHandlers.onDrop(e, workspace.id) : undefined}
        onClick={() => onSelect?.(workspace.id, workspace.name)}
        aria-label={`Workspace: ${workspace.name}`}
        className={`
          flex items-center gap-3 px-3 py-2.5 ml-2 rounded-lg
          transition-all duration-200 cursor-pointer group
          ${
            isActive
              ? 'bg-green-100 border-2 border-green-300'
              : isHovered
                ? 'bg-gray-200/50'
                : workspace.is_favourite
                  ? 'bg-yellow-50'
                  : ''
          }
          ${isDragging ? 'opacity-50' : ''}
        `}
      >
        {/* Ikona */}
        <div
          className={`w-10 h-10 ${colorClass} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}
        >
          <Icon size={20} className="text-white" />
        </div>

        {/* Grip przy hover — tylko gdy D&D aktywne */}
        {isHovered && dragHandlers && (
          <div className="flex items-center text-gray-400 cursor-move">
            <GripVertical size={16} />
          </div>
        )}

        {/* Nazwa */}
        <span
          className={`text-sm font-medium flex-1 truncate ${
            isActive ? 'text-green-700' : 'text-gray-700 group-hover:text-gray-900'
          }`}
        >
          {workspace.name}
        </span>

        {/* Akcje przy hover */}
        {isHovered && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              size="iconSm"
              onClick={handleToggleFavourite}
              className={
                workspace.is_favourite
                  ? 'bg-yellow-100 hover:bg-yellow-200'
                  : 'bg-gray-200 hover:bg-gray-300'
              }
              title={workspace.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            >
              <Star
                size={14}
                className={
                  workspace.is_favourite ? 'text-yellow-600 fill-yellow-600' : 'text-gray-600'
                }
              />
            </Button>

            <WorkspaceDropdownMenu
              workspace={workspace}
              onEdit={() => onAction.edit(workspace)}
              onMembers={() => onAction.members(workspace)}
              onDelete={() => onAction.delete(workspace)}
              onLeave={() => onAction.leave(workspace)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
