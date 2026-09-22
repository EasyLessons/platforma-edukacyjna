/**
 * hit-testing.ts - czyste funkcje "co jest pod kursorem / w ramce zaznaczenia".
 *
 * Wyciete z components/toolbar/select-tool.tsx (PR-C6 z REFAKTOR-PLAN.md), zeby
 * geometria zaznaczania byla testowalna bez Reacta. Zero zaleznosci od DOM.
 */
import type { Point, DrawingElement } from '../types';
import { ElementRegistry } from '../handlers/element-registry';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Prostokat w ukladzie swiata: lewy-gorny rog + rozmiar. */
export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Czy dwa prostokaty (x, y, w, h) sie przecinaja (stykanie krawedzia = przecinaja). */
export function rectanglesIntersect(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return !(ax + aw < bx || bx + bw < ax || ay + ah < by || by + bh < ay);
}

/** Cztery narozniki prostokata obroconego wokol jego srodka. */
export function rotatedRectCorners(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): Point[] {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return corners.map((corner) => {
    const dx = corner.x - centerX;
    const dy = corner.y - centerY;
    return { x: centerX + dx * cos - dy * sin, y: centerY + dx * sin + dy * cos };
  });
}

/**
 * Czy obrocony prostokat elementu przecina sie z (nieobroconym) prostokatem
 * zaznaczenia. Heurystyka 3-krokowa (jak w oryginale): ktorys naroznik elementu
 * w ramce, srodek elementu w ramce, albo srodek ramki w elemencie (po odwroceniu obrotu).
 */
export function rotatedRectIntersects(
  selectX: number,
  selectY: number,
  selectW: number,
  selectH: number,
  elemX: number,
  elemY: number,
  elemW: number,
  elemH: number,
  rotation: number
): boolean {
  const centerX = elemX + elemW / 2;
  const centerY = elemY + elemH / 2;

  for (const corner of rotatedRectCorners(elemX, elemY, elemW, elemH, rotation)) {
    if (
      corner.x >= selectX &&
      corner.x <= selectX + selectW &&
      corner.y >= selectY &&
      corner.y <= selectY + selectH
    ) {
      return true;
    }
  }

  if (
    centerX >= selectX &&
    centerX <= selectX + selectW &&
    centerY >= selectY &&
    centerY <= selectY + selectH
  ) {
    return true;
  }

  const selectCenterX = selectX + selectW / 2;
  const selectCenterY = selectY + selectH / 2;
  const dx = selectCenterX - centerX;
  const dy = selectCenterY - centerY;
  const cosNeg = Math.cos(-rotation);
  const sinNeg = Math.sin(-rotation);
  const rotatedSelectX = centerX + dx * cosNeg - dy * sinNeg;
  const rotatedSelectY = centerY + dx * sinNeg + dy * cosNeg;

  return (
    rotatedSelectX >= elemX &&
    rotatedSelectX <= elemX + elemW &&
    rotatedSelectY >= elemY &&
    rotatedSelectY <= elemY + elemH
  );
}

/** Czy punkt lezy w bounding boxie (krawedzie wlacznie). */
export function isPointInBoundingBox(worldPoint: Point, bbox: BoundingBox): boolean {
  return (
    worldPoint.x >= bbox.x &&
    worldPoint.x <= bbox.x + bbox.width &&
    worldPoint.y >= bbox.y &&
    worldPoint.y <= bbox.y + bbox.height
  );
}

/** Strategy: hit-test deleguje do handlera typu elementu (brak handlera = false). */
export function isPointInElement(worldPoint: Point, element: DrawingElement): boolean {
  const handler = ElementRegistry[element.type as keyof typeof ElementRegistry];
  if (!handler) return false;
  return handler.isPointInElement(worldPoint, element);
}

