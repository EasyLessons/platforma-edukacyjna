/**
 * transform-math.ts - matematyka operacji na zaznaczeniu: resize (z proporcjami
 * i snapem do prowadnic), przeciaganie ze snapem, obrot ze snapem do osi.
 *
 * Wyciete z components/toolbar/select-tool.tsx (PR-C6). Czyste funkcje: wejscie ->
 * wynik, bez stanu Reacta. Komponent tylko wola je z handlerow wskaznika.
 */
import type { Point, DrawingElement } from '../types';
import { ElementRegistry } from '../handlers/element-registry';
import { snapToGuidelines, type GuideLine } from './snap-utils';
import type { BoundingBox } from './hit-testing';
import type { ResizeHandle } from './handles';

/** Najmniejszy rozmiar ramki - zapobiega znikaniu elementow przy resize. */
export const MIN_SIZE = 0.1;
/** Prog snapu krawedzi do prowadnicy przy resize (jednostki swiata). */
export const RESIZE_SNAP_THRESHOLD = 0.1;
/** Snap obrotu do osi co 90 stopni, gdy blizej niz 5 stopni. */
export const ROTATION_SNAP_ANGLE = Math.PI / 2;
export const ROTATION_SNAP_THRESHOLD = (5 * Math.PI) / 180;

type CornerHandle = 'nw' | 'ne' | 'se' | 'sw';
type SideHandle = 'e' | 'w';

export interface ResizeResult {
  box: BoundingBox;
  pivot: Point;
  scaleX: number;
  scaleY: number;
  activeGuides: GuideLine[];
}

/** Przeciwlegly (oryginalny) rog jako pivot skalowania. */
export function resizePivot(handle: ResizeHandle, original: BoundingBox): Point {
  switch (handle) {
    case 'sw':
      return { x: original.x + original.width, y: original.y };
    case 'ne':
      return { x: original.x, y: original.y + original.height };
    case 'nw':
      return { x: original.x + original.width, y: original.y + original.height };
    case 'se':
    default:
      return { x: original.x, y: original.y };
  }
}

/**
 * Resize za rog z zachowaniem proporcji i snapem krawedzi do prowadnic.
 * `guidelines` powinny byc juz przefiltrowane (bez prowadnic zrodlowych
 * elementow, ktore sa skalowane) - patrz filterGuidelines.
 */
export function computeCornerResize(
  handle: CornerHandle,
  original: BoundingBox,
  worldX: number,
  worldY: number,
  guidelines: GuideLine[]
): ResizeResult {
  const aspectRatio = original.width / original.height;
  const verticalGuides = guidelines.filter((g) => g.orientation === 'vertical');
  const horizontalGuides = guidelines.filter((g) => g.orientation === 'horizontal');
  const activeGuides: GuideLine[] = [];

  let newX = original.x;
  let newY = original.y;
  let newWidth = original.width;
  let newHeight = original.height;

  const snapVertical = (value: number): number => {
    for (const guide of verticalGuides) {
      if (Math.abs(value - guide.value) < RESIZE_SNAP_THRESHOLD) {
        activeGuides.push(guide);
        return guide.value;
      }
    }
    return value;
  };
  const findHorizontal = (value: number): GuideLine | null => {
    for (const guide of horizontalGuides) {
      if (Math.abs(value - guide.value) < RESIZE_SNAP_THRESHOLD) return guide;
    }
    return null;
  };

  if (handle === 'se') {
    const targetRight = snapVertical(worldX);
    newWidth = Math.max(MIN_SIZE, targetRight - original.x);
    newHeight = newWidth / aspectRatio;
    const guide = findHorizontal(original.y + newHeight);
    if (guide) {
      newHeight = guide.value - original.y;
      newWidth = newHeight * aspectRatio;
      activeGuides.push(guide);
    }
  } else if (handle === 'sw') {
    const originalRight = original.x + original.width;
    const targetLeft = snapVertical(worldX);
    newWidth = Math.max(MIN_SIZE, originalRight - targetLeft);
    newX = originalRight - newWidth;
    newHeight = newWidth / aspectRatio;
    const guide = findHorizontal(original.y + newHeight);
    if (guide) {
      newHeight = guide.value - original.y;
      newWidth = newHeight * aspectRatio;
      newX = originalRight - newWidth;
      activeGuides.push(guide);
    }
  } else if (handle === 'ne') {
    const originalBottom = original.y + original.height;
    const targetRight = snapVertical(worldX);
    newWidth = Math.max(MIN_SIZE, targetRight - original.x);
    newHeight = newWidth / aspectRatio;
    newY = originalBottom - newHeight;
    const guide = findHorizontal(newY);
    if (guide) {
      newY = guide.value;
      newHeight = originalBottom - newY;
      newWidth = newHeight * aspectRatio;
      activeGuides.push(guide);
    }
  } else {
    // 'nw'
    const originalRight = original.x + original.width;
    const originalBottom = original.y + original.height;
    const targetLeft = snapVertical(worldX);
    newWidth = Math.max(MIN_SIZE, originalRight - targetLeft);
    newX = originalRight - newWidth;
    newHeight = newWidth / aspectRatio;
    newY = originalBottom - newHeight;
    const guide = findHorizontal(newY);
    if (guide) {
      newY = guide.value;
      newHeight = originalBottom - newY;
      newWidth = newHeight * aspectRatio;
      newX = originalRight - newWidth;
      activeGuides.push(guide);
    }
  }

  // worldY jest przyjmowane dla symetrii API - proporcje wynikaja z osi X (jak w oryginale).
  void worldY;

  return {
    box: { x: newX, y: newY, width: newWidth, height: newHeight },
    pivot: resizePivot(handle, original),
    scaleX: newWidth / original.width,
    scaleY: newHeight / original.height,
    activeGuides,
  };
}

