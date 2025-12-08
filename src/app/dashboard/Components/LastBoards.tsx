'use client';

import { useState, useEffect, useRef } from 'react';
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
  Compass,
  Cpu,
  Settings,
  Trash2,
  // Dodatkowe ikony z BoardSettingsModal
  Palette,
  Camera,
  Music,
  Video,
  Film,
  Code,
  Terminal,
  Database,
  Server,
  Cloud,
  Wifi,
  Smartphone,
  Monitor,
  Laptop,
  Gamepad2,
  Trophy,
  Heart,
  Flame,
  Sparkles,
  Award,
  Home,
  Calendar,
  FileText,
  MessageCircle,
  Bell
} from 'lucide-react';
import { fetchBoards, createBoard, updateBoard, deleteBoard, Board as APIBoard } from '@/boards_api/api';
import { useWorkspaces } from '@/app/context/WorkspaceContext';
import BoardSettingsModal from './BoardSettingsModal';

interface Board {
  id: number;  // ← ZMIANA: number zamiast string
  name: string;
  icon: any;
  iconName: string;  // Nazwa ikony do edycji
  bgColor: string;   // Kolor tła do edycji
  lastModified: string;
  lastModifiedBy: string;
  lastOpened: string;
  owner: string;
  onlineUsers: number;
  isFavorite: boolean;
}

// Mapowanie kolorów z bazy na gradienty Tailwind
const colorGradientMap: Record<string, string> = {
  'gray-500': 'from-gray-400 to-gray-600',
  'blue-500': 'from-blue-400 to-blue-600',
  'green-500': 'from-green-400 to-green-600',
  'purple-500': 'from-purple-400 to-purple-600',
  'pink-500': 'from-pink-400 to-pink-600',
  'red-500': 'from-red-400 to-red-600',
  'orange-500': 'from-orange-400 to-orange-600',
  'yellow-500': 'from-yellow-400 to-yellow-600',
  'teal-500': 'from-teal-400 to-teal-600',
  'indigo-500': 'from-indigo-400 to-indigo-600',
  'cyan-500': 'from-cyan-400 to-cyan-600',
  'emerald-500': 'from-emerald-400 to-emerald-600',
};

// Helper do pobrania gradientu z koloru
const getGradientFromColor = (color: string): string => {
  return colorGradientMap[color] || 'from-gray-400 to-gray-600';
};

const allIcons = [
  PenTool, Calculator, Globe, Lightbulb, Target, Rocket, BookOpen, Presentation,
  Zap, Compass, Cpu
];

export default function LastBoards() {
  const router = useRouter();
  const { workspaces, activeWorkspace } = useWorkspaces();
  
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState<{ id: number; name: string; icon: string; bg_color: string } | null>(null);
  
  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Mapowanie nazwy ikony → komponent
  const getIconComponent = (iconName: string) => {
    const map: Record<string, any> = {
      PenTool, Calculator, Globe, Lightbulb, Target, Rocket,
      BookOpen, Presentation, Zap, Compass, Cpu,
      Palette, Camera, Music, Video, Film,
      Code, Terminal, Database, Server, Cloud, Wifi,
      Smartphone, Monitor, Laptop, Gamepad2,
      Trophy, Star, Heart, Flame, Sparkles, Award,
      Home, Users, Calendar, FileText, MessageCircle, Bell
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
          iconName: b.icon,  // Zachowaj nazwę ikony do edycji
          bgColor: b.bg_color,  // Zachowaj kolor do edycji
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
  }, [activeWorkspace?.id]);

  // Zamknij dropdown przy kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Otwórz modal tworzenia tablicy
  const handleOpenCreateModal = () => {
    if (!activeWorkspace) {
      console.error('❌ Brak aktywnego workspace');
      return;
    }
    setShowCreateModal(true);
  };

  // Tworzenie nowej tablicy
  const handleCreateBoard = async (data: { name: string; icon: string; bg_color: string }) => {
    if (!activeWorkspace) {
      throw new Error('Brak aktywnego workspace');
    }
    
    const newBoard = await createBoard({
      name: data.name,
      workspace_id: activeWorkspace.id,
      icon: data.icon,
      bg_color: data.bg_color
    });
    
    // Przekieruj do tablicy z boardId
    router.push(`/tablica?boardId=${newBoard.id}`);
  };

  // Otwórz modal edycji tablicy
  const handleOpenEditModal = (board: Board) => {
    setEditingBoard({
      id: board.id,
      name: board.name,
      icon: board.iconName,
      bg_color: board.bgColor
    });
    setOpenDropdownId(null);
    setShowEditModal(true);
  };

  // Aktualizacja tablicy
  const handleUpdateBoard = async (data: { name: string; icon: string; bg_color: string }) => {
    if (!editingBoard) return;
    
    await updateBoard(editingBoard.id, data);
    
    // Zaktualizuj lokalny stan
    setBoards(prev => prev.map(b => 
      b.id === editingBoard.id 
        ? { 
            ...b, 
            name: data.name, 
            icon: getIconComponent(data.icon),
            iconName: data.icon,
            bgColor: data.bg_color
          }
        : b
    ));
  };

  // Usuń tablicę
  const handleDeleteBoard = async (boardId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę tablicę? Ta akcja jest nieodwracalna.')) {
      return;
    }
    
    try {
      await deleteBoard(boardId);
      setBoards(prev => prev.filter(b => b.id !== boardId));
      setOpenDropdownId(null);
    } catch (err) {
      console.error('❌ Błąd usuwania tablicy:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć tablicy');
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

  return (
    <>
      {/* Modal tworzenia tablicy */}
      <BoardSettingsModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateBoard}
        mode="create"
      />

      {/* Modal edycji tablicy */}
      <BoardSettingsModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingBoard(null);
        }}
        onSave={handleUpdateBoard}
        mode="edit"
        initialData={editingBoard || undefined}
      />

      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Tablice w tej przestrzeni
        </h2>
        <button
          onClick={handleOpenCreateModal}
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
      <div className="space-y-3 overflow-visible">
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
            // Użyj koloru z bazy zamiast gradientu opartego na ikonie
            const gradient = getGradientFromColor(board.bgColor);
            return (
              <div
                key={board.id}
                onClick={() => handleBoardClick(board.id)}
                className={`group bg-white rounded-2xl p-5 border-2 border-transparent hover:border-green-400 hover:shadow-lg transition-all duration-300 cursor-pointer grid grid-cols-12 gap-4 items-center backdrop-blur-sm relative ${openDropdownId === board.id ? 'z-50' : 'z-0'}`}
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

                {/* Trzy kropki - dropdown menu */}
                <div className="col-span-1 flex justify-end relative" ref={openDropdownId === board.id ? dropdownRef : null}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdownId(openDropdownId === board.id ? null : board.id);
                    }}
                    className={`p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-200 cursor-pointer ${
                      openDropdownId === board.id ? 'opacity-100 bg-gray-100 text-gray-700' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <MoreVertical size={20} />
                  </button>

                  {/* Dropdown menu */}
                  {openDropdownId === board.id && (
                    <div className="absolute right-0 top-full mt-1 z-[100] bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[180px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(board);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <Settings size={16} className="text-gray-500" />
                        <span>Ustawienia</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBoard(board.id);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                      >
                        <Trash2 size={16} />
                        <span>Usuń tablicę</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}