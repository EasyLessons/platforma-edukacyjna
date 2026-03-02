/**
 * ============================================================================
 * SNAP TO GUIDES — przyciąganie do linii prowadzących
 * ============================================================================
 * Gdy przeciągasz element blisko krawędzi/środka innego — "przyciąga się".
 * Aktualnie tylko obrazki emitują guide lines, wszystkie inne mogą się snap'ować.
 *
 * UŻYWANE PRZEZ:
 * - selection/use-drag.ts     (snap podczas przeciągania)
 * - canvas/snap-guides.tsx    (renderowanie linii pomocniczych)
 * ============================================================================
 */

import { DrawingElement, ImageElement } from '../types';

/** Linia pomocnicza emitowana przez obiekt (np. jego krawędź lub środek) */
export interface GuideLine {
  /** Pozycja linii w jednostkach tablicy (world space) */
  value: number;
  /** vertical = pionowa linia (kontroluje X), horizontal = pozioma (kontroluje Y) */
  orientation: 'vertical' | 'horizontal';
  /** ID obiektu który emituje tę linię (żeby nie snap'ować do siebie) */
  sourceId: string;
}

/** Wynik próby snap'owania — zwraca skorygowaną pozycję i aktywne linie */
export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  /** Linie które były aktywne podczas snap'owania (do wyrenderowania) */
  activeGuides: GuideLine[];
}

/** Odległość (w jednostkach tablicy) przy której snap się aktywuje */
const SNAP_THRESHOLD = 0.15;

/**
 * Zbiera wszystkie guide lines ze wszystkich obrazków na tablicy.
 * Każdy obrazek emituje 6 linii: lewo, prawo, środekX, góra, dół, środekY.
 */
export function collectGuidelinesFromImages(elements: DrawingElement[]): GuideLine[] {
  const guidelines: GuideLine[] = [];
  const images = elements.filter((el) => el.type === 'image') as ImageElement[];

  for (const img of images) {
    // Pionowe (kontrolują X)
    guidelines.push(
      { value: img.x,                    orientation: 'vertical',   sourceId: img.id },
      { value: img.x + img.width,        orientation: 'vertical',   sourceId: img.id },
      { value: img.x + img.width / 2,    orientation: 'vertical',   sourceId: img.id },
    );
    // Poziome (kontrolują Y)
    guidelines.push(
      { value: img.y,                    orientation: 'horizontal', sourceId: img.id },
      { value: img.y + img.height,       orientation: 'horizontal', sourceId: img.id },
      { value: img.y + img.height / 2,   orientation: 'horizontal', sourceId: img.id },
    );
  }

  return guidelines;
}

/**
 * Sprawdź czy przeciągany obiekt powinien się przyciągnąć do którejś guide line.
 * Jeśli tak — koryguje x/y i zwraca które linie były aktywne.
 *
 * @param excludeIds - IDs obiektów do wykluczenia ze snap'owania (zwykle sam siebie)
 */
export function snapToGuidelines(
  x: number,
  y: number,
  width: number,
  height: number,
  guidelines: GuideLine[],
  excludeIds: string[] = []
): SnapResult {
  let adjustedX = x;
  let adjustedY = y;
  let snappedX = false;
  let snappedY = false;
  const activeGuides: GuideLine[] = [];

  const valid = guidelines.filter((g) => !excludeIds.includes(g.sourceId));

  // Snap X — sprawdzamy: lewa krawędź, prawa krawędź, środek
  for (const guide of valid.filter((g) => g.orientation === 'vertical')) {
    const left   = x;
    const right  = x + width;
    const centerX = x + width / 2;

    if      (Math.abs(left    - guide.value) < SNAP_THRESHOLD) { adjustedX = guide.value;           snappedX = true; activeGuides.push(guide); break; }
    else if (Math.abs(right   - guide.value) < SNAP_THRESHOLD) { adjustedX = guide.value - width;   snappedX = true; activeGuides.push(guide); break; }
    else if (Math.abs(centerX - guide.value) < SNAP_THRESHOLD) { adjustedX = guide.value - width/2; snappedX = true; activeGuides.push(guide); break; }
  }

  // Snap Y — sprawdzamy: górna krawędź, dolna krawędź, środek
  for (const guide of valid.filter((g) => g.orientation === 'horizontal')) {
    const top    = y;
    const bottom = y + height;
    const centerY = y + height / 2;

    if      (Math.abs(top     - guide.value) < SNAP_THRESHOLD) { adjustedY = guide.value;            snappedY = true; activeGuides.push(guide); break; }
    else if (Math.abs(bottom  - guide.value) < SNAP_THRESHOLD) { adjustedY = guide.value - height;   snappedY = true; activeGuides.push(guide); break; }
    else if (Math.abs(centerY - guide.value) < SNAP_THRESHOLD) { adjustedY = guide.value - height/2; snappedY = true; activeGuides.push(guide); break; }
  }

  return { x: adjustedX, y: adjustedY, snappedX, snappedY, activeGuides };
}
