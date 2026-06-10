/**
 * ============================================================================
 * PLIK: components/toolbar/ToolbarUI.tsx
 * ============================================================================
 *
 * Prezentacja UI toolbara: przyciski-tryby (z rejestru przez <ToolModeButtons/>),
 * akcje (undo/redo/clear/kalkulator/szablony/import/eksport), menu „Więcej"
 * (responsywne) oraz slot panelu właściwości aktywnego narzędzia
 * (ToolDefinition.PropertiesPanel — np. PenProperties / ShapeProperties /
 * ImageProperties). Aktywne narzędzie czytamy ze store'a (zustand).
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Undo,
  Redo,
  Trash2,
  X as XIcon,
  Download,
  FolderOpen,
  Calculator,
  MoreVertical,
  FolderHeart,
} from 'lucide-react';
import { Tooltip } from '@/_new/shared/ui/tooltip';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';
import { ToolModeButtons } from './registry-toolbar';
import { getTool } from '@/_new/features/whiteboard/tools/registry';

interface ToolbarUIProps {
  // 🧮 Kalkulator state
  isCalculatorOpen?: boolean;
  onCalculatorToggle?: () => void;
  onToggleAssetsLibrary?: () => void;

  // History state
  canUndo: boolean;
  canRedo: boolean;

  // Selection state
  hasSelection?: boolean;

  // 🔒 Read-only mode
  isReadOnly?: boolean;

  // Handlers
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDeleteSelected?: () => void;

  // Export/Import handlers
  onExport?: () => void;
  onImport?: () => void;
}

const ToolButton = ({
  icon: Icon,
  active,
  onClick,
  title,
  disabled = false,
  filled = false,
  fillOpacity,
  position = 'right',
}: {
  icon: React.ComponentType<{ className?: string; fill?: string; fillOpacity?: number }>;
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  filled?: boolean;
  fillOpacity?: number;
  position?: 'top' | 'right' | 'bottom' | 'left';
}) => (
  <Tooltip content={title} position={position}>
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative p-1.5 rounded-md transition-colors group
        ${active
          ? 'bg-blue-500/20 text-blue-600'
          : 'text-gray-700 hover:bg-gray-100'
        }
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Icon
        className="w-5 h-5"
        {...(() => {
          if (filled) {
            return { fill: 'currentColor', fillOpacity };
          }
          if (active) {
            return {
              fill: 'rgb(37 99 235 / 0.1)',
              stroke: 'currentColor',
            };
          }
          return {};
        })()}
      />
    </button>
  </Tooltip>
);

const Divider = () => <div className="h-px w-6 bg-gray-200 my-1" />;

export function ToolbarUI({
  isCalculatorOpen,
  onCalculatorToggle,
  onToggleAssetsLibrary,
  canUndo,
  canRedo,
  hasSelection,
  isReadOnly = false,
  onUndo,
  onRedo,
  onClear,
  onDeleteSelected,
  onExport,
  onImport,
}: ToolbarUIProps) {
  // Aktywne narzędzie ze store'a + jego panel właściwości z rejestru
  const activeTool = useToolStore((s) => s.activeTool);
  const ActivePropertiesPanel = getTool(activeTool)?.PropertiesPanel;

  // Wykrywanie wysokości ekranu (responsywny layout)
  const [viewportHeight, setViewportHeight] = useState(0);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  useEffect(() => {
    const updateHeight = () => setViewportHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Określenie layoutu na podstawie wysokości
  // Full: >= 815px - wszystko widoczne
  // Medium: < 815px - ukryj markdown/table/import/export do menu "więcej"
  // Mobile: < 768px (md breakpoint) - pełny modal
  const isMediumHeight = viewportHeight < 815 && viewportHeight >= 768;
  const isMobile = viewportHeight < 768;
  const isCompactHeight = viewportHeight <= 814;

  return (
    <>
      {/* GŁÓWNY TOOLBAR - PIONOWY (desktop + mobile) */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 pointer-events-auto">
        <div className={`flex flex-col items-center ${isCompactHeight ? 'gap-1 p-1.5' : 'gap-1.5 p-2'}`}>
          {/* Main Tools — z rejestru (ALL_TOOLS, group 'main') */}
          <ToolModeButtons group="main" isReadOnly={isReadOnly} />

          <Divider />

          {/* Nowe narzędzia (group 'more') — UKRYTE w medium height */}
          {!isMediumHeight && !isMobile && (
            <ToolModeButtons group="more" isReadOnly={isReadOnly} />
          )}

          {!isCompactHeight && (
            <>
              <ToolButton
                icon={Calculator}
                active={isCalculatorOpen ?? false}
                onClick={() => onCalculatorToggle?.()}
                title="Kalkulator (zawsze dostępny)"
              />
              <ToolButton
                icon={FolderHeart}
                active={false}
                onClick={() => onToggleAssetsLibrary?.()}
                title="Moje Szablony"
              />
            </>
          )}

          <Divider />

          {/* History */}
          <ToolButton
            icon={Undo}
            active={false}
            onClick={onUndo}
            title="Cofnij (Ctrl+Z)"
            disabled={!canUndo || isReadOnly}
          />
          <ToolButton
            icon={Redo}
            active={false}
            onClick={onRedo}
            title="Ponów (Ctrl+Y)"
            disabled={!canRedo || isReadOnly}
          />

          {/* Export/Import - UKRYTE w medium height */}
          {!isMediumHeight && !isMobile && (
            <>
              <Divider />
              {onExport && (
                <ToolButton
                  icon={Download}
                  active={false}
                  onClick={onExport}
                  title="Eksportuj tablicę"
                  disabled={isReadOnly}
                />
              )}
              {onImport && (
                <ToolButton
                  icon={FolderOpen}
                  active={false}
                  onClick={onImport}
                  title="Importuj tablicę"
                  disabled={isReadOnly}
                />
              )}
            </>
          )}

          {/* 🆕 Przycisk "Więcej" - WIDOCZNY w medium height i mobile */}
          {(isMediumHeight || isMobile) && (
            <>
              <Divider />
              <ToolButton
                icon={MoreVertical}
                active={isMoreMenuOpen}
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="Więcej narzędzi"
                disabled={isReadOnly}
              />
            </>
          )}

          <Divider />

          {/* Delete Selected - widoczne gdy coś zaznaczone */}
          {hasSelection && onDeleteSelected && (
            <ToolButton
              icon={XIcon}
              active={false}
              onClick={onDeleteSelected}
              title="Usuń zaznaczone (Del)"
              disabled={isReadOnly}
            />
          )}

          {/* Clear */}
          {!isCompactHeight && (
            <ToolButton
              icon={Trash2}
              active={false}
              onClick={onClear}
              title="Wyczyść wszystko"
              disabled={isReadOnly}
            />
          )}
        </div>
      </div>

      {/* 🆕 MEDIUM HEIGHT + MOBILE: "Więcej" Menu */}
      {(isMediumHeight || isMobile) && isMoreMenuOpen && (
        <div className="fixed left-20 top-1/2 -translate-y-1/2 bg-white rounded-xl shadow-lg border border-gray-200 pointer-events-auto z-50">
          <div className="flex flex-col items-center gap-1.5 p-2">
            <div className="text-xs font-semibold text-gray-600 px-2 py-1">Więcej</div>
            <Divider />

            <ToolModeButtons
              group="more"
              isReadOnly={isReadOnly}
              onAfterSelect={() => setIsMoreMenuOpen(false)}
            />

            <Divider />

            {onExport && (
              <ToolButton
                icon={Download}
                active={false}
                onClick={() => {
                  onExport();
                  setIsMoreMenuOpen(false);
                }}
                title="Eksportuj tablicę"
                disabled={isReadOnly}
              />
            )}
            {onImport && (
              <ToolButton
                icon={FolderOpen}
                active={false}
                onClick={() => {
                  onImport();
                  setIsMoreMenuOpen(false);
                }}
                title="Importuj tablicę"
                disabled={isReadOnly}
              />
            )}

            <Divider />

            <ToolButton
              icon={Calculator}
              active={isCalculatorOpen ?? false}
              onClick={() => {
                onCalculatorToggle?.();
                setIsMoreMenuOpen(false);
              }}
              title="Kalkulator"
              disabled={isReadOnly}
            />

            <ToolButton
              icon={FolderHeart}
              active={false}
              onClick={() => {
                onToggleAssetsLibrary?.();
                setIsMoreMenuOpen(false);
              }}
              title="Moje Szablony"
            />

            <ToolButton
              icon={Trash2}
              active={false}
              onClick={() => {
                onClear();
                setIsMoreMenuOpen(false);
              }}
              title="Wyczyść wszystko"
              disabled={isReadOnly}
            />
          </div>
        </div>
      )}

      {/* PANEL WŁAŚCIWOŚCI aktywnego narzędzia — z rejestru (ToolDefinition.PropertiesPanel).
          Wrapper zostaje tu, treść dostarcza komponent narzędzia (pen/shape/image). */}
      {ActivePropertiesPanel && (
        <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-200 p-2 pointer-events-auto">
          <div className="flex flex-col items-center gap-2">
            <ActivePropertiesPanel />
          </div>
        </div>
      )}
    </>
  );
}
