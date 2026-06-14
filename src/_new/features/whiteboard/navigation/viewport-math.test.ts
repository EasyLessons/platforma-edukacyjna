import { describe, it, expect } from 'vitest';
import {
  transformPoint,
  inverseTransformPoint,
  panViewportWithMouse,
  panViewportWithWheel,
  zoomViewport,
  startMomentum,
  updateMomentum,
  isElementInViewport,
  computePathBbox,
} from './viewport-math';
import type { ViewportTransform, MomentumState } from '../types';
import type { DrawingPath } from '../types';

const W = 800;
const H = 600;

// ─── transformPoint / inverseTransformPoint ────────────────────────────────

describe('transformPoint', () => {
  it('punkt w centrum viewportu trafia na środek canvasu', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };
    const screen = transformPoint({ x: 0, y: 0 }, viewport, W, H);
    expect(screen.x).toBeCloseTo(W / 2);
    expect(screen.y).toBeCloseTo(H / 2);
  });

  it('przesuwa punkt proporcjonalnie do skali i przesunięcia viewportu', () => {
    const viewport: ViewportTransform = { x: 1, y: 2, scale: 1 };
    const screen = transformPoint({ x: 3, y: 4 }, viewport, W, H);
    // (3-1)*100 + 400 = 600
    expect(screen.x).toBeCloseTo(600);
    // (4-2)*100 + 300 = 500
    expect(screen.y).toBeCloseTo(500);
  });
});

describe('inverseTransformPoint', () => {
  it('jest odwrotnością transformPoint (round-trip) dla różnych skal', () => {
    const cases: ViewportTransform[] = [
      { x: 0, y: 0, scale: 1 },
      { x: 2, y: -1, scale: 1.5 },
      { x: -5, y: 3, scale: 0.1 },
      { x: 10, y: -10, scale: 5 },
    ];
    const point = { x: 3.7, y: -2.1 };

    for (const viewport of cases) {
      const screen = transformPoint(point, viewport, W, H);
      const back = inverseTransformPoint(screen, viewport, W, H);
      expect(back.x).toBeCloseTo(point.x, 10);
      expect(back.y).toBeCloseTo(point.y, 10);
    }
  });
});

// ─── panViewportWithMouse / panViewportWithWheel ───────────────────────────

describe('panViewportWithMouse', () => {
  it('przesuwa viewport w odwrotnym kierunku niż ruch myszy (drag)', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };
    const result = panViewportWithMouse(viewport, 100, 50);
    // dx=100 → x maleje (ciągniesz w prawo, tablica przesuwa się w lewo)
    expect(result.x).toBeLessThan(0);
    expect(result.y).toBeLessThan(0);
  });

  it('nie modyfikuje skali', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 2 };
    const result = panViewportWithMouse(viewport, 100, 0);
    expect(result.scale).toBe(2);
  });
});

describe('panViewportWithWheel', () => {
  it('przesuwa viewport w tym samym kierunku co scroll (wheel pan)', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };
    const result = panViewportWithWheel(viewport, 100, 50);
    // deltaX=100 → x rośnie
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
  });

  it('kierunek WHEEL jest odwrotny do kierunku MOUSE — celowa różnica', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };
    const mouse = panViewportWithMouse(viewport, 100, 0);
    const wheel = panViewportWithWheel(viewport, 100, 0);
    // mouse odejmuje, wheel dodaje — znaki powinny być przeciwne
    expect(Math.sign(mouse.x)).not.toBe(Math.sign(wheel.x));
  });
});

// ─── zoomViewport ──────────────────────────────────────────────────────────

describe('zoomViewport', () => {
  const center = { x: W / 2, y: H / 2 };

  it('ujemne deltaY zwiększa skalę (zoom in)', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };
    const result = zoomViewport(viewport, -1, center.x, center.y, W, H);
    expect(result.scale).toBeGreaterThan(1);
  });

  it('dodatnie deltaY zmniejsza skalę (zoom out)', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };
    const result = zoomViewport(viewport, 1, center.x, center.y, W, H);
    expect(result.scale).toBeLessThan(1);
  });

  it('clampuje skalę do maksimum 5.0', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 4.99 };
    const result = zoomViewport(viewport, -1, center.x, center.y, W, H);
    expect(result.scale).toBe(5.0);
  });

  it('clampuje skalę do minimum 0.1', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 0.101 };
    const result = zoomViewport(viewport, 1, center.x, center.y, W, H);
    expect(result.scale).toBe(0.1);
  });

  it('punkt pod kursorem pozostaje w tym samym miejscu ekranu po zoom', () => {
    const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };
    const mouseX = 300;
    const mouseY = 200;

    // pozycja w world-space przed zoomem
    const worldBefore = inverseTransformPoint({ x: mouseX, y: mouseY }, viewport, W, H);

    const zoomed = zoomViewport(viewport, -1, mouseX, mouseY, W, H);

    // ta sama pozycja world powinna dać te same screen coords po zoom
    const screenAfter = transformPoint(worldBefore, zoomed, W, H);
    expect(screenAfter.x).toBeCloseTo(mouseX, 8);
    expect(screenAfter.y).toBeCloseTo(mouseY, 8);
  });
});

// ─── startMomentum ─────────────────────────────────────────────────────────

