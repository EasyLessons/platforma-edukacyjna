'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Filter,
  Star,
  MoreVertical,
  Users,
  Clock,
  User,
  ChevronDown,
  PenTool,
  Calculator,
  Globe,
  Lightbulb,
  Target,
  Rocket,
  BookOpen,
  Presentation,
  Zap,
  Beaker,
  Brain,
  Compass,
  Cpu,
  Dna
} from 'lucide-react';
import { fetchBoards, createBoard, Board as APIBoard } from '@/boards_api/api';
import { useWorkspaces } from '@/app/context/WorkspaceContext';

interface Board {
  id: number;  // ← ZMIANA: number zamiast string
  name: string;
  icon: any;
  lastModified: string;
  lastModifiedBy: string;
  lastOpened: string;
  owner: string;
  onlineUsers: number;
  isFavorite: boolean;
}

const iconGradientMap: Record<string, string> = {
  // Podstawowe
  PenTool: 'from-gray-400 to-gray-600',
  Calculator: 'from-blue-400 to-blue-600',
  Globe: 'from-teal-400 to-teal-600',
  Lightbulb: 'from-yellow-400 to-yellow-600',
  Target: 'from-green-400 to-green-600',
  Rocket: 'from-purple-400 to-purple-600',
  BookOpen: 'from-orange-400 to-orange-600',
  Presentation: 'from-red-400 to-red-600',

  // Nowe, żywe
  Zap: 'from-pink-400 to-pink-600',
  Beaker: 'from-cyan-400 to-cyan-600',
  Brain: 'from-indigo-400 to-indigo-600',
  Compass: 'from-emerald-400 to-emerald-600',
  Cpu: 'from-violet-400 to-violet-600',
  Dna: 'from-rose-400 to-rose-600'
};

const allIcons = [
  PenTool, Calculator, Globe, Lightbulb, Target, Rocket, BookOpen, Presentation,
  Zap, Beaker, Brain, Compass, Cpu, Dna
];

