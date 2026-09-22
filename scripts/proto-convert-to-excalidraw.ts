/**
 * SZKIC konwersji elementów obecnej tablicy (DrawingElement[]) -> Excalidraw.
 *
 * Czysta funkcja `convertBoard(elements)`; NIE łączy się z żadną bazą.
 * Mapowanie typów i to, czego się nie da przenieść 1:1, jest opisane w
 * docs/architecture/PROTOTYP-EXCALIDRAW.md (sekcja "Mapowanie danych").
 *
 * Uruchomienie w przyszłości: `npx tsx scripts/proto-convert-to-excalidraw.ts < board.json`
 * (na razie tylko test: `npx vitest run scripts`).
 */

import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement, FileId } from '@excalidraw/excalidraw/element/types';
import type { BinaryFileData, DataURL } from '@excalidraw/excalidraw/types';
import type {
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  ArrowElement,
  TableElement,
  MarkdownNote,
  FunctionPlot,
} from '@/_new/features/whiteboard/types/elements';
import {
  functionPlotSvg,
  svgToDataUrl,
  type FunctionSpec,
} from '@/_new/features/whiteboard-excalidraw/math/function-plot';

export interface ConvertResult {
  elements: ExcalidrawElement[];
  files: BinaryFileData[];
  /** Elementy, których nie udało się przenieść (typ + powód). */
  skipped: { id: string; type: string; reason: string }[];
}

const FONT_HAND = 1; // Excalidraw FONT_FAMILY.Virgil... w 0.18: 5 = Excalifont; 1 = Virgil (legacy)
const FONT_NORMAL = 2; // Helvetica

/** Skrót: hash treści -> FileId (ten sam obraz = jeden plik). */
function fileIdFrom(str: string): FileId {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `conv-${h.toString(16)}` as FileId;
}

function rad(v?: number): number {
  return v ?? 0;
}

// --- konwertery per typ ------------------------------------------------------

function pathToFreedraw(el: DrawingPath): ExcalidrawElementSkeleton {
  const minX = Math.min(...el.points.map((p) => p.x));
  const minY = Math.min(...el.points.map((p) => p.y));
  const maxX = Math.max(...el.points.map((p) => p.x));
  const maxY = Math.max(...el.points.map((p) => p.y));
  const points = el.points.map((p) => [p.x - minX, p.y - minY] as [number, number]);
  const pressures =
    el.widths?.length === el.points.length ? el.widths.map((w) => Math.min(1, w / el.width)) : [];
  // freedraw nie ma skeletona - podajemy pełny element (ExcalidrawElementSkeleton dopuszcza pełny freedraw)
  return {
    type: 'freedraw',
    id: el.id,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    points,
    pressures,
    simulatePressure: pressures.length === 0,
    lastCommittedPoint: points[points.length - 1] ?? null,
    strokeColor: el.color,
    strokeWidth: el.width,
    opacity: Math.round((el.opacity ?? 1) * 100),
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeStyle: 'solid',
    roughness: 0,
    roundness: null,
    angle: 0,
    seed: 1,
    version: 1,
    versionNonce: 0,
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  } as unknown as ExcalidrawElementSkeleton;
}

