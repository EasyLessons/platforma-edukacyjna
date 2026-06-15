import { describe, it, expect } from 'vitest';
import { collectGuidelinesFromImages, snapToGuidelines } from './snap-utils';
import type { DrawingElement, ImageElement } from '../types';

// ─── collectGuidelinesFromImages ───────────────────────────────────────────

describe('collectGuidelinesFromImages', () => {
  it('pusta lista elementów → []', () => {
    expect(collectGuidelinesFromImages([])).toEqual([]);
  });

  it('elementy bez obrazków → []', () => {
    const elements: DrawingElement[] = [
      { id: '1', type: 'path', points: [], color: '#000', width: 1 },
      { id: '2', type: 'shape', shapeType: 'rectangle', startX: 0, startY: 0, endX: 1, endY: 1, color: '#000', strokeWidth: 1, fill: false },
    ];
    expect(collectGuidelinesFromImages(elements)).toEqual([]);
  });

  it('jeden obrazek → 6 guidelines (3 pionowe, 3 poziome)', () => {
    const img: ImageElement = { id: 'img1', type: 'image', x: 10, y: 20, width: 100, height: 60, src: '' };
    const guides = collectGuidelinesFromImages([img]);
    expect(guides).toHaveLength(6);
    expect(guides.filter(g => g.orientation === 'vertical')).toHaveLength(3);
    expect(guides.filter(g => g.orientation === 'horizontal')).toHaveLength(3);
  });

  it('wartości guidelines są prawidłowe: lewo, prawo, środekX, góra, dół, środekY', () => {
    const img: ImageElement = { id: 'img1', type: 'image', x: 10, y: 20, width: 100, height: 60, src: '' };
    const guides = collectGuidelinesFromImages([img]);

    const verticals = guides.filter(g => g.orientation === 'vertical').map(g => g.value);
    expect(verticals).toContain(10);        // lewa krawędź
    expect(verticals).toContain(110);       // prawa krawędź (10+100)
    expect(verticals).toContain(60);        // środek X (10+100/2)

    const horizontals = guides.filter(g => g.orientation === 'horizontal').map(g => g.value);
    expect(horizontals).toContain(20);      // górna krawędź
    expect(horizontals).toContain(80);      // dolna krawędź (20+60)
    expect(horizontals).toContain(50);      // środek Y (20+60/2)
  });

  it('wszystkie guidelines mają prawidłowe sourceId', () => {
    const img: ImageElement = { id: 'img1', type: 'image', x: 0, y: 0, width: 10, height: 10, src: '' };
    const guides = collectGuidelinesFromImages([img]);
    expect(guides.every(g => g.sourceId === 'img1')).toBe(true);
  });

  it('dwa obrazki → 12 guidelines', () => {
    const imgs: ImageElement[] = [
      { id: 'a', type: 'image', x: 0, y: 0, width: 10, height: 10, src: '' },
      { id: 'b', type: 'image', x: 20, y: 20, width: 10, height: 10, src: '' },
    ];
    const guides = collectGuidelinesFromImages(imgs);
    expect(guides).toHaveLength(12);
  });
});

// ─── snapToGuidelines ──────────────────────────────────────────────────────

const THRESHOLD = 0.15;

function makeGuides() {
  // Obrazek: x=5, y=10, w=4, h=6
  const img: ImageElement = { id: 'source', type: 'image', x: 5, y: 10, width: 4, height: 6, src: '' };
  return collectGuidelinesFromImages([img]);
}

describe('snapToGuidelines', () => {
  it('brak snap gdy odległość > SNAP_THRESHOLD (0.15)', () => {
    const guides = makeGuides();
    // guide pionowa: x=5. Przesunięty element: left=5.2 (>0.15 od guide)
    const result = snapToGuidelines(5.2, 100, 1, 1, guides);
    expect(result.snappedX).toBe(false);
    expect(result.x).toBeCloseTo(5.2);
  });

  it('snap lewej krawędzi elementu do guide pionowej', () => {
    const guides = makeGuides(); // guide vertical: x=5
    // element z lewą krawędzią 5.1 (< 0.15 od guide x=5)
    const result = snapToGuidelines(5.1, 100, 1, 1, guides);
    expect(result.snappedX).toBe(true);
    expect(result.x).toBeCloseTo(5); // adjustedX = guide.value
  });

  it('snap prawej krawędzi elementu do guide pionowej', () => {
    const guides = makeGuides(); // guide vertical: x=9 (5+4)
    // element z prawą krawędzią 9.1, width=2 → x=7.1
    const result = snapToGuidelines(7.1, 100, 2, 1, guides);
    // right = 7.1+2 = 9.1, odległość od guide 9 = 0.1 < 0.15
    expect(result.snappedX).toBe(true);
    expect(result.x).toBeCloseTo(9 - 2); // adjustedX = guide.value - width
  });

  it('snap środka elementu do guide pionowej', () => {
    const guides = makeGuides(); // guide vertical: x=7 (środek: 5+4/2)
    // element: width=2, center=x+1. Center=7.1 → x=6.1
    const result = snapToGuidelines(6.1, 100, 2, 1, guides);
    // center = 6.1+1 = 7.1, odległość od guide 7 = 0.1 < 0.15
    expect(result.snappedX).toBe(true);
    expect(result.x).toBeCloseTo(7 - 1); // adjustedX = guide.value - width/2
  });

  it('snap górnej krawędzi elementu do guide poziomej', () => {
    const guides = makeGuides(); // guide horizontal: y=10
    const result = snapToGuidelines(100, 10.1, 1, 1, guides);
    // top = 10.1, odległość od guide 10 = 0.1 < 0.15
    expect(result.snappedY).toBe(true);
    expect(result.y).toBeCloseTo(10);
  });

  it('snap dolnej krawędzi elementu do guide poziomej', () => {
    const guides = makeGuides(); // guide horizontal: y=16 (10+6)
    // element: height=2, bottom=16.1 → y=14.1
    const result = snapToGuidelines(100, 14.1, 1, 2, guides);
    // bottom = 14.1+2 = 16.1, odległość od guide 16 = 0.1 < 0.15
    expect(result.snappedY).toBe(true);
    expect(result.y).toBeCloseTo(16 - 2);
  });

  it('excludeIds zapobiega snap do własnych linii', () => {
    const guides = makeGuides(); // sourceId='source'
    const result = snapToGuidelines(5.05, 10.05, 1, 1, guides, ['source']);
    expect(result.snappedX).toBe(false);
    expect(result.snappedY).toBe(false);
  });

  it('jednoczesny snap X i Y — activeGuides zawiera obydwie linie', () => {
    const guides = makeGuides();
    // left ≈ 5, top ≈ 10 — oba w zasięgu snap
    const result = snapToGuidelines(5.05, 10.05, 1, 1, guides);
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
    expect(result.activeGuides).toHaveLength(2);
  });

  it('zwraca niezmienione x/y gdy brak snap', () => {
    const result = snapToGuidelines(100, 200, 1, 1, []);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    expect(result.snappedX).toBe(false);
    expect(result.snappedY).toBe(false);
    expect(result.activeGuides).toEqual([]);
  });
});
