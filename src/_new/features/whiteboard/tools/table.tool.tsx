'use client';

import { Table } from 'lucide-react';
import { TableTool } from '@/_new/features/whiteboard/components/toolbar/table-tool';
import { useToolHost } from './tool-host-context';
import type { ToolDefinition } from './types';

function TableOverlay() {
  const h = useToolHost();
  return (
    <TableTool
      viewport={h.viewport}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      onTableCreate={h.onTableCreate}
      onViewportChange={h.onViewportChange}
      isGestureActive={h.isGestureActive}
    />
  );
}

export const tableTool: ToolDefinition = {
  id: 'table',
  label: 'Tabelka',
  icon: Table,
  group: 'more',
  order: 9,
  cursor: 'crosshair',
  Overlay: TableOverlay,
};
