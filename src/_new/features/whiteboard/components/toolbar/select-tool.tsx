/**
 * ============================================================================
 * PLIK: components/toolbar/select-tool.tsx - narzedzie zaznaczania
 * ============================================================================
 *
 * Komponent = maszyna stanow wskaznika (zaznaczanie ramka, przeciaganie,
 * resize, obrot) + render overlayow. Cala geometria zyje w czystych modulach
 * z testami (PR-C6 z REFAKTOR-PLAN.md):
 *  - selection/hit-testing.ts   - co jest pod kursorem / w ramce
 *  - selection/handles.ts       - bounding box i uchwyty na ekranie
 *  - selection/transform-math.ts - resize / drag / rotate ze snapem
 *
 * Zachowanie 1:1 z wersja sprzed wyciecia (1906 linii), m.in.:
 * - pivot resize = ORYGINALNY przeciwlegly rog, MIN_SIZE = 0.1,
 * - uchwyty e/w tylko dla text/markdown/image/table,
 * - podglad zaznaczenia: sciezka po bbox; finalne zaznaczenie: po punktach.
 * ============================================================================
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Point, ViewportTransform, DrawingElement } from '@/_new/features/whiteboard/types';
import { inverseTransformPoint } from '@/_new/features/whiteboard/navigation/viewport-math';
import { RotationHandleIcon } from './rotation-handle-icon';
import { useSelectToolNativeEvents } from './use-select-tool-native-events';
import { SelectionPanelHost, SelectionTextToolbar } from './selection-panels';
import {
  GuideLine,
  collectGuidelinesFromImages,
} from '@/_new/features/whiteboard/selection/snap-utils';
import { ElementRegistry } from '@/_new/features/whiteboard/handlers/element-registry';
import {
  findFirstElementAt,
  findTopmostElementAt,
  getElementIdsInSelectionRect,
  isPointInBoundingBox,
  selectionRectFromPoints,
} from '@/_new/features/whiteboard/selection/hit-testing';
import {
  RESIZE_HANDLE_SIZE,
  getResizeHandleAt,
  previewBoundingBox,
  resizeHandlePositions,
  rotationHandlePosition,
  selectionBoundingBox,
  snapshotElements,
  supportsSideResize,
  worldBoxToScreenRect,
  type BoundingBox,
  type ResizeHandle,
} from '@/_new/features/whiteboard/selection/handles';
import {
  acceptsSideResize,
  angleFromPivot,
  computeCornerResize,
  computeDragSnap,
  computeRotationAngle,
  computeSideResize,
  filterGuidelines,
  normalizedShapeCoords,
} from '@/_new/features/whiteboard/selection/transform-math';

interface SelectToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  elements: DrawingElement[];
  selectedIds: Set<string>;
  isOverlayVisible?: boolean; // Czy overlay jest widoczny (nie renderuj properties panel gdy false)
  isGestureActive?: boolean;
  onSelectionChange: (ids: Set<string>) => void;
  onElementUpdate: (id: string, updates: Partial<DrawingElement>) => void;
  onElementUpdateWithHistory?: (id: string, updates: Partial<DrawingElement>) => void;
  onElementsUpdate: (updates: Map<string, Partial<DrawingElement>>) => void;
  onOperationFinish?: (originalElements?: Map<string, DrawingElement>) => void;
  onTextEdit?: (id: string) => void;
  onMarkdownEdit?: (id: string) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
  onActiveGuidesChange?: (guides: GuideLine[]) => void;
  onDeleteSelected?: () => void;
  onCopySelected?: () => void;
  onDuplicateSelected?: () => void;
  onSaveGroupTemplate?: (elements: DrawingElement[]) => void;
}

export function SelectTool({
  viewport,
  canvasWidth,
  canvasHeight,
  elements,
  selectedIds,
  isOverlayVisible = true,
  isGestureActive = false,
  onSelectionChange,
  onElementUpdate,
  onElementUpdateWithHistory,
  onElementsUpdate,
  onOperationFinish,
  onTextEdit,
  onMarkdownEdit,
  onViewportChange,
  onActiveGuidesChange,
  onDeleteSelected,
  onCopySelected,
  onDuplicateSelected,
  onSaveGroupTemplate,
}: SelectToolProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [draggedElementsOriginal, setDraggedElementsOriginal] = useState<
    Map<string, DrawingElement>
  >(new Map());

  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeOriginalBox, setResizeOriginalBox] = useState<BoundingBox | null>(null);
  const [resizeOriginalElements, setResizeOriginalElements] = useState<Map<string, DrawingElement>>(
    new Map()
  );

  const [isRotating, setIsRotating] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState<number>(0);
  const [rotationPivot, setRotationPivot] = useState<Point | null>(null);
  const [rotationOriginalElements, setRotationOriginalElements] = useState<
    Map<string, DrawingElement>
  >(new Map());
  // Aktualny (wzgledny) kat podczas obracania - trzymany dla live preview, jak w oryginale.
  const [, setCurrentRotationAngle] = useState<number>(0);

  // Podglad zaznaczenia podczas przeciagania ramki
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());

  const overlayRef = useRef<HTMLDivElement>(null);

  // Ref do viewport zeby uniknac re-subscribe wheel listenera
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  /** Punkt ekranu (px wzgledem overlaya) z eventu wskaznika. */
  const screenPointOf = (e: { clientX: number; clientY: number }): Point => {
    const rect = overlayRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Natywny wheel (zoom/pan) i touchmove (fix Apple Pencil) na overlayu
  useSelectToolNativeEvents({
    overlayRef,
    viewportRef,
    canvasWidth,
    canvasHeight,
    onViewportChange,
  });

  useEffect(() => {
    if (isGestureActive) {
      setIsDragging(false);
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setIsResizing(false);
      setIsRotating(false);
      onOperationFinish?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGestureActive]);

  // KRYTYCZNE: globalne pointermove/pointerup dla resize/drag/rotate
  useEffect(() => {
    if (!isResizing && !isDragging && !isRotating) return;

    const handleGlobalPointerMove = (e: PointerEvent) => {
      const screenPoint = screenPointOf(e);
      const worldPoint = inverseTransformPoint(
        screenPoint,
        viewportRef.current,
        canvasWidth,
        canvasHeight
      );

      if (isResizing && resizeHandle && resizeOriginalBox) {
        if (resizeHandle === 'e' || resizeHandle === 'w') {
          // Boki: tylko szerokosc ramki, i tylko dla typow, ktore to wspieraja
          const { x, width } = computeSideResize(resizeHandle, resizeOriginalBox, worldPoint.x);
          const updates = new Map<string, Partial<DrawingElement>>();
          resizeOriginalElements.forEach((originalEl, id) => {
            if (acceptsSideResize(originalEl)) {
              updates.set(id, { x, width });
            }
          });
          if (updates.size > 0) {
            onElementsUpdate(updates);
          }
          return;
        }

        const guidelines = filterGuidelines(
          collectGuidelinesFromImages(elements),
          Array.from(resizeOriginalElements.keys())
        );
        const result = computeCornerResize(
          resizeHandle,
          resizeOriginalBox,
          worldPoint.x,
          worldPoint.y,
          guidelines
        );
        onActiveGuidesChange?.(result.activeGuides);

        const updates = new Map<string, Partial<DrawingElement>>();
        // Strategy: kazdy typ elementu ma wlasny handler resize
        resizeOriginalElements.forEach((originalEl, id) => {
          const handler = ElementRegistry[originalEl.type as keyof typeof ElementRegistry];
          if (handler) {
            updates.set(
              id,
              handler.resize(
                originalEl,
                result.pivot.x,
                result.pivot.y,
                result.scaleX,
                result.scaleY
              )
            );
          }
        });
        onElementsUpdate(updates);
      } else if (isDragging && dragStart) {
        const dx = worldPoint.x - dragStart.x;
        const dy = worldPoint.y - dragStart.y;

        if (draggedElementsOriginal.size > 0) {
          const snap = computeDragSnap(
            draggedElementsOriginal,
            dx,
            dy,
            collectGuidelinesFromImages(elements)
          );
          onActiveGuidesChange?.(snap.activeGuides);

          const updates = new Map<string, Partial<DrawingElement>>();
          draggedElementsOriginal.forEach((originalEl, id) => {
            const handler = ElementRegistry[originalEl.type as keyof typeof ElementRegistry];
            if (handler) {
              updates.set(id, handler.move(originalEl, snap.dx, snap.dy));
            }
          });
          onElementsUpdate(updates);
        }
      } else if (isRotating && rotationPivot && rotationOriginalElements.size > 0) {
        const rotationAngle = computeRotationAngle(
          worldPoint,
          rotationPivot,
          rotationStartAngle,
          rotationOriginalElements.values()
        );
        setCurrentRotationAngle(rotationAngle);

        const cos = Math.cos(rotationAngle);
        const sin = Math.sin(rotationAngle);
        const updates = new Map<string, Partial<DrawingElement>>();
        rotationOriginalElements.forEach((originalEl, id) => {
          const handler = ElementRegistry[originalEl.type as keyof typeof ElementRegistry];
          if (handler) {
            updates.set(id, handler.rotate(originalEl, rotationAngle, rotationPivot, cos, sin));
          }
        });
        onElementsUpdate(updates);
      }
    };

    const handleGlobalPointerUp = () => {
      if (isDragging && draggedElementsOriginal.size > 0) {
        onOperationFinish?.(draggedElementsOriginal);
      }

      if (isResizing && resizeOriginalElements.size > 0) {
        onOperationFinish?.(resizeOriginalElements);
      }

      if (isRotating && rotationOriginalElements.size > 0) {
        // Po obrocie znormalizuj wspolrzedne shape (startX < endX, startY < endY)
        const finalUpdates = new Map<string, Partial<DrawingElement>>();
        elements.forEach((el) => {
          if (!selectedIds.has(el.id)) return;
          const normalized = normalizedShapeCoords(el);
          if (normalized) finalUpdates.set(el.id, normalized);
        });
        if (finalUpdates.size > 0) {
          onElementsUpdate(finalUpdates);
        }
        onOperationFinish?.(rotationOriginalElements);
      }

      setIsDragging(false);
      setDragStart(null);
      setDraggedElementsOriginal(new Map());

      setIsResizing(false);
      setResizeHandle(null);
      setResizeOriginalBox(null);
      setResizeOriginalElements(new Map());

      setIsRotating(false);
      setRotationStartAngle(0);
      setRotationPivot(null);
      setRotationOriginalElements(new Map());
      setCurrentRotationAngle(0);

      onActiveGuidesChange?.([]);
    };

    const handleGlobalPointerCancel = () => {
      // Pusty handler (nic nie musimy tu czyscic z multitoucha)
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isResizing,
    isDragging,
    isRotating,
    resizeHandle,
    resizeOriginalBox,
    canvasWidth,
    canvasHeight,
    onElementsUpdate,
    onOperationFinish,
    elements,
    selectedIds,
    onActiveGuidesChange,
  ]);

  const getPreviewBoundingBox = useCallback(
    (): BoundingBox | null => selectionBoundingBox(elements, previewSelectedIds),
    [elements, previewSelectedIds]
  );

  const getSelectionBoundingBox = useCallback(
    (): BoundingBox | null => selectionBoundingBox(elements, selectedIds),
    [elements, selectedIds]
  );

  const selectedElements = elements.filter((el) => selectedIds.has(el.id));
  const sideHandles = supportsSideResize(selectedElements);

  /** Start resize za dany uchwyt (z klikniecia w overlay albo w kolko uchwytu). */
  const beginResize = (handle: ResizeHandle, bbox: BoundingBox) => {
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeOriginalBox(bbox);
    setResizeOriginalElements(snapshotElements(elements, selectedIds));
  };

  /** Start przeciagania zaznaczonych elementow. */
  const beginDrag = (worldPoint: Point, ids: Set<string>) => {
    setIsDragging(true);
    setDragStart(worldPoint);
    setDraggedElementsOriginal(snapshotElements(elements, ids));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const worldPoint = inverseTransformPoint(screenPointOf(e), viewport, canvasWidth, canvasHeight);
    // Jak w oryginale: szukamy od gory, ale tylko wsrod tekstow i notatek
    const editable = findTopmostElementAt(
      worldPoint,
      elements.filter((el) => el.type === 'text' || el.type === 'markdown')
    );
    if (!editable) return;
    if (editable.type === 'text') onTextEdit?.(editable.id);
    else onMarkdownEdit?.(editable.id);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isGestureActive) return;
    // Blokuj srodkowy (1) i prawy (2) przycisk, ale przepusc lewy (0) i pen (-1)
    if (e.button === 1 || e.button === 2) return;

    const screenPoint = screenPointOf(e);
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    const bbox = getSelectionBoundingBox();
    if (bbox && selectedIds.size > 0) {
      const handle = getResizeHandleAt(
        screenPoint,
        bbox,
        viewport,
        canvasWidth,
        canvasHeight,
        sideHandles
      );
      if (handle) {
        beginResize(handle, bbox);
        return;
      }

      // Klikniecie w obszar zaznaczenia = przeciaganie calego zaznaczenia
      if (isPointInBoundingBox(worldPoint, bbox)) {
        beginDrag(worldPoint, selectedIds);
        return;
      }
    }

    const clickedElement = findFirstElementAt(worldPoint, elements);

    if (clickedElement) {
      let newSelection: Set<string>;
      if (e.shiftKey) {
        // Shift: przelacz element w zaznaczeniu
        newSelection = new Set(selectedIds);
        if (newSelection.has(clickedElement.id)) {
          newSelection.delete(clickedElement.id);
        } else {
          newSelection.add(clickedElement.id);
        }
      } else if (selectedIds.has(clickedElement.id)) {
        // Element juz zaznaczony - przeciagaj wszystkie zaznaczone
        newSelection = new Set(selectedIds);
      } else {
        // Nowy element - zaznacz tylko jego
        newSelection = new Set([clickedElement.id]);
      }
      onSelectionChange(newSelection);
      // Auto-drag: od razu zacznij przeciagac nowa selekcje
      beginDrag(worldPoint, newSelection);
    } else {
      setIsSelecting(true);
      setSelectionStart(screenPoint);
      setSelectionEnd(screenPoint);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Tylko dla zaznaczania obszaru - resize/drag obslugiwane przez global listener
    if (isSelecting && selectionStart) {
      const currentEnd = screenPointOf(e);
      setSelectionEnd(currentEnd);

      // Live preview: sciezki po bounding boxie (jak w oryginale)
      const worldStart = inverseTransformPoint(selectionStart, viewport, canvasWidth, canvasHeight);
      const worldEnd = inverseTransformPoint(currentEnd, viewport, canvasWidth, canvasHeight);
      setPreviewSelectedIds(
        getElementIdsInSelectionRect(
          elements,
          selectionRectFromPoints(worldStart, worldEnd),
          'bbox'
        )
      );
    }
  };

  const handlePointerUp = () => {
    // Tylko dla zaznaczania obszaru - resize/drag pointerup obslugiwane przez global listener
    if (isSelecting && selectionStart && selectionEnd) {
      const worldStart = inverseTransformPoint(selectionStart, viewport, canvasWidth, canvasHeight);
      const worldEnd = inverseTransformPoint(selectionEnd, viewport, canvasWidth, canvasHeight);
      // Finalne zaznaczenie: sciezka wpada, gdy ktorykolwiek punkt lezy w ramce (jak w oryginale)
      onSelectionChange(
        getElementIdsInSelectionRect(
          elements,
          selectionRectFromPoints(worldStart, worldEnd),
          'points'
        )
      );
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setPreviewSelectedIds(new Set());
  };

  const handlePointerCancel = () => {
    // Pusty handler po usunieciu gestures
  };

  // Glowny bounding box podgladu zaznaczenia (gdy wiecej niz 1 element)
  const renderPreviewBoundingBox = () => {
    if (previewSelectedIds.size <= 1) return null;

    const bbox = getPreviewBoundingBox();
    if (!bbox) return null;

    const screen = worldBoxToScreenRect(bbox, viewport, canvasWidth, canvasHeight);

    return (
      <div
        className="absolute border z-36 border-blue-500 pointer-events-none"
        style={{ left: screen.left, top: screen.top, width: screen.width, height: screen.height }}
      />
    );
  };

  // Podglad zaznaczenia podczas przeciagania ramki
  const renderPreviewSelectionBoxes = () => {
    if (previewSelectedIds.size === 0) return null;

    return (
      <>
        {Array.from(previewSelectedIds).map((id) => {
          const element = elements.find((el) => el.id === id);
          if (!element) return null;

          const bbox = previewBoundingBox(element);
          if (!bbox) return null;

          const screen = worldBoxToScreenRect(bbox, viewport, canvasWidth, canvasHeight);

          return (
            <div
              key={`preview-${id}`}
              className="absolute border z-35 border-blue-400 bg-blue-50/10 pointer-events-none"
              style={{
                left: screen.left,
                top: screen.top,
                width: screen.width,
                height: screen.height,
              }}
            />
          );
        })}
      </>
    );
  };

  const renderSelectionBox = () => {
    // Nie renderuj selection box gdy overlay jest ukryty
    if (!isOverlayVisible) return null;

    const bbox = getSelectionBoundingBox();
    if (!bbox || selectedIds.size === 0) return null;

    const screen = worldBoxToScreenRect(bbox, viewport, canvasWidth, canvasHeight);
    const handles = resizeHandlePositions(screen, sideHandles);
    const rotationHandle = rotationHandlePosition(screen);

    return (
      <>
        {/* Selection box - prosty prostokat */}
        {!isRotating && (
          <div
            className="absolute border border-blue-500 pointer-events-none z-40"
            style={{
              left: screen.left,
              top: screen.top,
              width: screen.width,
              height: screen.height,
              boxSizing: 'border-box',
            }}
          />
        )}

        {/* Uchwyty resize w rogach (i na bokach, jesli elementy to wspieraja) */}
        {!isRotating &&
          handles.map(({ pos, x, y, cursor }) => (
            <div
              key={pos}
              className="absolute bg-white z-50 border border-gray-400 rounded-full pointer-events-auto"
              style={{
                left: x - RESIZE_HANDLE_SIZE / 2,
                top: y - RESIZE_HANDLE_SIZE / 2,
                width: RESIZE_HANDLE_SIZE,
                height: RESIZE_HANDLE_SIZE,
                cursor,
              }}
              onMouseDown={(e) => {
                e.stopPropagation(); // KRYTYCZNE: zatrzymaj propagacje do interactive overlay
                beginResize(pos, bbox);
              }}
            />
          ))}

        {/* Uchwyt obrotu - ukryty podczas obracania */}
        {!isRotating && (
          <div
            className="absolute z-50 pointer-events-auto cursor-grab"
            style={{ left: rotationHandle.x, top: rotationHandle.y - 12, width: 12, height: 12 }}
            onMouseDown={(e) => {
              e.stopPropagation();

              const pivot = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
              const worldPoint = inverseTransformPoint(
                screenPointOf(e),
                viewport,
                canvasWidth,
                canvasHeight
              );

              setIsRotating(true);
              setRotationStartAngle(angleFromPivot(worldPoint, pivot));
              setRotationPivot(pivot);
              setRotationOriginalElements(snapshotElements(elements, selectedIds));
            }}
          >
            <RotationHandleIcon />
          </div>
        )}
      </>
    );
  };

  const panelProps = {
    viewport,
    canvasWidth,
    canvasHeight,
    elements,
    selectedIds,
    onElementUpdateWithHistory,
  };

  return (
    <>
      {/* Niewidoczny overlay tylko dla wheel */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{ touchAction: 'none' }}
      />

      {/* Interaktywny overlay dla wskaznika */}
      <div
        className="absolute inset-0 z-30 pointer-events-auto"
        style={{ cursor: 'default', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
      />

      {isSelecting && selectionStart && selectionEnd && (
        <div
          className="absolute border z-40 border-blue-500 bg-blue-500/20 pointer-events-none"
          style={{
            left: Math.min(selectionStart.x, selectionEnd.x),
            top: Math.min(selectionStart.y, selectionEnd.y),
            width: Math.abs(selectionEnd.x - selectionStart.x),
            height: Math.abs(selectionEnd.y - selectionStart.y),
          }}
        />
      )}

      <SelectionTextToolbar {...panelProps} />
      <SelectionPanelHost
        {...panelProps}
        isOverlayVisible={isOverlayVisible}
        onDeleteSelected={onDeleteSelected}
        onCopySelected={onCopySelected}
        onDuplicateSelected={onDuplicateSelected}
        onSaveGroupTemplate={onSaveGroupTemplate}
      />
      {renderPreviewSelectionBoxes()}
      {renderPreviewBoundingBox()}
      {renderSelectionBox()}
    </>
  );
}
