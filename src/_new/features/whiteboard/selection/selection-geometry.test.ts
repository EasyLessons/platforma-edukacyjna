/**
 * Testy czystych funkcji zaznaczenia (hit-testing, handles, transform-math).
 * Semantyka = 1:1 z select-tool.tsx sprzed wyciecia (PR-C6); te testy sa
 * siatka bezpieczenstwa dla PR-a przepinajacego komponent na te moduly.
 */
import { describe, it, expect } from 'vitest';
import type {
  DrawingElement,
  DrawingPath,
  ImageElement,
  Shape,
  TextElement,
  ViewportTransform,
} from '../types';
import {
  rectanglesIntersect,
  rotatedRectCorners,
  rotatedRectIntersects,
  isPointInBoundingBox,
  isPointInElement,
  findTopmostElementAt,
  distancePointToSegment,
  distancePointToPolyline,
  lineHitTolerance,
  MIN_LINE_HIT_PX,
  selectionRectFromPoints,
  elementIntersectsSelectionRect,
  getElementIdsInSelectionRect,
} from './hit-testing';
import {
  supportsSideResize,
  unionBoundingBox,
  selectionBoundingBox,
  previewBoundingBox,
  boundsOfPoints,
  worldBoxToScreenRect,
  resizeHandlePositions,
  getResizeHandleAt,
  rotationHandlePosition,
  snapshotElements,
  RESIZE_HANDLE_SIZE,
  ROTATION_HANDLE_OFFSET,
} from './handles';
import {
  MIN_SIZE,
  resizePivot,
  computeCornerResize,
  computeSideResize,
  filterGuidelines,
  acceptsSideResize,
  computeDragSnap,
  normalizeAngle,
  averageRotation,
  computeRotationAngle,
  angleFromPivot,
  normalizedShapeCoords,
} from './transform-math';
import type { GuideLine } from './snap-utils';

// ── fixtures ────────────────────────────────────────────────────────────────

const shape = (id: string, sx: number, sy: number, ex: number, ey: number): Shape => ({
  id,
  type: 'shape',
  shapeType: 'rectangle',
  startX: sx,
  startY: sy,
  endX: ex,
  endY: ey,
  color: '#000',
  strokeWidth: 1,
  fill: false,
});
const text = (id: string, x: number, y: number, extra: Partial<TextElement> = {}): TextElement => ({
  id,
  type: 'text',
  x,
  y,
  text: 't',
  fontSize: 16,
  color: '#000',
  ...extra,
});
const image = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation?: number
): ImageElement => ({
  id,
  type: 'image',
  x,
  y,
  width: w,
  height: h,
  src: 'x',
  rotation,
});
const path = (id: string, points: { x: number; y: number }[]): DrawingPath => ({
  id,
  type: 'path',
  points,
  color: '#000',
  width: 1,
});
const identityViewport: ViewportTransform = { x: 0, y: 0, scale: 1 } as ViewportTransform;

// ── hit-testing ─────────────────────────────────────────────────────────────

