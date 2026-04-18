/**
 * ============================================================================
 * PLIK: src/app/tablica/smartsearch/CardViewer.tsx
 * ============================================================================
 *
 * CardViewer - modal do przeglądania karty wzorów z bocznym spisem treści
 * Użytkownik może zaznaczyć sekcje do dodania na tablicę
 *
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Check, Plus, ChevronRight, ChevronDown, GripVertical, GripHorizontal } from 'lucide-react';
import { CardResource, FormulaResource, ResourceManifest, CardSection } from './types';
import { loadManifest, getFormulaById, getResourceTypeColor } from './search-service';

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
      // Zmieniono na puste domyślnie, aby spis treści był schowany na początku
      setExpandedSections(new Set());
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
    e.nativeEvent.stopImmediatePropagation();
  }, []);

  const handleSectionClick = (sectionId: string) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleSection = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const allFormulasList = useMemo(() => Array.from(sectionFormulas.values()).flat(), [sectionFormulas]);
  const isAllSelectedGlobal = allFormulasList.length > 0 && selectedIds.size === allFormulasList.length;

  const toggleAll = () => {
    if (isAllSelectedGlobal) {
      setSelectedIds(new Set()); // odznacz wszystkie
    } else {
      setSelectedIds(new Set(allFormulasList.map(f => f.id))); // zaznacz wszystkie
    }
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
        onDragOver={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault(); // Pozwala na upuszczenie "na tło" (czarne rozmycie)
          }
        }}
        onDrop={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            const formulaId = e.dataTransfer.getData('formula/id');
            const formulaPath = e.dataTransfer.getData('text/plain');
            if (formulaId && manifest) {
              const formula = getFormulaById(manifest, formulaId);
              if (formula) {
                onAddFormulas([formula]);
                onClose(); // po przeciągnięciu zamknij modal by od razu widzieć tablicę
              }
            }
          }
        }}
        onWheel={(e) => {
          // Blokuj scroll tablicy w tle
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          e.preventDefault();
        }}
        onWheelCapture={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{card.title}</h2>
              <p className="text-sm text-gray-500">{card.description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
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
                        <div
                          onClick={() => handleSectionClick(section.id)}
                          className={`
                            group w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                            transition-all
                            ${selectedInSection > 0 ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}
                          `}
                        >
                          <span className="flex-1 truncate text-sm select-none">{section.name}</span>
                          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            {selectedInSection > 0 && (
                              <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                {selectedInSection}
                              </span>
                            )}
                            <button
                              onClick={(e) => toggleSection(section.id, e)}
                              className="p-1 hover:bg-gray-200/50 rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 shrink-0" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Lista wzorów w sekcji */}
                        {isExpanded && (
                          <ul className="ml-6 mt-1 space-y-0.5">
                            {formulas.map((formula) => (
                              <li key={formula.id}>
                                <button
                                  onClick={() => toggleFormula(formula.id)}
                                  className={`
                                    w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[13px] cursor-pointer
                                    transition-colors font-medium
                                    ${
                                      selectedIds.has(formula.id)
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'text-gray-600 hover:bg-gray-200'
                                    }
                                  `}
                                >
                                  <div
                                    className={`
                                    w-[14px] h-[14px] rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors
                                    ${
                                      selectedIds.has(formula.id)
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'border-gray-300 bg-white'
                                    }
                                  `}
                                  >
                                    {selectedIds.has(formula.id) && (
                                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
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
                      <div id={`section-${section.id}`} key={section.id} className="space-y-4 scroll-mt-6">
                        {/* Section header */}
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <h3 className="text-xl font-bold text-gray-900">{section.name}</h3>
                          <button
                            onClick={() => toggleAllInSection(section)}
                            className={`
                              flex items-center gap-1.5 text-sm py-1.5 px-3 cursor-pointer rounded-lg border font-medium transition-colors
                              ${
                                allSelected 
                                  ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
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

                        {/* Formulas list */}
                        <div className="flex flex-col gap-5 items-stretch">
                          {formulas.map((formula) => {
                            const isSelected = selectedIds.has(formula.id);
                            const color = manifest
                              ? getResourceTypeColor(manifest, formula.type)
                              : '#3B82F6';

                            return (
                              <div
                                key={formula.id}
                                onClick={() => toggleFormula(formula.id)}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'copy';
                                  e.dataTransfer.setData('text/plain', formula.path);
                                  e.dataTransfer.setData('formula/id', formula.id);
                                }}
                                className={`
                                  relative rounded-xl overflow-hidden cursor-pointer
                                  border transition-all flex flex-col bg-white hover:shadow-md group
                                  ${
                                    isSelected
                                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
                                      : 'border-gray-200 hover:border-blue-300'
                                  }
                                `}
                              >
                                {/* Image preview (100% width) */}
                                <div className="relative w-full flex items-center justify-center p-4 bg-white group-hover:bg-gray-50/50 transition-colors">
                                  <img
                                    src={formula.path}
                                    alt={formula.title}
                                    className="w-full h-auto object-contain pointer-events-none"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        '/resources/placeholder.svg';
                                    }}
                                  />
                                  {/* Stylizowany uchwyt przeciągania na zdjęciu (wizualna ikona w lewym górnym) */}
                                  <div className="absolute top-2 left-2 flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100/80 backdrop-blur-sm text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity cursor-grab shadow-sm">
                                    <GripVertical className="w-5 h-5" />
                                  </div>
                                </div>

                                {/* Bottom thin bar: Info + Checkbox */}
                                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <span
                                      className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 text-white rounded-full"
                                      style={{ backgroundColor: color }}
                                    >
                                      {manifest?.resourceTypes[formula.type]?.label || formula.type}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900 truncate flex-1">
                                      {formula.title}
                                    </span>
                                  </div>
                                  
                                  <div className={`shrink-0 ml-3 w-5 h-5 rounded-[4px] border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                     {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
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
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="text-sm text-gray-500">
              {selectedCount > 0 ? (
                <span className="text-blue-600 font-medium">
                  Wybrano {selectedCount}{' '}
                  {selectedCount === 1 ? 'wzór' : selectedCount < 5 ? 'wzory' : 'wzorów'}
                </span>
              ) : (
                'Kliknij na wzór, aby wybrać (lub przeciągnij na tablicę)'
              )}
            </div>
            <div className="flex items-center justify-end gap-3 flex-wrap">
              <button
                onClick={toggleAll}
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors cursor-pointer text-sm"
              >
                {isAllSelectedGlobal ? 'Odznacz wszystko' : 'Zaznacz wszystko'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors cursor-pointer text-sm"
              >
                Zamknij
              </button>
              <button
                onClick={handleAddSelected}
                disabled={selectedCount === 0}
                className={`
                  flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all shadow-sm text-sm
                  ${
                    selectedCount > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                      : 'bg-blue-300 text-white cursor-not-allowed'
                  }
                `}
              >
                <Check className="w-4 h-4 text-white stroke-[3]" />
                Dodaj na tablicę ({selectedCount})
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
