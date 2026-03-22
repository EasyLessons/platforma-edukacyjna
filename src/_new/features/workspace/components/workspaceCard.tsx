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

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, GripVertical, UserPlus, Pencil } from 'lucide-react';
import { WorkspaceDropdownMenu } from './workspaceDropdownMenu';
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
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const collapsedButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const updateTooltipPosition = useCallback(() => {
    if (!collapsedButtonRef.current) return;

    const rect = collapsedButtonRef.current.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  }, []);

  useEffect(() => {
    if (!isCollapsed || !isHovered) return;

    updateTooltipPosition();

    const handleViewportChange = () => updateTooltipPosition();

    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isCollapsed, isHovered, updateTooltipPosition]);

  // RENDERS
  // ================================

  // Compact version
  if (isCollapsed) {
    return (
      <>
        <button
          ref={collapsedButtonRef}
          onClick={() => onSelect?.(workspace.id, workspace.name)}
          onMouseEnter={() => {
            setIsHovered(true);
            updateTooltipPosition();
          }}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => {
            setIsHovered(true);
            updateTooltipPosition();
          }}
          onBlur={() => setIsHovered(false)}
          aria-label={workspace.name}
          className={`
            relative w-full flex justify-center p-2 rounded-lg
            transition-all duration-200 cursor-pointer
            ${isActive ? 'bg-[#ececef]' : isHovered ? 'bg-[#f0f0f2]' : ''}
          `}
        >
          {/* Pasek aktywności */}
          <div
            className={`
              absolute left-0 top-1/2 -translate-y-1/2
              bg-black rounded-r-full transition-all duration-200
              ${isActive ? 'w-1 h-10' : isHovered ? 'w-0.5 h-10' : 'w-0 h-10'}
            `}
          />
          <div
            className={`w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center`}
          >
            <Icon size={16} className="text-white" />
          </div>
        </button>

        {isHovered &&
          tooltipPosition &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[1200] whitespace-nowrap rounded-md bg-black px-3 py-1.5 text-[11px] font-bold text-white shadow-xl"
              style={{
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                transform: 'translateY(-50%)',
              }}
            >
              {workspace.name}
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-black" />
            </div>,
            document.body
          )}
      </>
    );
  }

  // Default version
  return (
    <div
      className={`relative mb-1 ${isHovered ? 'z-30' : 'z-0'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Pasek aktywności po lewej */}
      <div
        className={`
          absolute left-0 top-1/2 -translate-y-1/2
          bg-black rounded-r-full transition-all duration-200
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
          relative flex items-center gap-2 px-2.5 py-2 ml-2 rounded-lg
          transition-all duration-200 cursor-pointer group
          ${
            isActive
              ? 'bg-[#ececef]'
              : isHovered
                ? 'bg-[#f0f0f2]'
                : workspace.is_favourite
                  ? 'bg-[#f3f3f5]'
                  : ''
          }
          ${isDragging ? 'opacity-50' : ''}
        `}
      >
        {/* Ikona */}
        <div
          className={`w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          <Icon size={16} className="text-white" />
        </div>

        {/* Grip przy hover — tylko gdy D&D aktywne */}
        {dragHandlers && (
          <div
            className={`flex w-4 items-center text-gray-400 transition-opacity ${
              isHovered ? ' opacity-100 cursor-move' : ' opacity-0'
            }`}
          >
            <GripVertical size={16} />
          </div>
        )}

        {/* Nazwa */}
        <span
          className={`text-sm font-medium flex-1 min-w-0 transition-all duration-150 ${
            isHovered
              ? 'truncate pr-[148px]'
              : 'overflow-hidden whitespace-nowrap text-clip pr-1'
          } ${
            isActive ? 'text-black font-semibold' : 'text-gray-700 group-hover:text-gray-900'
          }`}
        >
          {workspace.name}
        </span>

        {/* Akcje */}
        <div
          className={`absolute right-2 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1 transition-opacity duration-150 ${
            isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
            <Button
              variant="secondary"
              size="iconSm"
              onClick={handleToggleFavourite}
              className={
                workspace.is_favourite
                  ? 'dashboard-btn-secondary bg-yellow-100 hover:bg-yellow-200'
                  : 'dashboard-btn-secondary'
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

            <Button
              variant="secondary"
              size="iconSm"
              onClick={() => onAction.invite(workspace)}
              className="dashboard-btn-secondary"
              title="Zaproś członków"
              aria-label="Zaproś członków"
            >
              <UserPlus className="w-4 h-4 text-gray-600" />
            </Button>

            {workspace.is_owner && (
              <Button
                variant="secondary"
                size="iconSm"
                onClick={() => onAction.edit(workspace)}
                className="dashboard-btn-secondary"
                title="Zmień nazwę"
                aria-label="Zmień nazwę"
              >
                <Pencil className="w-4 h-4 text-gray-600" />
              </Button>
            )}

            <WorkspaceDropdownMenu
              workspace={workspace}
              onEdit={() => onAction.edit(workspace)}
              onMembers={() => onAction.members(workspace)}
              onDelete={() => onAction.delete(workspace)}
              onLeave={() => onAction.leave(workspace)}
            />
        </div>
      </div>
    </div>
  );
}