describe('hit-testing', () => {
  it('rectanglesIntersect: rozlaczne, stykajace sie krawedzia, nachodzace', () => {
    expect(rectanglesIntersect(0, 0, 1, 1, 2, 2, 1, 1)).toBe(false);
    expect(rectanglesIntersect(0, 0, 1, 1, 1, 0, 1, 1)).toBe(true); // krawedz = przecina
    expect(rectanglesIntersect(0, 0, 2, 2, 1, 1, 2, 2)).toBe(true);
  });

  it('rotatedRectCorners: obrot o 90 stopni zamienia szerokosc z wysokoscia', () => {
    const c = rotatedRectCorners(0, 0, 4, 2, Math.PI / 2);
    const xs = c.map((p) => Math.round(p.x * 1000) / 1000);
    const ys = c.map((p) => Math.round(p.y * 1000) / 1000);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(4);
  });

  it('rotatedRectIntersects: naroznik w ramce / srodek ramki w elemencie / brak', () => {
    // element 4x2 obrocony o 45 stopni wokol (2,1); naroznik (0,0) laduje w ~(1.29,-1.12)
    expect(rotatedRectIntersects(0.5, -2, 2, 1.5, 0, 0, 4, 2, Math.PI / 4)).toBe(true);
    // ta sama ramka przesunieta w lewo (x -1..1) juz naroznika nie lapie
    expect(rotatedRectIntersects(-1, -2, 2, 1.5, 0, 0, 4, 2, Math.PI / 4)).toBe(false);
    // mala ramka dokladnie w srodku elementu
    expect(rotatedRectIntersects(1.9, 0.9, 0.2, 0.2, 0, 0, 4, 2, Math.PI / 4)).toBe(true);
    // daleko
    expect(rotatedRectIntersects(10, 10, 1, 1, 0, 0, 4, 2, Math.PI / 4)).toBe(false);
  });

  it('isPointInBoundingBox: krawedzie wlacznie', () => {
    const bbox = { x: 0, y: 0, width: 2, height: 2 };
    expect(isPointInBoundingBox({ x: 2, y: 2 }, bbox)).toBe(true);
    expect(isPointInBoundingBox({ x: 2.01, y: 1 }, bbox)).toBe(false);
  });

  it('isPointInElement deleguje do handlera; nieznany typ = false', () => {
    expect(isPointInElement({ x: 1, y: 1 }, shape('s', 0, 0, 2, 2))).toBe(true);
    expect(isPointInElement({ x: 5, y: 5 }, shape('s', 0, 0, 2, 2))).toBe(false);
    expect(
      isPointInElement({ x: 0, y: 0 }, { id: 'x', type: 'unknown' } as unknown as DrawingElement)
    ).toBe(false);
  });

  it('findTopmostElementAt: przy kilku trafieniach wygrywa ostatni z tablicy (najwyzej)', () => {
    const a = shape('a', 0, 0, 2, 2);
    const b = shape('b', 0, 0, 2, 2);
    expect(findTopmostElementAt({ x: 1, y: 1 }, [a, b])?.id).toBe('b');
    expect(findTopmostElementAt({ x: 1, y: 1 }, [b, a])?.id).toBe('a');
    expect(findTopmostElementAt({ x: 9, y: 9 }, [a, b])).toBeNull();
  });

  it('distancePointToSegment: rzut na odcinek, poza koncami - odleglosc do konca, odcinek zdegenerowany', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(distancePointToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3);
    expect(distancePointToSegment({ x: 14, y: 3 }, a, b)).toBeCloseTo(5); // do (10,0)
    expect(distancePointToSegment({ x: -3, y: 4 }, a, b)).toBeCloseTo(5); // do (0,0)
    expect(distancePointToSegment({ x: 3, y: 4 }, a, a)).toBeCloseTo(5);
  });

  it('distancePointToPolyline: minimum po odcinkach; jeden punkt = kropka; pusta = Infinity', () => {
    const poly = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(distancePointToPolyline({ x: 12, y: 5 }, poly)).toBeCloseTo(2);
    expect(distancePointToPolyline({ x: 3, y: 4 }, [{ x: 0, y: 0 }])).toBeCloseTo(5);
    expect(distancePointToPolyline({ x: 0, y: 0 }, [])).toBe(Infinity);
  });

  it('lineHitTolerance: max(polowa grubosci, 4 px) przeliczone na jednostki swiata wg zoomu', () => {
    // zoom 1: 100 px = 1 jednostka; kreska 2 px -> polowa 1 px < 4 px -> 0.04
    expect(lineHitTolerance(2, 1)).toBeCloseTo(MIN_LINE_HIT_PX / 100);
    // gruba kreska 20 px -> polowa 10 px -> 0.1
    expect(lineHitTolerance(20, 1)).toBeCloseTo(0.1);
    // zoom 2: te same 4 px ekranu to o polowe mniej jednostek swiata
    expect(lineHitTolerance(2, 2)).toBeCloseTo(MIN_LINE_HIT_PX / 200);
    // zoom 0.5: cienka kreska - 4 px ekranu = 0.08 jednostki
    expect(lineHitTolerance(2, 0.5)).toBeCloseTo(0.08);
    expect(lineHitTolerance(2, 0)).toBeCloseTo(lineHitTolerance(2, 1)); // zoom 0 -> jak 1
  });

  it('path: trafienie zalezy od zoomu (te same 4 px ekranu)', () => {
    const p = path('p', [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    // 0.03 jednostki od kreski = 3 px przy zoom 1 (trafia), 1.5 px przy zoom 0.5 (trafia),
    // 6 px przy zoom 2 (nie trafia)
    expect(isPointInElement({ x: 0.5, y: 0.03 }, p, 1)).toBe(true);
    expect(isPointInElement({ x: 0.5, y: 0.03 }, p, 0.5)).toBe(true);
    expect(isPointInElement({ x: 0.5, y: 0.03 }, p, 2)).toBe(false);
  });

  it('path: pressure-sensitive widths poszerzaja trafienie; jeden punkt = kropka; pusta = brak', () => {
    const thin = path('t', [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const thick: DrawingPath = { ...thin, widths: [30, 30] }; // polowa 15 px = 0.15
    expect(isPointInElement({ x: 0.5, y: 0.1 }, thin)).toBe(false);
    expect(isPointInElement({ x: 0.5, y: 0.1 }, thick)).toBe(true);
    expect(isPointInElement({ x: 0.02, y: 0.02 }, path('d', [{ x: 0, y: 0 }]))).toBe(true);
    expect(isPointInElement({ x: 0, y: 0 }, path('e', []))).toBe(false);
  });

  it('shape line/arrow: po odleglosci od odcinka, nie po bbox; strzalka takze po grocie', () => {
    const line: Shape = { ...shape('l', 0, 0, 2, 2), shapeType: 'line', strokeWidth: 2 };
    expect(isPointInElement({ x: 1, y: 1 }, line)).toBe(true); // na przekatnej
    expect(isPointInElement({ x: 1.5, y: 0.5 }, line)).toBe(false); // w bbox, daleko od kreski
    expect(isPointInElement({ x: 1, y: 1.03 }, line)).toBe(true); // ~2 px od kreski

    const arrow: Shape = { ...line, id: 'a', shapeType: 'arrow' };
    expect(isPointInElement({ x: 1.5, y: 0.5 }, arrow)).toBe(false);
    // grot: 15 px = 0.15 jednostki od konca (2,2), ramie pod katem 45-30 = 15 stopni od osi X
    // (w strone startu): koniec ramienia ~ (2 - 0.15*cos15, 2 - 0.15*sin15) = (1.855, 1.961)
    expect(isPointInElement({ x: 1.86, y: 1.96 }, arrow)).toBe(true);
    expect(isPointInElement({ x: 1.86, y: 1.96 }, line)).toBe(false); // linia bez grotu

    // prostokat/kolo: nadal wnetrze po bbox (bez zmian)
    expect(isPointInElement({ x: 1.5, y: 0.5 }, shape('r', 0, 0, 2, 2))).toBe(true);
  });

  it('REGRESJA ramka (marquee): sciezka nadal wpada po bbox (podglad) i po punktach (final)', () => {
    // kolko o promieniu 1; ramka w srodku, daleko od kreski i bez zadnego punktu
    const c = path(
      'c',
      Array.from({ length: 33 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2;
        return { x: Math.cos(a), y: Math.sin(a) };
      })
    );
    const inside = { minX: -0.2, minY: -0.2, maxX: 0.2, maxY: 0.2 };
    expect(elementIntersectsSelectionRect(c, inside, 'bbox')).toBe(true);
    expect(elementIntersectsSelectionRect(c, inside, 'points')).toBe(false);
    // ramka lapiaca fragment kreski: oba tryby
    const onStroke = { minX: 0.9, minY: -0.1, maxX: 1.1, maxY: 0.1 };
    expect(elementIntersectsSelectionRect(c, onStroke, 'bbox')).toBe(true);
    expect(elementIntersectsSelectionRect(c, onStroke, 'points')).toBe(true);
    expect([...getElementIdsInSelectionRect([c], inside, 'bbox')]).toEqual(['c']);
    expect([...getElementIdsInSelectionRect([c], inside, 'points')]).toEqual([]);
  });

  describe('trafienie w sciezke (path) - po odleglosci od kreski, nie po bbox', () => {
    /** Kolko z dlugopisu: 32 punkty na obwodzie o promieniu r wokol (cx, cy). */
    const circle = (id: string, cx: number, cy: number, r: number): DrawingPath =>
      path(
        id,
        Array.from({ length: 33 }, (_, i) => {
          const a = (i / 32) * Math.PI * 2;
          return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
        })
      );

    it('srodek kolka (wewnatrz bbox, daleko od kreski) NIE jest trafieniem', () => {
      expect(isPointInElement({ x: 0, y: 0 }, circle('c', 0, 0, 1))).toBe(false);
    });

    it('punkt na kresce kolka jest trafieniem', () => {
      expect(isPointInElement({ x: 1, y: 0 }, circle('c', 0, 0, 1))).toBe(true);
    });

    it('prostokat w srodku kolka narysowany wczesniej: klik w srodek trafia w prostokat', () => {
      const inner = shape('rect', -0.2, -0.2, 0.2, 0.2);
      const c = circle('circle', 0, 0, 1);
      expect(findTopmostElementAt({ x: 0, y: 0 }, [inner, c])?.id).toBe('rect');
    });
  });

  it('selectionRectFromPoints normalizuje rogi', () => {
    expect(selectionRectFromPoints({ x: 5, y: 1 }, { x: 1, y: 5 })).toEqual({
      minX: 1,
      maxX: 5,
      minY: 1,
      maxY: 5,
    });
  });

  it('elementIntersectsSelectionRect: shape/text(domyslne 3x1)/image/markdown', () => {
    const rect = { minX: 0, minY: 0, maxX: 5, maxY: 5 };
    expect(elementIntersectsSelectionRect(shape('s', 9, 9, 3, 3), rect, 'bbox')).toBe(true); // odwrocone rogi
    expect(elementIntersectsSelectionRect(text('t', 4, 4), rect, 'bbox')).toBe(true); // 3x1 od (4,4)
    expect(elementIntersectsSelectionRect(text('t', 6, 6), rect, 'bbox')).toBe(false);
    expect(elementIntersectsSelectionRect(image('i', 4.5, 4.5, 2, 2), rect, 'bbox')).toBe(true);
    expect(
      elementIntersectsSelectionRect(
        { id: 'm', type: 'markdown', x: 6, y: 0, width: 1, height: 1 } as unknown as DrawingElement,
        rect,
        'bbox'
      )
    ).toBe(false);
  });

  it('elementIntersectsSelectionRect: obrocony tekst uzywa heurystyki rotacji', () => {
    // tekst 3x1 w (0,0) obrocony o 90 stopni siega w pionie do ~2.0 - ramka pod nim go lapie
    const rect = { minX: 1, minY: 1.6, maxX: 2, maxY: 3 };
    expect(
      elementIntersectsSelectionRect(text('t', 0, 0, { rotation: Math.PI / 2 }), rect, 'bbox')
    ).toBe(true);
    expect(elementIntersectsSelectionRect(text('t', 0, 0), rect, 'bbox')).toBe(false);
  });

  it('path: tryb bbox vs points roznia sie dla ramki miedzy punktami', () => {
    const p = path('p', [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
    const between = { minX: 4, minY: 6, maxX: 6, maxY: 8 }; // w bbox, ale bez zadnego punktu
    expect(elementIntersectsSelectionRect(p, between, 'bbox')).toBe(true);
    expect(elementIntersectsSelectionRect(p, between, 'points')).toBe(false);
    expect(
      elementIntersectsSelectionRect(p, { minX: 9, minY: 9, maxX: 11, maxY: 11 }, 'points')
    ).toBe(true);
  });

  it('getElementIdsInSelectionRect zbiera id', () => {
    const ids = getElementIdsInSelectionRect(
      [shape('a', 0, 0, 1, 1), shape('b', 8, 8, 9, 9), text('c', 0.5, 0.5)],
      { minX: 0, minY: 0, maxX: 2, maxY: 2 },
      'points'
    );
    expect([...ids].sort()).toEqual(['a', 'c']);
  });
});

// ── handles ─────────────────────────────────────────────────────────────────

describe('handles', () => {
  it('supportsSideResize: tylko text/markdown/image/table', () => {
    expect(supportsSideResize([text('t', 0, 0), image('i', 0, 0, 1, 1)])).toBe(true);
    expect(supportsSideResize([text('t', 0, 0), shape('s', 0, 0, 1, 1)])).toBe(false);
    expect(supportsSideResize([])).toBe(true); // every na pustej = true (jak w oryginale)
  });

  it('unionBoundingBox / selectionBoundingBox', () => {
    const els = [shape('a', 0, 0, 2, 2), image('b', 3, 3, 1, 1)];
    expect(unionBoundingBox(els)).toEqual({ x: 0, y: 0, width: 4, height: 4 });
    expect(selectionBoundingBox(els, new Set(['b']))).toEqual({ x: 3, y: 3, width: 1, height: 1 });
    expect(selectionBoundingBox(els, new Set())).toBeNull();
    expect(selectionBoundingBox(els, new Set(['zzz']))).toBeNull();
  });

  it('previewBoundingBox: shape z odwroconymi rogami, text domyslny 3x1, obrocony obrazek, path', () => {
    expect(previewBoundingBox(shape('s', 4, 4, 1, 1))).toEqual({ x: 1, y: 1, width: 3, height: 3 });
    expect(previewBoundingBox(text('t', 2, 2))).toEqual({ x: 2, y: 2, width: 3, height: 1 });
    const rot = previewBoundingBox(image('i', 0, 0, 4, 2, Math.PI / 2))!;
    expect(rot.width).toBeCloseTo(2);
    expect(rot.height).toBeCloseTo(4);
    expect(
      previewBoundingBox(
        path('p', [
          { x: 1, y: 5 },
          { x: 3, y: 2 },
        ])
      )
    ).toEqual({
      x: 1,
      y: 2,
      width: 2,
      height: 3,
    });
    expect(
      previewBoundingBox({ id: 'f', type: 'function' } as unknown as DrawingElement)
    ).toBeNull();
  });

  it('boundsOfPoints', () => {
    expect(
      boundsOfPoints([
        { x: -1, y: 2 },
        { x: 3, y: -4 },
      ])
    ).toEqual({ x: -1, y: -4, width: 4, height: 6 });
  });

  it('worldBoxToScreenRect przy viewport identycznosciowym', () => {
    const rect = worldBoxToScreenRect(
      { x: 1, y: 2, width: 3, height: 4 },
      identityViewport,
      100,
      100
    );
    expect(rect.width).toBeCloseTo(3 * (rect.width / 3));
    expect(rect.height / rect.width).toBeCloseTo(4 / 3);
  });

  it('resizeHandlePositions: 4 rogi, +2 boki gdy dozwolone; kursory jak w oryginale', () => {
    const screen = { left: 10, top: 20, width: 100, height: 50 };
    const four = resizeHandlePositions(screen, false);
    expect(four.map((h) => h.pos)).toEqual(['nw', 'ne', 'se', 'sw']);
    expect(four[2]).toEqual({ pos: 'se', x: 110, y: 70, cursor: 'nwse-resize' });
    const six = resizeHandlePositions(screen, true);
    expect(six.slice(4)).toEqual([
      { pos: 'e', x: 110, y: 45, cursor: 'ew-resize' },
      { pos: 'w', x: 10, y: 45, cursor: 'ew-resize' },
    ]);
  });

  it('getResizeHandleAt: trafia w rog w promieniu RESIZE_HANDLE_SIZE, boki tylko gdy dozwolone', () => {
    const bbox = { x: 0, y: 0, width: 4, height: 2 };
    const screen = worldBoxToScreenRect(bbox, identityViewport, 200, 200);
    const near = (x: number, y: number) => ({ x: x + RESIZE_HANDLE_SIZE * 0.5, y });
    expect(
      getResizeHandleAt(near(screen.left, screen.top), bbox, identityViewport, 200, 200, false)
    ).toBe('nw');
    const eastMid = { x: screen.left + screen.width, y: screen.top + screen.height / 2 };
    expect(getResizeHandleAt(eastMid, bbox, identityViewport, 200, 200, false)).toBeNull();
    expect(getResizeHandleAt(eastMid, bbox, identityViewport, 200, 200, true)).toBe('e');
    expect(
      getResizeHandleAt({ x: -999, y: -999 }, bbox, identityViewport, 200, 200, true)
    ).toBeNull();
  });

  it('rotationHandlePosition: na przekatnej NW, ROTATION_HANDLE_OFFSET dalej od srodka', () => {
    const screen = { left: 0, top: 0, width: 60, height: 80 };
    const p = rotationHandlePosition(screen);
    const cx = 30;
    const cy = 40;
    const dist = Math.hypot(p.x - cx, p.y - cy);
    expect(dist).toBeCloseTo(50 + ROTATION_HANDLE_OFFSET);
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBeLessThan(0);
  });

  it('snapshotElements kopiuje tylko zaznaczone (plytka kopia)', () => {
    const a = shape('a', 0, 0, 1, 1);
    const snap = snapshotElements([a, shape('b', 0, 0, 1, 1)], new Set(['a']));
    expect([...snap.keys()]).toEqual(['a']);
    expect(snap.get('a')).toEqual(a);
    expect(snap.get('a')).not.toBe(a);
  });
});

// ── transform-math ──────────────────────────────────────────────────────────

describe('transform-math', () => {
  const box = { x: 10, y: 10, width: 4, height: 2 };

  it('resizePivot to przeciwlegly rog oryginalu', () => {
    expect(resizePivot('se', box)).toEqual({ x: 10, y: 10 });
    expect(resizePivot('sw', box)).toEqual({ x: 14, y: 10 });
    expect(resizePivot('ne', box)).toEqual({ x: 10, y: 12 });
    expect(resizePivot('nw', box)).toEqual({ x: 14, y: 12 });
    expect(resizePivot(null, box)).toEqual({ x: 10, y: 10 });
  });

  it('computeCornerResize se: proporcje 2:1 zachowane, skale wzgledem oryginalu', () => {
    const r = computeCornerResize('se', box, 18, 99, []);
    expect(r.box).toEqual({ x: 10, y: 10, width: 8, height: 4 });
    expect(r.scaleX).toBe(2);
    expect(r.scaleY).toBe(2);
    expect(r.pivot).toEqual({ x: 10, y: 10 });
    expect(r.activeGuides).toEqual([]);
  });

  it('computeCornerResize nw: rosnie w lewo/gore, MIN_SIZE gdy przeciagniemy za daleko', () => {
    const r = computeCornerResize('nw', box, 12, 0, []);
    expect(r.box.x + r.box.width).toBeCloseTo(14);
    expect(r.box.y + r.box.height).toBeCloseTo(12);
    expect(r.box.width).toBe(2);
    const tiny = computeCornerResize('nw', box, 100, 0, []);
    expect(tiny.box.width).toBe(MIN_SIZE);
  });

  it('computeCornerResize sw/ne: snap prawej/lewej krawedzi do prowadnicy pionowej', () => {
    const guide: GuideLine = { value: 18.05, orientation: 'vertical', sourceId: 'img' };
    const se = computeCornerResize('se', box, 18, 0, [guide]);
    expect(se.box.width).toBeCloseTo(8.05);
    expect(se.activeGuides).toEqual([guide]);
    const swGuide: GuideLine = { value: 11.95, orientation: 'vertical', sourceId: 'img' };
    const sw = computeCornerResize('sw', box, 12, 0, [swGuide]);
    expect(sw.box.x).toBeCloseTo(11.95);
    expect(sw.box.x + sw.box.width).toBeCloseTo(14);
  });

  it('computeCornerResize: snap dolnej krawedzi (horizontal) nadpisuje wysokosc i szerokosc', () => {
    const guide: GuideLine = { value: 14.05, orientation: 'horizontal', sourceId: 'img' };
    const r = computeCornerResize('se', box, 18, 0, [guide]); // bez snapu bottom = 14
    expect(r.box.height).toBeCloseTo(4.05);
    expect(r.box.width).toBeCloseTo(8.1);
    expect(r.activeGuides).toEqual([guide]);
  });

  it('computeSideResize: e rozciaga w prawo, w rosnie w lewo, MIN_SIZE', () => {
    expect(computeSideResize('e', box, 20)).toEqual({ x: 10, width: 10 });
    expect(computeSideResize('w', box, 8)).toEqual({ x: 8, width: 6 });
    expect(computeSideResize('w', box, 99)).toEqual({ x: 14 - MIN_SIZE, width: MIN_SIZE });
  });

  it('filterGuidelines i acceptsSideResize', () => {
    const g = (id: string): GuideLine => ({ value: 0, orientation: 'vertical', sourceId: id });
    expect(filterGuidelines([g('a'), g('b')], ['a']).map((x) => x.sourceId)).toEqual(['b']);
    expect(acceptsSideResize(text('t', 0, 0))).toBe(true);
    expect(acceptsSideResize(shape('s', 0, 0, 1, 1))).toBe(false);
  });

  it('computeDragSnap: pusta grupa = bez zmian; snap lewej krawedzi do prowadnicy', () => {
    expect(computeDragSnap(new Map(), 3, 4, [])).toEqual({ dx: 3, dy: 4, activeGuides: [] });
    const dragged = new Map<string, DrawingElement>([['s', shape('s', 0, 0, 2, 2)]]);
    const guide: GuideLine = { value: 5.05, orientation: 'vertical', sourceId: 'img' };
    const r = computeDragSnap(dragged, 5, 0, [guide]);
    expect(r.dx).toBeCloseTo(5.05);
    expect(r.dy).toBe(0);
    expect(r.activeGuides.length).toBeGreaterThan(0);
  });

  it('normalizeAngle / averageRotation', () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(
      averageRotation([image('a', 0, 0, 1, 1, 1), image('b', 0, 0, 1, 1, 3), path('p', [])])
    ).toBe(2);
    expect(averageRotation([path('p', [])])).toBe(0);
  });

  it('computeRotationAngle: snap do osi w granicach 5 stopni, poza - dokladny kat', () => {
    const pivot = { x: 0, y: 0 };
    const start = angleFromPivot({ x: 1, y: 0 }, pivot); // 0
    const nearly90 = { x: Math.cos(1.53), y: Math.sin(1.53) }; // ~87.7 stopnia
    expect(computeRotationAngle(nearly90, pivot, start, [image('i', 0, 0, 1, 1, 0)])).toBeCloseTo(
      Math.PI / 2
    );
    const at60 = { x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) };
    expect(computeRotationAngle(at60, pivot, start, [image('i', 0, 0, 1, 1, 0)])).toBeCloseTo(
      Math.PI / 3
    );
  });

  it('computeRotationAngle uwzglednia srednia rotacje wyjsciowa przy snapie', () => {
    const pivot = { x: 0, y: 0 };
    const start = 0;
    const delta = 0.05; // ~2.9 stopnia
    const pointer = { x: Math.cos(delta), y: Math.sin(delta) };
    // element juz obrocony o ~88 stopni: 88 + 2.9 = ~91 -> snap do 90 -> delta = 90 - 88
    const original = image('i', 0, 0, 1, 1, Math.PI / 2 - 0.035);
    expect(computeRotationAngle(pointer, pivot, start, [original])).toBeCloseTo(0.035);
  });

  it('normalizedShapeCoords: null gdy juz znormalizowane, inaczej posortowane rogi', () => {
    expect(normalizedShapeCoords(shape('s', 0, 0, 2, 2))).toBeNull();
    expect(normalizedShapeCoords(shape('s', 2, 3, 0, 1))).toEqual({
      startX: 0,
      startY: 1,
      endX: 2,
      endY: 3,
    });
    expect(normalizedShapeCoords(text('t', 0, 0))).toBeNull();
  });
});
