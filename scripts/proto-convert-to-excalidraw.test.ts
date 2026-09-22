import { describe, it, expect } from 'vitest';
import { convertBoard } from './proto-convert-to-excalidraw';
import type { DrawingElement } from '@/_new/features/whiteboard/types/elements';

// `any`: elementy Excalidraw to unie readonly - w teście czytamy pola po typie
const byId = (els: { id: string }[], id: string): any => els.find((e) => e.id === id);

describe('convertBoard (szkic konwersji starej tablicy -> Excalidraw)', () => {
  it('path -> freedraw z punktami względem lewego-górnego rogu', () => {
    const input: DrawingElement[] = [
      {
        id: 'p1',
        type: 'path',
        color: '#ff0000',
        width: 3,
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 25 },
          { x: 50, y: 60 },
        ],
      },
    ];
    const { elements, skipped } = convertBoard(input);
    expect(skipped).toEqual([]);
    const fd = byId(elements, 'p1') as {
      type: string;
      x: number;
      y: number;
      points: number[][];
      strokeColor: string;
    };
    expect(fd.type).toBe('freedraw');
    expect(fd.x).toBe(10);
    expect(fd.y).toBe(20);
    expect(fd.points[0]).toEqual([0, 0]);
    expect(fd.points[2]).toEqual([40, 40]);
    expect(fd.strokeColor).toBe('#ff0000');
  });

  it('shape: rectangle/circle -> rectangle/ellipse, triangle -> zamknięta line', () => {
    const input: DrawingElement[] = [
      {
        id: 'r',
        type: 'shape',
        shapeType: 'rectangle',
        startX: 100,
        startY: 100,
        endX: 0,
        endY: 50,
        color: '#000',
        strokeWidth: 2,
        fill: true,
      },
      {
        id: 'c',
        type: 'shape',
        shapeType: 'circle',
        startX: 0,
        startY: 0,
        endX: 40,
        endY: 40,
        color: '#00f',
        strokeWidth: 1,
        fill: false,
      },
      {
        id: 't',
        type: 'shape',
        shapeType: 'triangle',
        startX: 0,
        startY: 0,
        endX: 30,
        endY: 60,
        color: '#0f0',
        strokeWidth: 1,
        fill: false,
      },
    ];
    const { elements } = convertBoard(input);
    const r = byId(elements, 'r') as {
      type: string;
      x: number;
      width: number;
      backgroundColor: string;
    };
    expect(r.type).toBe('rectangle');
    expect(r.x).toBe(0); // znormalizowane min(startX, endX)
    expect(r.width).toBe(100);
    expect(r.backgroundColor).toBe('#000');
    expect((byId(elements, 'c') as { type: string }).type).toBe('ellipse');
    const t = byId(elements, 't') as { type: string; points: number[][] };
    expect(t.type).toBe('line');
    expect(t.points).toHaveLength(4);
  });

  it('text + arrow z kontrolnymi punktami', () => {
    const input: DrawingElement[] = [
      {
        id: 'tx',
        type: 'text',
        x: 5,
        y: 5,
        text: 'zażółć gęślą jaźń',
        fontSize: 20,
        color: '#111',
      },
      {
        id: 'ar',
        type: 'arrow',
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 0,
        controlPoints: [{ x: 50, y: 30 }],
        color: '#222',
        strokeWidth: 2,
        arrowType: 'smooth',
        arrowHead: 'both',
      },
    ];
    const { elements } = convertBoard(input);
    const tx = byId(elements, 'tx') as { type: string; text: string; fontSize: number };
    expect(tx.type).toBe('text');
    expect(tx.text).toBe('zażółć gęślą jaźń');
    expect(tx.fontSize).toBe(20);
    const ar = byId(elements, 'ar') as {
      type: string;
      points: number[][];
      startArrowhead: string | null;
      endArrowhead: string | null;
    };
    expect(ar.type).toBe('arrow');
    // Excalidraw normalizuje punkty zaokrąglonej strzałki (pierwszy punkt przesuwa o ~0.5)
    expect(ar.points).toHaveLength(3);
    expect(ar.points[1]).toEqual([50, 30]);
    expect(Math.abs(ar.points[2][0] - 100)).toBeLessThanOrEqual(1);
    expect(Math.abs(ar.points[2][1])).toBeLessThanOrEqual(1);
    expect(ar.startArrowhead).toBe('arrow');
    expect(ar.endArrowhead).toBe('arrow');
  });

  it('table -> siatka prostokątów z etykietami w jednej grupie; function -> image SVG; pdf -> skipped', () => {
    const input: DrawingElement[] = [
      {
        id: 'tb',
        type: 'table',
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        rows: 2,
        cols: 2,
        cells: [
          ['a', 'b'],
          ['c', ''],
        ],
        headerRow: true,
      },
      {
        id: 'fn',
        type: 'function',
        expression: 'sin(x)',
        color: '#f00',
        strokeWidth: 2,
        xRange: 10,
        yRange: 10,
      },
      { id: 'pdf', type: 'pdf', x: 0, y: 0, width: 100, height: 100, src: 'https://x/y.pdf' },
    ];
    const { elements, files, skipped } = convertBoard(input);
    const cells = elements.filter((e) => e.id.startsWith('tb-c'));
    expect(cells).toHaveLength(4);
    expect(new Set(cells.map((c) => c.groupIds[0])).size).toBe(1);
    // 3 etykiety (jedna komórka pusta) jako związane elementy tekstowe
    expect(
      elements
        .filter((e) => e.type === 'text')
        .map((e) => (e as { text: string }).text)
        .sort()
    ).toEqual(['a', 'b', 'c']);
    const fn = byId(elements, 'fn') as {
      type: string;
      fileId: string;
      customData: { kind: string };
    };
    expect(fn.type).toBe('image');
    expect(fn.customData.kind).toBe('function');
    expect(files.find((f) => f.id === fn.fileId)?.mimeType).toBe('image/svg+xml');
    expect(skipped).toEqual([expect.objectContaining({ id: 'pdf', type: 'pdf' })]);
  });
});