function shapeToSkeleton(el: Shape): ExcalidrawElementSkeleton | null {
  const x = Math.min(el.startX, el.endX);
  const y = Math.min(el.startY, el.endY);
  const width = Math.abs(el.endX - el.startX);
  const height = Math.abs(el.endY - el.startY);
  const common = {
    id: el.id,
    x,
    y,
    width,
    height,
    strokeColor: el.color,
    strokeWidth: el.strokeWidth,
    backgroundColor: el.fill ? el.color : 'transparent',
    fillStyle: 'solid' as const,
    roughness: 0,
    angle: rad(el.rotation),
  };
  switch (el.shapeType) {
    case 'rectangle':
      return { type: 'rectangle', ...common };
    case 'circle':
      return { type: 'ellipse', ...common };
    case 'triangle':
      // Excalidraw nie ma trójkąta - linia zamknięta (3 punkty + powrót)
      return {
        type: 'line',
        id: el.id,
        x: el.startX,
        y: el.startY,
        strokeColor: el.color,
        strokeWidth: el.strokeWidth,
        backgroundColor: el.fill ? el.color : 'transparent',
        fillStyle: 'solid',
        roughness: 0,
        points: [
          [0, 0],
          [el.endX - el.startX, el.endY - el.startY],
          [-(el.endX - el.startX), el.endY - el.startY],
          [0, 0],
        ],
      } as ExcalidrawElementSkeleton;
    case 'polygon': {
      const sides = Math.max(3, el.sides ?? 5);
      const cx = (el.startX + el.endX) / 2;
      const cy = (el.startY + el.endY) / 2;
      const r = Math.min(width, height) / 2;
      const pts: [number, number][] = [];
      for (let i = 0; i <= sides; i++) {
        const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
        pts.push([
          cx + r * Math.cos(a) - (cx + r * Math.cos(-Math.PI / 2)),
          cy + r * Math.sin(a) - (cy - r),
        ]);
      }
      return {
        type: 'line',
        id: el.id,
        x: cx + r * Math.cos(-Math.PI / 2),
        y: cy - r,
        strokeColor: el.color,
        strokeWidth: el.strokeWidth,
        backgroundColor: el.fill ? el.color : 'transparent',
        fillStyle: 'solid',
        roughness: 0,
        points: pts,
      } as ExcalidrawElementSkeleton;
    }
    case 'line':
      return {
        type: 'line',
        id: el.id,
        x: el.startX,
        y: el.startY,
        strokeColor: el.color,
        strokeWidth: el.strokeWidth,
        roughness: 0,
        points: [
          [0, 0],
          [el.endX - el.startX, el.endY - el.startY],
        ],
      } as ExcalidrawElementSkeleton;
    case 'arrow':
      return {
        type: 'arrow',
        id: el.id,
        x: el.startX,
        y: el.startY,
        strokeColor: el.color,
        strokeWidth: el.strokeWidth,
        roughness: 0,
        endArrowhead: 'arrow',
        points: [
          [0, 0],
          [el.endX - el.startX, el.endY - el.startY],
        ],
      } as ExcalidrawElementSkeleton;
    default:
      return null;
  }
}

function textToSkeleton(el: TextElement): ExcalidrawElementSkeleton {
  return {
    type: 'text',
    id: el.id,
    x: el.x,
    y: el.y,
    text: el.text,
    fontSize: el.fontSize,
    fontFamily: el.fontFamily?.toLowerCase().includes('virgil') ? FONT_HAND : FONT_NORMAL,
    strokeColor: el.color,
    textAlign: el.textAlign ?? 'left',
    angle: rad(el.rotation),
  };
}

function arrowToSkeleton(el: ArrowElement): ExcalidrawElementSkeleton {
  const mid = el.controlPoints ?? [];
  const points: [number, number][] = [
    [0, 0],
    ...mid.map((p) => [p.x - el.startX, p.y - el.startY] as [number, number]),
    [el.endX - el.startX, el.endY - el.startY],
  ];
  const head = el.arrowHead ?? 'end';
  return {
    type: 'arrow',
    id: el.id,
    x: el.startX,
    y: el.startY,
    strokeColor: el.color,
    strokeWidth: el.strokeWidth,
    roughness: 0,
    points,
    startArrowhead: head === 'both' ? 'arrow' : null,
    endArrowhead: head === 'none' ? null : 'arrow',
    roundness: el.arrowType === 'smooth' ? { type: 2 } : null,
    // Bindingi do elementów (startAttachment/endAttachment) Excalidraw przelicza sam
    // po `start: { id }` / `end: { id }` - wymaga, żeby cel był w tym samym wsadzie.
    ...(el.startAttachment ? { start: { id: el.startAttachment.elementId } } : {}),
    ...(el.endAttachment ? { end: { id: el.endAttachment.elementId } } : {}),
  } as ExcalidrawElementSkeleton;
}

/** Tabela -> siatka prostokątów + tekstów w jednej grupie (Excalidraw nie ma tabeli). */
function tableToSkeletons(el: TableElement): ExcalidrawElementSkeleton[] {
  const out: ExcalidrawElementSkeleton[] = [];
  const cw = el.width / el.cols;
  const ch = el.height / el.rows;
  const fontSize = Math.max(10, Math.min(24, ch * 0.5));
  const groupId = `table-${el.id}`;
  for (let r = 0; r < el.rows; r++) {
    for (let c = 0; c < el.cols; c++) {
      const isHeader = (el.headerRow && r === 0) || (el.headerCol && c === 0);
      const text = el.cells[r]?.[c] ?? '';
      out.push({
        type: 'rectangle',
        id: `${el.id}-c${r}-${c}`,
        x: el.x + c * cw,
        y: el.y + r * ch,
        width: cw,
        height: ch,
        strokeColor: el.borderColor ?? '#1e1e1e',
        backgroundColor: isHeader ? (el.headerBgColor ?? '#f3f4f6') : 'transparent',
        fillStyle: 'solid',
        roughness: 0,
        groupIds: [groupId],
        label: text ? { text, fontSize, fontFamily: FONT_NORMAL } : undefined,
      } as ExcalidrawElementSkeleton);
    }
  }
  return out;
}