export default function LastBoards() {
  const router = useRouter();
  const { workspaces } = useWorkspaces();
  
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  
  // Znajdź aktywny workspace (ulubiony lub pierwszy)
  const activeWorkspace = workspaces.find(w => w.is_favourite) || workspaces[0];
  
  // Mapowanie nazwy ikony → komponent
  const getIconComponent = (iconName: string) => {
    const map: Record<string, any> = {
      PenTool, Calculator, Globe, Lightbulb, Target, Rocket,
      BookOpen, Presentation, Zap, Beaker, Brain, Compass, Cpu, Dna
    };
    return map[iconName] || PenTool;
  };
  
  // Formatowanie daty
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Nigdy';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Nieznana data';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffMins < 1) return 'Teraz';
      if (diffMins < 60) return `${diffMins} min temu`;
      if (diffHours < 24) return `${diffHours} godz. temu`;
      if (diffDays === 1) return 'Wczoraj';
      if (diffDays < 7) return `${diffDays} dni temu`;
      return date.toLocaleDateString('pl-PL');
    } catch {
      return 'Nieznana data';
    }
  };
  
  // Załaduj tablice z API
  useEffect(() => {
    const loadBoards = async () => {
      if (!activeWorkspace) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        const data = await fetchBoards(activeWorkspace.id);
        
        // Mapuj API Board → UI Board
        const mappedBoards: Board[] = data.boards.map((b: APIBoard) => ({
          id: b.id,
          name: b.name,
          icon: getIconComponent(b.icon),
          lastModified: formatDate(b.last_modified),
          lastModifiedBy: b.last_modified_by || b.created_by,
          lastOpened: formatDate(b.last_opened || b.created_at),
          owner: b.owner_username,
          onlineUsers: 0,  // TODO: WebSocket
          isFavorite: b.is_favourite
        }));
        
        setBoards(mappedBoards);
      } catch (err) {
        console.error('❌ Błąd ładowania tablic:', err);
        setError(err instanceof Error ? err.message : 'Błąd ładowania tablic');
      } finally {
        setLoading(false);
      }
    };
    
    loadBoards();
  }, [activeWorkspace]);

  // Sortowanie: ulubione na górze
  const sortedBoards = [...boards].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;

    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;  // 'recent' jest już posortowane przez API
  });

  const filteredBoards = sortedBoards.filter(board =>
    filterOwner === 'all' ||
    (filterOwner === 'me' && board.owner === 'Ty') ||
    (filterOwner === 'others' && board.owner !== 'Ty')
  );

  const handleCreateBoard = async () => {
    if (!activeWorkspace) {
      console.error('❌ Brak aktywnego workspace');
      return;
    }
    
    try {
      const newBoard = await createBoard({
        name: 'Nowa tablica',
        workspace_id: activeWorkspace.id,
        icon: 'PenTool',
        bg_color: 'gray-500'
      });
      
      // Przekieruj do tablicy z boardId
      router.push(`/tablica?boardId=${newBoard.id}`);
    } catch (err) {
      console.error('❌ Błąd tworzenia tablicy:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć tablicy');
    }
  };

  const handleBoardClick = (boardId: number) => {
    router.push(`/tablica?boardId=${boardId}`);
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie tablic...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center py-16">
          <div className="text-red-500 mb-4">❌ {error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Odśwież stronę
          </button>
        </div>
      </div>
    );
  }

  const toggleFavorite = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const board = boards.find(b => b.id === id);
    if (!board) return;
    
    try {
      // Optymistyczna aktualizacja UI
      setBoards(prev =>
        prev.map(b =>
          b.id === id ? { ...b, isFavorite: !b.isFavorite } : b
        )
      );
      
      // Wywołaj API
      // await toggleBoardFavourite(id, !board.isFavorite);  // TODO: gdy endpoint zadziała
    } catch (err) {
      console.error('❌ Błąd zmiany ulubionej:', err);
      // Cofnij zmianę przy błędzie
      setBoards(prev =>
        prev.map(b =>
          b.id === id ? { ...b, isFavorite: board.isFavorite } : b
        )
      );
    }
  };

  const getRandomIcon = () => {
    return allIcons[Math.floor(Math.random() * allIcons.length)];
  };

  const getGradient = (Icon: any) => {
    return iconGradientMap[Icon.name] || 'from-indigo-400 to-indigo-600';
  };

  return (
    <>
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Tablice w tej przestrzeni
        </h2>
        <button
          onClick={handleCreateBoard}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-md flex items-center gap-2 transition-all duration-200 text-sm cursor-pointer shadow-sm hover:shadow"
        >
          <Plus size={18} />
          Utwórz nową
        </button>
      </div>

      {/* Filtry */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-600" />
            <span className="font-semibold text-gray-800">Wszystkie tablice</span>
          </div>

          <div className="relative">
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer transition-all"
            >
              <option value="all">Należy do dowolnej osoby</option>
              <option value="me">Tylko moje</option>
              <option value="others">Innych</option>
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          <div className="relative ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer transition-all"
            >
              <option value="recent">Ostatnio otwarta</option>
              <option value="modified">Ostatnio zmodyfikowana</option>
              <option value="name">Nazwa</option>
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Nagłówki kolumn */}
      <div className="grid grid-cols-12 gap-4 px-2 mb-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
        <div className="col-span-4">Nazwa</div>
        <div className="col-span-2">Ostatnio otwarta</div>
        <div className="col-span-2">Właściciel</div>
        <div className="col-span-2 text-center">Osoby online</div>
        <div className="col-span-1"></div>
        <div className="col-span-1"></div>
      </div>

      {/* Lista tablic */}
      <div className="space-y-3">
        {filteredBoards.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
              <Rocket size={36} className="text-green-600" />
            </div>
            <p className="text-lg font-medium text-gray-800 mb-1">Brak tablic</p>
            <p className="text-sm text-gray-600">Utwórz nową, aby zacząć!</p>
          </div>
        ) : (
          filteredBoards.map((board) => {
            const Icon = board.icon || getRandomIcon();
            const gradient = getGradient(Icon);
            return (
              <div
                key={board.id}
                onClick={() => handleBoardClick(board.id)}
                className="group bg-white rounded-2xl p-5 border-2 border-transparent hover:border-green-400 hover:shadow-lg transition-all duration-300 cursor-pointer grid grid-cols-12 gap-4 items-center backdrop-blur-sm"
              >
                {/* Nazwa + ikona */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={24} className="text-white drop-shadow-sm" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base leading-tight">{board.name}</h3>
                    <p className="text-sm font-medium text-gray-700 mt-0.5">
                      {board.lastModified} przez <span className="text-green-700">{board.lastModifiedBy}</span>
                    </p>
                  </div>
                </div>

                {/* Ostatnio otwarta */}
                <div className="col-span-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock size={15} className="text-gray-500" />
                    <span className="font-medium text-gray-800">{board.lastOpened}</span>
                  </div>
                </div>

                {/* Właściciel */}
                <div className="col-span-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <User size={15} className="text-gray-500" />
                    <span className="font-medium text-gray-800">{board.owner}</span>
                  </div>
                </div>

                {/* Osoby online */}
                <div className="col-span-2 text-center">
                  {board.onlineUsers > 0 ? (
                    <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full">
                      <Users size={16} />
                      <span className="font-bold text-sm">{board.onlineUsers}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs font-medium">—</span>
                  )}
                </div>

                {/* Gwiazdka */}
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={(e) => toggleFavorite(e, board.id)}
                    className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                      board.isFavorite
                        ? 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200 shadow-sm'
                        : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                    }`}
                  >
                    <Star size={20} fill={board.isFavorite ? 'currentColor' : 'none'} strokeWidth={2} />
                  </button>
                </div>

                {/* Trzy kropki */}
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                  >
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}