import { DrawingElement } from '../types';

/**
 * SEC-07: wartości pól elementów pochodzą z tablicy współdzielonej (inni użytkownicy, realtime,
 * import), więc przed wstawieniem do SVG każda przechodzi przez `num` albo `safeColor`.
 * Do znaczników trafiają wyłącznie liczby skończone i kolory z allowlisty formatu.
 */
const DEFAULT_COLOR = '#333';
const SAFE_COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z]{1,32}|(rgb|hsl)a?\([0-9.,%\s/-]{1,64}\))$/i;

/** Kolor w formacie hex / nazwa / rgb(a) / hsl(a); wszystko inne -> kolor domyślny. */
export function safeColor(value: unknown, fallback: string = DEFAULT_COLOR): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return SAFE_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

/** Liczba skończona albo wartość zastępcza - nigdy string, NaN ani Infinity. */
function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Punkty ścieżki z poprawnymi współrzędnymi (pozostałe są pomijane). */
function finitePoints(points: unknown): { x: number; y: number }[] {
  if (!Array.isArray(points)) return [];
  return points.filter(
    (p): p is { x: number; y: number } =>
      !!p && Number.isFinite((p as { x: unknown }).x) && Number.isFinite((p as { y: unknown }).y)
  );
}

/** Miniatury większe niż ten limit nie są renderowane (ochrona przed zapchaniem panelu). */
const MAX_THUMBNAIL_LENGTH = 512 * 1024;

/**
 * Zamienia miniaturę z serwera na `data:` URI dla `<img>`.
 *
 * SEC-07: miniatura to dowolny string zapisany w bazie (także stare rekordy), więc NIE wolno
 * wstawiać jej jako HTML. SVG załadowane przez `<img>` działa w trybie statycznym: przeglądarka
 * nie wykonuje skryptów ani handlerów zdarzeń i nie pobiera zasobów zewnętrznych.
 * Zwraca null, gdy treść nie jest SVG albo nie da się jej zakodować - wtedy panel pokazuje
 * pustą ramkę. Nigdy nie rzuca.
 */
