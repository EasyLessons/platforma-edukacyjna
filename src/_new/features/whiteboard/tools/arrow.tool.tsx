'use client';

import { ArrowRight } from 'lucide-react';
import { ArrowTool } from '@/_new/features/whiteboard/components/toolbar/arrow-tool';
import { useToolHost } from './tool-host-context';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';
import type { ToolDefinition } from './types';

function ArrowOverlay() {
  const h = useToolHost();
  const color = useToolStore((s) => s.color);
  const lineWidth = useToolStore((s) => s.lineWidth);
  return (
    <ArrowTool
      elements={h.elements}
      selectedIds={h.selectedIds}
      viewport={h.viewport}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      color={color}
      lineWidth={lineWidth}
      onArrowCreate={h.onArrowCreate}
      onViewportChange={h.onViewportChange}
      isGestureActive={h.isGestureActive}
    />
  );
}

// Brak `group` → narzędzie bez przycisku w toolbarze (jak dziś), tylko overlay.
export const arrowTool: ToolDefinition = {
  id: 'arrow',
  label: 'Strzałka',
  icon: ArrowRight,
  order: 10,
  cursor: 'crosshair',
  Overlay: ArrowOverlay,
};
