'use client';

import { useMemo } from 'react';
import { Type } from 'lucide-react';
import { TextTool } from '@/_new/features/whiteboard/components/toolbar/text-tool';
import type { TextElement } from '@/_new/features/whiteboard/types';
import { useToolHost } from './tool-host-context';
import type { ToolDefinition } from './types';

function TextOverlay() {
  const h = useToolHost();
  const textElements = useMemo(
    () => h.elements.filter((e) => e.type === 'text') as TextElement[],
    [h.elements],
  );
  return (
    <TextTool
      viewport={h.viewport}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      elements={textElements}
      editingTextId={h.editingTextId}
      onTextCreate={h.onTextCreate}
      onTextUpdate={h.onTextUpdate}
      onTextDelete={h.onTextDelete}
      onEditingComplete={h.onEditingComplete}
      onViewportChange={h.onViewportChange}
      editorDivRef={h.textEditorDivRef}
      isGestureActive={h.isGestureActive}
    />
  );
}

export const textTool: ToolDefinition = {
  id: 'text',
  label: 'Tekst (T)',
  icon: Type,
  shortcut: 't',
  group: 'main',
  order: 3,
  cursor: 'text',
  Overlay: TextOverlay,
};