/** Markdown -> tekst (surowy markdown; renderowanie MD wymaga osobnego narzędzia, patrz doc). */
function markdownToSkeleton(el: MarkdownNote): ExcalidrawElementSkeleton {
  return {
    type: 'rectangle',
    id: el.id,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    backgroundColor: el.backgroundColor ?? '#fef9c3',
    strokeColor: el.borderColor ?? '#ca8a04',
    fillStyle: 'solid',
    roughness: 0,
    customData: { kind: 'markdown', content: el.content, isFromChatbot: !!el.isFromChatbot },
    label: {
      text: el.content,
      fontSize: 16,
      fontFamily: FONT_NORMAL,
      textAlign: 'left',
      verticalAlign: 'top',
    },
  } as ExcalidrawElementSkeleton;
}

function functionToSkeleton(el: FunctionPlot, position: { x: number; y: number }) {
  const spec: FunctionSpec = {
    expression: el.expression,
    xRange: el.xRange,
    yRange: el.yRange,
    color: el.color,
    strokeWidth: el.strokeWidth,
    dashed: !!el.strokeDasharray,
  };
  const svg = functionPlotSvg(spec, { width: 400, height: 400 });
  const file: BinaryFileData = {
    id: fileIdFrom(svg),
    mimeType: 'image/svg+xml',
    dataURL: svgToDataUrl(svg) as DataURL,
    created: Date.now(),
  };
  const skeleton = {
    type: 'image',
    id: el.id,
    x: position.x,
    y: position.y,
    width: 400,
    height: 400,
    fileId: file.id,
    status: 'saved',
    customData: { kind: 'function', spec },
  } as ExcalidrawElementSkeleton;
  return { skeleton, file };
}

// --- główna funkcja -----------------------------------------------------------

export function convertBoard(elements: DrawingElement[]): ConvertResult {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  const files: BinaryFileData[] = [];
  const skipped: ConvertResult['skipped'] = [];
  let functionSlot = 0;

  for (const el of elements) {
    switch (el.type) {
      case 'path':
        if (el.points.length < 2) {
          skipped.push({ id: el.id, type: el.type, reason: 'mniej niż 2 punkty' });
          break;
        }
        skeletons.push(pathToFreedraw(el));
        break;
      case 'shape': {
        const s = shapeToSkeleton(el);
        if (s) skeletons.push(s);
        else
          skipped.push({ id: el.id, type: el.type, reason: `nieznany shapeType ${el.shapeType}` });
        break;
      }
      case 'text':
        skeletons.push(textToSkeleton(el));
        break;
      case 'arrow':
        skeletons.push(arrowToSkeleton(el));
        break;
      case 'image': {
        const isData = el.src.startsWith('data:');
        const fileId = fileIdFrom(el.src);
        if (isData) {
          const mime = (el.src.match(/^data:([^;,]+)/)?.[1] ??
            'image/png') as BinaryFileData['mimeType'];
          files.push({
            id: fileId,
            mimeType: mime,
            dataURL: el.src as DataURL,
            created: Date.now(),
          });
        }
        // URL (Supabase Storage) - plik trzeba pobrać osobno i dodać do `files`; element już wskazuje na fileId
        skeletons.push({
          type: 'image',
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          fileId,
          status: isData ? 'saved' : 'pending',
          angle: rad(el.rotation),
          customData: isData ? undefined : { sourceUrl: el.src },
        } as ExcalidrawElementSkeleton);
        break;
      }
      case 'table':
        skeletons.push(...tableToSkeletons(el));
        break;
      case 'markdown':
        skeletons.push(markdownToSkeleton(el));
        break;
      case 'function': {
        // stara funkcja nie ma pozycji (rysowana zawsze w (0,0) sceny) - układamy obok siebie
        const { skeleton, file } = functionToSkeleton(el, { x: functionSlot * 420, y: 0 });
        functionSlot += 1;
        skeletons.push(skeleton);
        files.push(file);
        break;
      }
      case 'pdf':
        skipped.push({
          id: el.id,
          type: el.type,
          reason:
            'PDF: Excalidraw nie ma elementu PDF - do zrenderowania stron na obrazy (pdfjs) albo embeddable',
        });
        break;
      default:
        skipped.push({
          id: (el as { id: string }).id,
          type: (el as { type: string }).type,
          reason: 'nieznany typ',
        });
    }
  }

  const converted = convertToExcalidrawElements(skeletons, { regenerateIds: false });
  return { elements: converted, files, skipped };
}
