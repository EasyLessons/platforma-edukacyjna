import { describe, it, expect } from 'vitest';
import { projectPointsToScreen, buildSvgPath } from './plot-geometry';

describe('projectPointsToScreen', () => {
  it('odwraca os Y i przelicza przez viewport (100px = 1 jednostka)', () => {
    const screen = projectPointsToScreen(
      [
        { x: 0, y: 0 },
        { x: 1, y: 2 },
      ],
      { x: 0, y: 0, scale: 1 },
      1000,
      800
    );
    expect(screen).toEqual([
      { x: 500, y: 400 },
      { x: 600, y: 200 },
    ]);
  });

  it('uwzglednia przesuniecie i skale viewportu', () => {
    const [p] = projectPointsToScreen([{ x: 1, y: 1 }], { x: 1, y: -1, scale: 2 }, 1000, 800);
    // x: (1 - 1) * 200 + 500 = 500; y: (-1 - (-1)) * 200 + 400 = 400
    expect(p).toEqual({ x: 500, y: 400 });
  });
});

describe('buildSvgPath', () => {
  it('null dla mniej niz dwoch punktow', () => {
    expect(buildSvgPath([])).toBeNull();
    expect(buildSvgPath([{ x: 1, y: 1 }])).toBeNull();
  });

  it('M dla pierwszego punktu, L dla kolejnych', () => {
    expect(
      buildSvgPath([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5.5, y: -6 },
      ])
    ).toBe('M 1 2 L 3 4 L 5.5 -6');
  });
});
