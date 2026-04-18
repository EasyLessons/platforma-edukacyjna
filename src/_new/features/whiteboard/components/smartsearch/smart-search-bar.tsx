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
import {
  Search,
  X,
  BookOpen,
  Calculator,
  FileText,
  Table2,
  PieChart,
  Library,
  Sparkles,
  Copy,
  Check,
  Plus,
} from 'lucide-react';
import { loadManifest, searchResources, getResourceTypeColor } from './search-service';
import {
  ResourceManifest,
  SearchResult,
  FormulaResource,
  CardResource,
  CalculationResult,
} from './types';
import { useWhiteboardUiMetrics } from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';
import { Tooltip } from '@/_new/shared/ui/tooltip';

interface SmartSearchBarProps {
  onFormulaSelect: (formula: FormulaResource) => void;
  onCardSelect: (card: CardResource) => void;
  onCalculationSelect?: (result: CalculationResult) => void; // 🆕 Opcjonalny callback dla obliczeń
  onBrowseAll?: () => void;
  onActiveChange?: (isActive: boolean) => void; // Callback gdy search się otwiera/zamyka
  userRole?: 'owner' | 'editor' | 'viewer'; // 🆕 Rola użytkownika
  browseButtonPlacement?: 'inside' | 'outside-right';
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Calculator,
  FileText,
  Table: Table2,
  PieChart,
};

