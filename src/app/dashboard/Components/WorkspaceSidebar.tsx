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
  Gamepad2,
  Heart,
  Home,
  Lightbulb,
  Music,
  Palette,
  Rocket,
  Sparkles,
  Target,
  Zap,
  Users,
  Calendar,
  FileText,
  Settings
} from 'lucide-react';
import { Fragment } from 'react';
import { useWorkspaces } from '@/app/context/WorkspaceContext';
import { setActiveWorkspace } from '@/workspace_api/api';
import WorkspaceSettingsModal from './WorkspaceSettingsModal';

// Mapowanie ikon z nazw na komponenty
const iconMap: Record<string, any> = {
  BookOpen,
  Briefcase,
  Code,
  Coffee,
  Compass,
  Crown,
  Gamepad2,
  Heart,
  Home,
  Lightbulb,
  Music,
  Palette,
  Rocket,
  Sparkles,
  Target,
  Zap
};

// Mapowanie kolorów - Tailwind nie obsługuje dynamicznych klas
const colorMap: Record<string, string> = {
  'green-500': 'bg-green-500',
  'blue-500': 'bg-blue-500',
  'purple-500': 'bg-purple-500',
  'pink-500': 'bg-pink-500',
  'orange-500': 'bg-orange-500',
  'red-500': 'bg-red-500',
  'yellow-500': 'bg-yellow-500',
  'indigo-500': 'bg-indigo-500',
  'teal-500': 'bg-teal-500',
  'cyan-500': 'bg-cyan-500',
  'emerald-500': 'bg-emerald-500',
  'gray-500': 'bg-gray-500',
  // Obsługa starych formatów z prefixem bg-
  'bg-green-500': 'bg-green-500',
  'bg-blue-500': 'bg-blue-500',
  'bg-purple-500': 'bg-purple-500',
  'bg-pink-500': 'bg-pink-500',
  'bg-orange-500': 'bg-orange-500',
  'bg-red-500': 'bg-red-500',
  'bg-yellow-500': 'bg-yellow-500',
  'bg-indigo-500': 'bg-indigo-500',
  'bg-teal-500': 'bg-teal-500',
  'bg-cyan-500': 'bg-cyan-500',
  'bg-emerald-500': 'bg-emerald-500',
  'bg-gray-500': 'bg-gray-500',
};

// Helper do pobrania klasy koloru
const getColorClass = (color: string): string => {
  return colorMap[color] || 'bg-green-500';
};

