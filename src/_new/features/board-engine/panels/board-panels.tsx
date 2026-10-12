'use client';

/**
 * Panele EasyLesson przy płótnie Excalidraw (etap B1, ADR silnika tablicy - "Decyzja 01.10.2026" pkt 4).
 *
 * Dwie części montowane w dwóch miejscach:
 *   - `PanelToggles` - przyciski w slocie `topRightExtra` Excalidraw (prawy górny róg na
 *     komputerze, pływające przyciski nad stopką na telefonie), więc nie zasłaniają paska narzędzi;
 *   - `PanelLayer` - okna paneli nad płótnem (warstwa `pointer-events: none`, klikalne są tylko panele).
 * Stan otwarcia trzyma `useBoardPanels` u wspólnego rodzica (`excalidraw-whiteboard.tsx`).
 *
 * Panele reużywają komponentów starego silnika (`features/whiteboard`) - logika jest tam jedna.
 * Które panele są dostępne, decyduje rodzic (`availablePanels`: ustawienia tablicy + rola).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType, RefObject } from 'react';
import { Calculator, Search } from 'lucide-react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { CalculatorTool } from '@/_new/features/whiteboard/components/toolbar/calculator-tool';
import { SmartSearchBar } from '@/_new/features/whiteboard/components/smartsearch/smart-search-bar';
import { CardViewer } from '@/_new/features/whiteboard/components/smartsearch/card-viewer';
import type {
  CardResource,
  FormulaResource,
} from '@/_new/features/whiteboard/components/smartsearch/types';
import { createLogger } from '@/_new/lib/logger';
import { insertResources } from './insert-resources';

const log = createLogger('board-engine/board-panels');

export type BoardPanelId = 'calculator' | 'search';

const PANEL_BUTTONS: Record<
  BoardPanelId,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  search: { label: 'Wzory', icon: Search },
  calculator: { label: 'Kalkulator', icon: Calculator },
};

/**
 * Panele dostępne na tablicy. Kalkulator - zawsze (nie zmienia tablicy, także viewer).
 * Wzory (SmartSearch) - ustawienie `smartsearch_visible` i rola z prawem edycji (jak w starym silniku).
 */
export function availablePanels(opts: {
  readOnly: boolean;
  smartSearchVisible: boolean;
}): BoardPanelId[] {
  const panels: BoardPanelId[] = [];
  if (opts.smartSearchVisible && !opts.readOnly) panels.push('search');
  panels.push('calculator');
  return panels;
}

export interface BoardPanelsState {
  isOpen: (id: BoardPanelId) => boolean;
  toggle: (id: BoardPanelId) => void;
  close: (id: BoardPanelId) => void;
}

export function useBoardPanels(): BoardPanelsState {
  const [open, setOpen] = useState<ReadonlySet<BoardPanelId>>(() => new Set());

  const toggle = useCallback((id: BoardPanelId) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const close = useCallback((id: BoardPanelId) => {
    setOpen((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isOpen = useCallback((id: BoardPanelId) => open.has(id), [open]);

  return { isOpen, toggle, close };
}

interface PanelTogglesProps {
  panels: BoardPanelsState;
  available: readonly BoardPanelId[];
  placement: 'top-right' | 'mobile';
}

export function PanelToggles({ panels, available, placement }: PanelTogglesProps) {
  const compact = placement === 'mobile';
  return (
    <>
      {available.map((id) => {
        const { label, icon: Icon } = PANEL_BUTTONS[id];
        const active = panels.isOpen(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => panels.toggle(id)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            data-testid={`panel-toggle-${id}`}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm ${
              active
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
            } ${compact ? 'h-10 w-10 justify-center px-0' : ''}`}
          >
            <Icon className="h-4 w-4" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </>
  );
}

/** Rozmiar kontenera - panele przeciągalne pilnują, żeby nie wyjechać poza tablicę. */
function useContainerSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

interface PanelLayerProps {
  panels: BoardPanelsState;
  available: readonly BoardPanelId[];
  /** API Excalidraw do wstawiania elementów; null, dopóki płótno się nie załadowało. */
  api: ExcalidrawImperativeAPI | null;
}

export function PanelLayer({ panels, available, api }: PanelLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(layerRef);
  const [activeCard, setActiveCard] = useState<CardResource | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shows = (id: BoardPanelId) => available.includes(id) && panels.isOpen(id);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const addFormulas = useCallback(
    async (formulas: FormulaResource[]) => {
      if (!api || formulas.length === 0) return;
      try {
        const added = await insertResources(api, formulas);
        setNotice(
          added === 0
            ? 'Nie udało się dodać wzoru'
            : added === 1
              ? `Dodano: ${formulas[0].title}`
              : `Dodano wzory: ${added}`
        );
      } catch (error) {
        log.error('Wstawianie wzoru nie powiodło się', error);
        setNotice('Nie udało się dodać wzoru');
      }
    },
    [api]
  );

  // Wybór karty zamyka wyszukiwarkę - karta żyje tu, nie w panelu wyszukiwania.
  const canAddFormulas = available.includes('search');

  return (
    <div
      ref={layerRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      data-testid="board-panel-layer"
    >
      {shows('search') && (
        <div
          className="pointer-events-auto absolute left-1/2 top-16 w-[min(640px,calc(100%-24px))] -translate-x-1/2"
          data-testid="panel-search"
        >
          <SmartSearchBar
            defaultOpen
            onClose={() => panels.close('search')}
            onFormulaSelect={(formula) => void addFormulas([formula])}
            onCardSelect={setActiveCard}
          />
        </div>
      )}

      {activeCard && canAddFormulas && (
        <div className="pointer-events-auto" data-testid="panel-card-viewer">
          <CardViewer
            card={activeCard}
            onClose={() => setActiveCard(null)}
            onAddFormulas={(formulas) => void addFormulas(formulas)}
          />
        </div>
      )}

      {shows('calculator') && width > 0 && (
        <div className="absolute inset-0" data-testid="panel-calculator">
          <CalculatorTool
            canvasWidth={width}
            canvasHeight={height}
            onClose={() => panels.close('calculator')}
          />
        </div>
      )}

      {notice && (
        <div
          role="status"
          data-testid="panel-notice"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900/85 px-4 py-2 text-sm text-white shadow"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
