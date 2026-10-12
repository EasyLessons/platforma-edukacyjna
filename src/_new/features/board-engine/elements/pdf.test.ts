import { describe, expect, it } from 'vitest';
import {
  PAGE_GAP,
  PAGE_MAX_SIDE,
  PAGE_SCENE_WIDTH,
  layoutPages,
  pageScale,
  pagesLabel,
} from './pdf';

describe('pageScale', () => {
  it('dłuższy bok najwyżej PAGE_MAX_SIDE, bez powiększania ponad 2x', () => {
    expect(pageScale(595, 842) * 842).toBeCloseTo(PAGE_MAX_SIDE);
    expect(pageScale(842, 595) * 842).toBeCloseTo(PAGE_MAX_SIDE);
    expect(pageScale(100, 100)).toBe(2);
    expect(pageScale(0, 0)).toBe(1);
  });
});

describe('layoutPages', () => {
  it('kolumna wyśrodkowana, stała szerokość, wysokość wg proporcji, odstęp między stronami', () => {
    const slots = layoutPages(
      [
        { width: 100, height: 200 },
        { width: 100, height: 100 },
      ],
      { x: 0, y: 0 }
    );
    const h1 = PAGE_SCENE_WIDTH * 2;
    const h2 = PAGE_SCENE_WIDTH;
    const total = h1 + h2 + PAGE_GAP;
    expect(slots).toEqual([
      { x: -PAGE_SCENE_WIDTH / 2, y: -total / 2, width: PAGE_SCENE_WIDTH, height: h1 },
      {
        x: -PAGE_SCENE_WIDTH / 2,
        y: -total / 2 + h1 + PAGE_GAP,
        width: PAGE_SCENE_WIDTH,
        height: h2,
      },
    ]);
  });
});

describe('pagesLabel', () => {
  it('polska odmiana', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25].map(pagesLabel)).toEqual([
      '1 strona',
      '2 strony',
      '4 strony',
      '5 stron',
      '11 stron',
      '12 stron',
      '14 stron',
      '21 stron',
      '22 strony',
      '25 stron',
    ]);
  });
});
