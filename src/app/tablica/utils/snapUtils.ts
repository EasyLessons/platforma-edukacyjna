/**
 * ============================================================================
 * PLIK: src/app/tablica/utils/snapUtils.ts
 * ============================================================================
 * 
 * SNAP TO GUIDES - System przyciągania do linii prowadzących
 * 
 * LOGIKA:
 * - Tylko OBRAZKI emitują guide lines (vertical/horizontal)
 * - Wszystkie inne obiekty przyciągają się do tych linii
 * - Snap threshold: 10 jednostek canvas (0.1 w jednostkach świata)
 * 
 * ============================================================================
 */

import { DrawingElement, ImageElement } from '../whiteboard/types';

export interface GuideLine {
  value: number; // pozycja w jednostkach canvas (world space)
  orientation: 'vertical' | 'horizontal'; // vertical = x, horizontal = y
  sourceId: string; // ID obrazka który emituje tę linię
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  activeGuides: GuideLine[];
}

const SNAP_THRESHOLD = 0.15; // 50px w jednostkach canvas = 0.5 w jednostkach świata (było 0.1)

/**
 * Zbiera wszystkie guide lines z obrazków
 */
export function collectGuidelinesFromImages(elements: DrawingElement[]): GuideLine[] {
  const guidelines: GuideLine[] = [];

  // Filtruj tylko obrazki
  const images = elements.filter(el => el.type === 'image') as ImageElement[];

  for (const img of images) {
    const left = img.x;
    const right = img.x + img.width;
    const centerX = img.x + img.width / 2;
    const top = img.y;
    const bottom = img.y + img.height;
    const centerY = img.y + img.height / 2;

    // Pionowe guide lines (vertical = kontrolują x)
    guidelines.push(
      { value: left, orientation: 'vertical', sourceId: img.id },
      { value: right, orientation: 'vertical', sourceId: img.id },
      { value: centerX, orientation: 'vertical', sourceId: img.id }
    );

    // Poziome guide lines (horizontal = kontrolują y)
    guidelines.push(
      { value: top, orientation: 'horizontal', sourceId: img.id },
      { value: bottom, orientation: 'horizontal', sourceId: img.id },
      { value: centerY, orientation: 'horizontal', sourceId: img.id }
    );
  }

  return guidelines;
}

/**
 * Sprawdza snap dla obiektu i zwraca adjusted pozycję
 */
export function snapToGuidelines(
  x: number,
  y: number,
  width: number,
  height: number,
  guidelines: GuideLine[],
  excludeIds: string[] = [] // Wykluczamy własny obiekt z snap
): SnapResult {
  const objectLeft = x;
  const objectRight = x + width;
  const objectCenterX = x + width / 2;
  const objectTop = y;
  const objectBottom = y + height;
  const objectCenterY = y + height / 2;

  let adjustedX = x;
  let adjustedY = y;
  let snappedX = false;
  let snappedY = false;
  const activeGuides: GuideLine[] = [];

  // Filtruj guidelines (wykluczamy źródłowe obiekty jeśli to obrazek)
  const validGuidelines = guidelines.filter(g => !excludeIds.includes(g.sourceId));

  // Sprawdź vertical guides (snap X)
  const verticalGuides = validGuidelines.filter(g => g.orientation === 'vertical');
  for (const guide of verticalGuides) {
    // Sprawdź left edge
    if (Math.abs(objectLeft - guide.value) < SNAP_THRESHOLD) {
      adjustedX = guide.value;
      snappedX = true;
      activeGuides.push(guide);
      break;
    }
    // Sprawdź right edge
    if (Math.abs(objectRight - guide.value) < SNAP_THRESHOLD) {
      adjustedX = guide.value - width;
      snappedX = true;
      activeGuides.push(guide);
      break;
    }
    // Sprawdź center
    if (Math.abs(objectCenterX - guide.value) < SNAP_THRESHOLD) {
      adjustedX = guide.value - width / 2;
      snappedX = true;
      activeGuides.push(guide);
      break;
    }
  }

  // Sprawdź horizontal guides (snap Y)
  const horizontalGuides = validGuidelines.filter(g => g.orientation === 'horizontal');
  for (const guide of horizontalGuides) {
    // Sprawdź top edge
    if (Math.abs(objectTop - guide.value) < SNAP_THRESHOLD) {
      adjustedY = guide.value;
      snappedY = true;
      activeGuides.push(guide);
      break;
    }
    // Sprawdź bottom edge
    if (Math.abs(objectBottom - guide.value) < SNAP_THRESHOLD) {
      adjustedY = guide.value - height;
      snappedY = true;
      activeGuides.push(guide);
      break;
    }
    // Sprawdź center
    if (Math.abs(objectCenterY - guide.value) < SNAP_THRESHOLD) {
      adjustedY = guide.value - height / 2;
      snappedY = true;
      activeGuides.push(guide);
      break;
    }
  }

  return {
    x: adjustedX,
    y: adjustedY,
    snappedX,
    snappedY,
    activeGuides,
  };
}
