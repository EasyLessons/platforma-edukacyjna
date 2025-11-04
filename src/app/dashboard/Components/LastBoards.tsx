'use client';

import { useState } from 'react';
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

interface Board {
  id: string;
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
  const [filterOwner, setFilterOwner] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [boards, setBoards] = useState<Board[]>([
    {
      id: '1',
      name: 'Matura 2025 - Algebra',
      icon: Calculator,
      lastModified: '2 godziny temu',
      lastModifiedBy: 'Jan Kowalski',
      lastOpened: 'Dzisiaj, 14:32',
      owner: 'Ty',
      onlineUsers: 3,
      isFavorite: true
    },
    {
      id: '2',
      name: 'Geometria - Bryły',
      icon: Globe,
      lastModified: 'Wczoraj',
      lastModifiedBy: 'Anna Nowak',
      lastOpened: '2 dni temu',
      owner: 'Anna Nowak',
      onlineUsers: 0,
      isFavorite: false
    },
    {
      id: '3',
      name: 'Trygonometria - Zadania',
      icon: Target,
      lastModified: '5 godzin temu',
      lastModifiedBy: 'Ty',
      lastOpened: 'Dzisiaj, 09:15',
      owner: 'Ty',
      onlineUsers: 1,
      isFavorite: true
    },
    {
      id: '4',
      name: 'Statystyka - Rozkłady',
      icon: Presentation,
      lastModified: '3 dni temu',
      lastModifiedBy: 'Michał Wiśniewski',
      lastOpened: 'Tydzień temu',
      owner: 'Michał Wiśniewski',
      onlineUsers: 0,
      isFavorite: false
    },
    {
      id: '5',
      name: 'Pusta tablica - Notatki',
      icon: PenTool,
      lastModified: 'Teraz',
      lastModifiedBy: 'Ty',
      lastOpened: 'Właśnie otwarta',
      owner: 'Ty',
      onlineUsers: 2,
      isFavorite: false
    },
    {
      id: '6',
      name: 'Fizyka - Prędkość',
      icon: Zap,
      lastModified: '1 godzinę temu',
      lastModifiedBy: 'Kasia Zielińska',
      lastOpened: 'Dzisiaj, 11:20',
      owner: 'Kasia Zielińska',
      onlineUsers: 1,
      isFavorite: false
    },
    {
      id: '7',
      name: 'Biologia - Komórka',
      icon: Dna,
      lastModified: '4 godziny temu',
      lastModifiedBy: 'Ty',
      lastOpened: 'Wczoraj',
      owner: 'Ty',
      onlineUsers: 0,
      isFavorite: true
    }
  ]);

  // Sortowanie: ulubione na górze
  const sortedBoards = [...boards].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;

    if (sortBy === 'recent') {
      const order = ['Właśnie otwarta', 'Teraz', 'Dzisiaj', 'Wczoraj', '2 dni temu', 'Tydzień temu'];
      const aKey = a.lastOpened.split(',')[0];
      const bKey = b.lastOpened.split(',')[0];
      return (order.indexOf(aKey) === -1 ? 999 : order.indexOf(aKey)) - 
             (order.indexOf(bKey) === -1 ? 999 : order.indexOf(bKey));
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const filteredBoards = sortedBoards.filter(board =>
    filterOwner === 'all' ||
    (filterOwner === 'me' && board.owner === 'Ty') ||
    (filterOwner === 'others' && board.owner !== 'Ty')
  );

  const handleCreateBoard = () => {
    router.push('/tablica');
  };

  const handleBoardClick = (boardId: string) => {
    router.push(`/tablica/${boardId}`);
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setBoards(prev =>
      prev.map(board =>
        board.id === id ? { ...board, isFavorite: !board.isFavorite } : board
      )
    );
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