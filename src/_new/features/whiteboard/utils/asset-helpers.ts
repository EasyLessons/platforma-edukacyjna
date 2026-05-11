import { DrawingElement } from '../types';

/** Zwraca bounding box grupy elementów (w układzie tablicy). */
function getBoundingBox(elements: DrawingElement[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const expand = (x: number, y: number) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    };

    elements.forEach(el => {
        switch (el.type) {
            case 'path':
                el.points.forEach(p => expand(p.x, p.y));
                break;
            case 'shape':
                expand(el.startX, el.startY);
                expand(el.endX, el.endY);
                break;
            case 'arrow':
                expand(el.startX, el.startY);
                expand(el.endX, el.endY);
                if (el.controlPoints) el.controlPoints.forEach(p => expand(p.x, p.y));
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

    return elements.map(el => {
        const copy = structuredClone(el) as DrawingElement;

        switch (copy.type) {
            case 'path':
                copy.points = copy.points.map(p => ({ x: p.x - minX, y: p.y - minY }));
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
                    copy.controlPoints = copy.controlPoints.map(p => ({ x: p.x - minX, y: p.y - minY }));
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

    const svgInner = elements.map(el => {
        const color = (el as any).color || '#333';
        // Skalujemy oryginalny strokeWidth elementu proporcjonalnie, ale z górnym limitem 2px ekranowe
        const originalSw = (el as any).strokeWidth || 2;
        const sw = Math.min(originalSw * unitPerPx, unitPerPx * 2);

        switch (el.type) {
            case 'path': {
                if (el.points.length < 2) return '';
                const d = 'M ' + el.points.map(p => `${p.x},${p.y}`).join(' L ');
                return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`;
            }
            case 'shape': {
                const x1 = Math.min(el.startX, el.endX);
                const y1 = Math.min(el.startY, el.endY);
                const w = Math.abs(el.endX - el.startX);
                const h = Math.abs(el.endY - el.startY);
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
                        return `<line x1="${el.startX}" y1="${el.startY}" x2="${el.endX}" y2="${el.endY}" stroke="${color}" stroke-width="${sw}" />`;
                    case 'arrow': {
                        const dx = el.endX - el.startX;
                        const dy = el.endY - el.startY;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        const ux = dx / len, uy = dy / len;
                        const ah = sw * 4;
                        const p1x = el.endX - ux * ah - uy * ah * 0.5;
                        const p1y = el.endY - uy * ah + ux * ah * 0.5;
                        const p2x = el.endX - ux * ah + uy * ah * 0.5;
                        const p2y = el.endY - uy * ah - ux * ah * 0.5;
                        return `<line x1="${el.startX}" y1="${el.startY}" x2="${el.endX}" y2="${el.endY}" stroke="${color}" stroke-width="${sw}" /><polygon points="${el.endX},${el.endY} ${p1x},${p1y} ${p2x},${p2y}" fill="${color}" />`;
                    }
                    default:
                        return `<rect x="${x1}" y="${y1}" width="${w}" height="${h}" fill="${fillAttr}" stroke="${color}" stroke-width="${sw}" />`;
                }
            }
            case 'arrow': {
                const lineSw = Math.min(((el as any).strokeWidth || 2) * unitPerPx, unitPerPx * 2);
                return `<line x1="${el.startX}" y1="${el.startY}" x2="${el.endX}" y2="${el.endY}" stroke="${color}" stroke-width="${lineSw}" stroke-linecap="round" />`;
            }
            case 'text':
                return `<rect x="${el.x}" y="${el.y}" width="${el.width || 80}" height="${(el.height || el.fontSize * 1.5)}" fill="#f8f8f8" stroke="#ccc" stroke-width="${baseSw * 0.5}" rx="2" />`;
            case 'image':
            case 'pdf':
                return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="${baseSw * 0.5}" rx="4" />`;
            case 'markdown':
                return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="#fffbeb" stroke="#fcd34d" stroke-width="${baseSw * 0.5}" rx="4" />`;
            case 'table':
                return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="#f0fdf4" stroke="#86efac" stroke-width="${baseSw * 0.5}" rx="4" />`;
            default:
                return '';
        }
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="100%" height="100%">${svgInner}</svg>`;
}