describe('startMomentum', () => {
  it('ustawia isActive: true', () => {
    const m = startMomentum(0.5, 0);
    expect(m.isActive).toBe(true);
  });

  it('nie zmienia prędkości gdy poniżej limitu', () => {
    const m = startMomentum(0.5, 0);
    expect(m.velocityX).toBeCloseTo(0.5);
    expect(m.velocityY).toBeCloseTo(0);
  });

  it('normalizuje wektory prędkości przekraczające MAX_MOMENTUM_VELOCITY=1', () => {
    // wektor (3,4) ma długość 5 → po normalizacji (0.6, 0.8)
    const m = startMomentum(3, 4);
    expect(m.velocityX).toBeCloseTo(0.6);
    expect(m.velocityY).toBeCloseTo(0.8);
  });

  it('normalizuje wektory wzdłuż jednej osi', () => {
    const m = startMomentum(10, 0);
    expect(m.velocityX).toBeCloseTo(1);
    expect(m.velocityY).toBeCloseTo(0);
  });
});

// ─── updateMomentum ────────────────────────────────────────────────────────

describe('updateMomentum', () => {
  const base: MomentumState = {
    velocityX: 0.5,
    velocityY: 0,
    isActive: true,
    lastTimestamp: 1000,
  };

  it('gdy isActive=false zwraca viewport: null i nie zmienia stanu', () => {
    const inactive = { ...base, isActive: false };
    const result = updateMomentum(inactive, 1016);
    expect(result.viewport).toBeNull();
    expect(result.momentum.isActive).toBe(false);
  });

  it('prędkość maleje o czynnik tarcia po jednej klatce (deltaTime=1)', () => {
    const result = updateMomentum(base, 1016); // 1000 + 16ms = deltaTime 1
    // nowa prędkość = 0.5 * 0.9^1
    expect(result.momentum.velocityX).toBeCloseTo(0.5 * 0.9, 10);
  });

  it('zwraca przesunięcie viewportu proporcjonalne do prędkości', () => {
    const result = updateMomentum(base, 1016);
    expect(result.viewport).not.toBeNull();
    expect(result.viewport!.x).toBeGreaterThan(0);
    expect(result.viewport!.y).toBeCloseTo(0);
  });

  it('deaktywuje momentum gdy prędkość spada poniżej progu', () => {
    const slow: MomentumState = { ...base, velocityX: 0.0005, velocityY: 0 };
    const result = updateMomentum(slow, 1016);
    expect(result.momentum.isActive).toBe(false);
    expect(result.viewport).toBeNull();
  });
});

// ─── isElementInViewport ───────────────────────────────────────────────────

describe('isElementInViewport', () => {
  const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };

  it('element w centrum canvasu jest widoczny', () => {
    expect(isElementInViewport(0, 0, 1, 1, viewport, W, H)).toBe(true);
  });

  it('element o > 100px (domyślny margin) poza prawą krawędzią jest niewidoczny', () => {
    // przy scale=1, 100px = 1 jednostka tablicy, canvas ma W=800px
    // prawy screen-edge to W=800, element w world x=5 daje screen ~900
    // element 800+101 pikseli od centrum ekranu to ~10 jednostek (z marginesem)
    // Obliczamy: transformPoint({x, y}, vp, 800, 600).x > 800 + 100
    // screen.x = (x - 0) * 100 + 400; screen.x > 900 → x > 5
    // element ma width=1, więc bottom-right screen.x = (5+1)*100+400 = 1000 (a top-left=900)
    // Warunek: topLeft.x > canvasWidth + margin → 900 > 900 → FALSE
    // Niech x=6: topLeft.screen.x = 6*100+400 = 1000 > 900 → TRUE (poza)
    expect(isElementInViewport(6, 0, 1, 1, viewport, W, H)).toBe(false);
  });

  it('element z marginesem 50px w granicach jest widoczny', () => {
    // element tuż za krawędzią canvasu ale w marginesie
    // top-left screen: (5.4)*100+400 = 940; canvasWidth+margin(50)=850 → 940>850 → false
    expect(isElementInViewport(5.4, 0, 1, 1, viewport, W, H, 50)).toBe(false);
    // element bliżej: x=4.5 → top-left=850 → NIE jest > 850 → widoczny
    expect(isElementInViewport(4.5, 0, 1, 1, viewport, W, H, 50)).toBe(true);
  });
});

// ─── computePathBbox ───────────────────────────────────────────────────────

describe('computePathBbox', () => {
  const makePath = (points: Array<{ x: number; y: number }>): DrawingPath => ({
    id: 'test',
    type: 'path',
    points,
    color: '#000',
    width: 1,
  });

  it('zwraca {0,0,0,0} dla pustej ścieżki', () => {
    const bbox = computePathBbox(makePath([]));
    expect(bbox).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('pojedynczy punkt: minX === maxX === punkt.x', () => {
    const bbox = computePathBbox(makePath([{ x: 3, y: 7 }]));
    expect(bbox.minX).toBe(3);
    expect(bbox.maxX).toBe(3);
    expect(bbox.minY).toBe(7);
    expect(bbox.maxY).toBe(7);
  });

  it('zwraca poprawne min/max dla wielu punktów', () => {
    const points = [
      { x: 1, y: 5 },
      { x: -3, y: 10 },
      { x: 7, y: 2 },
      { x: 0, y: 0 },
    ];
    const bbox = computePathBbox(makePath(points));
    expect(bbox.minX).toBe(-3);
    expect(bbox.maxX).toBe(7);
    expect(bbox.minY).toBe(0);
    expect(bbox.maxY).toBe(10);
  });
});
