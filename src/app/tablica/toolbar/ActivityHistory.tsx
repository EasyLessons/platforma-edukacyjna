/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/ActivityHistory.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, useMemo, memo)
 * - lucide-react (ikony elementów i UI)
 * - boards_api/api (BoardElementWithAuthor)
 * 
 * EKSPORTUJE:
 * - ActivityHistory (component) - panel historii aktywności
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główny komponent)
 * 
 * PRZEZNACZENIE:
 * Panel pokazujący historię dodanych elementów na tablicy.
 * Grupuje elementy po autorze i czasie (5s okno).
 * Przycisk "Pokaż" centruje widok na wybranym elemencie.
 * ============================================================================
 */

'use client';

import React, { useState, useMemo, memo, useCallback } from 'react';
import { 
  History, 
  ChevronDown, 
  ChevronUp,
  Pencil, 
  Square, 
  Type, 
  Image, 
  FileText, 
  Table2, 
  LineChart,
  FileCode,
  Eye,
  X,
  User
} from 'lucide-react';
import type { BoardElementWithAuthor } from '@/boards_api/api';
import type { DrawingElement, ViewportTransform } from '../whiteboard/types';

// ============================================================================
// TYPY
// ============================================================================

interface ActivityGroup {
  id: string;
  authorId: number;
  authorName: string;
  timestamp: Date;
  elements: BoardElementWithAuthor[];
  // Bounding box całej grupy - do centrowania widoku
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  };
}

interface ActivityHistoryProps {
  elements: BoardElementWithAuthor[];
  currentUserId?: number;
  onCenterView: (x: number, y: number, scale?: number) => void;
  viewport: ViewportTransform;
}

// ============================================================================
// HELPERS
// ============================================================================

const TIME_GROUP_WINDOW_MS = 5000; // 5 sekund

/**
 * Zwraca ikonę dla danego typu elementu
 */
const getElementIcon = (type: string) => {
  switch (type) {
    case 'path':
      return <Pencil className="w-3.5 h-3.5" />;
    case 'shape':
      return <Square className="w-3.5 h-3.5" />;
    case 'text':
      return <Type className="w-3.5 h-3.5" />;
    case 'image':
      return <Image className="w-3.5 h-3.5" />;
    case 'pdf':
      return <FileText className="w-3.5 h-3.5" />;
    case 'markdown':
      return <FileCode className="w-3.5 h-3.5" />;
    case 'table':
      return <Table2 className="w-3.5 h-3.5" />;
    case 'function':
      return <LineChart className="w-3.5 h-3.5" />;
    default:
      return <Square className="w-3.5 h-3.5" />;
  }
};

/**
 * Zwraca czytelną nazwę typu elementu
 */
const getElementTypeName = (type: string): string => {
  switch (type) {
    case 'path':
      return 'Rysunek';
    case 'shape':
      return 'Kształt';
    case 'text':
      return 'Tekst';
    case 'image':
      return 'Obraz';
    case 'pdf':
      return 'PDF';
    case 'markdown':
      return 'Notatka';
    case 'table':
      return 'Tabela';
    case 'function':
      return 'Wykres funkcji';
    default:
      return 'Element';
  }
};

/**
 * Oblicza bounding box elementu
 */
const getElementBounds = (data: DrawingElement): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  if (!data) return null;

  switch (data.type) {
    case 'path': {
      if (!data.points || data.points.length === 0) return null;
      const xs = data.points.map(p => p.x);
      const ys = data.points.map(p => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
      };
    }
    case 'shape': {
      return {
        minX: Math.min(data.startX, data.endX),
        minY: Math.min(data.startY, data.endY),
        maxX: Math.max(data.startX, data.endX),
        maxY: Math.max(data.startY, data.endY)
      };
    }
    case 'text':
    case 'image':
    case 'pdf':
    case 'markdown':
    case 'table': {
      return {
        minX: data.x,
        minY: data.y,
        maxX: data.x + (data.width || 100),
        maxY: data.y + (data.height || 50)
      };
    }
    case 'function': {
      // Funkcje są renderowane globalnie - centruj na 0,0
      return {
        minX: -data.xRange,
        minY: -data.yRange,
        maxX: data.xRange,
        maxY: data.yRange
      };
    }
    default:
      return null;
  }
};

/**
 * Grupuje elementy po autorze i czasie (5s okno)
 */
