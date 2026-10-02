import { describe, expect, it } from 'vitest';
import type { DrawingElement } from '../types';
import { generateElementsSvgThumbnail, thumbnailToDataUri } from './asset-helpers';

/** Payloady z audytu SEC-07 (stored XSS przez pola elementu). */
const XSS_PAYLOADS = [
  '"><img src=x onerror=alert(1)>',
  '"/><script>alert(1)</script><rect x="',
  '#000" onload="alert(1)',
  '"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror=alert(1)></body></foreignObject>',
  '"><a href="javascript:alert(1)">x</a>',
  'url(javascript:alert(1))',
  "red'/><svg onload=alert(1)>",
];

const ALLOWED_TAGS = new Set(['svg', 'path', 'rect', 'ellipse', 'polygon', 'line']);

/** Element udajacy poprawny typ, ale z dowolnymi (zlosliwymi) wartosciami pol. */
const hostile = (el: Record<string, unknown>) => el as unknown as DrawingElement;

function elementsWith(payload: string): DrawingElement[] {
  return [
    hostile({
      id: 'p',
      type: 'path',
      color: payload,
      strokeWidth: payload,
      points: [
        { x: 0, y: 0 },
        { x: payload, y: 10 },
        { x: 20, y: payload },
      ],
    }),
    hostile({
      id: 's',
      type: 'shape',
      shapeType: 'rectangle',
      color: payload,
      fill: true,
      strokeWidth: 2,
      startX: payload,
      startY: 0,
      endX: 50,
      endY: payload,
    }),
    hostile({
      id: 's2',
      type: 'shape',
      shapeType: 'arrow',
      color: payload,
      strokeWidth: 2,
      startX: 0,
      startY: payload,
      endX: payload,
      endY: 40,
    }),
    hostile({
      id: 'a',
      type: 'arrow',
      color: payload,
      strokeWidth: payload,
      startX: payload,
      startY: 0,
      endX: 30,
      endY: payload,
    }),
    hostile({
      id: 't',
      type: 'text',
      text: payload,
      color: payload,
      x: payload,
      y: 5,
      width: payload,
      height: payload,
      fontSize: payload,
    }),
    hostile({ id: 'i', type: 'image', x: 1, y: payload, width: payload, height: 10 }),
    hostile({ id: 'm', type: 'markdown', x: payload, y: 2, width: 10, height: payload }),
    hostile({ id: 'tb', type: 'table', x: 3, y: 3, width: payload, height: payload }),
  ];
}

function assertInertSvg(svg: string) {
  // 1) Poprawny XML zlozony wylacznie z dozwolonych znacznikow i bez atrybutow zdarzen.
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  const all = [doc.documentElement, ...Array.from(doc.documentElement.querySelectorAll('*'))];
  for (const node of all) {
    expect(ALLOWED_TAGS.has(node.localName)).toBe(true);
    for (const attr of Array.from(node.attributes)) {
      expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
      expect(attr.name.toLowerCase()).not.toContain('href');
      expect(attr.value.toLowerCase()).not.toContain('javascript:');
    }
  }

  // 2) Nawet gdyby ktos wstawil wynik jako HTML (stary sink), nie powstaje nic wykonywalnego.
  const host = document.createElement('div');
  host.innerHTML = svg;
  expect(host.querySelector('script, img, iframe, foreignObject, a, object, embed')).toBeNull();
  for (const node of Array.from(host.querySelectorAll('*'))) {
    for (const attr of Array.from(node.attributes)) {
      expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
    }
  }
}

describe('generateElementsSvgThumbnail (SEC-07)', () => {
  it.each(XSS_PAYLOADS)('nie przenosi payloadu do SVG: %s', (payload) => {
    const svg = generateElementsSvgThumbnail(elementsWith(payload));
    expect(svg).not.toContain(payload);
    expect(svg).not.toMatch(/onerror|onload|<script|foreignObject|javascript:/i);
    assertInertSvg(svg);
  });

  it('zachowuje poprawne kolory i liczby', () => {
    const svg = generateElementsSvgThumbnail([
      hostile({
        id: 's',
        type: 'shape',
        shapeType: 'rectangle',
        color: '#ff0000',
        fill: true,
        strokeWidth: 2,
        startX: 10,
        startY: 20,
        endX: 110,
        endY: 70,
      }),
      hostile({
        id: 'p',
        type: 'path',
        color: 'rgba(0, 128, 255, 0.5)',
        strokeWidth: 3,
        points: [
          { x: 0, y: 0 },
          { x: 5.5, y: 7.25 },
        ],
      }),
    ]);
    expect(svg).toContain('<rect x="10" y="20" width="100" height="50" fill="#ff0000"');
    expect(svg).toContain('stroke="rgba(0, 128, 255, 0.5)"');
    expect(svg).toContain('d="M 0,0 L 5.5,7.25"');
    assertInertSvg(svg);
  });

  it('niepoprawny kolor zastepuje domyslnym, a nieskonczone liczby zerem', () => {
    const svg = generateElementsSvgThumbnail([
      hostile({
        id: 's',
        type: 'shape',
        shapeType: 'line',
        color: 'expression(alert(1))',
        strokeWidth: Infinity,
        startX: NaN,
        startY: 0,
        endX: 10,
        endY: 10,
      }),
    ]);
    expect(svg).toContain('stroke="#333"');
    expect(svg).toContain('x1="0"');
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('pusta lista daje pusty string', () => {
    expect(generateElementsSvgThumbnail([])).toBe('');
  });
});

describe('thumbnailToDataUri (SEC-07)', () => {
  it('zwraca null dla braku miniatury i tresci innej niz SVG', () => {
    expect(thumbnailToDataUri(null)).toBeNull();
    expect(thumbnailToDataUri('')).toBeNull();
    expect(thumbnailToDataUri('<img src=x onerror=alert(1)>')).toBeNull();
    expect(thumbnailToDataUri('javascript:alert(1)')).toBeNull();
    expect(thumbnailToDataUri(123 as unknown as string)).toBeNull();
  });

  it('koduje SVG do data URI o stalym typie image/svg+xml', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const uri = thumbnailToDataUri(svg);
    expect(uri).not.toBeNull();
    expect(uri!.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    // Cala tresc jest percent-encoded - zadnych surowych znakow konczacych atrybut/znacznik.
    expect(uri).not.toMatch(/[<>"'\s]/);
    expect(decodeURIComponent(uri!.split(',')[1])).toBe(svg);
  });

  it('odrzuca zbyt duze miniatury', () => {
    const big = '<svg xmlns="http://www.w3.org/2000/svg">' + 'a'.repeat(600_000) + '</svg>';
    expect(thumbnailToDataUri(big)).toBeNull();
  });

  it('nie rzuca dla niesparowanego surogatu UTF-16 (encodeURIComponent -> URIError)', () => {
    // Wywolanie jest w renderze panelu - wyjatek wywrocilby cala liste zasobow.
    expect(() => thumbnailToDataUri('<svg>\ud800</svg>')).not.toThrow();
    expect(thumbnailToDataUri('<svg>\ud800</svg>')).toBeNull();
    expect(thumbnailToDataUri('<svg>\udc00\ud800</svg>')).toBeNull();
    // Poprawna para surogatow (emoji) nadal sie koduje.
    expect(thumbnailToDataUri('<svg>😀</svg>')).not.toBeNull();
  });
});
