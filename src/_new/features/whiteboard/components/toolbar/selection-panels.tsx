/**
 * Panele towarzyszace zaznaczeniu: mini-toolbar tekstu (1 zaznaczony tekst)
 * i panel wlasciwosci (ksztalty/sciezki, notatki, obrazki, tabele).
 * Wydzielone z select-tool.tsx (PR-C6) - czysty render, decyzje "czy pokazac"
 * 1:1 z oryginalem.
 */
import type { DrawingElement, ViewportTransform } from '@/_new/features/whiteboard/types';
import { transformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';
import { selectionBoundingBox } from '@/_new/features/whiteboard/selection/handles';
import { TextMiniToolbar } from './text-mini-toolbar';
import { SelectionPropertiesPanel } from './properties-panel';

interface CommonProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  elements: DrawingElement[];
  selectedIds: Set<string>;
  onElementUpdateWithHistory?: (id: string, updates: Partial<DrawingElement>) => void;
}

/** Mini-toolbar tekstu: tylko gdy zaznaczony jest dokladnie jeden element typu text. */
export function SelectionTextToolbar({
  viewport,
  canvasWidth,
  canvasHeight,
  elements,
  selectedIds,
  onElementUpdateWithHistory,
}: CommonProps) {
  if (selectedIds.size !== 1 || !onElementUpdateWithHistory) return null;

  const selectedId = Array.from(selectedIds)[0];
  const selectedElement = elements.find((el) => el.id === selectedId);
  if (!selectedElement || selectedElement.type !== 'text') return null;

  const textElement = selectedElement;
  const topLeft = transformPoint(
    { x: textElement.x, y: textElement.y },
    viewport,
    canvasWidth,
    canvasHeight
  );

  return (
    <TextMiniToolbar
      style={{
        fontSize: textElement.fontSize,
        color: textElement.color,
        fontWeight: textElement.fontWeight || 'normal',
        fontStyle: textElement.fontStyle || 'normal',
        textAlign: textElement.textAlign || 'left',
      }}
      onChange={(updates) => onElementUpdateWithHistory(selectedId, updates)}
      position={topLeft}
      className="pointer-events-auto"
    />
  );
}

interface PanelHostProps extends CommonProps {
  isOverlayVisible: boolean;
  onDeleteSelected?: () => void;
  onCopySelected?: () => void;
  onDuplicateSelected?: () => void;
  onSaveGroupTemplate?: (elements: DrawingElement[]) => void;
}

/**
 * Panel wlasciwosci nad bounding boxem zaznaczenia. Ukryty, gdy overlay jest
 * schowany (scroll/pan), gdy nie ma czego edytowac albo zaznaczony jest sam tekst.
 */
export function SelectionPanelHost({
  viewport,
  canvasWidth,
  canvasHeight,
  elements,
  selectedIds,
  isOverlayVisible,
  onElementUpdateWithHistory,
  onDeleteSelected,
  onCopySelected,
  onDuplicateSelected,
  onSaveGroupTemplate,
}: PanelHostProps) {
  if (!isOverlayVisible) return null;
  if (selectedIds.size === 0 || !onElementUpdateWithHistory) return null;

  const selectedElements = elements.filter((el) => selectedIds.has(el.id));
  const hasEditableElements = selectedElements.some(
    (el) => el.type === 'shape' || el.type === 'path'
  );
  const hasMarkdownElements = selectedElements.some((el) => el.type === 'markdown');
  const hasImageElements = selectedElements.some((el) => el.type === 'image');
  const hasTableElements = selectedElements.some((el) => el.type === 'table');
  if (!hasEditableElements && !hasMarkdownElements && !hasImageElements && !hasTableElements) {
    return null;
  }
  if (selectedElements.every((el) => el.type === 'text')) return null;

  const bbox = selectionBoundingBox(elements, selectedIds);
  if (!bbox) return null;

  const topCenter = transformPoint(
    { x: bbox.x + bbox.width / 2, y: bbox.y },
    viewport,
    canvasWidth,
    canvasHeight
  );

  return (
    <SelectionPropertiesPanel
      elements={elements}
      selectedIds={selectedIds}
      position={topCenter}
      onElementUpdate={onElementUpdateWithHistory}
      onDeleteSelected={onDeleteSelected}
      onCopySelected={onCopySelected}
      onDuplicateSelected={onDuplicateSelected}
      onSaveGroupTemplate={onSaveGroupTemplate}
    />
  );
}