export function thumbnailToDataUri(thumbnail: string | null | undefined): string | null {
  if (typeof thumbnail !== 'string') return null;
  if (thumbnail.length > MAX_THUMBNAIL_LENGTH) return null;
  if (!/^\s*<svg[\s>]/i.test(thumbnail)) return null;
  try {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumbnail)}`;
  } catch {
    // encodeURIComponent rzuca URIError dla niesparowanego surogatu UTF-16. Funkcja jest wołana
    // w renderze, więc wyjątek wywróciłby cały panel - uszkodzona miniatura = pusta ramka.
    return null;
  }
}

/** Zwraca bounding box grupy elementów (w układzie tablicy). */
function getBoundingBox(elements: DrawingElement[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const expand = (x: number, y: number) => {
    // Współrzędne spoza liczb skończonych nie mogą trafić do viewBox (SEC-07).
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  elements.forEach((el) => {
    switch (el.type) {
      case 'path':
        finitePoints(el.points).forEach((p) => expand(p.x, p.y));
        break;
      case 'shape':
        expand(el.startX, el.startY);
        expand(el.endX, el.endY);
        break;
      case 'arrow':
        expand(el.startX, el.startY);
        expand(el.endX, el.endY);
        if (el.controlPoints) el.controlPoints.forEach((p) => expand(p.x, p.y));
        break;
      case 'text':
        expand(el.x, el.y);
        expand(el.x + (el.width || 100), el.y + (el.height || el.fontSize * 1.5));
        break;
      case 'image':
      case 'pdf':
      case 'markdown':
      case 'table':
        expand(el.x, el.y);
        expand(el.x + el.width, el.y + el.height);
        break;
      // 'function' nie ma pozycji — pomijamy
    }
  });

  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

/**
 * Normalizuje pozycje elementów tak, żeby lewy-górny róg grupy był w (0,0).
 * Zachowuje wzajemne położenie wszystkich elementów.
 */
export function normalizeElementsForAsset(elements: DrawingElement[]): DrawingElement[] {
  if (!elements.length) return [];

  const { minX, minY } = getBoundingBox(elements);

  return elements.map((el) => {
    const copy = structuredClone(el) as DrawingElement;

    switch (copy.type) {
      case 'path':
        copy.points = copy.points.map((p) => ({ x: p.x - minX, y: p.y - minY }));
        break;
      case 'shape':
        copy.startX -= minX;
        copy.startY -= minY;
        copy.endX -= minX;
        copy.endY -= minY;
        break;
      case 'arrow':
        copy.startX -= minX;
        copy.startY -= minY;
        copy.endX -= minX;
        copy.endY -= minY;
        if (copy.controlPoints) {
          copy.controlPoints = copy.controlPoints.map((p) => ({ x: p.x - minX, y: p.y - minY }));
        }
        break;
      case 'text':
      case 'image':
      case 'pdf':
      case 'markdown':
      case 'table':
        copy.x -= minX;
        copy.y -= minY;
        break;
    }

    return copy;
  });
}

/**
 * Generuje miniaturkę SVG dla grupy elementów.
 * viewBox jest obliczany dynamicznie z rzeczywistego bounding box.
 */
export function generateElementsSvgThumbnail(elements: DrawingElement[]): string {
  if (!elements.length) return '';

  const { minX, minY, maxX, maxY } = getBoundingBox(elements);

  const pad = Math.max((maxX - minX) * 0.08, (maxY - minY) * 0.08, 8);
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = Math.max(maxX - minX + pad * 2, 1);
  const vbH = Math.max(maxY - minY + pad * 2, 1);

  // Grubość kreski: stała wizualna 1.5% rozmiaru miniatury w px (128px) przeliczona na jednostki viewBox
  const THUMBNAIL_PX = 128;
  const pxPerUnit = THUMBNAIL_PX / Math.max(vbW, vbH);
  // 1px w jednostkach viewBox
  const unitPerPx = 1 / pxPerUnit;
  // Docelowa grubość kreski: ~1.2px na ekranie
  const baseSw = unitPerPx * 1.2;

  const svgInner = elements
    .map((el) => {
      const raw = el as { color?: unknown; strokeWidth?: unknown };
      const color = safeColor(raw.color);
      // Skalujemy oryginalny strokeWidth elementu proporcjonalnie, ale z górnym limitem 2px ekranowe
      const originalSw = num(raw.strokeWidth) || 2;
      const sw = Math.min(originalSw * unitPerPx, unitPerPx * 2);

      switch (el.type) {
        case 'path': {
          const points = finitePoints(el.points);
          if (points.length < 2) return '';
          const d = 'M ' + points.map((p) => `${p.x},${p.y}`).join(' L ');
          return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`;
        }
        case 'shape': {
          const startX = num(el.startX);
          const startY = num(el.startY);
          const endX = num(el.endX);
          const endY = num(el.endY);
          const x1 = Math.min(startX, endX);
          const y1 = Math.min(startY, endY);
          const w = Math.abs(endX - startX);
          const h = Math.abs(endY - startY);
          const fillAttr = el.fill ? color : 'none';
          switch (el.shapeType) {
            case 'rectangle':
              return `<rect x="${x1}" y="${y1}" width="${w}" height="${h}" fill="${fillAttr}" stroke="${color}" stroke-width="${sw}" />`;
            case 'circle':
              return `<ellipse cx="${x1 + w / 2}" cy="${y1 + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fillAttr}" stroke="${color}" stroke-width="${sw}" />`;
            case 'triangle': {
              const pts = `${x1 + w / 2},${y1} ${x1},${y1 + h} ${x1 + w},${y1 + h}`;
              return `<polygon points="${pts}" fill="${fillAttr}" stroke="${color}" stroke-width="${sw}" />`;
            }
            case 'line':
              return `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${color}" stroke-width="${sw}" />`;
            case 'arrow': {
              const dx = endX - startX;
              const dy = endY - startY;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / len,
                uy = dy / len;
              const ah = sw * 4;
              const p1x = endX - ux * ah - uy * ah * 0.5;
              const p1y = endY - uy * ah + ux * ah * 0.5;
              const p2x = endX - ux * ah + uy * ah * 0.5;
              const p2y = endY - uy * ah - ux * ah * 0.5;
              return `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${color}" stroke-width="${sw}" /><polygon points="${endX},${endY} ${p1x},${p1y} ${p2x},${p2y}" fill="${color}" />`;
            }
            default:
              return `<rect x="${x1}" y="${y1}" width="${w}" height="${h}" fill="${fillAttr}" stroke="${color}" stroke-width="${sw}" />`;
          }
        }
        case 'arrow':
          return `<line x1="${num(el.startX)}" y1="${num(el.startY)}" x2="${num(el.endX)}" y2="${num(el.endY)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" />`;
        case 'text':
          // Treść tekstu celowo NIE trafia do miniatury - tylko ramka o wymiarach elementu.
          return `<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.width) || 80}" height="${num(el.height) || num(el.fontSize, 16) * 1.5}" fill="#f8f8f8" stroke="#ccc" stroke-width="${baseSw * 0.5}" rx="2" />`;
        case 'image':
        case 'pdf':
          return `<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.width)}" height="${num(el.height)}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="${baseSw * 0.5}" rx="4" />`;
        case 'markdown':
          return `<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.width)}" height="${num(el.height)}" fill="#fffbeb" stroke="#fcd34d" stroke-width="${baseSw * 0.5}" rx="4" />`;
        case 'table':
          return `<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.width)}" height="${num(el.height)}" fill="#f0fdf4" stroke="#86efac" stroke-width="${baseSw * 0.5}" rx="4" />`;
        default:
          return '';
      }
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="100%" height="100%">${svgInner}</svg>`;
}
