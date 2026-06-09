'use client';

import { Pencil } from 'lucide-react';
import { PenTool } from '@/_new/features/whiteboard/components/toolbar/pen-tool';
import { useToolHost } from './tool-host-context';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';
import type { ToolDefinition } from './types';

function PenOverlay() {
  const h = useToolHost();
  const color = useToolStore((s) => s.color);
  const lineWidth = useToolStore((s) => s.lineWidth);
  return (
    <PenTool
      viewport={h.viewport}
      viewportRef={h.viewportRef}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      color={color}
      lineWidth={lineWidth}
      onPathCreate={h.onPathCreate}
      onViewportChange={h.onViewportChange}
      isGestureActive={h.isGestureActive}
    />
  );
}

export const penTool: ToolDefinition = {
  id: 'pen',
  label: 'Rysuj (P)',
  icon: Pencil,
  shortcut: 'p',
  group: 'main',
  order: 2,
  cursor: 'crosshair',
  iconFill: 0.3,
  Overlay: PenOverlay,
};
