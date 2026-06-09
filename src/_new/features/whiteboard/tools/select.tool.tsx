'use client';

import { MousePointer2 } from 'lucide-react';
import { SelectTool } from '@/_new/features/whiteboard/components/toolbar/select-tool';
import { useToolHost } from './tool-host-context';
import type { ToolDefinition } from './types';

function SelectOverlay() {
  const h = useToolHost();
  return (
    <div ref={h.htmlOverlaysRef} style={{ position: 'absolute', inset: 0 }}>
      <SelectTool
        viewport={h.viewport}
        canvasWidth={h.canvasWidth}
        canvasHeight={h.canvasHeight}
        elements={h.elements}
        selectedIds={h.selectedIds}
        isOverlayVisible={h.overlaysVisible}
        onSelectionChange={h.onSelectionChange}
        onElementUpdate={h.onElementUpdate}
        onElementUpdateWithHistory={h.onElementUpdateWithHistory}
        onElementsUpdate={h.onElementsUpdate}
        onOperationFinish={h.onOperationFinish}
        onTextEdit={h.onTextEdit}
        onMarkdownEdit={h.onMarkdownEdit}
        onViewportChange={h.onViewportChange}
        onActiveGuidesChange={h.onActiveGuidesChange}
        onDeleteSelected={h.onDeleteSelected}
        onCopySelected={h.onCopySelected}
        onDuplicateSelected={h.onDuplicateSelected}
        onSaveGroupTemplate={h.onSaveGroupTemplate}
        isGestureActive={h.isGestureActive}
      />
    </div>
  );
}

export const selectTool: ToolDefinition = {
  id: 'select',
  label: 'Zaznacz (V)',
  icon: MousePointer2,
  shortcut: 'v',
  group: 'main',
  order: 0,
  cursor: 'default',
  iconFill: 1,
  Overlay: SelectOverlay,
};
