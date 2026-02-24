/**
 * WORKSPACE DROPDOWN MENU
 *
 * Wyświetla menu z akcjami dostępnymi dla workspace:
 * - Owner: Ustawienia, Członkowie, Usuń
 * - Member: Opuść przestrzeń
 *
 * Automatycznie dostosowuje się do roli użytkownika.
 *
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { MoreVertical, Settings, Users, Trash2, LogOut } from 'lucide-react';
import type { Workspace } from '../types';
import { Button } from '@/_new/shared/ui/button';

interface WorkspaceDropdownMenuProps {
  workspace: Workspace;
  onEdit: () => void;
  onMembers: () => void;
  onDelete: () => void;
  onLeave: () => void;
}

export function WorkspaceDropdownMenu({
  workspace,
  onEdit,
  onMembers,
  onDelete,
  onLeave,
}: WorkspaceDropdownMenuProps) {
  // STATE
  // ================================

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // EFFECTS
  // ================================

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    // Dodaj z małym opóźnieniem aby nie zamknąć od razu po otwarciu
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // HANDLERS
  // ================================

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    action();
  };

  // RENDER
  // ================================

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger Button */}
      <Button
        variant="secondary"
        size="icon"
        onClick={handleToggle}
        title="Więcej opcji"
        aria-label="Więcej opcji"
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="shadow-md"
      >
        <MoreVertical className="w-4 h-4 text-gray-600" />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
          aria-orientation="vertical"
        >
          {workspace.is_owner ? (
            // Owner menu
            <>
              <Button
                onClick={handleAction(onEdit)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                role="menuitem"
              >
                <Settings size={14} />
                <span>Ustawienia</span>
              </Button>

              <button
                onClick={handleAction(onMembers)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                role="menuitem"
              >
                <Users size={14} />
                <span>Członkowie</span>
              </button>

              <div className="h-px bg-gray-200 my-1" role="separator" />

              <button
                onClick={handleAction(onDelete)}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                role="menuitem"
              >
                <Trash2 size={14} />
                <span>Usuń przestrzeń</span>
              </button>
            </>
          ) : (
            // Member menu
            <button
              onClick={handleAction(onLeave)}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              role="menuitem"
            >
              <LogOut size={14} />
              <span>Opuść przestrzeń</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
