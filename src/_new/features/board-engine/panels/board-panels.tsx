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
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Calculator } from 'lucide-react';
import { CalculatorTool } from '@/_new/features/whiteboard/components/toolbar/calculator-tool';

export type BoardPanelId = 'calculator';

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
  placement: 'top-right' | 'mobile';
}

export function PanelToggles({ panels, placement }: PanelTogglesProps) {
  const compact = placement === 'mobile';
  const active = panels.isOpen('calculator');
  return (
    <button
      type="button"
      onClick={() => panels.toggle('calculator')}
      aria-pressed={active}
      aria-label="Kalkulator"
      title="Kalkulator"
      data-testid="panel-toggle-calculator"
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
      } ${compact ? 'h-10 w-10 justify-center px-0' : ''}`}
    >
      <Calculator className="h-4 w-4" />
      {!compact && <span>Kalkulator</span>}
    </button>
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
}

export function PanelLayer({ panels }: PanelLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(layerRef);

  return (
    <div
      ref={layerRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      data-testid="board-panel-layer"
    >
      {panels.isOpen('calculator') && width > 0 && (
        <div className="absolute inset-0" data-testid="panel-calculator">
          <CalculatorTool
            canvasWidth={width}
            canvasHeight={height}
            onClose={() => panels.close('calculator')}
          />
        </div>
      )}
    </div>
  );
}