/** Resize za bok (e/w): tylko szerokosc ramki, bez proporcji i snapu. */
export function computeSideResize(
  handle: SideHandle,
  original: BoundingBox,
  worldX: number
): { x: number; width: number } {
  if (handle === 'e') {
    return { x: original.x, width: Math.max(MIN_SIZE, worldX - original.x) };
  }
  const originalRight = original.x + original.width;
  const width = Math.max(MIN_SIZE, originalRight - worldX);
  return { x: originalRight - width, width };
}

/** Prowadnice bez tych, ktore pochodza z samych przeksztalcanych elementow. */
export function filterGuidelines(guidelines: GuideLine[], excludeIds: string[]): GuideLine[] {
  return guidelines.filter((g) => !excludeIds.includes(g.sourceId));
}

/** Typy, ktorym resize za bok zmienia szerokosc ramki (path/shape ignorowane). */
export function acceptsSideResize(el: DrawingElement): boolean {
  return el.type === 'text' || el.type === 'markdown' || el.type === 'image' || el.type === 'table';
}

export interface DragSnapResult {
  dx: number;
  dy: number;
  activeGuides: GuideLine[];
}

/**
 * Przesuniecie (dx, dy) skorygowane snapem bounding boxa przeciaganej grupy do
 * prowadnic. Gdy grupa jest pusta - bez zmian i bez prowadnic.
 */
export function computeDragSnap(
  dragged: Map<string, DrawingElement>,
  dx: number,
  dy: number,
  guidelines: GuideLine[]
): DragSnapResult {
  if (dragged.size === 0) return { dx, dy, activeGuides: [] };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  dragged.forEach((el) => {
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

  const snap = snapToGuidelines(
    minX,
    minY,
    maxX - minX,
    maxY - minY,
    guidelines,
    Array.from(dragged.keys())
  );
  return { dx: dx + (snap.x - minX), dy: dy + (snap.y - minY), activeGuides: snap.activeGuides };
}

/** Normalizacja kata do [-PI, PI]. */
export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Srednia wyjsciowa rotacja elementow z polem `rotation` (shape/text/image). */
export function averageRotation(elements: Iterable<DrawingElement>): number {
  let sum = 0;
  let count = 0;
  for (const el of elements) {
    if (
      (el.type === 'shape' || el.type === 'text' || el.type === 'image') &&
      el.rotation !== undefined
    ) {
      sum += el.rotation;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Kat obrotu (wzgledny, w radianach) dla biezacej pozycji wskaznika, ze snapem
 * do osi 0/90/180/270 stopni, gdy suma (srednia rotacja + delta) jest blizej niz 5 stopni.
 */
export function computeRotationAngle(
  pointerWorld: Point,
  pivot: Point,
  startAngle: number,
  originalElements: Iterable<DrawingElement>
): number {
  const currentAngle = Math.atan2(pointerWorld.y - pivot.y, pointerWorld.x - pivot.x);
  let rotationAngle = currentAngle - startAngle;

  const avgOriginalRotation = averageRotation(originalElements);
  const finalAngle = normalizeAngle(avgOriginalRotation + rotationAngle);
  const nearestSnapAngle = Math.round(finalAngle / ROTATION_SNAP_ANGLE) * ROTATION_SNAP_ANGLE;
  if (Math.abs(finalAngle - nearestSnapAngle) < ROTATION_SNAP_THRESHOLD) {
    rotationAngle = nearestSnapAngle - avgOriginalRotation;
  }
  return rotationAngle;
}

/** Kat startowy obrotu: kierunek od pivota do punktu wskaznika. */
export function angleFromPivot(pointerWorld: Point, pivot: Point): number {
  return Math.atan2(pointerWorld.y - pivot.y, pointerWorld.x - pivot.x);
}

/**
 * Po obrocie shape moze miec startX > endX itp. - zwraca znormalizowane
 * wspolrzedne albo null, gdy nic nie trzeba zmieniac.
 */
export function normalizedShapeCoords(
  el: DrawingElement
): { startX: number; startY: number; endX: number; endY: number } | null {
  if (el.type !== 'shape') return null;
  const minX = Math.min(el.startX, el.endX);
  const maxX = Math.max(el.startX, el.endX);
  const minY = Math.min(el.startY, el.endY);
  const maxY = Math.max(el.startY, el.endY);
  if (minX === el.startX && maxX === el.endX && minY === el.startY && maxY === el.endY) {
    return null;
  }
  return { startX: minX, startY: minY, endX: maxX, endY: maxY };
}
