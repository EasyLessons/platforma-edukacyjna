'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Maximize2, PenTool, Layout, Star, MoreVertical, Search, Filter, ChevronDown, Clock } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { BoardCard } from '@/_new/features/board/components/boardCard';
import { getRecentBoards, type RecentBoard } from '@/_new/features/board/utils/recentBoards';
import { getIconComponent, getGradientClass, formatDate, type SortBy } from '@/_new/features/board/utils/helpers';
import { toggleBoardFavourite } from '@/_new/features/board/api/boardApi';

export default function RecentsView() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  
  const { user } = useAuth();
  const currentUsername = user?.username ?? '';
  const router = useRouter();

  useEffect(() => {
    setRecentBoards(getRecentBoards());
  }, []);

  const handleSelect = (boardId: number) => {
    router.push(`/tablica?boardId=${boardId}`);
  };

  const handleToggleFavourite = async (id: number, isFavourite: boolean) => {
    try {
      await toggleBoardFavourite(id, isFavourite);
      const updatedList = getRecentBoards().map(b => b.id === id ? { ...b, is_favourite: isFavourite } : b);
      if (typeof window !== 'undefined') {
        localStorage.setItem('recent_boards', JSON.stringify(updatedList));
      }
      setRecentBoards(updatedList);
    } catch (err) {
      console.error(err);
      alert("Nie udało się zaktualizować ulubionych.");
    }
  };

  const sortedBoards = useMemo(() => {
    const list = [...recentBoards];
    switch (sortBy) {
      case 'name':
         list.sort((a, b) => a.name.localeCompare(b.name));
         break;
      case 'favourite':
         list.sort((a, b) => Number(b.is_favourite) - Number(a.is_favourite));
         break;
      case 'recent':
      default:
         list.sort((a, b) => new Date(b.last_opened || b.last_modified).getTime() - new Date(a.last_opened || a.last_modified).getTime());
         break;
    }
    // ensure desc
    if (sortBy === 'recent') {
      list.reverse();
    }
    return list;
  }, [recentBoards, sortBy]);

  return (
    <div className="flex flex-col w-full min-h-full bg-gray-50">
      <div className="p-8 md:p-10 pb-6 md:pb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Ostatnio używane tablice</h1>

        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setViewMode('grid')}
              className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
                viewMode === 'grid' ? 'text-black border-black' : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              Miniatury
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
                viewMode === 'list' ? 'text-black border-black' : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              Lista
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-xs md:text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-black focus:border-black cursor-pointer transition-all min-w-[120px]"
              >
                <option value="recent">Ostatnio otwarte</option>
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

        {recentBoards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center bg-white border border-gray-200 rounded-xl">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Brak ostatnio używanych tablic</h3>
            <p className="text-gray-600 text-sm max-w-md">
              Wejdź na dowolną tablicę aby w tym widoku zaczęły pojawiać się tablice.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedBoards.map((board) => {
               const Icon = getIconComponent(board.icon);
               const gradient = getGradientClass(board.bg_color);
               return (
                <div
                  key={board.id}
                  onClick={() => handleSelect(board.id)}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all cursor-pointer shadow-none"
                >
                  <div className="w-full pt-[56.25%] relative bg-gray-100 border-b border-gray-100">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon size={32} className="text-gray-300" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="p-4 flex flex-col">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-black truncate text-[15px]">{board.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {formatDate(board.last_opened || board.last_modified)}
                          {board.workspaceName && ` w: ${board.workspaceName}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
               );
            })}
          </div>
        ) : (
          <div className="flex flex-col bg-white border border-gray-200 rounded-xl shadow-none">
            <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-4">Nazwa</div>
              <div className="col-span-2">Ostatnio otwarta</div>
              <div className="col-span-2">Właściciel</div>
              <div className="col-span-2 text-center"></div>
              <div className="col-span-2" />
            </div>
            
            <div className="flex flex-col gap-0 [&>div:last-child]:border-b-0">
              {sortedBoards.map((board) => (
                <div key={board.id} className="border-b border-gray-100 group relative">
                  <BoardCard
                    board={board}
                    canRename={false}
                    onlineUsers={[]}
                    onAction={{ edit: () => {}, delete: () => {} }}
                    onToggleFavourite={handleToggleFavourite}
                    onSelect={handleSelect}
                  />
                  {board.workspaceName && (
                     <div className="py-2 absolute lg:static top-0 right-0 hidden lg:block text-xs text-gray-400 pl-5 pb-2 -mt-1 truncate max-w-full z-10 pointer-events-none">
                       Przestrzeń: {board.workspaceName}
                     </div>
                  )}
                  {board.workspaceName && (
                     <div className="py-2 block lg:hidden text-xs text-gray-400 pl-[4.5rem] pr-4 pb-3 -mt-2 truncate z-10 pointer-events-none">
                       Przestrzeń: {board.workspaceName}
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
