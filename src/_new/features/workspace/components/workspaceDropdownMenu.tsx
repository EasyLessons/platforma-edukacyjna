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

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, Settings, Users, Trash2, UserPlus } from 'lucide-react';
import type { Workspace } from '../types';
import { Button } from '@/_new/shared/ui/button';

interface WorkspaceDropdownMenuProps {
  workspace: Workspace;
  onEdit: () => void;
  onMembers: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onInvite?: () => void; // Nowy props na mobile zapraszanie
  triggerClassName?: string;
  iconSize?: number;
}

export function WorkspaceDropdownMenu({
  workspace,
  onEdit,
  onMembers,
  onDelete,
  onLeave,
  onInvite,
  triggerClassName = "w-8 h-8", // Domyślny rozmiar dla TopNav i innych miejsc
  iconSize = 16,
}: WorkspaceDropdownMenuProps) {
  // STATE
  // ================================

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // EFFECTS
  // ================================

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px below button
        right: window.innerWidth - rect.right, // align exactly to the right side of the button
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    // Dodaj z małym opóźnieniem aby nie zamknąć od razu po otwarciu
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, updatePosition]);

  // HANDLERS
  // ================================

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
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
    <div ref={menuRef} className={`relative ${isOpen ? 'z-50' : 'z-10'}`}>
      <button
        onClick={handleToggle}
        title="Menu"
        aria-label="Menu"
        className={`flex justify-center items-center p-0 min-w-0 rounded bg-transparent hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600 ${triggerClassName} ${
          isOpen ? 'bg-gray-200' : ''
        }`}
      >
        <MoreVertical size={iconSize} className={isOpen ? 'text-gray-600' : ''} />
      </button>

      {/* Dropdown Menu (Portal) */}
      {isMounted && isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[1500] min-w-[180px] animate-in fade-in zoom-in-95 duration-100 origin-top-right"
          style={{ top: dropdownPosition.top, right: dropdownPosition.right }}
          role="menu"
          aria-orientation="vertical"
        >
          {workspace.is_owner ? (
            // Owner menu
            <>
              {/* Opcja zapraszania widoczna tylko jeśli przekazano funkcję (używane na mobile) */}
              {onInvite && (
                <button
                  onClick={handleAction(onInvite)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 sm:hidden flex items-center gap-2 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <UserPlus size={14} />
                  <span>Zaproś uczestników</span>
                </button>
              )}

              <button
                onClick={handleAction(onEdit)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Pencil size={14} />
                <span>Zmień nazwę</span>
              </button>

              <button
                onClick={handleAction(onEdit)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Settings size={14} />
                <span>Ustawienia</span>
              </button>

              <button
                onClick={handleAction(onMembers)}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Users size={14} />
                <span>Członkowie</span>
              </button>

              <div className="h-px bg-gray-200 my-1" role="separator" />

              <button
                onClick={handleAction(onDelete)}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-100 flex items-center gap-2 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Trash2 size={14} />
                <span>Usuń</span>
              </button>
            </>
          ) : (
            // Member menu
            <button
              onClick={handleAction(onLeave)}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
              role="menuitem"
            >
              <Trash2 size={14} />
              <span>Opuść</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
