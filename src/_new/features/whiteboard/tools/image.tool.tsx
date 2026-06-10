'use client';

import { Image as ImageIcon } from 'lucide-react';
import { ImageTool } from '@/_new/features/whiteboard/components/toolbar/image-tool';
import { useToolHost } from './tool-host-context';
import { ImageProperties } from './image.properties';
import type { ToolDefinition } from './types';

function ImageOverlay() {
  const h = useToolHost();
  return (
    <ImageTool
      ref={h.imageToolRef}
      viewport={h.viewport}
      canvasWidth={h.canvasWidth}
      canvasHeight={h.canvasHeight}
      onImageCreate={h.onImageCreate}
      onViewportChange={h.onViewportChange}
    />
  );
}

export const imageTool: ToolDefinition = {
  id: 'image',
  label: 'Obraz (I)',
  icon: ImageIcon,
  shortcut: 'i',
  group: 'main',
  order: 6,
  cursor: 'copy',
  Overlay: ImageOverlay,
  PropertiesPanel: ImageProperties,
};
