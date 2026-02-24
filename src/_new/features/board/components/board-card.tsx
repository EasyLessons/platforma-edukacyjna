/**
 * BOARD CARD
 *
 * Karta tablicy — wyświetla dane tablicy i zarządza akcjami:
 * - Nawigacja do tablicy (klik)
 * - Toggle ulubione
 * - Edycja (settings)
 * - Usunięcie
 *
 * Dwa layouty: mobile (uproszczony) + desktop (grid 12 kolumn).
 *
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Star, MoreVertical, Clock, User, Settings, Trash2 } from 'lucide-react';
import { ConfirmationModal } from '@/_new/shared/ui/confirmation-modal';
import { BoardFormModal } from './board-form-modal';
import { BoardOnlineUsers } from './board-online-users';
import { useBoards } from '../hooks/use-boards';
import { fetchBoardOnlineUsers } from '../api/board-api';
import { getIconComponent, getGradientClass, formatDate } from '../utils/helpers';
import type { Board } from '../types';
import type { OnlineUser } from '@/_new/shared/types/user';

interface BoardCardProps {
  board: Board;
  workspaceId: number;
}

export function BoardCard({ board, workspaceId }: BoardCardProps) {
  // STATE
  // ================================

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const { toggleFavourite, deleteBoard } = useBoards({ workspaceId, autoLoad: false });

  const Icon = getIconComponent(board.icon);
  const gradient = getGradientClass(board.bg_color);

  // ONLINE USERS
  // ================================

  useEffect(() => {
    const load = async () => {
      try {
        const users = await fetchBoardOnlineUsers(board.id);
        setOnlineUsers(users);
      } catch {
        // cicho — brak online users to nie błąd krytyczny
      }
    };

    load();
  }, [board.id]);

  // HANDLERS
  // ================================

  const handleClick = () => {
    router.push(`/tablica?boardId=${board.id}`);
  };

  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavourite(board.id, !board.is_favourite);
    } catch (err) {
      console.error('Error toggling favourite:', err);
    }
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown((prev) => !prev);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    setShowEditModal(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteBoard(board.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting board:', err);
      alert('Nie udało się usunąć tablicy. Spróbuj ponownie.');
    }
  };

  // RENDER
  // ================================

  return (
    <>
      <div
        onClick={handleClick}
        className="group relative bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer px-4 py-3"
      >
        {/* MOBILE LAYOUT */}
        <div className="flex lg:hidden items-center gap-3">
          {/* Ikona */}
          <div
            className={`w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}
          >
            <Icon size={20} className="text-white drop-shadow-sm" />
          </div>

          {/* Info */}
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

          {/* Actions */}
          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleToggleFavourite}
              className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-gray-100 transition-colors"
              title={board.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            >
              <Star
                className={`w-4 h-4 ${board.is_favourite ? 'fill-yellow-400 text-yellow-400' : ''}`}
              />
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleDropdownToggle}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <MoreVertical size={16} />
              </button>
              {showDropdown && <DropdownMenu onEdit={handleEdit} onDelete={handleDeleteClick} />}
            </div>
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
          <div className="col-span-2 flex items-center justify-end gap-1">
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

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleDropdownToggle}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100"
              >
                <MoreVertical size={18} />
              </button>
              {showDropdown && <DropdownMenu onEdit={handleEdit} onDelete={handleDeleteClick} />}
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}

      <BoardFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        board={board}
        workspaceId={workspaceId}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Usuń tablicę?"
        message={
          <>
            Czy na pewno chcesz usunąć <strong>"{board.name}"</strong>?
            <br />
            <span className="text-red-600 font-semibold">Ta akcja jest nieodwracalna.</span>
          </>
        }
        confirmText="Usuń tablicę"
        confirmVariant="destructive"
      />
    </>
  );
}

// DROPDOWN MENU
// ================================

interface DropdownMenuProps {
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function DropdownMenu({ onEdit, onDelete }: DropdownMenuProps) {
  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[180px]">
      <button
        onClick={onEdit}
        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
      >
        <Settings size={16} className="text-gray-500" />
        <span>Ustawienia</span>
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={onDelete}
        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
      >
        <Trash2 size={16} />
        <span>Usuń tablicę</span>
      </button>
    </div>
  );
}
