/**
 * BOARD CARD
 *
 * "Głupi" komponent — tylko UI. Stan i handlery przez propsy.
 *
 * Dwa layouty: mobile (uproszczony) + desktop (grid 12 kolumn).
 * Online users dostaje jako prop — pobierane zbiorczo w BoardList.
 */

'use client';

import { Star, MoreVertical, Clock, User } from 'lucide-react';
import { BoardOnlineUsers } from './board-online-users';
import { getIconComponent, getGradientClass, formatDate } from '../utils/helpers';
import type { Board, BoardCardActions } from '../types';
import type { OnlineUser } from '@/_new/shared/types/user';

interface BoardCardProps {
  board: Board;
  onlineUsers: OnlineUser[];
  onAction: BoardCardActions;
  onToggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
  onSelect: (boardId: number) => void;
}

export function BoardCard({
  board,
  onlineUsers,
  onAction,
  onToggleFavourite,
  onSelect,
}: BoardCardProps) {
  // DERIVED
  // ================================
  const Icon = getIconComponent(board.icon);
  const gradient = getGradientClass(board.bg_color);

  // HANDLERS
  // ================================

  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onToggleFavourite(board.id, !board.is_favourite);
  };

  const handleDropdownEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction.edit(board);
  };

  const handleDropdownDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction.delete(board);
  };

  // RENDER
  // ================================

  return (
    <div
      onClick={() => onSelect(board.id)}
      className="group relative bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer px-4 py-3"
    >
      {/* MOBILE LAYOUT */}
      <div className="flex lg:hidden items-center gap-3">
        <div
          className={`w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}
        >
          <Icon size={20} className="text-white drop-shadow-sm" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate text-sm">{board.name}</h3>
            {board.is_favourite && (
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {formatDate(board.last_modified)} ·{' '}
            <span className="text-green-700 font-medium">
              {board.last_modified_by || board.owner_username}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleToggleFavourite}
            className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-gray-100 transition-colors"
            title={board.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <Star
              className={`w-4 h-4 ${board.is_favourite ? 'fill-yellow-400 text-yellow-400' : ''}`}
            />
          </button>
          <BoardDropdownMenu onEdit={handleDropdownEdit} onDelete={handleDropdownDelete} />
        </div>
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
        {/* Nazwa + ikona — col 4 */}
        <div className="col-span-4 flex items-center gap-3">
          <div
            className={`w-12 h-12 flex-shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200`}
          >
            <Icon size={24} className="text-white drop-shadow-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-base truncate">{board.name}</h3>
              {board.is_favourite && (
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {formatDate(board.last_modified)} przez{' '}
              <span className="text-green-700 font-medium">
                {board.last_modified_by || board.owner_username}
              </span>
            </p>
          </div>
        </div>

        {/* Ostatnio otwarta — col 2 */}
        <div className="col-span-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Clock size={14} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{formatDate(board.last_opened)}</span>
          </div>
        </div>

        {/* Właściciel — col 2 */}
        <div className="col-span-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <User size={14} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{board.owner_username}</span>
          </div>
        </div>

        {/* Online users — col 2 */}
        <div className="col-span-2 flex justify-center">
          <BoardOnlineUsers users={onlineUsers} />
        </div>

        {/* Actions — col 2 */}
        <div
          className="col-span-2 flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleToggleFavourite}
            className={`p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:bg-gray-100 ${
              board.is_favourite
                ? '!opacity-100 text-yellow-400'
                : 'text-gray-400 hover:text-yellow-400'
            }`}
            title={board.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <Star className={`w-4 h-4 ${board.is_favourite ? 'fill-yellow-400' : ''}`} />
          </button>

          <BoardDropdownMenu onEdit={handleDropdownEdit} onDelete={handleDropdownDelete} />
        </div>
      </div>
    </div>
  );
}

// DROPDOWN MENU
// ================================

import { Settings, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface BoardDropdownMenuProps {
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function BoardDropdownMenu({ onEdit, onDelete }: BoardDropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Zamknij po kliknięciu poza
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        className="p-1.5 lg:p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[180px]">
          <button
            onClick={(e) => {
              onEdit(e);
              setOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <Settings size={16} className="text-gray-500" />
            <span>Ustawienia</span>
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={(e) => {
              onDelete(e);
              setOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
          >
            <Trash2 size={16} />
            <span>Usuń tablicę</span>
          </button>
        </div>
      )}
    </div>
  );
}
