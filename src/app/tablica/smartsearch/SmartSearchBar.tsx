/**
 * ============================================================================
 * PLIK: src/app/tablica/smartsearch/SmartSearchBar.tsx
 * ============================================================================
 * 
 * SmartSearchBar - wyszukiwarka wzorów w toolbarze
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, BookOpen, Calculator, FileText, Table2, PieChart } from 'lucide-react';
import { loadManifest, searchResources, getResourceTypeColor } from './searchService';
import { ResourceManifest, SearchResult, FormulaResource, CardResource } from './types';

interface SmartSearchBarProps {
  onFormulaSelect: (formula: FormulaResource) => void;
  onCardSelect: (card: CardResource) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Calculator,
  FileText,
  Table: Table2,
  PieChart,
};

export function SmartSearchBar({ onFormulaSelect, onCardSelect }: SmartSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [manifest, setManifest] = useState<ResourceManifest | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Załaduj manifest przy pierwszym otwarciu
  useEffect(() => {
    if (isOpen && !manifest) {
      setIsLoading(true);
      loadManifest()
        .then(setManifest)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, manifest]);

  // Wyszukaj gdy zmieni się query
  useEffect(() => {
    if (manifest && query.trim()) {
      const searchResults = searchResources(manifest, query);
      setResults(searchResults);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [query, manifest]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  }, [results, selectedIndex]);

  // Zamknij przy kliknięciu poza
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (result: SearchResult) => {
    if (result.resultType === 'card') {
      onCardSelect(result as CardResource);
    } else {
      onFormulaSelect(result as FormulaResource);
    }
    setIsOpen(false);
    setQuery('');
  };

  const getIcon = (type: string) => {
    const iconName = manifest?.resourceTypes[type]?.icon || 'Calculator';
    const IconComponent = iconMap[iconName] || Calculator;
    return IconComponent;
  };

  const getTypeLabel = (type: string) => {
    return manifest?.resourceTypes[type]?.label || type;
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search Button / Input */}
      {!isOpen ? (
        <button
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl"
          title="Szukaj wzorów (Ctrl+K)"
        >
          <Search className="w-5 h-5 text-gray-400" />
          <span className="text-base text-gray-500">Szukaj wzorów matematycznych...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded border border-gray-200">
            Ctrl+K
          </kbd>
        </button>
      ) : (
        <div className="flex items-center gap-3 bg-white rounded-xl border-2 border-blue-500 shadow-xl px-4">
          <Search className="w-5 h-5 text-blue-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Wpisz np. jedynka, sinus, karta wzorów..."
            className="text-black w-[400px] py-3 text-base bg-transparent outline-none"
            autoFocus
          />
          <button
            onClick={() => {
              setIsOpen(false);
              setQuery('');
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      )}

      {/* Results Dropdown */}
      {isOpen && (query.trim() || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border border-gray-200 shadow-xl max-h-96 overflow-y-auto z-50 min-w-[320px]">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
              Ładowanie...
            </div>
          ) : results.length === 0 && query.trim() ? (
            <div className="p-4 text-center text-gray-500">
              Brak wyników dla "{query}"
            </div>
          ) : (
            <ul className="py-1">
              {results.map((result, index) => {
                const Icon = getIcon(result.type);
                const color = manifest ? getResourceTypeColor(manifest, result.type) : '#3B82F6';
                const isCard = result.resultType === 'card';
                
                return (
                  <li
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`
                      flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors
                      ${index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    `}
                  >
                    {/* Icon */}
                    <div 
                      className="p-2 rounded-lg shrink-0"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <div style={{ color }}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {result.title}
                        </span>
                        {isCard && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full text-white shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            Karta
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {result.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${color}15`, color }}
                        >
                          {getTypeLabel(result.type)}
                        </span>
                        {!isCard && 'subcategory' in result && (
                          <span className="text-xs text-gray-400">
                            {result.subcategory}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Action hint */}
                    <div className="text-xs text-gray-400 shrink-0 self-center">
                      {isCard ? 'Przeglądaj →' : 'Dodaj →'}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
