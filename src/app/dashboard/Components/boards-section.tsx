/**
 * BOARDS SECTION
 *
 * Orkiestrator sekcji tablic na dashboardzie.
 *
 * Odpowiada za:
 * - useBoards — jeden stan dla całej sekcji
 * - Header z przyciskiem tworzenia
 * - Filtry i sortowanie (UI + stan)
 * - Nagłówki kolumn (desktop)
 * - Modals: tworzenie, edycja, potwierdzenie usunięcia
 * - Nawigację do tablicy
 * - Przekazanie danych i onAction do BoardList
 *
 */

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter, ChevronDown } from 'lucide-react';
import { DashboardButton } from './DashboardButton';
import { BoardList } from '@/_new/features/board/components/board-list';
import { BoardCreateModal } from '@/_new/features/board/components/board-create-modal';
import { BoardEditModal } from '@/_new/features/board/components/board-edit-modal';
import { ConfirmationModal } from '@/_new/shared/ui/confirmation-modal';
import { useBoards } from '@/_new/features/board/hooks/use-boards';
import { useAuth } from '@/app/context/AuthContext';
import type { Board, BoardCardActions } from '@/_new/features/board/types';
import type { SortBy, FilterOwner } from '@/_new/features/board/utils/helpers';

interface BoardsSectionProps {
  workspaceId: number;
  workspaceName?: string;
}

export default function BoardsSection({ workspaceId, workspaceName }: BoardsSectionProps) {
  const router = useRouter();
  const { user } = useAuth();
  const currentUsername = user?.username ?? '';

  // STATE
  // ================================
  const {
    boards,
    loading,
    error,
    createBoard,
    updateBoard,
    deleteBoard,
    toggleFavourite,
  } = useBoards({ workspaceId });

  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [filterOwner, setFilterOwner] = useState<FilterOwner>('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);

  // Obiekt akcji przekazywany do kart przez BoardList
  const cardActions: BoardCardActions = useMemo(
    () => ({
      edit: setEditingBoard,
      delete: setDeletingBoard,
    }),
    []
  );

  // HANDLERS
  // ================================
  const handleSelect = (boardId: number) => {
    router.push(`/tablica?boardId=${boardId}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBoard) return;
    try {
      await deleteBoard(deletingBoard.id);
      setDeletingBoard(null);
    } catch (err) {
      console.error('Error deleting board:', err);
      alert('Nie udało się usunąć tablicy. Spróbuj ponownie.');
    }
  };

  // RENDER
  // ================================
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h2 className="text-lg md:text-2xl font-bold text-gray-900">
          {workspaceName ? `Tablice — ${workspaceName}` : 'Tablice'}
        </h2>
        <DashboardButton
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => setShowCreateModal(true)}
          className="h-8"
        >
          <span className="hidden sm:inline">Nowa tablica</span>
          <span className="sm:hidden">Nowa</span>
        </DashboardButton>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-3 md:p-4 mb-4 md:mb-6 mx-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-600" />
            <span className="font-semibold text-gray-800 text-xs md:text-sm">
              Wszystkie tablice
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 flex-1 sm:justify-end">
            <div className="relative">
              <select
                value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value as FilterOwner)}
                className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-xs md:text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer transition-all min-w-[120px]"
              >
                <option value="all">Dowolna osoba</option>
                <option value="mine">Tylko moje</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-xs md:text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer transition-all min-w-[120px]"
              >
                <option value="recent">Ostatnio zmieniona</option>
                <option value="favourite">Ulubione</option>
                <option value="name">Nazwa</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Nagłówki kolumn — tylko desktop */}
      <div className="hidden lg:grid grid-cols-12 gap-4 px-5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <div className="col-span-4">Nazwa</div>
        <div className="col-span-2">Ostatnio otwarta</div>
        <div className="col-span-2">Właściciel</div>
        <div className="col-span-2 text-center">Osoby online</div>
        <div className="col-span-2" />
      </div>

      {/* Lista tablic */}
      <BoardList
        boards={boards}
        loading={loading}
        error={error}
        sortBy={sortBy}
        filterOwner={filterOwner}
        currentUsername={currentUsername}
        onlineUsersEnabled
        onAction={cardActions}
        onSelect={handleSelect}
        onToggleFavourite={toggleFavourite}
      />

      {/* MODALS */}

      <BoardCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        workspaceId={workspaceId}
        onSubmit={async (data) => {
          await createBoard(data);
          setShowCreateModal(false);
        }}
      />

      {editingBoard && (
        <BoardEditModal
          isOpen={!!editingBoard}
          onClose={() => setEditingBoard(null)}
          board={editingBoard}
          onSubmit={async (data) => {
            await updateBoard(editingBoard.id, data);
            setEditingBoard(null);
          }}
        />
      )}

      <ConfirmationModal
        isOpen={!!deletingBoard}
        onClose={() => setDeletingBoard(null)}
        onConfirm={handleDeleteConfirm}
        title="Usuń tablicę?"
        message={
          <>
            Czy na pewno chcesz usunąć <strong>"{deletingBoard?.name}"</strong>?
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
