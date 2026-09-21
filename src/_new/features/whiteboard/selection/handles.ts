/**
 * handles.ts - bounding box zaznaczenia i uchwyty (resize / rotate) w ukladzie ekranu.
 *
 * Wyciete z components/toolbar/select-tool.tsx (PR-C6). Czyste funkcje: swiat -> ekran
 * przez viewport-math, zero DOM. Komponent tylko rysuje to, co tu policzone.
 */
import type { Point, ViewportTransform, DrawingElement } from '../types';
import { transformPoint } from '../navigation/viewport-math';
import { ElementRegistry } from '../handlers/element-registry';
import { rotatedRectCorners, type BoundingBox } from './hit-testing';

export type { BoundingBox } from './hit-testing';

export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'e' | 'w' | null;

/** Srednica kolka uchwytu w px ekranu (i promien trafienia w getResizeHandleAt). */
export const RESIZE_HANDLE_SIZE = 10;
/** O ile px (ekranu) uchwyt obrotu jest odsuniety od rogu NW wzdluz przekatnej. */
export const ROTATION_HANDLE_OFFSET = 50;

/** Typy, ktorych ramke mozna rozciagac w poziomie bez deformacji tresci (uchwyty e/w). */
export function supportsSideResize(elements: DrawingElement[]): boolean {
  return elements.every(
    (el) =>
      el.type === 'text' || el.type === 'markdown' || el.type === 'image' || el.type === 'table'
  );
}

/** Suma bounding boxow elementow (Strategy: bbox per handler). null gdy nic policzalnego. */
export function unionBoundingBox(elements: DrawingElement[]): BoundingBox | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const handler = ElementRegistry[el.type as keyof typeof ElementRegistry];
    if (!handler) continue;
    const bbox = handler.getBoundingBox(el);
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Bounding box zaznaczonych elementow (po id). */
export function selectionBoundingBox(
  elements: DrawingElement[],
  ids: Set<string>
): BoundingBox | null {
  if (ids.size === 0) return null;
  return unionBoundingBox(elements.filter((el) => ids.has(el.id)));
}

/**
 * Bounding box elementu do podgladu zaznaczenia (osiowy; dla obroconego tekstu/obrazka
 * obejmuje obrocone narozniki). null dla typow bez podgladu.
 * Semantyka 1:1 z renderPreviewSelectionBoxes w select-tool.
 */
export function previewBoundingBox(element: DrawingElement): BoundingBox | null {
  if (element.type === 'shape') {
    const minX = Math.min(element.startX, element.endX);
    const maxX = Math.max(element.startX, element.endX);
    const minY = Math.min(element.startY, element.endY);
    const maxY = Math.max(element.startY, element.endY);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (element.type === 'text' || element.type === 'image') {
    const width = element.type === 'text' ? element.width || 3 : element.width;
    const height = element.type === 'text' ? element.height || 1 : element.height;
    if (element.rotation && element.rotation !== 0) {
      return boundsOfPoints(
        rotatedRectCorners(element.x, element.y, width, height, element.rotation)
      );
    }
    return { x: element.x, y: element.y, width, height };
  }
  if (element.type === 'path') {
    return boundsOfPoints(element.points);
  }
  if (element.type === 'markdown' || element.type === 'table') {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  return null;
}

/** Osiowy bounding box zbioru punktow. */
export function boundsOfPoints(points: Point[]): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Bounding box swiata -> prostokat na ekranie (px). */
export function worldBoxToScreenRect(
  bbox: BoundingBox,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number
): ScreenRect {
  const topLeft = transformPoint({ x: bbox.x, y: bbox.y }, viewport, canvasWidth, canvasHeight);
  const bottomRight = transformPoint(
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    viewport,
    canvasWidth,
    canvasHeight
  );
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

export interface HandlePosition {
  pos: Exclude<ResizeHandle, null>;
  x: number;
  y: number;
  cursor: string;
}

/** Pozycje uchwytow resize na ekranie: 4 rogi (+ e/w, gdy elementy to wspieraja). */
export function resizeHandlePositions(screen: ScreenRect, sideHandles: boolean): HandlePosition[] {
  const { left, top, width, height } = screen;
  const handles: HandlePosition[] = [
    { pos: 'nw', x: left, y: top, cursor: 'nwse-resize' },
    { pos: 'ne', x: left + width, y: top, cursor: 'nesw-resize' },
    { pos: 'se', x: left + width, y: top + height, cursor: 'nwse-resize' },
    { pos: 'sw', x: left, y: top + height, cursor: 'nesw-resize' },
  ];
  if (sideHandles) {
    handles.push({ pos: 'e', x: left + width, y: top + height / 2, cursor: 'ew-resize' });
    handles.push({ pos: 'w', x: left, y: top + height / 2, cursor: 'ew-resize' });
  }
  return handles;
}

/**
 * Ktory uchwyt (jesli ktorys) lezy pod punktem ekranu. Kolejnosc sprawdzania
 * (nw, ne, se, sw, e, w) i promien RESIZE_HANDLE_SIZE jak w oryginale.
 */
export function getResizeHandleAt(
  screenPoint: Point,
  bbox: BoundingBox,
  viewport: ViewportTransform,
  canvasWidth: number,
  canvasHeight: number,
  sideHandles: boolean
): ResizeHandle {
  const screen = worldBoxToScreenRect(bbox, viewport, canvasWidth, canvasHeight);
  for (const handle of resizeHandlePositions(screen, sideHandles)) {
    const dx = screenPoint.x - handle.x;
    const dy = screenPoint.y - handle.y;
    if (Math.sqrt(dx * dx + dy * dy) < RESIZE_HANDLE_SIZE) return handle.pos;
  }
  return null;
}

/** Pozycja uchwytu obrotu: rog NW odsuniety od srodka o ROTATION_HANDLE_OFFSET px. */
export function rotationHandlePosition(screen: ScreenRect): Point {
  const centerX = screen.left + screen.width / 2;
  const centerY = screen.top + screen.height / 2;
  const dx = screen.left - centerX;
  const dy = screen.top - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return {
    x: centerX + (dx / dist) * (dist + ROTATION_HANDLE_OFFSET),
    y: centerY + (dy / dist) * (dist + ROTATION_HANDLE_OFFSET),
  };
}

/** Kopia zaznaczonych elementow (do undo / jako punkt odniesienia operacji). */
export function snapshotElements(
  elements: DrawingElement[],
  ids: Set<string>
): Map<string, DrawingElement> {
  const snapshot = new Map<string, DrawingElement>();
  for (const el of elements) {
    if (ids.has(el.id)) snapshot.set(el.id, { ...el });
  }
  return snapshot;
}
