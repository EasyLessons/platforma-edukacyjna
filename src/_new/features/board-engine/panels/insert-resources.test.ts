import { describe, expect, it } from 'vitest';
import {
  RESOURCE_GAP,
  RESOURCE_WIDTH,
  layoutResources,
  resourceFileId,
  viewportCenter,
} from './insert-resources';

const square = { dimensions: { width: 100, height: 100 } };
const wide = { dimensions: { width: 200, height: 100 } };

describe('resourceFileId', () => {
  it('ta sama ścieżka = to samo id, inna ścieżka = inne id', () => {
    expect(resourceFileId('/resources/a.webp')).toBe(resourceFileId('/resources/a.webp'));
    expect(resourceFileId('/resources/a.webp')).not.toBe(resourceFileId('/resources/b.webp'));
    // wzór z manifestu = wspólny plik (odwołanie, bez uploadu); inna ścieżka = hash (upload)
    expect(resourceFileId('/resources/wzory/funkcja kwadratowa/delta.webp')).toBe(
      'tpl:resources/wzory/funkcja kwadratowa/delta.webp'
    );
    expect(resourceFileId('/inne/a.png')).toMatch(/^res-[0-9a-f]+$/);
  });
});

describe('viewportCenter', () => {
  it('uwzględnia przewinięcie i powiększenie', () => {
    expect(
      viewportCenter({
        scrollX: -100,
        scrollY: 50,
        width: 800,
        height: 600,
        zoom: { value: 2 } as never,
      })
    ).toEqual({ x: 300, y: 100 });
  });
});

describe('layoutResources', () => {
  it('jeden wzór na środku, wysokość wg proporcji', () => {
    const [slot] = layoutResources([wide], { x: 0, y: 0 });
    expect(slot).toEqual({
      x: -RESOURCE_WIDTH / 2,
      y: -RESOURCE_WIDTH / 4,
      width: RESOURCE_WIDTH,
      height: RESOURCE_WIDTH / 2,
    });
  });

  it('kilka wzorów w siatce 2 kolumn, wiersz ma wysokość najwyższego, całość wyśrodkowana', () => {
    const slots = layoutResources([wide, square, square], { x: 0, y: 0 });
    const rowGap = RESOURCE_WIDTH + RESOURCE_GAP;
    expect(slots.map((s) => s.x)).toEqual([
      -rowGap + RESOURCE_GAP / 2,
      RESOURCE_GAP / 2,
      -rowGap + RESOURCE_GAP / 2,
    ]);
    // wiersz 1: max(250, 500) = 500, wiersz 2: 500
    const totalHeight = 500 + RESOURCE_GAP + 500;
    expect(slots[0].y).toBe(-totalHeight / 2);
    expect(slots[1].y).toBe(-totalHeight / 2);
    expect(slots[2].y).toBe(-totalHeight / 2 + 500 + RESOURCE_GAP);
  });

  it('pusta lista i zerowe wymiary', () => {
    expect(layoutResources([], { x: 0, y: 0 })).toEqual([]);
    const [slot] = layoutResources([{ dimensions: { width: 0, height: 0 } }], { x: 0, y: 0 });
    expect(slot.height).toBe(RESOURCE_WIDTH);
  });
});
