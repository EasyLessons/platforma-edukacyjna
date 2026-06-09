'use client';

import { StickyNote } from 'lucide-react';
import { MarkdownNoteTool } from '@/_new/features/whiteboard/components/toolbar/markdown-note-tool';
import { useToolHost } from './tool-host-context';
import type { ToolDefinition } from './types';

function MarkdownOverlay() {
  const h = useToolHost();
  return (
    <MarkdownNoteTool
      viewport={h.viewport}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      onNoteCreate={h.onNoteCreate}
      onViewportChange={h.onViewportChange}
    />
  );
}

export const markdownTool: ToolDefinition = {
  id: 'markdown',
  label: 'Notatka Markdown (M)',
  icon: StickyNote,
  shortcut: 'm',
  group: 'more',
  order: 8,
  cursor: 'crosshair',
  Overlay: MarkdownOverlay,
};
