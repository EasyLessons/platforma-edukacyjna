/**
 * hit-testing.ts - czyste funkcje "co jest pod kursorem / w ramce zaznaczenia".
 *
 * Wyciete z components/toolbar/select-tool.tsx (PR-C6 z REFAKTOR-PLAN.md), zeby
 * geometria zaznaczania byla testowalna bez Reacta. Zero zaleznosci od DOM.
 */
import type { Point, DrawingElement, DrawingPath, Shape } from '../types';
import { ElementRegistry } from '../handlers/element-registry';
import { getScaledWorldSize } from '../navigation/viewport-math';

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

// ── trafienie w kreske (path / line / arrow) ─────────────────────────────────

/**
 * Minimalny promien trafienia w kreske w px EKRANU. Cienka linia (1-2 px) bylaby
 * nie do klikniecia, gdyby liczyla sie tylko polowa jej grubosci.
 */
export const MIN_LINE_HIT_PX = 4;

/** Dlugosc grotu strzalki w px ekranu - 1:1 z ShapeHandler.render (headLen = 15). */
const ARROW_HEAD_PX = 15;

/** Odleglosc punktu p od odcinka a-b (ten sam uklad wspolrzednych dla wszystkich trzech). */
export function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Najmniejsza odleglosc punktu od polilinii; jeden punkt = odleglosc do niego (kropka). */
export function distancePointToPolyline(p: Point, points: Point[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y);
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distancePointToSegment(p, points[i], points[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Tolerancja trafienia w kreske w JEDNOSTKACH SWIATA.
 *
 * Grubosc kreski (`width` / `strokeWidth`) jest w px ekranu przy zoom 1 - render robi
 * `clampLineWidth(width, viewport.scale)` = width * scale px. Polowa tego to promien
 * kreski; dla cienkich kresek bierzemy minimum MIN_LINE_HIT_PX. Wynik przeliczamy na
 * jednostki swiata tak samo jak reszta tablicy (100 px = 1 jednostka przy zoom 1).
 *
 * @param zoom viewport.scale (1 = 100 %)
 */
export function lineHitTolerance(strokeWidth: number, zoom: number): number {
  const safeZoom = zoom > 0 ? zoom : 1;
  const halfStrokePx = (strokeWidth * safeZoom) / 2;
  return getScaledWorldSize(Math.max(halfStrokePx, MIN_LINE_HIT_PX), safeZoom);
}

/** Najgrubsze miejsce sciezki (pressure-sensitive `widths` moga byc grubsze niz `width`). */
function pathStrokeWidth(el: DrawingPath): number {
  let width = el.width;
  if (el.widths) {
    for (const w of el.widths) if (w > width) width = w;
  }
  return width;
}

/**
 * Sciezka z dlugopisu: trafienie, gdy punkt lezy blisko ktoregos odcinka polilinii.
 * Punkty sciezki sa w ukladzie swiata (bez offsetu x/y elementu), bbox bez paddingu.
 */
export function isPointNearPath(worldPoint: Point, el: DrawingPath, zoom: number): boolean {
  if (el.points.length === 0) return false;
  return (
    distancePointToPolyline(worldPoint, el.points) <= lineHitTolerance(pathStrokeWidth(el), zoom)
  );
}

/**
 * Linia / strzalka (shape): odleglosc od odcinka start-end; strzalka dodatkowo od dwoch
 * ramion grotu (ARROW_HEAD_PX na ekranie, kat 30 stopni - jak w ShapeHandler.render).
 */
export function isPointNearLineShape(worldPoint: Point, el: Shape, zoom: number): boolean {
  const start = { x: el.startX, y: el.startY };
  const end = { x: el.endX, y: el.endY };
  const tolerance = lineHitTolerance(el.strokeWidth, zoom);
  if (distancePointToSegment(worldPoint, start, end) <= tolerance) return true;
  if (el.shapeType !== 'arrow') return false;

  const headLength = getScaledWorldSize(ARROW_HEAD_PX, zoom > 0 ? zoom : 1);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  for (const side of [-1, 1]) {
    const tip = {
      x: end.x - headLength * Math.cos(angle + (side * Math.PI) / 6),
      y: end.y - headLength * Math.sin(angle + (side * Math.PI) / 6),
    };
    if (distancePointToSegment(worldPoint, end, tip) <= tolerance) return true;
  }
  return false;
}

/** Czy shape jest "kreska" (bez wnetrza): linia albo strzalka. */
function isLineShape(element: DrawingElement): element is Shape {
  return (
    element.type === 'shape' && (element.shapeType === 'line' || element.shapeType === 'arrow')
  );
}

// ── co jest pod kursorem ─────────────────────────────────────────────────────

/**
 * Hit-test punktu (uklad swiata):
 * - path oraz shape line/arrow: po odleglosci od kreski (tolerancja zalezna od zoomu),
 *   bo ich bbox to w wiekszosci puste pole - klik w srodek kolka nie ma trafiac w kolko;
 * - reszta (Strategy): deleguje do handlera typu elementu (wnetrze; brak handlera = false).
 *
 * @param zoom viewport.scale; domyslnie 1 (np. testy, podwojne klikniecie w tekst)
 */
export function isPointInElement(worldPoint: Point, element: DrawingElement, zoom = 1): boolean {
  if (element.type === 'path') return isPointNearPath(worldPoint, element, zoom);
  if (isLineShape(element)) return isPointNearLineShape(worldPoint, element, zoom);
  const handler = ElementRegistry[element.type as keyof typeof ElementRegistry];
  if (!handler) return false;
  return handler.isPointInElement(worldPoint, element);
}

/**
 * Element pod punktem: przy kilku trafieniach wygrywa NAJWYZEJ narysowany, czyli ostatni
 * w tablicy (kolejnosc tablicy = kolejnosc rysowania / z-order). Uzywane przy klikniecu
 * i podwojnym klikniecu w select-tool.
 */
export function findTopmostElementAt(
  worldPoint: Point,
  elements: DrawingElement[],
  zoom = 1
): DrawingElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (isPointInElement(worldPoint, elements[i], zoom)) return elements[i];
  }
  return null;
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
