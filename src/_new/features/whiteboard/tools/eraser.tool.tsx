'use client';

import { Eraser } from 'lucide-react';
import { EraserTool } from '@/_new/features/whiteboard/components/toolbar/eraser-tool';
import { useToolHost } from './tool-host-context';
import type { ToolDefinition } from './types';

function EraserOverlay() {
  const h = useToolHost();
  return (
    <EraserTool
      viewport={h.viewport}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      elements={h.elements}
      onElementDelete={h.onElementDelete}
      onViewportChange={h.onViewportChange}
      isGestureActive={h.isGestureActive}
    />
  );
}

export const eraserTool: ToolDefinition = {
  id: 'eraser',
  label: 'Gumka (E)',
  icon: Eraser,
  shortcut: 'e',
  group: 'main',
  order: 7,
  cursor: 'cell',
  Overlay: EraserOverlay,
};
