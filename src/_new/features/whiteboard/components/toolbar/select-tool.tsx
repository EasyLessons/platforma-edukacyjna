/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/SelectTool.tsx
 * ============================================================================
 *
 * ✅ POPRAWKI:
 * - Używamy newBoxX/newBoxY do obliczania pivotu (KRYTYCZNE!)
 * - Skalujemy fontSize dla tekstów (nie tylko width/height)
 * - Tylko 4 rogi (nw, ne, se, sw)
 * - MIN_SIZE = 0.1 zapobiega znikaniu elementów
 * ============================================================================
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Point, ViewportTransform, DrawingElement } from '@/_new/features/whiteboard/types';
import {
  transformPoint,
  inverseTransformPoint,
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '@/_new/features/whiteboard/navigation/viewport-math';
import { TextMiniToolbar } from './text-mini-toolbar';
import { SelectionPropertiesPanel } from './properties-panel';
import { GuideLine, collectGuidelinesFromImages, snapToGuidelines } from '@/_new/features/whiteboard/selection/snap-utils';
import { ElementRegistry } from '@/_new/features/whiteboard/handlers/element-registry';

interface SelectToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  elements: DrawingElement[];
  selectedIds: Set<string>;
  isOverlayVisible?: boolean; // 🆕 Czy overlay jest widoczny (nie renderuj properties panel gdy false)
  onSelectionChange: (ids: Set<string>) => void;
  onElementUpdate: (id: string, updates: Partial<DrawingElement>) => void;
  onElementUpdateWithHistory?: (id: string, updates: Partial<DrawingElement>) => void;
  onElementsUpdate: (updates: Map<string, Partial<DrawingElement>>) => void;
  onOperationFinish?: () => void;
  onTextEdit?: (id: string) => void;
  onMarkdownEdit?: (id: string) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
  onActiveGuidesChange?: (guides: GuideLine[]) => void;
  onDeleteSelected?: () => void;
  onCopySelected?: () => void;
  onDuplicateSelected?: () => void;
}

type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'e' | 'w' | null;

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SelectTool({
  viewport,
  canvasWidth,
  canvasHeight,
  elements,
  selectedIds,
  isOverlayVisible = true, // 🆕 Domyślnie widoczny
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
  const [currentRotationAngle, setCurrentRotationAngle] = useState<number>(0); // 🆕 Aktualny kąt podczas przeciągania

  // 🆕 Preview selection - podgląd zaznaczenia podczas przeciągania selection box
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());

  const overlayRef = useRef<HTMLDivElement>(null);


  // Ref do viewport żeby uniknąć re-subscribe wheel listenera
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // 🆕 Natywny wheel listener z { passive: false } - używa viewportRef
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const currentViewport = viewportRef.current;

      if (e.ctrlKey) {
        const newViewport = zoomViewport(
          currentViewport,
          e.deltaY,
          e.clientX,
          e.clientY,
          canvasWidth,
          canvasHeight
        );
        onViewportChange(constrainViewport(newViewport));
      } else {
        const newViewport = panViewportWithWheel(currentViewport, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    };

    overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleNativeWheel);
  }, [canvasWidth, canvasHeight, onViewportChange]);

  // 🍎 FIX: Apple Pencil bug z iOS 14+ Scribble
  // Dodanie preventDefault na touchmove naprawia problem z brakującymi eventami Apple Pencil
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => overlay.removeEventListener('touchmove', handleTouchMove);
  }, []);