/** Ostatni (najwyzej narysowany) element pod punktem - jak przy podwojnym kliknieciu. */
export function findTopmostElementAt(
  worldPoint: Point,
  elements: DrawingElement[]
): DrawingElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (isPointInElement(worldPoint, elements[i])) return elements[i];
  }
  return null;
}

/** Pierwszy element (w kolejnosci tablicy) pod punktem - jak przy klikniecu w select-tool. */
export function findFirstElementAt(
  worldPoint: Point,
  elements: DrawingElement[]
): DrawingElement | undefined {
  return elements.find((el) => isPointInElement(worldPoint, el));
}

/** Ramka zaznaczenia z dwoch punktow swiata (dowolna kolejnosc rogow). */
export function selectionRectFromPoints(a: Point, b: Point): WorldRect {
  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxY: Math.max(a.y, b.y),
  };
}

/**
 * Jak traktowac sciezke (path) przy zaznaczaniu ramka:
 * - 'bbox'   - przecina, gdy bounding box punktow przecina ramke (podglad podczas przeciagania),
 * - 'points' - przecina, gdy ktorykolwiek punkt lezy w ramce (finalne zaznaczenie po puszczeniu).
 * Dwa tryby istnieja, bo tak zachowywal sie oryginalny select-tool (podglad vs pointerUp).
 */
export type PathSelectionMode = 'bbox' | 'points';

/** Czy element wpada w ramke zaznaczenia (semantyka 1:1 z select-tool). */
export function elementIntersectsSelectionRect(
  el: DrawingElement,
  rect: WorldRect,
  pathMode: PathSelectionMode
): boolean {
  const { minX, minY, maxX, maxY } = rect;
  const w = maxX - minX;
  const h = maxY - minY;

  if (el.type === 'shape') {
    const elMinX = Math.min(el.startX, el.endX);
    const elMaxX = Math.max(el.startX, el.endX);
    const elMinY = Math.min(el.startY, el.endY);
    const elMaxY = Math.max(el.startY, el.endY);
    return rectanglesIntersect(minX, minY, w, h, elMinX, elMinY, elMaxX - elMinX, elMaxY - elMinY);
  }

  if (el.type === 'text') {
    const elWidth = el.width || 3;
    const elHeight = el.height || 1;
    if (el.rotation && el.rotation !== 0) {
      return rotatedRectIntersects(minX, minY, w, h, el.x, el.y, elWidth, elHeight, el.rotation);
    }
    return rectanglesIntersect(minX, minY, w, h, el.x, el.y, elWidth, elHeight);
  }

  if (el.type === 'image') {
    if (el.rotation && el.rotation !== 0) {
      return rotatedRectIntersects(minX, minY, w, h, el.x, el.y, el.width, el.height, el.rotation);
    }
    return rectanglesIntersect(minX, minY, w, h, el.x, el.y, el.width, el.height);
  }

  if (el.type === 'path') {
    if (pathMode === 'points') {
      return el.points.some((p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
    }
    const xs = el.points.map((p: Point) => p.x);
    const ys = el.points.map((p: Point) => p.y);
    const elMinX = Math.min(...xs);
    const elMaxX = Math.max(...xs);
    const elMinY = Math.min(...ys);
    const elMaxY = Math.max(...ys);
    return rectanglesIntersect(minX, minY, w, h, elMinX, elMinY, elMaxX - elMinX, elMaxY - elMinY);
  }

  if (el.type === 'markdown' || el.type === 'table') {
    return rectanglesIntersect(minX, minY, w, h, el.x, el.y, el.width, el.height);
  }

  return false;
}

/** Id elementow wpadajacych w ramke zaznaczenia. */
export function getElementIdsInSelectionRect(
  elements: DrawingElement[],
  rect: WorldRect,
  pathMode: PathSelectionMode
): Set<string> {
  const ids = new Set<string>();
  for (const el of elements) {
    if (elementIntersectsSelectionRect(el, rect, pathMode)) ids.add(el.id);
  }
  return ids;
}