export default function WorkspaceSidebar() {
  const { 
    workspaces,
    activeWorkspace,
    setActiveWorkspace: setActiveWorkspaceContext,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    leaveWorkspace,
    toggleFavourite  
  } = useWorkspaces();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<number | null>(null);
  const [hoveredSpace, setHoveredSpace] = useState<number | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<{ id: number; name: string; icon: string; bg_color: string } | null>(null);

  // Tworzenie workspace przez modal
  const handleCreateWorkspace = async (data: { name: string; icon: string; bg_color: string }) => {
    await createWorkspace({
      name: data.name,
      icon: data.icon,
      bg_color: data.bg_color // format: "green-500"
    });
    console.log('✅ Workspace utworzony w bazie danych!');
  };

  // Otwórz modal edycji workspace
  const handleOpenEditModal = (space: any) => {
    setEditingWorkspace({
      id: space.id,
      name: space.name,
      icon: space.icon,
      bg_color: space.bg_color
    });
    setShowEditModal(true);
  };

  // Aktualizacja workspace przez modal
  const handleUpdateWorkspace = async (data: { name: string; icon: string; bg_color: string }) => {
    if (!editingWorkspace) return;
    
    await updateWorkspace(editingWorkspace.id, {
      name: data.name,
      icon: data.icon,
      bg_color: data.bg_color
    });
    console.log('✅ Workspace zaktualizowany!');
  };

  const toggleFavorite = async (id: number) => {
    try {
      const workspace = workspaces.find(ws => ws.id === id);
      if (!workspace) throw new Error('Workspace nie znaleziony');
      
      await toggleFavourite(id, !workspace.is_favourite);
      
      console.log(`✅ Zmieniono status ulubionego dla workspace ID: ${id}`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Nie udało się zmienić statusu';
      console.error('❌ Błąd zmiany ulubionego:', errorMsg);
    }
  };

  const handleDeleteSpace = async (id: number) => {
    try {
      await deleteWorkspace(id);
      setShowDeleteConfirm(null);
      
      // Jeśli usuwamy aktywny workspace, ustaw pierwszy
      if (activeWorkspace?.id === id) {
        setActiveWorkspaceContext(workspaces[0] || null);
      }
    } catch (err) {
      console.error('Błąd usuwania workspace:', err);
    }
  };

  const handleLeaveSpace = async (id: number) => {
    try {
      await leaveWorkspace(id);
      setShowLeaveConfirm(null);
      
      // Jeśli opuszczamy aktywny workspace, ustaw pierwszy z pozostałych
      if (activeWorkspace?.id === id) {
        const remaining = workspaces.filter(ws => ws.id !== id);
        setActiveWorkspaceContext(remaining[0] || null);
      }
    } catch (err) {
      console.error('Błąd opuszczania workspace:', err);
    }
  };

  const handleWorkspaceClick = async (id: number) => {
    // Jeśli klikamy ten sam workspace - nie rób nic
    if (activeWorkspace?.id === id) {
      return;
    }
    
    // Znajdź workspace
    const workspace = workspaces.find(ws => ws.id === id);
    if (!workspace) {
      console.error('❌ Workspace nie znaleziony:', id);
      return;
    }
    
    // Ustaw w kontekście (lokalnie)
    setActiveWorkspaceContext(workspace);
    
    try {
      // Zapisz w bazie
      await setActiveWorkspace(id);
      console.log(`✅ Aktywny workspace: ${id}`);
    } catch (err) {
      console.error('❌ Błąd ustawiania aktywnego workspace:', err);
    }
  };

  // Filtrowanie i sortowanie workspace'ów z backendu
  const filteredSpaces = workspaces.filter(space =>
    space.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSpaces = [...filteredSpaces].sort((a, b) => {
    if (a.is_favourite && !b.is_favourite) return -1;
    if (!a.is_favourite && b.is_favourite) return 1;
    return 0;
  });

  if (loading) {
    return (
      <div className="w-[350px] h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col sticky top-[64px]">
        
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Przestrzenie
            </h2>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-semibold">
              {workspaces.length}
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

        {/* WORKSPACE SKELETONS */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="mb-3 px-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white">
                {/* IKONA SKELETON */}
                <div className="w-10 h-10 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-xl animate-shimmer bg-[length:200%_100%]"></div>
                
                {/* NAZWA SKELETON */}
                <div className="flex-1">
                  <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-shimmer bg-[length:200%_100%]" 
                      style={{ width: `${60 + Math.random() * 30}%` }}>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER SKELETON */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="h-3 bg-gray-300 rounded w-16 animate-pulse"></div>
            <div className="h-3 bg-gray-300 rounded w-16 animate-pulse"></div>
          </div>
          <div className="w-full h-10 bg-gray-300 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[350px] h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex items-center justify-center">
        <div className="text-red-500 text-center p-4">
          Błąd: {error}
        </div>
      </div>
    );
  }

  // ✅ EKRAN GDY NIE MA WORKSPACE'ÓW
  if (workspaces.length === 0) {
    return (
      <>
        <div className="w-[350px] h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col sticky top-[64px]">
          
          {/* HEADER */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Przestrzenie
              </h2>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-semibold">
                0
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
                disabled
              />
            </div>
          </div>

          {/* EKRAN PUSTY - ZACHĘTA DO UTWORZENIA PIERWSZEGO WORKSPACE */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <Users size={32} className="text-green-600" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              Stwórz swoją pierwszą przestrzeń
            </h3>
            
            <p className="text-gray-600 mb-2">
              Przestrzenie pomagają organizować Twoją pracę i współpracować z innymi.
            </p>
            
            <div className="flex items-center gap-4 mt-6 mb-8">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar size={16} />
                <span>Planuj</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText size={16} />
                <span>Organizuj</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Users size={16} />
                <span>Współpracuj</span>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer transform hover:scale-105"
            >
              <Plus size={24} />
              <span className="text-lg">Stwórz pierwszą przestrzeń</span>
            </button>

            <p className="text-xs text-gray-500 mt-4 max-w-xs">
              Możesz później zaprosić członków zespołu i dodawać tablice
            </p>
          </div>
        </div>

        {/* Modal tworzenia przestrzeni */}
        <WorkspaceSettingsModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateWorkspace}
          mode="create"
        />
      </>
    );
  }

  // ✅ NORMALNY EKRAN GDY SĄ WORKSPACE'E
  return (
    <>
      <div className="w-[350px] h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col sticky top-[64px]">
        
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Przestrzenie
            </h2>
            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-semibold">
              {workspaces.length}
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
          {sortedSpaces.filter(s => s.is_favourite).length > 0 && (
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                Ulubione
              </h3>
            </div>
          )}

          {sortedSpaces.map((space) => {
            const IconComponent = iconMap[space.icon as keyof typeof iconMap] || Home;
            const isActive = activeWorkspace?.id === space.id;
            const isHovered = hoveredSpace === space.id;

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
                          : space.is_favourite 
                            ? 'bg-yellow-50' 
                            : ''
                    }`}
                    onClick={() => handleWorkspaceClick(space.id)}
                  >
                    <div className={`w-10 h-10 ${getColorClass(space.bg_color)} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <IconComponent size={20} className="text-white" />
                    </div>

                    <span className={`text-sm font-medium flex-1 truncate ${
                      isActive ? 'text-green-700' : 'text-gray-700 group-hover:text-gray-900'
                    }`}>
                      {space.name}
                    </span>

                    {isHovered && (
                      <div className="flex items-center gap-1">
                        {/* Przycisk ustawień (edycja ikony, koloru, nazwy) - tylko dla właściciela */}
                        {space.is_owner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(space);
                            }}
                            className="w-7 h-7 bg-gray-200 hover:bg-blue-100 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                            title="Ustawienia przestrzeni"
                          >
                            <Settings size={14} className="text-gray-600 hover:text-blue-600" />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(space.id);
                          }}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                            space.is_favourite 
                              ? 'bg-yellow-100 hover:bg-yellow-200' 
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          title={space.is_favourite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                        >
                          <Star 
                            size={14} 
                            className={space.is_favourite ? 'text-yellow-600 fill-yellow-600' : 'text-gray-600'} 
                          />
                        </button>

                        {/* Przycisk usunięcia/opuszczenia - różna akcja dla owner vs member */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (space.is_owner) {
                              setShowDeleteConfirm(space.id);
                            } else {
                              setShowLeaveConfirm(space.id);
                            }
                          }}
                          className="w-7 h-7 bg-gray-200 hover:bg-red-100 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                          title={space.is_owner ? 'Usuń przestrzeń' : 'Opuść przestrzeń'}
                        >
                          <X size={14} className="text-gray-600 hover:text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {space.is_favourite && 
                 sortedSpaces.indexOf(space) === sortedSpaces.filter(s => s.is_favourite).length - 1 && (
                  <div className="h-px bg-gray-300 my-3 mx-4"></div>
                )}
              </Fragment>
            );
          })}

          {sortedSpaces.length === 0 && searchQuery && (
            <div className="text-center py-8 px-4">
              <p className="text-gray-500 text-sm">Nie znaleziono przestrzeni</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
            <span>Ulubione: {workspaces.filter(s => s.is_favourite).length}</span>
            <span>Wszystkie: {workspaces.length}</span>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
          >
            <Plus size={20} />
            <span>Dodaj przestrzeń</span>
          </button>
        </div>
      </div>

      {/* Modal tworzenia przestrzeni */}
      <WorkspaceSettingsModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateWorkspace}
        mode="create"
      />

      {/* Modal edycji przestrzeni */}
      <WorkspaceSettingsModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingWorkspace(null);
        }}
        onSave={handleUpdateWorkspace}
        mode="edit"
        initialData={editingWorkspace || undefined}
      />

      {/* POPUP - Usuń przestrzeń (tylko dla owner) */}
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
              Czy na pewno chcesz usunąć przestrzeń <strong>"{workspaces.find(s => s.id === showDeleteConfirm)?.name}"</strong>?
              <br />
              <span className="text-red-500 text-sm">To usunie wszystkie tablice i dane w tej przestrzeni!</span>
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
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP - Opuść przestrzeń (tylko dla member) */}
      {showLeaveConfirm && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[9999] px-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowLeaveConfirm(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Opuść przestrzeń?
            </h2>
            <p className="text-gray-600 mb-6">
              Czy na pewno chcesz opuścić przestrzeń <strong>"{workspaces.find(s => s.id === showLeaveConfirm)?.name}"</strong>?
              <br />
              <span className="text-gray-500 text-sm">Przestrzeń nie zostanie usunięta - tylko stracisz do niej dostęp.</span>
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
              >
                Zostań
              </button>
              <button
                onClick={() => handleLeaveSpace(showLeaveConfirm)}
                className="flex-1 px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors cursor-pointer"
              >
                Opuść
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}