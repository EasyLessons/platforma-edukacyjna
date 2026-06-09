'use client';

import { TrendingUp } from 'lucide-react';
import { FunctionTool } from '@/_new/features/whiteboard/components/toolbar/function-tool';
import { useToolHost } from './tool-host-context';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';
import type { ToolDefinition } from './types';

function FunctionOverlay() {
  const h = useToolHost();
  const color = useToolStore((s) => s.color);
  const lineWidth = useToolStore((s) => s.lineWidth);
  const setColor = useToolStore((s) => s.setColor);
  const setLineWidth = useToolStore((s) => s.setLineWidth);
  return (
    <FunctionTool
      viewport={h.viewport}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      color={color}
      lineWidth={lineWidth}
      onFunctionCreate={h.onFunctionCreate}
      onColorChange={setColor}
      onLineWidthChange={setLineWidth}
      onViewportChange={h.onViewportChange}
      isGestureActive={h.isGestureActive}
    />
  );
}

export const functionTool: ToolDefinition = {
  id: 'function',
  label: 'Funkcja (F)',
  icon: TrendingUp,
  shortcut: 'f',
  group: 'main',
  order: 5,
  cursor: 'crosshair',
  Overlay: FunctionOverlay,
};
