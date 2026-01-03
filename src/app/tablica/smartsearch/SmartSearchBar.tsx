/**
 * ============================================================================
 * PLIK: src/app/tablica/smartsearch/SmartSearchBar.tsx
 * ============================================================================
 * 
 * SmartSearchBar - wyszukiwarka wzorów w toolbarze (FIXED EXPANSION + FANCY ANIMATIONS)
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, BookOpen, Calculator, FileText, Table2, PieChart, Library, Sparkles } from 'lucide-react';
import { loadManifest, searchResources, getResourceTypeColor } from './searchService';
import { ResourceManifest, SearchResult, FormulaResource, CardResource } from './types';

interface SmartSearchBarProps {
  onFormulaSelect: (formula: FormulaResource) => void;
  onCardSelect: (card: CardResource) => void;
  onBrowseAll?: () => void;
  onActiveChange?: (isActive: boolean) => void; // Callback gdy search się otwiera/zamyka
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Calculator,
  FileText,
  Table: Table2,
  PieChart,
};

export function SmartSearchBar({ onFormulaSelect, onCardSelect, onBrowseAll, onActiveChange }: SmartSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [manifest, setManifest] = useState<ResourceManifest | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isAnimatingSelection, setIsAnimatingSelection] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);

  // Monitor window width
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ctrl+K skrót klawiszowy
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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

  // Auto-scroll do zaznaczonego elementu
  useEffect(() => {
    if (selectedItemRef.current && resultsContainerRef.current) {
      const container = resultsContainerRef.current;
      const item = selectedItemRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      
      // Scroll tylko gdy element jest poza widocznym obszarem
      // Używamy 'instant' zamiast 'smooth' żeby nie było lagu przy przytrzymaniu strzałek
      if (itemRect.bottom > containerRect.bottom) {
        item.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      } else if (itemRect.top < containerRect.top) {
        item.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Blokuj scroll tablicy w tle gdy modal jest otwarty
  useEffect(() => {
    const hasResults = !!(query.trim() || isLoading); // Wymuś boolean
    const isActive = isOpen && hasResults;
    
    // Informuj rodzica o zmianie stanu
    onActiveChange?.(isActive);
    
    if (isActive) {
      // Blokuj scroll na całym body/document
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Przywróć scroll po zamknięciu
        document.body.style.overflow = originalOverflow;
        onActiveChange?.(false);
      };
    }
  }, [isOpen, query, isLoading, onActiveChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
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
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Blokuj scroll tablicy gdy jesteśmy nad wynikami
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const container = resultsContainerRef.current;
    if (!container) return;
    
    // Zatrzymaj propagację do tablicy
    e.stopPropagation();
    
    // Manualnie scrolluj kontener
    container.scrollTop += e.deltaY;
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setQuery('');
      setSelectedItemId(null);
      setIsAnimatingSelection(false);
    }, 300);
  };

  const handleSelect = (result: SearchResult) => {
    // Rozpocznij fancy animację
    setSelectedItemId(result.id);
    setIsAnimatingSelection(true);
    
    // Poczekaj 400ms na animację, potem wywołaj callback
    setTimeout(() => {
      if (result.resultType === 'card') {
        onCardSelect(result as CardResource);
      } else {
        onFormulaSelect(result as FormulaResource);
      }
      handleClose();
    }, 400);
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
    <>
      {/* CSS Animacje */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-8px);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes expandSearch {
          from {
            width: 500px;
            opacity: 0.8;
          }
          to {
            width: 700px;
            opacity: 1;
          }
        }
        
        @keyframes expandSearchMobile {
          from {
            width: 56px;
            opacity: 0.8;
          }
          to {
            width: 90vw;
            opacity: 1;
          }
        }
        
        @keyframes shrinkSearch {
          from {
            width: 700px;
            opacity: 1;
          }
          to {
            width: 500px;
            opacity: 0.8;
          }
        }
        
        @keyframes shrinkSearchMobile {
          from {
            width: 90vw;
            opacity: 1;
          }
          to {
            width: 56px;
            opacity: 0.8;
          }
        }
        

        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @keyframes spin {
          to { 
            transform: rotate(360deg); 
          }
        }
        
        /* FANCY SELECTION ANIMATIONS - tylko glow i shimmer */
        @keyframes selectedItemGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 30px 10px rgba(59, 130, 246, 0.6), 0 0 60px 20px rgba(59, 130, 246, 0.3);
          }
          100% {
            box-shadow: 0 0 30px 10px rgba(59, 130, 246, 0.6), 0 0 60px 20px rgba(59, 130, 246, 0.3);
          }
        }
        
        @keyframes shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
        
        @keyframes fadeOutOthers {
          to {
            opacity: 0;
            transform: scale(0.95);
          }
        }
        
        /* Naprawiony scroll dla wyników */
        .results-scroll {
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
        }
        
        .results-scroll::-webkit-scrollbar {
          width: 8px;
        }
        
        .results-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 8px 0;
        }
        
        .results-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(59, 130, 246, 0.3);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        
        .results-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(59, 130, 246, 0.5);
        }
        
        /* Shimmer effect overlay */
        .shimmer-overlay {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.8) 50%,
            transparent 100%
          );
          animation: shimmer 0.6s ease-in-out;
          pointer-events: none;
          z-index: 10;
        }
      `}</style>

      <div ref={containerRef} className="relative">
        {/* Search Button / Input */}
        {!isOpen ? (
          <>
            <button
              onClick={() => {
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={`flex items-center gap-3 backdrop-blur-xl bg-white/70 rounded-3xl border border-gray-200/50 hover:border-blue-400/50 hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-purple-50/80 shadow-lg hover:shadow-blue-200/50 hover:scale-[1.02] hover:cursor-pointer relative ${windowWidth > 1550 ? 'mx-auto' : ''}`}
              style={{ 
                width: windowWidth <= 760 ? '56px' : '100%', 
                maxWidth: windowWidth <= 760 ? '56px' : '1000px', 
                height: '64px',
                padding: windowWidth <= 760 ? '0' : '16px 24px',
                justifyContent: windowWidth <= 760 ? 'center' : 'flex-start',
                transition: 'all 0.3s ease-out'
              }}
              title="Szukaj wzorów (Ctrl+K)"
            >
              <Search className="w-5 h-5 text-gray-400" />
  
              
              
              

              {/* Tekst i przyciski ukrywane przy 760px */}
              {windowWidth > 760 && (
                <>
                  <span className="text-base text-gray-500 flex-1 text-left">Szukaj wzorów matematycznych...</span>
                  
                  {/* Ctrl+K badge - WEWNĄTRZ buttona */}
                  <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-400 bg-white/60 rounded-lg border border-gray-200/50 backdrop-blur-sm">
                    Ctrl+K
                  </kbd>
                  
                  {/* Separator - WEWNĄTRZ buttona */}
                  <div className="w-px h-8 bg-gray-200/50 mx-2" />
                  
                  {/* Ikonka wzorów - WEWNĄTRZ głównego buttona */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(true);
                      setQuery('karty wzorów');
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="p-2 bg-blue-100/80 hover:bg-blue-100/99 rounded-xl transition-all duration-200 hover:scale-110 group relative"
                    title="Przeglądaj karty wzorów"
                  >
                    <Library className="w-5 h-5 text-blue-500 hover:cursor-pointer" />
                  
                    {/* Tooltip */}
                    <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                      <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                        Przeglądaj karty wzorów
                        <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </button>
          </>
        ) : (
          <div 
            className={`flex items-center gap-3 backdrop-blur-xl bg-white/80 rounded-3xl border-2 border-blue-400/50 shadow-lg px-6 ${windowWidth > 1550 ? 'mx-auto' : ''}`}
            style={{
              height: '64px',
              width: windowWidth <= 760 ? '90vw' : '100%',
              maxWidth: windowWidth <= 760 ? '500px' : windowWidth <= 1550 ? '100%' : windowWidth<=1580 ? '500px' : windowWidth<= 1620 ? '550px' : windowWidth <= 1800 ? '620px' : '1000px',
              position: 'relative',
              animation: windowWidth > 760 && windowWidth <= 1550 
                ? 'none' 
                : (isClosing 
                  ? (windowWidth <= 760 ? 'shrinkSearchMobile 0.3s ease-out forwards' : 'shrinkSearch 0.3s ease-out forwards')
                  : (windowWidth <= 760 ? 'expandSearchMobile 0.3s ease-out forwards' : 'expandSearch 0.3s ease-out forwards'))
            }}
          >
            <Search className="w-5 h-5 text-blue-500 animate-pulse" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Wpisz np. jedynka, sinus, karta wzorów..."
              className="text-black flex-1 py-4 text-base bg-transparent outline-none placeholder:text-gray-400"
              autoFocus
            />
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100/80 rounded-xl transition-all duration-200 hover:scale-110"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        )}

        {/* Results Dropdown Z DZIAŁAJĄCYM SCROLLEM I FANCY ANIMATIONS */}
        {isOpen && (query.trim() || isLoading) && !isClosing && (
          <div 
            ref={resultsContainerRef}
            onWheel={handleWheel}
            className="absolute top-full left-0 right-0 mt-3 backdrop-blur-xl bg-white/80 rounded-3xl border border-gray-200/50 shadow-lg max-h-[500px] z-[60] results-scroll overflow-y-auto"
            style={{
              animation: 'slideIn 0.3s ease-out',
              width: windowWidth <= 760 ? '90vw' : 'auto',
              maxWidth: windowWidth <= 760 ? '500px' : 'none',
              left: windowWidth <= 760 ? '50%' : '0',
              right: windowWidth <= 760 ? 'auto' : '0',
              transform: windowWidth <= 760 ? 'translateX(-50%)' : 'none'
            }}
          >
            {isLoading ? (
              <div className="p-6 text-center text-gray-500">
                <div 
                  className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"
                  style={{
                    animation: 'spin 1s linear infinite, pulse 2s ease-in-out infinite'
                  }}
                />
                Ładowanie...
              </div>
            ) : results.length === 0 && query.trim() ? (
              <div className="p-6 text-center text-gray-500">
                <div className="text-4xl mb-2"></div>
                Brak wyników dla "{query}"
              </div>
            ) : (
              <ul className="py-2">
                {results.map((result, index) => {
                  const Icon = getIcon(result.type);
                  const color = manifest ? getResourceTypeColor(manifest, result.type) : '#3B82F6';
                  const isCard = result.resultType === 'card';
                  const isSelected = selectedItemId === result.id;
                  const isOtherItem = isAnimatingSelection && !isSelected;
                  
                  return (
                    <li
                      key={result.id}
                      ref={index === selectedIndex ? selectedItemRef : null}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`
                        flex items-start gap-4 px-5 py-4 mx-2 mb-1 rounded-2xl cursor-pointer transition-all duration-200 relative overflow-hidden
                        ${index === selectedIndex 
                          ? 'bg-gray-200/50 shadow-lg' 
                          : 'hover:bg-gray-50/80'
                        }
                      `}
                      style={{
                        animation: isSelected 
                          ? 'selectedItemGlow 0.4s ease-out forwards'
                          : isOtherItem
                          ? 'fadeOutOthers 0.3s ease-out forwards'
                          : `slideIn 0.2s ease-out ${index * 0.03}s both`
                      }}
                    >
                      {/* Shimmer effect gdy zaznaczony */}
                      {isSelected && <div className="shimmer-overlay" />}
                      
                      {/* Icon z iskierkami */}
                      <div 
                        className="p-3 rounded-2xl shrink-0 transition-transform duration-200 hover:scale-110 relative"
                        style={{ 
                          backgroundColor: `${color}20`,
                          boxShadow: `0 4px 12px ${color}15`
                        }}
                      >
                        <div style={{ color }}>
                          <Icon className="w-6 h-6" />
                        </div>
                        
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 truncate text-base">
                            {result.title}
                          </span>
                          {isCard && (
                            <span 
                              className="text-xs px-2.5 py-1 rounded-full text-white shrink-0 font-medium"
                              style={{ backgroundColor: color }}
                            >
                              Karta
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate mb-2">
                          {result.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ backgroundColor: `${color}15`, color }}
                          >
                            {getTypeLabel(result.type)}
                          </span>
                          {!isCard && 'subcategory' in result && (
                            <span className="text-xs text-gray-400 font-medium">
                              {result.subcategory}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action hint */}
                      <div className="flex items-center gap-1 text-sm text-gray-400 shrink-0 self-center font-medium">
                        {isCard ? 'Przeglądaj' : 'Dodaj'}
                        <span className="text-lg">→</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Animacja zamykania wyników */}
        {isOpen && (query.trim() || isLoading) && isClosing && (
          <div 
            className="absolute top-full left-0 right-0 mt-3 backdrop-blur-xl bg-white/80 rounded-3xl border border-gray-200/50 shadow-lg max-h-[500px] z-50"
            style={{
              animation: 'slideOut 0.2s ease-out forwards'
            }}
          />
        )}
      </div>
    </>
  );
}