// 🔥 KRYTYCZNE: Global mouseup/mousemove dla resize/drag/rotate
  useEffect(() => {
    if (!isResizing && !isDragging && !isRotating) return;

    const handleGlobalPointerMove = (e: PointerEvent) => {
      const screenPoint = { x: e.clientX, y: e.clientY };
      const worldPoint = inverseTransformPoint(
        screenPoint,
        viewportRef.current,
        canvasWidth,
        canvasHeight
      );

      if (isResizing && resizeHandle && resizeOriginalBox) {
        const currentWorldX = worldPoint.x;
        const currentWorldY = worldPoint.y;

        let newBoxX = resizeOriginalBox.x;
        let newBoxY = resizeOriginalBox.y;
        let newBoxWidth = resizeOriginalBox.width;
        let newBoxHeight = resizeOriginalBox.height;

        const MIN_SIZE = 0.1;

        if (resizeHandle === 'e' || resizeHandle === 'w') {
          let newWidth = resizeOriginalBox.width;
          let newX = resizeOriginalBox.x;

          if (resizeHandle === 'e') {
            newWidth = Math.max(MIN_SIZE, currentWorldX - resizeOriginalBox.x);
          } else if (resizeHandle === 'w') {
            const originalRight = resizeOriginalBox.x + resizeOriginalBox.width;
            newWidth = Math.max(MIN_SIZE, originalRight - currentWorldX);
            newX = originalRight - newWidth; // Element rośnie "w lewo"
          }

          const updates = new Map<string, Partial<DrawingElement>>();
          resizeOriginalElements.forEach((originalEl, id) => {
            // 🔥 ZABEZPIECZENIE: Zmieniamy szerokość ramki tylko dla odpowiednich typów!
            // Ignorujemy path (gdzie width to grubość linii) i shape.
            if (originalEl.type === 'text' || originalEl.type === 'markdown' || originalEl.type === 'image' || originalEl.type === 'table') {
              updates.set(id, { x: newX, width: newWidth });
            }
          });

          if (updates.size > 0) {
            onElementsUpdate(updates);
          }
          return; 
        }

        // Minimalne wymiary notatki markdown (~150×100px przy scale=1)
        const MARKDOWN_MIN_W = 1.5;
        const MARKDOWN_MIN_H = 1.0;

        // Zachowaj oryginalne proporcje (aspect ratio)
        const aspectRatio = resizeOriginalBox.width / resizeOriginalBox.height;

        // 🆕 Zbierz guidelines dla snap podczas resize
        const guidelines = collectGuidelinesFromImages(elements);
        const excludeIds = Array.from(resizeOriginalElements.keys());
        const SNAP_THRESHOLD = 0.1;

        // Filtruj guidelines (wykluczamy źródłowe obiekty)
        const validGuidelines = guidelines.filter((g) => !excludeIds.includes(g.sourceId));
        const verticalGuides = validGuidelines.filter((g) => g.orientation === 'vertical');
        const horizontalGuides = validGuidelines.filter((g) => g.orientation === 'horizontal');

        const activeGuides: any[] = [];
          
        if (resizeHandle === 'se') {
          // Prawy dolny róg - snapujemy right i bottom edge
          let targetRight = currentWorldX;
          const targetBottom = currentWorldY;

          // Snap right edge do vertical guidelines
          for (const guide of verticalGuides) {
            if (Math.abs(targetRight - guide.value) < SNAP_THRESHOLD) {
              targetRight = guide.value;
              activeGuides.push(guide);
              break;
            }
          }

          newBoxWidth = Math.max(MIN_SIZE, targetRight - resizeOriginalBox.x);
          newBoxHeight = newBoxWidth / aspectRatio;

          // Snap bottom edge do horizontal guidelines
          const calculatedBottom = resizeOriginalBox.y + newBoxHeight;
          for (const guide of horizontalGuides) {
            if (Math.abs(calculatedBottom - guide.value) < SNAP_THRESHOLD) {
              newBoxHeight = guide.value - resizeOriginalBox.y;
              newBoxWidth = newBoxHeight * aspectRatio;
              activeGuides.push(guide);
              break;
            }
          }
        } else if (resizeHandle === 'sw') {
          // Lewy dolny róg - snapujemy left i bottom edge
          const originalRight = resizeOriginalBox.x + resizeOriginalBox.width;
          let targetLeft = currentWorldX;

          // Snap left edge
          for (const guide of verticalGuides) {
            if (Math.abs(targetLeft - guide.value) < SNAP_THRESHOLD) {
              targetLeft = guide.value;
              activeGuides.push(guide);
              break;
            }
          }

          newBoxWidth = Math.max(MIN_SIZE, originalRight - targetLeft);
          newBoxX = originalRight - newBoxWidth;
          newBoxHeight = newBoxWidth / aspectRatio;

          // Snap bottom edge
          const calculatedBottom = resizeOriginalBox.y + newBoxHeight;
          for (const guide of horizontalGuides) {
            if (Math.abs(calculatedBottom - guide.value) < SNAP_THRESHOLD) {
              newBoxHeight = guide.value - resizeOriginalBox.y;
              newBoxWidth = newBoxHeight * aspectRatio;
              newBoxX = originalRight - newBoxWidth;
              activeGuides.push(guide);
              break;
            }
          }
        } else if (resizeHandle === 'ne') {
          // Prawy górny róg - snapujemy right i top edge
          const originalBottom = resizeOriginalBox.y + resizeOriginalBox.height;
          let targetRight = currentWorldX;
          const targetTop = currentWorldY;

          // Snap right edge
          for (const guide of verticalGuides) {
            if (Math.abs(targetRight - guide.value) < SNAP_THRESHOLD) {
              targetRight = guide.value;
              activeGuides.push(guide);
              break;
            }
          }

          newBoxWidth = Math.max(MIN_SIZE, targetRight - resizeOriginalBox.x);
          newBoxHeight = newBoxWidth / aspectRatio;
          newBoxY = originalBottom - newBoxHeight;

          // Snap top edge
          for (const guide of horizontalGuides) {
            if (Math.abs(newBoxY - guide.value) < SNAP_THRESHOLD) {
              newBoxY = guide.value;
              newBoxHeight = originalBottom - newBoxY;
              newBoxWidth = newBoxHeight * aspectRatio;
              activeGuides.push(guide);
              break;
            }
          }
        } else if (resizeHandle === 'nw') {
          // Lewy górny róg - snapujemy left i top edge
          const originalRight = resizeOriginalBox.x + resizeOriginalBox.width;
          const originalBottom = resizeOriginalBox.y + resizeOriginalBox.height;
          let targetLeft = currentWorldX;
          const targetTop = currentWorldY;

          // Snap left edge
          for (const guide of verticalGuides) {
            if (Math.abs(targetLeft - guide.value) < SNAP_THRESHOLD) {
              targetLeft = guide.value;
              activeGuides.push(guide);
              break;
            }
          }

          newBoxWidth = Math.max(MIN_SIZE, originalRight - targetLeft);
          newBoxX = originalRight - newBoxWidth;
          newBoxHeight = newBoxWidth / aspectRatio;
          newBoxY = originalBottom - newBoxHeight;

          // Snap top edge
          for (const guide of horizontalGuides) {
            if (Math.abs(newBoxY - guide.value) < SNAP_THRESHOLD) {
              newBoxY = guide.value;
              newBoxHeight = originalBottom - newBoxY;
              newBoxWidth = newBoxHeight * aspectRatio;
              newBoxX = originalRight - newBoxWidth;
              activeGuides.push(guide);
              break;
            }
          }
        }

        // Zaktualizuj active guides dla wizualizacji
        onActiveGuidesChange?.(activeGuides);

        const scaleX = newBoxWidth / resizeOriginalBox.width;
        const scaleY = newBoxHeight / resizeOriginalBox.height;

        // 🔥 POPRAWKA: Pivot to ORYGINALNY przeciwległy róg, nie nowy!
        let pivotX: number;
        let pivotY: number;

        if (resizeHandle === 'se') {
          // Lewy górny róg (oryginalny)
          pivotX = resizeOriginalBox.x;
          pivotY = resizeOriginalBox.y;
        } else if (resizeHandle === 'sw') {
          // Prawy górny róg (oryginalny)
          pivotX = resizeOriginalBox.x + resizeOriginalBox.width;
          pivotY = resizeOriginalBox.y;
        } else if (resizeHandle === 'ne') {
          // Lewy dolny róg (oryginalny)
          pivotX = resizeOriginalBox.x;
          pivotY = resizeOriginalBox.y + resizeOriginalBox.height;
        } else if (resizeHandle === 'nw') {
          // Prawy dolny róg (oryginalny)
          pivotX = resizeOriginalBox.x + resizeOriginalBox.width;
          pivotY = resizeOriginalBox.y + resizeOriginalBox.height;
        } else {
          // Fallback (nie powinno się zdarzyć)
          pivotX = resizeOriginalBox.x;
          pivotY = resizeOriginalBox.y;
        }

        const updates = new Map<string, Partial<DrawingElement>>();

        // Strategy Pattern: każdy typ elementu ma własny handler – brak if/else
        resizeOriginalElements.forEach((originalEl, id) => {
          const handler = ElementRegistry[originalEl.type as keyof typeof ElementRegistry];
          if (handler) {
            updates.set(id, handler.resize(originalEl, pivotX, pivotY, scaleX, scaleY));
          }
        });

        onElementsUpdate(updates);
      } else if (isDragging && dragStart) {
        const dx = worldPoint.x - dragStart.x;
        const dy = worldPoint.y - dragStart.y;

        // Zbierz guide lines z obrazków
        const guidelines = collectGuidelinesFromImages(elements);

        // Oblicz bounding box przeciąganych elementów
        const draggedElements = Array.from(draggedElementsOriginal.values());
        if (draggedElements.length > 0) {
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

          // Strategy Pattern: getBoundingBox per handler – brak if/else per typ
          draggedElements.forEach((el) => {
            const handler = ElementRegistry[el.type as keyof typeof ElementRegistry];
            if (!handler) return;
            const bbox = handler.getBoundingBox(el);
            const projX = bbox.x + dx;
            const projY = bbox.y + dy;
            minX = Math.min(minX, projX);
            minY = Math.min(minY, projY);
            maxX = Math.max(maxX, projX + bbox.width);
            maxY = Math.max(maxY, projY + bbox.height);
          });

          const width = maxX - minX;
          const height = maxY - minY;

          // Snap do guidelines
          const excludeIds = Array.from(draggedElementsOriginal.keys());
          const snapResult = snapToGuidelines(minX, minY, width, height, guidelines, excludeIds);

          // Oblicz adjustment snapu
          const snapDx = snapResult.x - minX;
          const snapDy = snapResult.y - minY;

          // Zaktualizuj active guides dla wizualizacji
          onActiveGuidesChange?.(snapResult.activeGuides);

          const updates = new Map<string, Partial<DrawingElement>>();

          // Strategy Pattern: move per handler – brak if/else per typ
          draggedElementsOriginal.forEach((originalEl, id) => {
            const handler = ElementRegistry[originalEl.type as keyof typeof ElementRegistry];
            if (handler) {
              updates.set(id, handler.move(originalEl, dx + snapDx, dy + snapDy));
            }
          });

          onElementsUpdate(updates);
        }
      } else if (isRotating && rotationPivot && rotationOriginalElements.size > 0) {
        // 🆕 ROTATION - obracanie zaznaczonych elementów wokół pivota
        const screenPoint = { x: e.clientX, y: e.clientY };
        const worldPoint = inverseTransformPoint(
          screenPoint,
          viewportRef.current,
          canvasWidth,
          canvasHeight
        );

        // Oblicz kąt między punktem a pivotem
        const dx = worldPoint.x - rotationPivot.x;
        const dy = worldPoint.y - rotationPivot.y;
        const currentAngle = Math.atan2(dy, dx);

        // Kąt rotacji to różnica między obecnym kątem a początkowym
        let rotationAngle = currentAngle - rotationStartAngle;

        // 🆕 Snap do globalnych osi X/Y (0°, 90°, 180°, 270°)
        const SNAP_ANGLE = Math.PI / 2; // 90° w radianach
        const SNAP_THRESHOLD = (5 * Math.PI) / 180; // 5° w radianach

        // Oblicz średnią początkową rotację elementów
        let avgOriginalRotation = 0;
        let rotCount = 0;
        rotationOriginalElements.forEach((el) => {
          if (
            (el.type === 'shape' || el.type === 'text' || el.type === 'image') &&
            el.rotation !== undefined
          ) {
            avgOriginalRotation += el.rotation;
            rotCount++;
          }
        });
        if (rotCount > 0) {
          avgOriginalRotation = avgOriginalRotation / rotCount;
        }

        // Oblicz finalny kąt (oryginalna rotacja + nowa rotacja)
        let finalAngle = avgOriginalRotation + rotationAngle;

        // Normalizuj do zakresu [-π, π]
        while (finalAngle > Math.PI) finalAngle -= 2 * Math.PI;
        while (finalAngle < -Math.PI) finalAngle += 2 * Math.PI;

        // Znajdź najbliższą globalną oś (0°, 90°, 180°, 270°)
        const nearestSnapAngle = Math.round(finalAngle / SNAP_ANGLE) * SNAP_ANGLE;
        const distanceToSnap = Math.abs(finalAngle - nearestSnapAngle);

        // Jeśli jesteśmy w granicach bufora, snap do najbliższej osi
        if (distanceToSnap < SNAP_THRESHOLD) {
          // Oblicz korektę - różnicę między snappedFinal a current final
          rotationAngle = nearestSnapAngle - avgOriginalRotation;
        }

        // 🆕 Zapamiętaj aktualny kąt dla live preview selection box (względny, nie absolutny)
        setCurrentRotationAngle(rotationAngle);

        const cos = Math.cos(rotationAngle);
        const sin = Math.sin(rotationAngle);

        const updates = new Map<string, Partial<DrawingElement>>();

        // Strategy Pattern: rotate per handler – brak if/else per typ
        rotationOriginalElements.forEach((originalEl, id) => {
          const handler = ElementRegistry[originalEl.type as keyof typeof ElementRegistry];
          if (handler) {
            updates.set(id, handler.rotate(originalEl, rotationAngle, rotationPivot, cos, sin));
          }
        });

        onElementsUpdate(updates);
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (isDragging && draggedElementsOriginal.size > 0) {
        onOperationFinish?.();
      }

      if (isResizing && resizeOriginalElements.size > 0) {
        onOperationFinish?.();
      }

      if (isRotating && rotationOriginalElements.size > 0) {
        // 🆕 Zaktualizuj bounding boxy po rotacji
        const finalUpdates = new Map<string, Partial<DrawingElement>>();
        
        elements.forEach((el) => {
          if (selectedIds.has(el.id)) {
            if (el.type === 'shape') {
              // Normalizuj współrzędne shape (startX < endX, startY < endY)
              const minX = Math.min(el.startX, el.endX);
              const maxX = Math.max(el.startX, el.endX);
              const minY = Math.min(el.startY, el.endY);
              const maxY = Math.max(el.startY, el.endY);
              
              if (minX !== el.startX || maxX !== el.endX || minY !== el.startY || maxY !== el.endY) {
                finalUpdates.set(el.id, {
                  startX: minX,
                  startY: minY,
                  endX: maxX,
                  endY: maxY,
                });
              }
            }
            // Path, Text i Image już mają poprawne współrzędne
          }
        });
        
        if (finalUpdates.size > 0) {
          onElementsUpdate(finalUpdates);
        }
        
        onOperationFinish?.();
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
      setCurrentRotationAngle(0); // 🆕 Wyczyść aktualny kąt rotacji

      // Wyczyść active guides po zakończeniu operacji
      onActiveGuidesChange?.([]);
    };

    const handleGlobalPointerCancel = (e: PointerEvent) => {
      // Pusty handler (nic nie musimy tu czyścić z multitoucha)
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
    };
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

  // 🆕 Oblicz bounding box dla preview selection
  const getPreviewBoundingBox = useCallback((): BoundingBox | null => {
    if (previewSelectedIds.size === 0) return null;

    const previewElements = elements.filter((el) => previewSelectedIds.has(el.id));
    if (previewElements.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Strategy Pattern: getBoundingBox per handler – brak if/else per typ
    previewElements.forEach((el) => {
      const handler = ElementRegistry[el.type as keyof typeof ElementRegistry];
      if (!handler) return;
      const bbox = handler.getBoundingBox(el);
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });

    if (minX === Infinity || minY === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [elements, previewSelectedIds]);

  const getSelectionBoundingBox = useCallback((): BoundingBox | null => {
    if (selectedIds.size === 0) return null;

    const selectedElements = elements.filter((el) => selectedIds.has(el.id));
    if (selectedElements.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Strategy Pattern: getBoundingBox per handler – brak if/else per typ
    selectedElements.forEach((el) => {
      const handler = ElementRegistry[el.type as keyof typeof ElementRegistry];
      if (!handler) return;
      const bbox = handler.getBoundingBox(el);
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });

    // 🛡️ Walidacja - jeśli nie znaleziono żadnych współrzędnych
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [elements, selectedIds]);

  // Strategy Pattern: isPointInElement deleguje do handlera danego typu
  const isPointInElement = (worldPoint: Point, element: DrawingElement): boolean => {
    const handler = ElementRegistry[element.type as keyof typeof ElementRegistry];
    if (!handler) return false;
    return handler.isPointInElement(worldPoint, element);
  };

  // 🆕 Sprawdza czy punkt jest w bounding box (dla przeciągania zaznaczonych elementów)
  const isPointInBoundingBox = (worldPoint: Point, bbox: BoundingBox): boolean => {
    return (
      worldPoint.x >= bbox.x &&
      worldPoint.x <= bbox.x + bbox.width &&
      worldPoint.y >= bbox.y &&
      worldPoint.y <= bbox.y + bbox.height
    );
  };

  const getResizeHandleAt = (screenPoint: Point, boundingBox: BoundingBox): ResizeHandle => {
    const box = boundingBox;
    const handleSize = 10;

    const topLeft = transformPoint({ x: box.x, y: box.y }, viewport, canvasWidth, canvasHeight);
    const topRight = transformPoint(
      { x: box.x + box.width, y: box.y },
      viewport,
      canvasWidth,
      canvasHeight
    );
    const bottomLeft = transformPoint(
      { x: box.x, y: box.y + box.height },
      viewport,
      canvasWidth,
      canvasHeight
    );
    const bottomRight = transformPoint(
      { x: box.x + box.width, y: box.y + box.height },
      viewport,
      canvasWidth,
      canvasHeight
    );
    
    const rightCenter = transformPoint(
      { x: box.x + box.width, y: box.y + box.height / 2 },
       viewport,
        canvasWidth,
         canvasHeight
        );

    const leftCenter = transformPoint(
      { x: box.x, y: box.y + box.height / 2 }, 
      viewport, 
      canvasWidth, 
      canvasHeight
    );



  const isNear = (p1: Point, p2: Point) => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy) < handleSize;
      };

      // Sprawdzamy, czy wszystkie zaznaczone elementy obsługują boczne uchwyty
      const selectedElements = elements.filter(el => selectedIds.has(el.id));
      const supportsSideResize = selectedElements.every(el => 
        el.type === 'text' || el.type === 'markdown' || el.type === 'image' || el.type === 'table'
      );

      if (isNear(screenPoint, topLeft)) return 'nw';
      if (isNear(screenPoint, topRight)) return 'ne';
      if (isNear(screenPoint, bottomRight)) return 'se';
      if (isNear(screenPoint, bottomLeft)) return 'sw';
      
      // Zwracamy 'e' i 'w' tylko jeśli element to wspiera!
      if (supportsSideResize) {
        if (isNear(screenPoint, rightCenter)) return 'e';
        if (isNear(screenPoint, leftCenter)) return 'w';
      }
      
      return null;
    };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];

      if (el.type === 'text' && isPointInElement(worldPoint, el)) {
        if (onTextEdit) onTextEdit(el.id);
        return;
      }

      // 🆕 Obsługa doubleClick dla markdown
      if (el.type === 'markdown' && isPointInElement(worldPoint, el)) {
        if (onMarkdownEdit) onMarkdownEdit(el.id);
        return;
      }
    }
  };

const handlePointerDown = (e: React.PointerEvent) => {
    // ✅ Blokuj środkowy (1) i prawy (2) przycisk, ale przepuść lewy (0) i pen (-1)
    if (e.button === 1 || e.button === 2) return;

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    const bbox = getSelectionBoundingBox();
    if (bbox && selectedIds.size > 0) {
      const handle = getResizeHandleAt(screenPoint, bbox);
      if (handle) {
        setIsResizing(true);
        setResizeHandle(handle);
        setResizeOriginalBox(bbox);

        const originalElements = new Map<string, DrawingElement>();
        elements.forEach((el) => {
          if (selectedIds.has(el.id)) {
            originalElements.set(el.id, { ...el });
          }
        });
        setResizeOriginalElements(originalElements);
        return;
      }
    }

    // 🆕 Sprawdź czy kliknięto w bounding box zaznaczonych elementów
    if (selectedIds.size > 0 && bbox) {
      // Najpierw sprawdź czy kliknięto w bounding box zaznaczenia
      if (isPointInBoundingBox(worldPoint, bbox)) {
        // Można przeciągać - kliknięto w obszar zaznaczenia
        setIsDragging(true);
        setDragStart(worldPoint);

        const originalElements = new Map<string, DrawingElement>();
        elements.forEach((el) => {
          if (selectedIds.has(el.id)) {
            originalElements.set(el.id, { ...el });
          }
        });
        setDraggedElementsOriginal(originalElements);
        return;
      }
    }

    const clickedElement = elements.find((el) => isPointInElement(worldPoint, el));

    if (clickedElement) {
      // 🆕 Auto-drag: zaznacz element i od razu zacznij go przeciągać
      if (e.shiftKey) {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(clickedElement.id)) {
          newSelection.delete(clickedElement.id);
        } else {
          newSelection.add(clickedElement.id);
        }
        onSelectionChange(newSelection);
        
        // 🆕 Pobierz elementy z nową selekcją natychmiast
        setIsDragging(true);
        setDragStart(worldPoint);
        const originalElements = new Map<string, DrawingElement>();
        elements.forEach((el) => {
          if (newSelection.has(el.id)) {
            originalElements.set(el.id, { ...el });
          }
        });
        setDraggedElementsOriginal(originalElements);
      } else {
        // 🆕 Zwykłe kliknięcie - jeśli element już zaznaczony, drag WSZYSTKIE zaznaczone
        // Jeśli nowy element - zaznacz go i rozpocznij drag
        let newSelection: Set<string>;
        if (selectedIds.has(clickedElement.id)) {
          // Element już zaznaczony - drag wszystkie zaznaczone
          newSelection = new Set(selectedIds);
        } else {
          // Nowy element - zaznacz tylko jego
          newSelection = new Set([clickedElement.id]);
        }
        
        onSelectionChange(newSelection);
        
        setIsDragging(true);
        setDragStart(worldPoint);
        const originalElements = new Map<string, DrawingElement>();
        elements.forEach((el) => {
          if (newSelection.has(el.id)) {
            originalElements.set(el.id, { ...el });
          }
        });
        setDraggedElementsOriginal(originalElements);
      }
    } else {
      setIsSelecting(true);
      setSelectionStart(screenPoint);
      setSelectionEnd(screenPoint);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Tylko dla zaznaczania obszaru - resize/drag obsługiwane przez global listener
    if (isSelecting && selectionStart) {
      const currentEnd = { x: e.clientX, y: e.clientY };
      setSelectionEnd(currentEnd);

      // 🆕 Live preview - oblicz które elementy będą zaznaczone
      const worldStart = inverseTransformPoint(selectionStart, viewport, canvasWidth, canvasHeight);
      const worldEnd = inverseTransformPoint(currentEnd, viewport, canvasWidth, canvasHeight);

      const minX = Math.min(worldStart.x, worldEnd.x);
      const maxX = Math.max(worldStart.x, worldEnd.x);
      const minY = Math.min(worldStart.y, worldEnd.y);
      const maxY = Math.max(worldStart.y, worldEnd.y);

      // Funkcja sprawdzająca czy prostokąty się przecinają
      const rectanglesIntersect = (
        ax: number,
        ay: number,
        aw: number,
        ah: number,
        bx: number,
        by: number,
        bw: number,
        bh: number
      ): boolean => {
        return !(ax + aw < bx || bx + bw < ax || ay + ah < by || by + bh < ay);
      };

      // 🆕 Funkcja pomocnicza: czy rotowany prostokąt przecina się z selection box
      const rotatedRectIntersects = (
        selectX: number,
        selectY: number,
        selectW: number,
        selectH: number,
        elemX: number,
        elemY: number,
        elemW: number,
        elemH: number,
        rotation: number
      ): boolean => {
        // Znajdź 4 narożniki rotowanego elementu
        const centerX = elemX + elemW / 2;
        const centerY = elemY + elemH / 2;
        
        const corners = [
          { x: elemX, y: elemY },
          { x: elemX + elemW, y: elemY },
          { x: elemX + elemW, y: elemY + elemH },
          { x: elemX, y: elemY + elemH },
        ];
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const rotatedCorners = corners.map((corner) => {
          const dx = corner.x - centerX;
          const dy = corner.y - centerY;
          return {
            x: centerX + dx * cos - dy * sin,
            y: centerY + dx * sin + dy * cos,
          };
        });
        
        // Sprawdź czy którykolwiek narożnik rotowanego elementu jest w selection box
        for (const corner of rotatedCorners) {
          if (
            corner.x >= selectX &&
            corner.x <= selectX + selectW &&
            corner.y >= selectY &&
            corner.y <= selectY + selectH
          ) {
            return true;
          }
        }
        
        // Sprawdź czy środek elementu jest w selection box
        if (
          centerX >= selectX &&
          centerX <= selectX + selectW &&
          centerY >= selectY &&
          centerY <= selectY + selectH
        ) {
          return true;
        }
        
        // Sprawdź czy środek selection box jest w rotowanym elemencie (odwróć punkt)
        const selectCenterX = selectX + selectW / 2;
        const selectCenterY = selectY + selectH / 2;
        const dx = selectCenterX - centerX;
        const dy = selectCenterY - centerY;
        const cosNeg = Math.cos(-rotation);
        const sinNeg = Math.sin(-rotation);
        const rotatedSelectX = centerX + dx * cosNeg - dy * sinNeg;
        const rotatedSelectY = centerY + dx * sinNeg + dy * cosNeg;
        
        if (
          rotatedSelectX >= elemX &&
          rotatedSelectX <= elemX + elemW &&
          rotatedSelectY >= elemY &&
          rotatedSelectY <= elemY + elemH
        ) {
          return true;
        }
        
        return false;
      };

      const preview = new Set<string>();
      elements.forEach((el) => {
        if (el.type === 'shape') {
          const elMinX = Math.min(el.startX, el.endX);
          const elMaxX = Math.max(el.startX, el.endX);
          const elMinY = Math.min(el.startY, el.endY);
          const elMaxY = Math.max(el.startY, el.endY);

          if (
            rectanglesIntersect(
              minX,
              minY,
              maxX - minX,
              maxY - minY,
              elMinX,
              elMinY,
              elMaxX - elMinX,
              elMaxY - elMinY
            )
          ) {
            preview.add(el.id);
          }
        } else if (el.type === 'text') {
          const elWidth = el.width || 3;
          const elHeight = el.height || 1;

          // 🆕 Obsługa rotacji dla text
          if (el.rotation && el.rotation !== 0) {
            if (
              rotatedRectIntersects(
                minX,
                minY,
                maxX - minX,
                maxY - minY,
                el.x,
                el.y,
                elWidth,
                elHeight,
                el.rotation
              )
            ) {
              preview.add(el.id);
            }
          } else {
            if (
              rectanglesIntersect(minX, minY, maxX - minX, maxY - minY, el.x, el.y, elWidth, elHeight)
            ) {
              preview.add(el.id);
            }
          }
        } else if (el.type === 'image') {
          // 🆕 Obsługa rotacji dla image
          if (el.rotation && el.rotation !== 0) {
            if (
              rotatedRectIntersects(
                minX,
                minY,
                maxX - minX,
                maxY - minY,
                el.x,
                el.y,
                el.width,
                el.height,
                el.rotation
              )
            ) {
              preview.add(el.id);
            }
          } else {
            if (
              rectanglesIntersect(
                minX,
                minY,
                maxX - minX,
                maxY - minY,
                el.x,
                el.y,
                el.width,
                el.height
              )
            ) {
              preview.add(el.id);
            }
          }
        } else if (el.type === 'path') {
          const xs = el.points.map((p: Point) => p.x);
          const ys = el.points.map((p: Point) => p.y);
          const elMinX = Math.min(...xs);
          const elMaxX = Math.max(...xs);
          const elMinY = Math.min(...ys);
          const elMaxY = Math.max(...ys);

          if (
            rectanglesIntersect(
              minX,
              minY,
              maxX - minX,
              maxY - minY,
              elMinX,
              elMinY,
              elMaxX - elMinX,
              elMaxY - elMinY
            )
          ) {
            preview.add(el.id);
          }
        } else if (el.type === 'markdown' || el.type === 'table') {
          if (
            rectanglesIntersect(
              minX,
              minY,
              maxX - minX,
              maxY - minY,
              el.x,
              el.y,
              el.width,
              el.height
            )
          ) {
            preview.add(el.id);
          }
        }
      });

      setPreviewSelectedIds(preview);
    }
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    // Tylko dla zaznaczania obszaru - resize/drag mouseup obsługiwane przez global listener
    if (isSelecting && selectionStart && selectionEnd) {
      const worldStart = inverseTransformPoint(selectionStart, viewport, canvasWidth, canvasHeight);
      const worldEnd = inverseTransformPoint(selectionEnd, viewport, canvasWidth, canvasHeight);

      const minX = Math.min(worldStart.x, worldEnd.x);
      const maxX = Math.max(worldStart.x, worldEnd.x);
      const minY = Math.min(worldStart.y, worldEnd.y);
      const maxY = Math.max(worldStart.y, worldEnd.y);

      // 🆕 Funkcja sprawdzająca czy prostokąty się przecinają (intersection)
      const rectanglesIntersect = (
        ax: number,
        ay: number,
        aw: number,
        ah: number,
        bx: number,
        by: number,
        bw: number,
        bh: number
      ): boolean => {
        return !(ax + aw < bx || bx + bw < ax || ay + ah < by || by + bh < ay);
      };

      // 🆕 Funkcja pomocnicza: czy rotowany prostokąt przecina się z selection box
      const rotatedRectIntersects = (
        selectX: number,
        selectY: number,
        selectW: number,
        selectH: number,
        elemX: number,
        elemY: number,
        elemW: number,
        elemH: number,
        rotation: number
      ): boolean => {
        // Znajdź 4 narożniki rotowanego elementu
        const centerX = elemX + elemW / 2;
        const centerY = elemY + elemH / 2;
        
        const corners = [
          { x: elemX, y: elemY },
          { x: elemX + elemW, y: elemY },
          { x: elemX + elemW, y: elemY + elemH },
          { x: elemX, y: elemY + elemH },
        ];
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const rotatedCorners = corners.map((corner) => {
          const dx = corner.x - centerX;
          const dy = corner.y - centerY;
          return {
            x: centerX + dx * cos - dy * sin,
            y: centerY + dx * sin + dy * cos,
          };
        });
        
        // Sprawdź czy którykolwiek narożnik rotowanego elementu jest w selection box
        for (const corner of rotatedCorners) {
          if (
            corner.x >= selectX &&
            corner.x <= selectX + selectW &&
            corner.y >= selectY &&
            corner.y <= selectY + selectH
          ) {
            return true;
          }
        }
        
        // Sprawdź czy środek elementu jest w selection box
        if (
          centerX >= selectX &&
          centerX <= selectX + selectW &&
          centerY >= selectY &&
          centerY <= selectY + selectH
        ) {
          return true;
        }
        
        // Sprawdź czy środek selection box jest w rotowanym elemencie (odwróć punkt)
        const selectCenterX = selectX + selectW / 2;
        const selectCenterY = selectY + selectH / 2;
        const dx = selectCenterX - centerX;
        const dy = selectCenterY - centerY;
        const cosNeg = Math.cos(-rotation);
        const sinNeg = Math.sin(-rotation);
        const rotatedSelectX = centerX + dx * cosNeg - dy * sinNeg;
        const rotatedSelectY = centerY + dx * sinNeg + dy * cosNeg;
        
        if (
          rotatedSelectX >= elemX &&
          rotatedSelectX <= elemX + elemW &&
          rotatedSelectY >= elemY &&
          rotatedSelectY <= elemY + elemH
        ) {
          return true;
        }
        
        return false;
      };

      const newSelection = new Set<string>();
      elements.forEach((el) => {
        if (el.type === 'shape') {
          const elMinX = Math.min(el.startX, el.endX);
          const elMaxX = Math.max(el.startX, el.endX);
          const elMinY = Math.min(el.startY, el.endY);
          const elMaxY = Math.max(el.startY, el.endY);

          // Sprawdź czy zaznaczenie przecina się z elementem
          if (
            rectanglesIntersect(
              minX,
              minY,
              maxX - minX,
              maxY - minY,
              elMinX,
              elMinY,
              elMaxX - elMinX,
              elMaxY - elMinY
            )
          ) {
            newSelection.add(el.id);
          }
        } else if (el.type === 'text') {
          const elWidth = el.width || 3;
          const elHeight = el.height || 1;

          // 🆕 Obsługa rotacji dla text
          if (el.rotation && el.rotation !== 0) {
            if (
              rotatedRectIntersects(
                minX,
                minY,
                maxX - minX,
                maxY - minY,
                el.x,
                el.y,
                elWidth,
                elHeight,
                el.rotation
              )
            ) {
              newSelection.add(el.id);
            }
          } else {
            if (
              rectanglesIntersect(minX, minY, maxX - minX, maxY - minY, el.x, el.y, elWidth, elHeight)
            ) {
              newSelection.add(el.id);
            }
          }
        } else if (el.type === 'image') {
          // 🆕 Obsługa rotacji dla image
          if (el.rotation && el.rotation !== 0) {
            if (
              rotatedRectIntersects(
                minX,
                minY,
                maxX - minX,
                maxY - minY,
                el.x,
                el.y,
                el.width,
                el.height,
                el.rotation
              )
            ) {
              newSelection.add(el.id);
            }
          } else {
            if (
              rectanglesIntersect(
                minX,
                minY,
                maxX - minX,
                maxY - minY,
                el.x,
                el.y,
                el.width,
                el.height
              )
            ) {
              newSelection.add(el.id);
            }
          }
        } else if (el.type === 'path') {
          // Dla ścieżki sprawdzamy czy jakikolwiek punkt jest w zaznaczeniu
          const anyPointInside = el.points.some(
            (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
          );
          if (anyPointInside) {
            newSelection.add(el.id);
          }
        } else if (el.type === 'markdown' || el.type === 'table') {
          if (
            rectanglesIntersect(
              minX,
              minY,
              maxX - minX,
              maxY - minY,
              el.x,
              el.y,
              el.width,
              el.height
            )
          ) {
            newSelection.add(el.id);
          }
        }
      });

      onSelectionChange(newSelection);
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setPreviewSelectedIds(new Set()); // Wyczyść preview po finalizacji
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    // Pusty handler po usunięciu gestures
  };

  const renderTextToolbar = () => {
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
  };

  // 🆕 Renderuj główny bounding box dla preview selection (gdy więcej niż 1 element)
  const renderPreviewBoundingBox = () => {
    if (previewSelectedIds.size <= 1) return null;

    const bbox = getPreviewBoundingBox();
    if (!bbox) return null;

    const topLeft = transformPoint({ x: bbox.x, y: bbox.y }, viewport, canvasWidth, canvasHeight);
    const bottomRight = transformPoint(
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      viewport,
      canvasWidth,
      canvasHeight
    );

    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;

    return (
      <div
        className="absolute border z-36 border-blue-500 pointer-events-none"
        style={{
          left: topLeft.x,
          top: topLeft.y,
          width: width,
          height: height,
        }}
      />
    );
  };

  // 🆕 Renderuj podgląd zaznaczenia podczas przeciągania selection box
  const renderPreviewSelectionBoxes = () => {
    if (previewSelectedIds.size === 0) return null;

    return (
      <>
        {Array.from(previewSelectedIds).map((id) => {
          const element = elements.find((el) => el.id === id);
          if (!element) return null;

          // Oblicz bounding box dla elementu
          let bbox: BoundingBox;

          if (element.type === 'shape') {
            const minX = Math.min(element.startX, element.endX);
            const maxX = Math.max(element.startX, element.endX);
            const minY = Math.min(element.startY, element.endY);
            const maxY = Math.max(element.startY, element.endY);

            bbox = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            };
          } else if (element.type === 'text') {
            const width = element.width || 3;
            const height = element.height || 1;
            
            // 🆕 Dla obróconych tekstów oblicz rotowane narożniki
            if (element.rotation && element.rotation !== 0) {
              const centerX = element.x + width / 2;
              const centerY = element.y + height / 2;
              
              const corners = [
                { x: element.x, y: element.y },
                { x: element.x + width, y: element.y },
                { x: element.x + width, y: element.y + height },
                { x: element.x, y: element.y + height },
              ];
              
              const cos = Math.cos(element.rotation);
              const sin = Math.sin(element.rotation);
              
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              
              corners.forEach((corner) => {
                const dx = corner.x - centerX;
                const dy = corner.y - centerY;
                const rotatedX = centerX + dx * cos - dy * sin;
                const rotatedY = centerY + dx * sin + dy * cos;
                
                minX = Math.min(minX, rotatedX);
                minY = Math.min(minY, rotatedY);
                maxX = Math.max(maxX, rotatedX);
                maxY = Math.max(maxY, rotatedY);
              });
              
              bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            } else {
              bbox = {
                x: element.x,
                y: element.y,
                width: width,
                height: height,
              };
            }
          } else if (element.type === 'image') {
            // 🆕 Dla obróconych obrazków oblicz rotowane narożniki
            if (element.rotation && element.rotation !== 0) {
              const centerX = element.x + element.width / 2;
              const centerY = element.y + element.height / 2;
              
              const corners = [
                { x: element.x, y: element.y },
                { x: element.x + element.width, y: element.y },
                { x: element.x + element.width, y: element.y + element.height },
                { x: element.x, y: element.y + element.height },
              ];
              
              const cos = Math.cos(element.rotation);
              const sin = Math.sin(element.rotation);
              
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              
              corners.forEach((corner) => {
                const dx = corner.x - centerX;
                const dy = corner.y - centerY;
                const rotatedX = centerX + dx * cos - dy * sin;
                const rotatedY = centerY + dx * sin + dy * cos;
                
                minX = Math.min(minX, rotatedX);
                minY = Math.min(minY, rotatedY);
                maxX = Math.max(maxX, rotatedX);
                maxY = Math.max(maxY, rotatedY);
              });
              
              bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            } else {
              bbox = {
                x: element.x,
                y: element.y,
                width: element.width,
                height: element.height,
              };
            }
          } else if (element.type === 'path') {
            const xs = element.points.map((p: Point) => p.x);
            const ys = element.points.map((p: Point) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            bbox = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            };
          } else if (element.type === 'markdown' || element.type === 'table') {
            bbox = {
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
            };
          } else {
            return null;
          }

          const topLeft = transformPoint(
            { x: bbox.x, y: bbox.y },
            viewport,
            canvasWidth,
            canvasHeight
          );
          const bottomRight = transformPoint(
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
            viewport,
            canvasWidth,
            canvasHeight
          );

          const width = bottomRight.x - topLeft.x;
          const height = bottomRight.y - topLeft.y;

          return (
            <div
              key={`preview-${id}`}
              className="absolute border z-35 border-blue-400 bg-blue-50/10 pointer-events-none"
              style={{
                left: topLeft.x,
                top: topLeft.y,
                width: width,
                height: height,
              }}
            />
          );
        })}
      </>
    );
  };

  const renderSelectionBox = () => {
      // 🆕 Nie renderuj selection box gdy overlay jest ukryty
      if (!isOverlayVisible) return null;
      
      const bbox = getSelectionBoundingBox();
      if (!bbox || selectedIds.size === 0) return null;

      const topLeft = transformPoint({ x: bbox.x, y: bbox.y }, viewport, canvasWidth, canvasHeight);
      const bottomRight = transformPoint(
        { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
        viewport,
        canvasWidth,
        canvasHeight
      );

      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;
      const centerX = topLeft.x + width / 2;
      const centerY = topLeft.y + height / 2;

      const handleSize = 10;

      // 🔥 ZABEZPIECZENIE: Sprawdzamy czy wszystkie zaznaczone elementy wspierają zmianę szerokości bez deformacji
      const selectedElements = elements.filter(el => selectedIds.has(el.id));
      const supportsSideResize = selectedElements.every(el => 
        el.type === 'text' || el.type === 'markdown' || el.type === 'image' || el.type === 'table'
      );

      // Rogi selection box (zawsze pokazujemy te 4 rogi do skalowania)
      const corners = [
        { pos: 'nw', x: topLeft.x, y: topLeft.y, cursor: 'nwse-resize' },
        { pos: 'ne', x: topLeft.x + width, y: topLeft.y, cursor: 'nesw-resize' },
        { pos: 'se', x: topLeft.x + width, y: topLeft.y + height, cursor: 'nwse-resize' },
        { pos: 'sw', x: topLeft.x, y: topLeft.y + height, cursor: 'nesw-resize' },
      ];

      // 🔥 Dodajemy boczne uchwyty TYLKO jeśli zaznaczone elementy to wspierają!
      if (supportsSideResize) {
        corners.push({ pos: 'e', x: topLeft.x + width, y: topLeft.y + height / 2, cursor: 'ew-resize' });
        corners.push({ pos: 'w', x: topLeft.x, y: topLeft.y + height / 2, cursor: 'ew-resize' });
      }

      return (
        <>
          {/* Selection box - prosty prostokąt */}
          {!isRotating && (
            <div
              className="absolute border border-blue-500 pointer-events-none z-40"
              style={{
                left: topLeft.x,
                top: topLeft.y,
                width: width,
                height: height,
                boxSizing: 'border-box',
              }}
            />
          )}

          {/* Resize handles w rogach (i na bokach, jeśli dodane) */}
          {!isRotating && corners.map(({ pos, x, y, cursor }) => (
            <div
              key={pos}
              className="absolute bg-white z-50 border border-gray-400 rounded-full pointer-events-auto"
              style={{
                left: x - handleSize / 2,
                top: y - handleSize / 2,
                width: handleSize,
                height: handleSize,
                cursor: cursor,
              }}
              onMouseDown={(e) => {
                e.stopPropagation(); // 🔥 KRYTYCZNE: zatrzymaj propagację do interactive overlay!
                setIsResizing(true);
                setResizeHandle(pos as ResizeHandle);
                setResizeOriginalBox(bbox);

                const originalElements = new Map<string, DrawingElement>();
                elements.forEach((el) => {
                  if (selectedIds.has(el.id)) {
                    originalElements.set(el.id, { ...el });
                  }
                });
                setResizeOriginalElements(originalElements);
              }}
            />
          ))}

          {/* 🆕 Rotation handle - ukryj podczas rotacji */}
          {!isRotating && (() => {
            // Lewy górny róg
            const nwCorner = corners.find((c) => c.pos === 'nw');
            if (!nwCorner) return null;

            // Wektor od środka do NW corner
            const dx = nwCorner.x - centerX;
            const dy = nwCorner.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Wydłuż wektor o 50px
            const extendedX = centerX + (dx / dist) * (dist + 50);
            const extendedY = centerY + (dy / dist) * (dist + 50);

            return (
              <div
                className="absolute z-50 pointer-events-auto cursor-grab"
                style={{
                  left: extendedX,
                  top: extendedY - 12,
                  width: 12,
                  height: 12,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();

                  // Oblicz pivot - środek zaznaczenia
                  const pivot = {
                    x: bbox.x + bbox.width / 2,
                    y: bbox.y + bbox.height / 2,
                  };

                  // Oblicz początkowy kąt
                  const screenPoint = { x: e.clientX, y: e.clientY };
                  const worldPoint = inverseTransformPoint(
                    screenPoint,
                    viewport,
                    canvasWidth,
                    canvasHeight
                  );
                  const dx = worldPoint.x - pivot.x;
                  const dy = worldPoint.y - pivot.y;
                  const startAngle = Math.atan2(dy, dx);

                  setIsRotating(true);
                  setRotationStartAngle(startAngle);
                  setRotationPivot(pivot);

                  const originalElements = new Map<string, DrawingElement>();
                  elements.forEach((el) => {
                    if (selectedIds.has(el.id)) {
                      originalElements.set(el.id, { ...el });
                    }
                  });
                  setRotationOriginalElements(originalElements);
                }}
              >
              <svg 
                width="18"      // Zmień na swoją wartość
                height="18"     // Zmień na swoją wartość
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg" 
                transform="matrix(-1, 0, 0, 1, 0, 0)"
              >
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                <g id="SVGRepo_iconCarrier"> 
                  <path d="M4.06189 13C4.02104 12.6724 4 12.3387 4 12C4 7.58172 7.58172 4 12 4C14.5006 4 16.7332 5.14727 18.2002 6.94416M19.9381 11C19.979 11.3276 20 11.6613 20 12C20 16.4183 16.4183 20 12 20C9.61061 20 7.46589 18.9525 6 17.2916M9 17H6V17.2916M18.2002 4V6.94416M18.2002 6.94416V6.99993L15.2002 7M6 20V17.2916" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> 
                </g>
              </svg>            
            </div>
            );
          })()}
        </>
      );
    };

  // Renderuj panel właściwości dla zaznaczonych kształtów/ścieżek lub markdown
  const renderPropertiesPanel = () => {
    // 🆕 Nie renderuj wcale gdy overlay jest ukryty (zapobiega "latającemu" panelowi podczas scroll/pan)
    if (!isOverlayVisible) return null;
    if (selectedIds.size === 0 || !onElementUpdateWithHistory) return null;

    const selectedElements = elements.filter((el) => selectedIds.has(el.id));

    // Czy są zaznaczone elementy typu shape/path?
    const hasEditableElements = selectedElements.some(
      (el) => el.type === 'shape' || el.type === 'path'
    );
    // Czy są zaznaczone notatki markdown?
    const hasMarkdownElements = selectedElements.some((el) => el.type === 'markdown');
    // 🆕 Czy są zaznaczone obrazki?
    const hasImageElements = selectedElements.some((el) => el.type === 'image');
    // 🆕 Czy są zaznaczone tabele?
    const hasTableElements = selectedElements.some((el) => el.type === 'table');

    // Jeśli nie ma ani edytowalnych kształtów ani markdown ani obrazków ani tabel, nie pokazuj
    if (!hasEditableElements && !hasMarkdownElements && !hasImageElements && !hasTableElements) {
      return null;
    }

    // Nie pokazuj jeśli zaznaczony jest tylko tekst (bez shape/path/markdown/image)
    const onlyText = selectedElements.every((el) => el.type === 'text');
    if (onlyText) return null;

    // Oblicz pozycję panelu - nad bounding box
    const bbox = getSelectionBoundingBox();
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
      />
    );
  };

  return (
    <>
      {/* Invisible overlay for wheel events only */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{ touchAction: 'none' }}
      />

      {/* Interactive overlay for mouse events */}
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

      {renderTextToolbar()}
      {renderPropertiesPanel()}
      {renderPreviewSelectionBoxes()}
      {renderPreviewBoundingBox()}
      {renderSelectionBox()}
    </>
  );
}

