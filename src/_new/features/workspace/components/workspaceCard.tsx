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
import { getIconComponent, getColorClass, getTextColorClass } from '../utils/helpers';
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
  const textColorClass = getTextColorClass(workspace.bg_color);

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
            relative w-full flex justify-center py-3 rounded-md
            transition-colors duration-100 cursor-pointer
            ${isActive ? 'bg-gray-100/80 shadow-none' : isHovered ? 'bg-gray-50' : ''}
          `}
        >
          <div className="relative flex items-center justify-center w-8 h-8">
            <Icon size={24} className={textColorClass} />
          </div>
        </button>

        {isHovered &&
          tooltipPosition &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[1200] whitespace-nowrap rounded-md bg-black px-3 py-1.5 text-[11px] font-bold text-white shadow-none"
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
      className={`relative ${isHovered ? 'z-30' : 'z-0'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Wskaźnik drag-over */}
      {isDragOver && (
        <div className="absolute left-1 right-1 -top-0.5 h-px bg-gray-300 z-10" />
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
          relative flex items-center gap-2.5 pr-2 py-2.5 rounded-md
          transition-colors duration-100 cursor-pointer group shadow-none
          ${isActive ? 'bg-gray-200/60' : 'bg-transparent hover:bg-gray-100'}
          ${isDragging ? 'opacity-50' : ''}
        `}
      >
        {/* Grip przy hover — maks z lewej */}
        {dragHandlers ? (
          <div
            className="flex w-[18px] pl-0.5 items-center justify-center text-gray-400 transition-opacity opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </div>
        ) : (
          <div className="w-[18px] pl-0.5" /> // Wyrównanie gdy brak drag (np. ulubione)
        )}

        {/* Ikona (zawsze w docelowym kolorze na linii, bez kropek/backgroundów) */}
        <div
          className={`relative flex items-center justify-center flex-shrink-0 w-[24px] h-[24px]`}
        >
          <Icon size={20} className={textColorClass} />
        </div>

        {/* Nazwa przestrzeni - single line + gwiazdka */}
        <div
          className={`flex-1 min-w-0 flex items-center gap-2 pr-1 group-hover:pr-[140px] transition-all`}
        >
          <span
            className={`text-[15px] truncate leading-normal ${
              isActive ? 'font-semibold text-gray-900' : 'font-semibold text-gray-700 group-hover:text-gray-900'
            }`}
          >
            {workspace.name}
          </span>
          {workspace.is_favourite && (
            <Star size={13} className="flex-shrink-0 fill-yellow-500 text-yellow-500" />
          )}
        </div>

        {/* Akcje - pokaż na grupowym hoverze całego wiersza */}
        <div
          className="absolute right-1 top-1/2 z-40 flex -translate-y-1/2 items-center gap-0.5 transition-opacity duration-150 bg-transparent opacity-0 group-hover:opacity-100 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
            <button
              onClick={handleToggleFavourite}
              className={`flex justify-center items-center w-[30px] h-[30px] rounded bg-transparent hover:bg-gray-200 transition-colors ${
                workspace.is_favourite ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'
              }`}
              title={workspace.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            >
              <Star
                size={16}
                className={workspace.is_favourite ? 'fill-yellow-500' : ''}
              />
            </button>

            <button
              onClick={() => onAction.invite(workspace)}
              className="flex justify-center items-center w-[30px] h-[30px] rounded bg-transparent hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
              title="Zaproś członków"
              aria-label="Zaproś członków"
            >
              <UserPlus size={16} />
            </button>

            {workspace.is_owner && (
              <button
                onClick={() => onAction.edit(workspace)}
                className="flex justify-center items-center w-[30px] h-[30px] rounded bg-transparent hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
                title="Zmień nazwę"
                aria-label="Zmień nazwę"
              >
                <Pencil size={16} />
              </button>
            )}

            <div className="relative flex" onClick={(e) => e.stopPropagation()}>
              <WorkspaceDropdownMenu
                workspace={workspace}
                triggerClassName="w-[30px] h-[30px]"
                iconSize={16}
                onEdit={() => onAction.edit(workspace)}
                onMembers={() => onAction.members(workspace)}
                onDelete={() => onAction.delete(workspace)}
                onLeave={() => onAction.leave(workspace)}
              />
            </div>
        </div>
      </div>
    </div>
  );
}
