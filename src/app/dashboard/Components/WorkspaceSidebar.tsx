'use client';

import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Star,
  X,
  BookOpen,
  Briefcase,
  Code,
  Coffee,
  Compass,
  Crown,
  Gamepad,
  Heart,
  Home,
  Lightbulb,
  Music,
  Palette,
  Rocket,
  Sparkles,
  Target,
  Zap,
  Edit2,
  Check
} from 'lucide-react';
import { Fragment } from 'react';

interface Space {
  id: string;
  name: string;
  icon: any;
  color: string;
  isFavorite: boolean;
}

export default function WorkspaceSidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [hoveredSpace, setHoveredSpace] = useState<string | null>(null);
  const [activeSpace, setActiveSpace] = useState<string>('1');
  const [editingSpace, setEditingSpace] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const availableIcons = [
    BookOpen, Briefcase, Code, Coffee, Compass, Crown, 
    Gamepad, Heart, Home, Lightbulb, Music, Palette, 
    Rocket, Sparkles, Target, Zap
  ];

  const availableColors = [
    'bg-green-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-cyan-500',
  ];

  const getRandomIcon = () => availableIcons[Math.floor(Math.random() * availableIcons.length)];
  const getRandomColor = () => availableColors[Math.floor(Math.random() * availableColors.length)];

  const [spaces, setSpaces] = useState<Space[]>([
    {
      id: '1',
      name: 'Wygenerowana automatycznie',
      icon: Home,
      color: 'bg-green-500',
      isFavorite: false
    }
  ]);

  const openAddPopup = () => {
    setNewSpaceName('');
    setShowAddPopup(true);
  };

  const handleAddSpace = () => {
    if (!newSpaceName.trim()) return;

    const newSpace: Space = {
      id: Date.now().toString(),
      name: newSpaceName.trim(),
      icon: getRandomIcon(),
      color: getRandomColor(),
      isFavorite: false
    };
    setSpaces([...spaces, newSpace]);
    setShowAddPopup(false);
    setNewSpaceName('');
  };

  const toggleFavorite = (id: string) => {
    setSpaces(spaces.map(space => 
      space.id === id ? { ...space, isFavorite: !space.isFavorite } : space
    ));
  };

  const handleDeleteSpace = (id: string) => {
    setSpaces(spaces.filter(space => space.id !== id));
    setShowDeleteConfirm(null);
    if (activeSpace === id) {
      setActiveSpace(spaces[0]?.id || '');
    }
  };

  const startEdit = (space: Space) => {
    setEditingSpace(space.id);
    setEditName(space.name);
  };

  const saveEdit = () => {
    if (editingSpace && editName.trim()) {
      setSpaces(spaces.map(space =>
        space.id === editingSpace ? { ...space, name: editName.trim() } : space
      ));
    }
    setEditingSpace(null);
    setEditName('');
  };

  const cancelEdit = () => {
    setEditingSpace(null);
    setEditName('');
  };

  const filteredSpaces = spaces.filter(space =>
    space.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSpaces = [...filteredSpaces].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return 0;
  });

  return (
    <>
      {/* SIDEBAR – sticky, nie ucieka */}
      <div className="w-[350px] h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col sticky top-[64px]">
        
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Przestrzenie
            </h2>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-semibold">
              {spaces.length}
            </span>
          </div>

          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Wyszukaj przestrzenie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-sm text-gray-900 font-medium focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all cursor-text placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* SCROLLUJĄCA LISTA */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sortedSpaces.filter(s => s.isFavorite).length > 0 && (
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                Ulubione
              </h3>
            </div>
          )}

          {sortedSpaces.map((space) => {
            const IconComponent = space.icon;
            const isActive = activeSpace === space.id;
            const isHovered = hoveredSpace === space.id;
            const isEditing = editingSpace === space.id;

            return (
              <Fragment key={space.id}>
                <div
                  className="relative mb-1"
                  onMouseEnter={() => setHoveredSpace(space.id)}
                  onMouseLeave={() => setHoveredSpace(null)}
                >
                  <div 
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-10 bg-green-600 rounded-r-full transition-all duration-200 ${
                      isActive ? 'w-1' : isHovered ? 'w-0.5' : 'w-0'
                    }`}
                  />

                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 ml-2 rounded-lg transition-all duration-200 cursor-pointer group ${
                      isActive 
                        ? 'bg-green-100 border-2 border-green-300' 
                        : isHovered
                          ? 'bg-gray-100'
                          : space.isFavorite 
                            ? 'bg-yellow-50' 
                            : ''
                    }`}
                    onClick={() => setActiveSpace(space.id)}
                  >
                    <div className={`w-10 h-10 ${space.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <IconComponent size={20} className="text-white" />
                    </div>

                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="flex-1 px-2 py-1 text-sm font-semibold text-gray-900 border-2 border-green-400 rounded focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="p-1 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`text-sm font-medium flex-1 truncate ${
                          isActive ? 'text-green-700' : 'text-gray-700 group-hover:text-gray-900'
                        }`}>
                          {space.name}
                        </span>

                        {isHovered && !isEditing && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(space);
                              }}
                              className="w-7 h-7 bg-gray-200 hover:bg-blue-100 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                              title="Zmień nazwę"
                            >
                              <Edit2 size={14} className="text-gray-600 hover:text-blue-600" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(space.id);
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                space.isFavorite 
                                  ? 'bg-yellow-100 hover:bg-yellow-200' 
                                  : 'bg-gray-200 hover:bg-gray-300'
                              }`}
                              title={space.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                            >
                              <Star 
                                size={14} 
                                className={space.isFavorite ? 'text-yellow-600 fill-yellow-600' : 'text-gray-600'} 
                              />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(space.id);
                              }}
                              className="w-7 h-7 bg-gray-200 hover:bg-red-100 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                              title="Usuń przestrzeń"
                            >
                              <X size={14} className="text-gray-600 hover:text-red-600" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {space.isFavorite && 
                 sortedSpaces.indexOf(space) === sortedSpaces.filter(s => s.isFavorite).length - 1 && (
                  <div className="h-px bg-gray-300 my-3 mx-4"></div>
                )}
              </Fragment>
            );
          })}

          {sortedSpaces.length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="text-gray-500 text-sm">Nie znaleziono przestrzeni</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
            <span>Ulubione: {spaces.filter(s => s.isFavorite).length}</span>
            <span>Wszystkie: {spaces.length}</span>
          </div>

          <button
            onClick={openAddPopup}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
          >
            <Plus size={20} />
            <span>Dodaj przestrzeń</span>
          </button>
        </div>
      </div>

      {/* POPUPY – ZAWSZE NA WIERZCHU, z-index: 9999 */}
      {showAddPopup && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[9999] px-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowAddPopup(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Dodaj nową przestrzeń
            </h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nazwa przestrzeni:
              </label>
              <input
                type="text"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSpace();
                  if (e.key === 'Escape') setShowAddPopup(false);
                }}
                placeholder="np. Klasa 5A, Projekty, Gaming..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 font-medium focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Kolor i ikonka zostaną przypisane losowo
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddPopup(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddSpace}
                disabled={!newSpaceName.trim()}
                className={`flex-1 px-4 py-2 font-semibold rounded-lg transition-colors ${
                  newSpaceName.trim()
                    ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP - Usuń przestrzeń – DOKŁADNIE JAK BYŁO, ALE Z INDEX 9999 */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[9999] px-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Usuń przestrzeń?
            </h2>
            <p className="text-gray-600 mb-6">
              Czy na pewno chcesz usunąć przestrzeń <strong>"{spaces.find(s => s.id === showDeleteConfirm)?.name}"</strong>?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
              >
                Nie
              </button>
              <button
                onClick={() => handleDeleteSpace(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
              >
                Tak
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}