const groupElementsByAuthorAndTime = (elements: BoardElementWithAuthor[]): ActivityGroup[] => {
  if (!elements || elements.length === 0) return [];

  // Sortuj po created_at DESC (najnowsze pierwsze)
  const sorted = [...elements]
    .filter(el => el.created_at && el.created_by_username)
    .sort((a, b) => {
      const timeA = new Date(a.created_at!).getTime();
      const timeB = new Date(b.created_at!).getTime();
      return timeB - timeA;
    });

  const groups: ActivityGroup[] = [];
  let currentGroup: ActivityGroup | null = null;

  for (const element of sorted) {
    const timestamp = new Date(element.created_at!);
    const authorId = element.created_by_id || 0;
    const authorName = element.created_by_username || 'Nieznany';

    // Sprawdź czy element pasuje do bieżącej grupy
    if (
      currentGroup &&
      currentGroup.authorId === authorId &&
      Math.abs(timestamp.getTime() - currentGroup.timestamp.getTime()) <= TIME_GROUP_WINDOW_MS
    ) {
      // Dodaj do bieżącej grupy
      currentGroup.elements.push(element);
      
      // Aktualizuj bounds
      const bounds = getElementBounds(element.data);
      if (bounds) {
        currentGroup.bounds.minX = Math.min(currentGroup.bounds.minX, bounds.minX);
        currentGroup.bounds.minY = Math.min(currentGroup.bounds.minY, bounds.minY);
        currentGroup.bounds.maxX = Math.max(currentGroup.bounds.maxX, bounds.maxX);
        currentGroup.bounds.maxY = Math.max(currentGroup.bounds.maxY, bounds.maxY);
      }
    } else {
      // Zakończ poprzednią grupę i oblicz centrum
      if (currentGroup) {
        currentGroup.bounds.centerX = (currentGroup.bounds.minX + currentGroup.bounds.maxX) / 2;
        currentGroup.bounds.centerY = (currentGroup.bounds.minY + currentGroup.bounds.maxY) / 2;
      }

      // Nowa grupa
      const bounds = getElementBounds(element.data);
      currentGroup = {
        id: `group-${element.element_id}-${Date.now()}`,
        authorId,
        authorName,
        timestamp,
        elements: [element],
        bounds: bounds ? {
          ...bounds,
          centerX: 0,
          centerY: 0
        } : {
          minX: 0,
          minY: 0,
          maxX: 0,
          maxY: 0,
          centerX: 0,
          centerY: 0
        }
      };
      groups.push(currentGroup);
    }
  }

  // Zakończ ostatnią grupę
  if (currentGroup) {
    currentGroup.bounds.centerX = (currentGroup.bounds.minX + currentGroup.bounds.maxX) / 2;
    currentGroup.bounds.centerY = (currentGroup.bounds.minY + currentGroup.bounds.maxY) / 2;
  }

  return groups;
};

/**
 * Formatuje czas względny
 */
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Teraz';
  if (diffMin < 60) return `${diffMin} min temu`;
  if (diffHour < 24) return `${diffHour} godz. temu`;
  if (diffDay === 1) return 'Wczoraj';
  if (diffDay < 7) return `${diffDay} dni temu`;
  
  return date.toLocaleDateString('pl-PL', { 
    day: 'numeric', 
    month: 'short' 
  });
};

// ============================================================================
// KOMPONENTY
// ============================================================================

/**
 * Pojedyncza grupa aktywności
 */
const ActivityGroupItem = memo(({ 
  group, 
  currentUserId,
  onShow 
}: { 
  group: ActivityGroup; 
  currentUserId?: number;
  onShow: (centerX: number, centerY: number) => void;
}) => {
  const isCurrentUser = currentUserId && group.authorId === currentUserId;
  
  // Policz typy elementów w grupie
  const elementCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const el of group.elements) {
      const type = el.data?.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }, [group.elements]);

  const handleShow = useCallback(() => {
    onShow(group.bounds.centerX, group.bounds.centerY);
  }, [onShow, group.bounds.centerX, group.bounds.centerY]);

  return (
    <div className="px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            isCurrentUser ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>
            <User className="w-3.5 h-3.5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-medium truncate ${
                isCurrentUser ? 'text-blue-700' : 'text-gray-800'
              }`}>
                {isCurrentUser ? 'Ty' : group.authorName}
              </span>
              <span className="text-xs text-gray-400">
                {formatRelativeTime(group.timestamp)}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 mt-0.5">
              {Object.entries(elementCounts).map(([type, count]) => (
                <div 
                  key={type} 
                  className="flex items-center gap-0.5 text-gray-500"
                  title={`${count}× ${getElementTypeName(type)}`}
                >
                  {getElementIcon(type)}
                  {count > 1 && (
                    <span className="text-xs">{count}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleShow}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="Pokaż na tablicy"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

ActivityGroupItem.displayName = 'ActivityGroupItem';

// ============================================================================
// GŁÓWNY KOMPONENT
// ============================================================================

const ActivityHistoryComponent = ({
  elements,
  currentUserId,
  onCenterView,
  viewport
}: ActivityHistoryProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Grupuj elementy
  const groups = useMemo(() => {
    return groupElementsByAuthorAndTime(elements);
  }, [elements]);

  // Handler "Pokaż" - centruje widok na grupie
  const handleShow = useCallback((centerX: number, centerY: number) => {
    // viewport.x i viewport.y to współrzędne "world" na środku ekranu
    // Więc żeby element był na środku, ustawiamy viewport.x/y na pozycję elementu
    onCenterView(centerX, centerY, viewport.scale);
    setIsOpen(false);
  }, [onCenterView, viewport.scale]);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <div className="absolute bottom-4 left-44 z-50 pointer-events-auto">
      {/* Przycisk główny */}
      <button
        onClick={toggleOpen}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors ${
          isOpen ? 'ring-2 ring-blue-500' : ''
        }`}
        title="Historia aktywności"
      >
        <History className="w-4 h-4" />
        <span className="text-sm font-medium">Historia</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronUp className="w-4 h-4" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800">
              Historia aktywności
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista grup */}
          <div className="max-h-80 overflow-y-auto">
            {groups.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Brak historii</p>
                <p className="text-xs mt-1">Elementy pojawią się tutaj po dodaniu</p>
              </div>
            ) : (
              groups.map(group => (
                <ActivityGroupItem
                  key={group.id}
                  group={group}
                  currentUserId={currentUserId}
                  onShow={handleShow}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {groups.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                {groups.length} {groups.length === 1 ? 'grupa' : 
                  groups.length < 5 ? 'grupy' : 'grup'} • {elements.length} {elements.length === 1 ? 'element' : 
                  elements.length < 5 ? 'elementy' : 'elementów'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ActivityHistory = memo(ActivityHistoryComponent);
ActivityHistory.displayName = 'ActivityHistory';