export function SmartSearchBar({
  onFormulaSelect,
  onCardSelect,
  onCalculationSelect,
  onBrowseAll,
  onActiveChange,
  userRole,
  browseButtonPlacement = 'inside',
}: SmartSearchBarProps) {
  // 🔒 Viewer nie ma dostępu do wyszukiwarki
  if (userRole === 'viewer') {
    return null;
  }
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [manifest, setManifest] = useState<ResourceManifest | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isAnimatingSelection, setIsAnimatingSelection] = useState(false);
  const [copiedCalculation, setCopiedCalculation] = useState(false); // 🆕 Stan kopiowania

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);
  const metrics = useWhiteboardUiMetrics();
  const { windowWidth, isMobile, showFullHeader, isCompactHeader, smartSearch } = metrics;

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
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    },
    [results, selectedIndex]
  );

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
      setCopiedCalculation(false);
    }, 300);
  };

  // 🆕 Kopiuj wynik obliczeń do schowka
  const handleCopyCalculation = async (result: CalculationResult, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(result.result);
      setCopiedCalculation(true);
      setTimeout(() => setCopiedCalculation(false), 2000);
    } catch (err) {
      console.error('Nie udało się skopiować:', err);
    }
  };

  // 🆕 Dodaj wynik jako tekst na tablicę
  const handleAddCalculation = (result: CalculationResult, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCalculationSelect) {
      onCalculationSelect(result);
    }
    handleClose();
  };

  const handleSelect = (result: SearchResult) => {
    // 🆕 Obsługa obliczeń - kopiuj do schowka
    if (result.resultType === 'calculation') {
      navigator.clipboard.writeText(result.result);
      setCopiedCalculation(true);
      setTimeout(() => {
        setCopiedCalculation(false);
        handleClose();
      }, 500);
      return;
    }

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

  const openCardsBrowse = async () => {
    let currentManifest = manifest;
    if (!currentManifest) {
      try {
        currentManifest = await loadManifest();
        setManifest(currentManifest);
      } catch (error) {
        console.error("Nie udało się załadować manifestu:", error);
        return;
      }
    }
    
    if (currentManifest && currentManifest.cards?.length > 0) {
      // Zawsze wybieramy główną kartę CKE dla Matury Podstawowej
      const ckeCard = currentManifest.cards.find(c => c.id === 'karta-matura-podstawowa') || currentManifest.cards[0];
      if (ckeCard) {
        onCardSelect(ckeCard);
      }
    }
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
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
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
            width: 52px;
            opacity: 0.8;
          }
          to {
            width: 100%;
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
            width: 100%;
            opacity: 1;
          }
          to {
            width: 52px;
            opacity: 0.8;
          }
        }

        @keyframes pulse {
          0%,
          100% {
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
            box-shadow:
              0 0 30px 10px rgba(59, 130, 246, 0.6),
              0 0 60px 20px rgba(59, 130, 246, 0.3);
          }
          100% {
            box-shadow:
              0 0 30px 10px rgba(59, 130, 246, 0.6),
              0 0 60px 20px rgba(59, 130, 246, 0.3);
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
            <div
              className={`flex items-center gap-2 ${showFullHeader ? 'mx-auto' : ''}`}
              style={{ width: isMobile ? `${smartSearch.collapsedWidth}px` : '100%' }}
            >
            <div
              className="flex items-center backdrop-blur-xl bg-white/85 rounded-full border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow relative z-10"
              style={{
                width: isMobile ? `${smartSearch.collapsedWidth}px` : '100%',
                maxWidth: isMobile ? `${smartSearch.collapsedWidth}px` : '1000px',
                height: '56px',
              }}
            >
              {/* Lewa strona - fake input (przycisk otwierający wyszukiwarkę) */}
              <button
                onClick={() => {
                  setIsOpen(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="flex flex-1 items-center gap-3 h-full px-5 hover:bg-gray-50/50 rounded-l-full transition-colors outline-none border-none group"
                style={{
                  justifyContent: isMobile ? 'center' : 'flex-start',
                }}
                title="Szukaj wzorów (Ctrl+K)"
              >
                <Search className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />

                {!isMobile && (
                  <>
                    <span className="text-base text-gray-500 flex-1 text-left select-none">
                      Szukaj wzorów matematycznych...
                    </span>

                    {/* Ctrl+K badge */}
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded-md border border-gray-200/50 mr-1 select-none">
                      Ctrl+K
                    </kbd>
                  </>
                )}
              </button>

              {!isMobile && windowWidth > 822 && (
                <>
                  {/* Pionowy Separator */}
                  <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />

                  {/* Prawa strona - Przycisk Kart Wzorów (W stylu secondary button) */}
                  <Tooltip content="Karty Wzorów CKE" position="bottom" tooltipClassName="mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCardsBrowse();
                      }}
                      className={`cursor-pointer font-semibold hover-shine flex items-center justify-center h-10 mx-1.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all duration-300 ease-in-out shrink-0 group ${
                        windowWidth > 884 ? 'gap-2 px-4' : 'w-10 px-0'
                      }`}
                    >
                      <Library className="w-4 h-4 shrink-0" />
                      {windowWidth > 884 && (
                        <span className="hidden sm:inline-block text-[13px]">Wzory</span>
                      )}
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
            </div>
          </>
        ) : (
          <div
            className={`flex items-center backdrop-blur-xl bg-white/95 rounded-full border border-blue-400/50 shadow-md ${showFullHeader ? 'mx-auto' : ''}`}
            style={{
              height: '56px',
              width: isMobile ? smartSearch.mobileExpandedWidth : '100%',
              maxWidth:
                isMobile
                  ? '100%'
                  : isCompactHeader
                    ? '100%'
                    : windowWidth <= 1580
                      ? '500px'
                      : windowWidth <= 1620
                        ? '550px'
                        : windowWidth <= 1800
                          ? '620px'
                          : '1000px',
              position: 'relative',
              animation:
                smartSearch.disableExpandAnimation
                  ? 'none'
                  : isClosing
                    ? isMobile
                      ? 'shrinkSearchMobile 0.3s ease-out forwards'
                      : 'shrinkSearch 0.3s ease-out forwards'
                    : isMobile
                      ? 'expandSearchMobile 0.3s ease-out forwards'
                      : 'expandSearch 0.3s ease-out forwards',
            }}
          >
            {/* Input (Lewa Strona) */}
            <div className="flex flex-1 items-center gap-3 px-5 h-full rounded-l-full bg-transparent overflow-hidden w-full">
              <Search className="w-5 h-5 text-blue-500 animate-pulse shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Wpisz np. jedynka, sinus, karta wzorów..."
                className="text-black flex-1 h-full py-4 text-base bg-transparent border-none outline-none placeholder:text-gray-400 min-w-0"
                autoFocus
              />
            </div>
            
            {/* Pionowy Separator */}
            {windowWidth > 822 && (
              <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />
            )}

            {/* Przycisk Kart Wzorów (W stylu secondary button - mała, okrągła ikona w aktywnym / mniejszym ekranie) */}
            {windowWidth > 822 && (
              <Tooltip content="Karty Wzorów CKE" position="bottom" className="cursor-pointer" tooltipClassName="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openCardsBrowse();
                  }}
                  className="cursor-pointer hover-shine flex items-center justify-center w-10 h-10 mx-1.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all duration-300 ease-in-out shrink-0 group"
                >
                  <Library className="w-4 h-4" />
                </button>
              </Tooltip>
            )}

            {/* Przycisk Zamykania (Skrajnie po prawej) */}
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-12 h-full rounded-r-full hover:bg-red-50/70 transition-colors text-gray-400 hover:text-red-500 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Results Dropdown Z DZIAŁAJĄCYM SCROLLEM I FANCY ANIMATIONS */}
        {isOpen && (query.trim() || isLoading) && !isClosing && (
          <div
            ref={resultsContainerRef}
            onWheel={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onWheelCapture={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            className="absolute top-full left-0 right-0 mt-3 backdrop-blur-xl bg-white/80 rounded-3xl border border-gray-200/50 shadow-lg max-h-[500px] z-[60] results-scroll overflow-y-auto overscroll-contain"
            style={{
              animation: 'slideIn 0.3s ease-out',
              width: isMobile ? smartSearch.mobileExpandedWidth : 'auto',
              maxWidth: isMobile ? '100%' : 'none',
              left: isMobile ? '50%' : '0',
              right: isMobile ? 'auto' : '0',
              transform: isMobile ? 'translateX(-50%)' : 'none',
            }}
          >
            {isLoading ? (
              <div className="p-6 text-center text-gray-500">
                <div
                  className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"
                  style={{
                    animation: 'spin 1s linear infinite, pulse 2s ease-in-out infinite',
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
                  // 🆕 QUICK MATH - specjalne renderowanie dla obliczeń
                  if (result.resultType === 'calculation') {
                    return (
                      <li
                        key={result.id}
                        ref={index === selectedIndex ? selectedItemRef : null}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`
                          flex items-center gap-4 px-5 py-4 mx-2 mb-2 rounded-2xl cursor-pointer transition-all duration-200 relative overflow-hidden
                          ${
                            index === selectedIndex
                              ? 'bg-gradient-to-r from-emerald-100 to-teal-100 shadow-lg border-2 border-emerald-300'
                              : 'bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200'
                          }
                        `}
                        style={{
                          animation: `slideIn 0.2s ease-out both`,
                        }}
                      >
                        {/* Ikona kalkulatora */}
                        <div className="p-3 rounded-2xl bg-emerald-500 shrink-0">
                          <Calculator className="w-6 h-6 text-white" />
                        </div>

                        {/* Wyrażenie i wynik */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-emerald-700 font-medium">Quick Math</span>
                            <Sparkles className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-600 font-mono text-lg">
                              {result.expression}
                            </span>
                            <span className="text-emerald-600 font-bold">=</span>
                            <span className="text-2xl font-bold text-emerald-700 font-mono">
                              {result.result}
                            </span>
                          </div>
                        </div>

                        {/* Przyciski akcji */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Kopiuj */}
                          <button
                            onClick={(e) => handleCopyCalculation(result, e)}
                            className="p-2 rounded-xl bg-white/80 hover:bg-white shadow-sm transition-all hover:scale-110"
                            title="Kopiuj wynik"
                          >
                            {copiedCalculation ? (
                              <Check className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <Copy className="w-5 h-5 text-emerald-600" />
                            )}
                          </button>

                          {/* Dodaj do tablicy */}
                          {onCalculationSelect && (
                            <button
                              onClick={(e) => handleAddCalculation(result, e)}
                              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-all hover:scale-110"
                              title="Dodaj do tablicy"
                            >
                              <Plus className="w-5 h-5 text-white" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  }

                  // Normalne renderowanie dla wzorów i kart
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
                        ${
                          index === selectedIndex
                            ? 'bg-gray-200/50 shadow-lg'
                            : 'hover:bg-gray-50/80'
                        }
                      `}
                      style={{
                        animation: isSelected
                          ? 'selectedItemGlow 0.4s ease-out forwards'
                          : isOtherItem
                            ? 'fadeOutOthers 0.3s ease-out forwards'
                            : `slideIn 0.2s ease-out ${index * 0.03}s both`,
                      }}
                    >
                      {/* Shimmer effect gdy zaznaczony */}
                      {isSelected && <div className="shimmer-overlay" />}

                      {/* Miniaturka (Thumbnail) po lewej stronie - tylko dla wzorów */}
                      {!isCard && 'path' in result && (
                        <div className="shrink-0 mr-4 w-32 h-20 bg-white rounded-lg border-2 border-gray-100 flex items-center justify-center p-2 shadow-sm relative overflow-hidden group-hover:border-blue-300 transition-colors">
                          <img
                            src={result.path}
                            alt={result.title}
                            className="max-w-full max-h-full object-contain pointer-events-none"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/resources/placeholder.svg';
                            }}
                          />
                        </div>
                      )}

                      {/* Content - zajmuje resztę miejsca */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {isCard && (
                            <div
                              className="p-1.5 rounded-lg shrink-0"
                              style={{
                                backgroundColor: `${color}20`,
                                color: color,
                              }}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                          )}
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
                        <p className="text-sm text-gray-600 truncate mb-3">{result.description}</p>
                        <div className="flex items-center flex-wrap gap-2 mt-auto">
                          <span
                            className="text-[11px] px-2 py-1 rounded-sm font-bold uppercase tracking-wider"
                            style={{ backgroundColor: `${color}15`, color }}
                          >
                            {getTypeLabel(result.type)}
                          </span>
                          {!isCard && 'subcategory' in result && (
                            <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded-sm">
                              {result.subcategory}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action hint - po prawej stronie */}
                      <div className="flex items-center justify-end w-24 gap-1 text-sm text-gray-400 shrink-0 self-center font-medium ml-2">
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
              animation: 'slideOut 0.2s ease-out forwards',
            }}
          />
        )}
      </div>
    </>
  );
}
