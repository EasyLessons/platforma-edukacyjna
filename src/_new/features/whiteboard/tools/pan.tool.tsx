'use client';

import { Hand } from 'lucide-react';
import { PanTool } from '@/_new/features/whiteboard/components/toolbar/pan-tool';
import { useToolHost } from './tool-host-context';
import type { ToolDefinition } from './types';

function PanOverlay() {
  const h = useToolHost();
  return (
    <PanTool
      viewport={h.viewport}
      viewportRef={h.viewportRef}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      onViewportChange={h.onViewportChange}
      onPanStart={h.onPanStart}
      onPanEnd={h.onPanEnd}
    />
  );
}

export const panTool: ToolDefinition = {
  id: 'pan',
  label: 'Przesuwaj (H)',
  icon: Hand,
  shortcut: 'h',
  group: 'main',
  order: 1,
  cursor: 'grab',
  availableTo: ['owner', 'editor', 'viewer'],
  Overlay: PanOverlay,
};
