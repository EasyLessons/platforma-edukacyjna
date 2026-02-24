/**
 * BOARDS SECTION
 *
 * Orkiestrator sekcji tablic na dashboardzie.
 *
 * Odpowiada za:
 * - Header z przyciskiem tworzenia
 * - Nagłówki kolumn (desktop)
 * - Filtry i sortowanie
 * - Modal tworzenia tablicy
 * - Przekazanie stanu do BoardList
 *
 * NIE odpowiada za:
 * - Pobieranie danych (useBoards w BoardList)
 * - Renderowanie kart (BoardCard)
 *
 */

import { useState } from 'react';
import { Plus, Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { BoardList } from '@/_new/features/board/components/board-list';
import { BoardFormModal } from '@/_new/features/board/components/board-form-modal';
import { useAuth } from '@/app/context/AuthContext';
import type { SortBy, FilterOwner } from '@/_new/features/board/utils/helpers';

interface BoardsSectionProps {
  workspaceId: number;
  workspaceName?: string;
}

export default function BoardsSection({ workspaceId, workspaceName }: BoardsSectionProps) {
  // STATE
  // ================================

  const { user } = useAuth();
  const currentUsername = user?.username ?? '';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [filterOwner, setFilterOwner] = useState<FilterOwner>('all');

  // RENDER
  // ================================

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6 px-1">
        <h2 className="text-lg md:text-2xl font-bold text-gray-900">
          {workspaceName ? `Tablice — ${workspaceName}` : 'Tablice'}
        </h2>
        <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreateModal(true)} size="sm">
          <span className="hidden sm:inline">Nowa tablica</span>
          <span className="sm:hidden">Nowa</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-xl p-3 md:p-4 mb-4 md:mb-6 mx-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-600" />
            <span className="font-semibold text-gray-800 text-xs md:text-sm">
              Wszystkie tablice
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 flex-1 sm:justify-end">
            {/* Owner Filter */}
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

            {/* Sorting */}
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
        workspaceId={workspaceId}
        sortBy={sortBy}
        filterOwner={filterOwner}
        currentUsername={currentUsername}
      />

      {/* Modal tworzenia */}
      <BoardFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
        board={null}
        workspaceId={workspaceId}
      />
    </>
  );
}
