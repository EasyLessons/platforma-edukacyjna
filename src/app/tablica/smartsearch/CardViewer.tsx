/**
 * ============================================================================
 * PLIK: src/app/tablica/smartsearch/CardViewer.tsx
 * ============================================================================
 *
 * CardViewer - modal do przeglądania karty wzorów z bocznym spisem treści
 * Użytkownik może zaznaczyć sekcje do dodania na tablicę
 *
 * ✅ NAPRAWIONY SCROLL MYSZKĄ
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Check, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { CardResource, FormulaResource, ResourceManifest, CardSection } from './types';
import { loadManifest, getFormulaById, getResourceTypeColor } from './searchService';

interface CardViewerProps {
  card: CardResource;
  onClose: () => void;
  onAddFormulas: (formulas: FormulaResource[]) => void;
  onActiveChange?: (isActive: boolean) => void;
}

export function CardViewer({ card, onClose, onAddFormulas, onActiveChange }: CardViewerProps) {
  const [manifest, setManifest] = useState<ResourceManifest | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Załaduj manifest
  useEffect(() => {
    loadManifest()
      .then(setManifest)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Informuj rodzica że modal jest aktywny (blokuj scroll tablicy)
  useEffect(() => {
    onActiveChange?.(true);

    // Blokuj scroll tablicy w tle
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      onActiveChange?.(false);
      document.body.style.overflow = originalOverflow;
    };
  }, [onActiveChange]);

  // Rozwiń wszystkie sekcje domyślnie
  useEffect(() => {
    if (card.sections) {
      setExpandedSections(new Set(card.sections.map((s) => s.id)));
    }
  }, [card]);

  // Pobierz wszystkie wzory z sekcji
  const sectionFormulas = useMemo(() => {
    if (!manifest) return new Map<string, FormulaResource[]>();

    const map = new Map<string, FormulaResource[]>();
    for (const section of card.sections) {
      const formulas: FormulaResource[] = [];
      for (const item of section.items) {
        const formula = getFormulaById(manifest, item.ref);
        if (formula) formulas.push(formula);
      }
      map.set(section.id, formulas);
    }
    return map;
  }, [manifest, card]);

  // Obsługa scrolla myszką - DOKADNIE JAK W CHATBOCIE
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const toggleFormula = (formulaId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(formulaId)) {
        next.delete(formulaId);
      } else {
        next.add(formulaId);
      }
      return next;
    });
  };

  const toggleAllInSection = (section: CardSection) => {
    const formulas = sectionFormulas.get(section.id) || [];
    const allSelected = formulas.every((f) => selectedIds.has(f.id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        formulas.forEach((f) => next.delete(f.id));
      } else {
        formulas.forEach((f) => next.add(f.id));
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    if (!manifest || selectedIds.size === 0) return;

    const formulas: FormulaResource[] = [];
    for (const id of selectedIds) {
      const formula = getFormulaById(manifest, id);
      if (formula) formulas.push(formula);
    }

    onAddFormulas(formulas);
    onClose();
  };

  const selectedCount = selectedIds.size;

  return (
    <>
      {/* CSS dla scrollbarów */}
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          margin: 8px 0;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(59, 130, 246, 0.3);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(59, 130, 246, 0.5);
        }
      `}</style>

      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm cursor-default"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        onWheel={(e) => {
          // Blokuj scroll tablicy w tle
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{card.title}</h2>
              <p className="text-sm text-gray-500">{card.description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar - Spis treści */}
            <div
              ref={sidebarRef}
              onWheel={handleWheel}
              className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto custom-scrollbar"
            >
              <div className="p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Spis treści
                </h3>
                <ul className="space-y-1">
                  {card.sections.map((section) => {
                    const formulas = sectionFormulas.get(section.id) || [];
                    const selectedInSection = formulas.filter((f) => selectedIds.has(f.id)).length;
                    const isExpanded = expandedSections.has(section.id);

                    return (
                      <li key={section.id}>
                        <button
                          onClick={() => toggleSection(section.id)}
                          className={`
                            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer
                            hover:bg-white transition-colors
                            ${selectedInSection > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'}
                          `}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 shrink-0" />
                          )}
                          <span className="flex-1 font-medium truncate">{section.name}</span>
                          {selectedInSection > 0 && (
                            <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                              {selectedInSection}
                            </span>
                          )}
                        </button>

                        {/* Lista wzorów w sekcji */}
                        {isExpanded && (
                          <ul className="ml-6 mt-1 space-y-0.5">
                            {formulas.map((formula) => (
                              <li key={formula.id}>
                                <button
                                  onClick={() => toggleFormula(formula.id)}
                                  className={`
                                    w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm cursor-pointer
                                    transition-colors
                                    ${
                                      selectedIds.has(formula.id)
                                        ? 'bg-green-100 text-green-700'
                                        : 'text-gray-600 hover:bg-white'
                                    }
                                  `}
                                >
                                  <div
                                    className={`
                                    w-4 h-4 rounded border-2 flex items-center justify-center shrink-0
                                    ${
                                      selectedIds.has(formula.id)
                                        ? 'bg-green-500 border-green-500'
                                        : 'border-gray-300'
                                    }
                                  `}
                                  >
                                    {selectedIds.has(formula.id) && (
                                      <Check className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                  <span className="truncate">{formula.title}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Main content - Preview Z NAPRAWIONYM SCROLLEM */}
            <div
              ref={contentRef}
              onWheel={handleWheel}
              className="flex-1 overflow-y-auto p-6 custom-scrollbar"
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="space-y-8">
                  {card.sections.map((section) => {
                    const formulas = sectionFormulas.get(section.id) || [];
                    if (formulas.length === 0) return null;

                    const allSelected = formulas.every((f) => selectedIds.has(f.id));

                    return (
                      <div key={section.id} className="space-y-4">
                        {/* Section header */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-800">{section.name}</h3>
                          <button
                            onClick={() => toggleAllInSection(section)}
                            className={`
                              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer
                              transition-colors
                              ${
                                allSelected
                                  ? 'bg-green-500 text-white hover:bg-green-600'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }
                            `}
                          >
                            {allSelected ? (
                              <>
                                <Check className="w-4 h-4" />
                                Wybrano wszystkie
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                Dodaj wszystkie
                              </>
                            )}
                          </button>
                        </div>

                        {/* Formulas grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {formulas.map((formula) => {
                            const isSelected = selectedIds.has(formula.id);
                            const color = manifest
                              ? getResourceTypeColor(manifest, formula.type)
                              : '#3B82F6';

                            return (
                              <div
                                key={formula.id}
                                onClick={() => toggleFormula(formula.id)}
                                className={`
                                  relative rounded-xl overflow-hidden cursor-pointer
                                  border-2 transition-all
                                  ${
                                    isSelected
                                      ? 'border-green-500 ring-2 ring-green-200'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }
                                `}
                              >
                                {/* Selection indicator */}
                                {isSelected && (
                                  <div className="absolute top-2 right-2 z-10 bg-green-500 text-white p-1 rounded-full">
                                    <Check className="w-4 h-4" />
                                  </div>
                                )}

                                {/* Image preview */}
                                <div className="bg-gray-50 p-4 flex items-center justify-center min-h-[150px]">
                                  <img
                                    src={formula.path}
                                    alt={formula.title}
                                    className="max-w-full max-h-[200px] object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        '/resources/placeholder.svg';
                                    }}
                                  />
                                </div>

                                {/* Info */}
                                <div className="p-3 bg-white border-t border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-xs px-2 py-0.5 rounded-full text-white"
                                      style={{ backgroundColor: color }}
                                    >
                                      {manifest?.resourceTypes[formula.type]?.label || formula.type}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {formula.title}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              {selectedCount > 0 ? (
                <span className="text-green-600 font-medium">
                  Wybrano {selectedCount}{' '}
                  {selectedCount === 1 ? 'wzór' : selectedCount < 5 ? 'wzory' : 'wzorów'}
                </span>
              ) : (
                'Kliknij na wzór lub użyj checkboxów, aby wybrać'
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                onClick={handleAddSelected}
                disabled={selectedCount === 0}
                className={`
                  flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors
                  ${
                    selectedCount > 0
                      ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <Check className="w-5 h-5" />
                Dodaj na tablicę ({selectedCount})
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
