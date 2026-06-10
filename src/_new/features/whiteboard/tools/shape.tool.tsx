'use client';

import { Square } from 'lucide-react';
import { ShapeTool } from '@/_new/features/whiteboard/components/toolbar/shape-tool';
import { useToolHost } from './tool-host-context';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';
import { ShapeProperties } from './shape.properties';
import type { ToolDefinition } from './types';

function ShapeOverlay() {
  const h = useToolHost();
  const color = useToolStore((s) => s.color);
  const lineWidth = useToolStore((s) => s.lineWidth);
  const fillShape = useToolStore((s) => s.fillShape);
  const selectedShape = useToolStore((s) => s.selectedShape);
  const polygonSides = useToolStore((s) => s.polygonSides);
  return (
    <ShapeTool
      viewport={h.viewport}
      viewportRef={h.viewportRef}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      selectedShape={selectedShape}
      polygonSides={polygonSides}
      color={color}
      lineWidth={lineWidth}
      fillShape={fillShape}
      onShapeCreate={h.onShapeCreate}
      onViewportChange={h.onViewportChange}
      isGestureActive={h.isGestureActive}
    />
  );
}

export const shapeTool: ToolDefinition = {
  id: 'shape',
  label: 'Kształty (S)',
  icon: Square,
  shortcut: 's',
  group: 'main',
  order: 4,
  cursor: 'crosshair',
  Overlay: ShapeOverlay,
  PropertiesPanel: ShapeProperties,
};
