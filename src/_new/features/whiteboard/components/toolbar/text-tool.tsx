/**
 * ============================================================================
 * PLIK: text-tool.tsx — model Miro
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, ViewportTransform, TextElement } from '@/_new/features/whiteboard/types';
import {
  transformPoint,
  inverseTransformPoint,
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
} from '@/_new/features/whiteboard/navigation/viewport-math';
import { TextMiniToolbar } from './text-mini-toolbar';

const DEFAULT_FONT_SIZE = 24;
const MIN_WORLD_W = 0.8;
const MIN_WORLD_H = 0.18;

interface TextToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  elements: TextElement[];
  editingTextId: string | null;
  onTextCreate: (text: TextElement) => void;
  onTextUpdate: (id: string, updates: Partial<TextElement>) => void;
  onTextDelete: (id: string) => void;
  onEditingComplete?: () => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
  editorDivRef?: React.RefObject<HTMLDivElement | null>;
  isGestureActive?: boolean;
}

interface Draft {
  id:         string;
  worldX:     number;
  worldY:     number;
  worldW:     number;
  worldH:     number; // używany tylko przez logikę resize (proporcjonalne skalowanie)
  fontSize:   number;
  color:      string;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle:  'normal' | 'italic';
  textAlign:  'left' | 'center' | 'right';
  isExisting: boolean;
}

export function TextTool({
  viewport,
  canvasWidth,
  canvasHeight,
  elements,
  editingTextId,
  onTextCreate,
  onTextUpdate,
  onTextDelete,
  onEditingComplete,
  onViewportChange,
  editorDivRef,
  isGestureActive = false,
}: TextToolProps) {

  const [phase, setPhase]           = useState<'idle' | 'drawing' | 'editing'>('idle');
  const [draft, setDraft]           = useState<Draft | null>(null);
  // localHeight: jedyne źródło prawdy o wysokości ramki podczas edycji.
  // Aktualizowana przez auto-expand (textarea.scrollHeight) i resize.
  // Commit do Zustanda wyłącznie w handleSave — O(1) zapis niezależnie od długości tekstu.
  const [localHeight, setLocalHeight] = useState(0);

  const drawStartWorld = useRef<Point | null>(null);
  const drawCurrWorld  = useRef<Point | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [editText, setEditText]     = useState('');
  const textareaRef                 = useRef<HTMLTextAreaElement>(null);
  const overlayRef                  = useRef<HTMLDivElement>(null);
  const editorRef                   = useRef<HTMLDivElement | null>(null);

  const [isResizing, setIsResizing] = useState(false);
  const resizeHandleRef             = useRef<string>('');
  const resizeStartMouse            = useRef<Point>({ x: 0, y: 0 });
  const resizeDraftSnapshot         = useRef<Draft | null>(null);

  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  // ─── 1. Otwarcie edycji istniejącego tekstu ──────────────────────────────────
  useEffect(() => {
    if (!editingTextId) return;
    const el = elements.find((e) => e.id === editingTextId);
    if (!el) return;

    const initialH = el.height ?? 0.4;
    setDraft({
      id:         el.id,
      worldX:     el.x,
      worldY:     el.y,
      worldW:     el.width  ?? 3,
      worldH:     initialH,
      fontSize:   el.fontSize,
      color:      el.color,
      fontFamily: el.fontFamily ?? 'Arial, sans-serif',
      fontWeight: el.fontWeight ?? 'normal',
      fontStyle:  el.fontStyle  ?? 'normal',
      textAlign:  el.textAlign  ?? 'left',
      isExisting: true,
    });
    setLocalHeight(initialH);
    setEditText(el.text);
    setPhase('editing');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTextId]);

  useEffect(() => {
    if (phase !== 'editing') return;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
  }, [phase]);

  // ─── 2. Resize (proporcjonalne skalowanie Miro-style) ────────────────────────
  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      const snap   = resizeDraftSnapshot.current;
      const handle = resizeHandleRef.current;
      if (!snap) return;

      const rect = overlayRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const worldCursor = inverseTransformPoint(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        viewportRef.current,
        canvasWidth,
        canvasHeight,
      );

      const origLeft   = snap.worldX;
      const origTop    = snap.worldY;
      const origRight  = snap.worldX + snap.worldW;
      const origBottom = snap.worldY + snap.worldH;

      let newLeft = origLeft, newTop = origTop;
      let newRight = origRight, newBottom = origBottom;

      const { x: cx, y: cy } = worldCursor;
      if (handle === 'tl') { newLeft = cx; newTop = cy; }
      if (handle === 'tr') { newRight = cx; newTop = cy; }
      if (handle === 'bl') { newLeft = cx; newBottom = cy; }
      if (handle === 'br') { newRight = cx; newBottom = cy; }

      if (newRight - newLeft < MIN_WORLD_W) {
        if (handle === 'tl' || handle === 'bl') newLeft = newRight - MIN_WORLD_W;
        else                                    newRight = newLeft + MIN_WORLD_W;
      }

      const newW       = newRight - newLeft;
      const scaleRatio = newW / snap.worldW;
      const newFontSize = snap.fontSize * scaleRatio;
      const newH        = snap.worldH * scaleRatio;

      if (handle === 'tl' || handle === 'tr') newTop    = origBottom - newH;
      else                                    newBottom = origTop    + newH;

      setDraft(prev => prev ? {
        ...prev,
        worldX: newLeft,
        worldY: newTop,
        worldW: newW,
        worldH: newH,
        fontSize: newFontSize,
      } : prev);
    };

    const onUp = () => setIsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [isResizing, canvasWidth, canvasHeight]);

  // ─── 3. Auto-expand height — tylko lokalny stan, zero commitów do Zustanda ───
  // Nasłuchuje na: zmiana tekstu, faza, szerokość ramki, skala viewportu.
  // Używa funkcyjnej aktualizacji setLocalHeight, żeby uniknąć stale closure
  // i nadmiarowych re-renderów przy stabilnej wartości.
  useEffect(() => {
    if (phase !== 'editing' || !textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.style.height = '0px';
    const scrollH  = textarea.scrollHeight;
    textarea.style.height = '100%';
    const newWorldH = Math.max(MIN_WORLD_H, scrollH / (100 * viewport.scale));
    setLocalHeight(prev => Math.abs(newWorldH - prev) < 0.005 ? prev : newWorldH);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editText, phase, draft?.worldW, viewport.scale, draft?.fontSize, draft?.fontFamily, draft?.fontWeight, draft?.fontStyle]);

  // ─── 4. Commit — JEDEN zapis do Zustanda na zakończenie edycji ───────────────
  const handleSave = useCallback(() => {
    if (!draft) return;
    const trimmed = editText.trim();

    if (!trimmed) {
      if (draft.isExisting) onTextDelete(draft.id);
      setPhase('idle'); setDraft(null); setEditText(''); setLocalHeight(0);
      onEditingComplete?.();
      return;
    }

    const data: Partial<TextElement> = {
      x:          draft.worldX,
      y:          draft.worldY,
      width:      draft.worldW,
      height:     localHeight,   // ← wartość z lokalnego bufora, nie Zustanda
      text:       editText,
      fontSize:   draft.fontSize,
      color:      draft.color,
      fontFamily: draft.fontFamily,
      fontWeight: draft.fontWeight,
      fontStyle:  draft.fontStyle,
      textAlign:  draft.textAlign,
    };

    if (draft.isExisting) onTextUpdate(draft.id, data);
    else                  onTextCreate({ id: draft.id, type: 'text', ...data } as TextElement);

    setPhase('idle'); setDraft(null); setEditText(''); setLocalHeight(0);
    onEditingComplete?.();
  }, [draft, editText, localHeight, onTextCreate, onTextUpdate, onTextDelete, onEditingComplete]);

  const handleCancel = useCallback(() => {
    setPhase('idle'); setDraft(null); setEditText(''); setLocalHeight(0); setIsResizing(false);
    onEditingComplete?.();
  }, [onEditingComplete]);

  // Click outside → commit
  useEffect(() => {
    if (phase !== 'editing') return;
    const onDown = (e: MouseEvent) => {
      if (isResizing) return;
      if (editorRef.current?.contains(e.target as Node)) return;
      handleSave();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 100);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); };
  }, [phase, isResizing, handleSave]);

  // Scroll/zoom na overlayach (nie podczas edycji)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;
    const onWheel = (e: WheelEvent) => {
      if (phase === 'editing') return;
      e.preventDefault(); e.stopPropagation();
      const vp = viewportRef.current;
      if (e.ctrlKey) {
        const rect = overlay.getBoundingClientRect();
        onViewportChange(constrainViewport(zoomViewport(vp, e.deltaY, e.clientX - rect.left, e.clientY - rect.top, canvasWidth, canvasHeight)));
      } else {
        onViewportChange(constrainViewport(panViewportWithWheel(vp, e.deltaX, e.deltaY)));
      }
    };
    overlay.addEventListener('wheel', onWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', onWheel);
  }, [canvasWidth, canvasHeight, onViewportChange, phase]);

  useEffect(() => {
    if (isGestureActive && phase === 'drawing') {
      setPhase('idle');
      setDrawPreview(null);
      drawStartWorld.current = null;
      drawCurrWorld.current  = null;
    }
  }, [isGestureActive, phase]);

  // ─── 5. Rysowanie nowej ramki ─────────────────────────────────────────────────
  const handleOverlayDown = (e: React.MouseEvent) => {
    if (isGestureActive) return;
    if (phase === 'editing' || e.button !== 0) return;
    const rect  = overlayRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const world = inverseTransformPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top }, viewport, canvasWidth, canvasHeight);
    drawStartWorld.current = world;
    drawCurrWorld.current  = world;
    setPhase('drawing');
    setDrawPreview({ x: world.x, y: world.y, w: 0, h: 0 });
  };

  const handleOverlayMove = (e: React.MouseEvent) => {
    if (phase !== 'drawing' || !drawStartWorld.current) return;
    const rect  = overlayRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const world = inverseTransformPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top }, viewport, canvasWidth, canvasHeight);
    drawCurrWorld.current = world;
    setDrawPreview({
      x: Math.min(drawStartWorld.current.x, world.x),
      y: Math.min(drawStartWorld.current.y, world.y),
      w: Math.abs(world.x - drawStartWorld.current.x),
      h: Math.abs(world.y - drawStartWorld.current.y),
    });
  };

  const handleOverlayUp = () => {
    if (phase !== 'drawing' || !drawStartWorld.current || !drawCurrWorld.current) {
      setPhase('idle'); setDrawPreview(null); return;
    }
    const sx = drawStartWorld.current.x, sy = drawStartWorld.current.y;
    const ex = drawCurrWorld.current.x,  ey = drawCurrWorld.current.y;

    const worldX = Math.min(sx, ex);
    const worldY = Math.min(sy, ey);
    let worldW   = Math.abs(ex - sx);
    if (worldW < MIN_WORLD_W / viewport.scale) worldW = 3.0 / viewport.scale;

    const adjustedFontSize = DEFAULT_FONT_SIZE / viewport.scale;
    const worldH = (adjustedFontSize * 1.4) / 100;

    setDraft({
      id: Date.now().toString(),
      worldX, worldY, worldW, worldH,
      fontSize:   adjustedFontSize,
      color:      '#000000',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      fontStyle:  'normal',
      textAlign:  'left',
      isExisting: false,
    });
    setLocalHeight(worldH);
    setEditText('');
    setPhase('editing');
    setDrawPreview(null);
    drawStartWorld.current = null;
    drawCurrWorld.current  = null;
  };

  const makeResizeHandler = (handle: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeHandleRef.current     = handle;
    resizeStartMouse.current    = { x: e.clientX, y: e.clientY };
    // snapshot używa localHeight jako worldH, żeby proporcje resize odpowiadały
    // rzeczywistej wizualnej wysokości ramki, nie zapisanej wartości ze stanu
    resizeDraftSnapshot.current = draft ? { ...draft, worldH: localHeight } : null;
    setIsResizing(true);
  };

  // ─── Geometria edytora ────────────────────────────────────────────────────────
  // edHeight pochodzi z localHeight (nie draft.worldH), dzięki czemu ramka
  // wizualna natychmiast dopasowuje się do treści podczas wpisywania.
  let edLeft = 0, edTop = 0, edWidth = 0, edHeight = 0;
  if (draft && phase === 'editing') {
    const tl = transformPoint({ x: draft.worldX, y: draft.worldY }, viewport, canvasWidth, canvasHeight);
    const br = transformPoint({ x: draft.worldX + draft.worldW, y: draft.worldY + localHeight }, viewport, canvasWidth, canvasHeight);
    edLeft = tl.x; edTop = tl.y; edWidth = br.x - tl.x; edHeight = br.y - tl.y;
  }

  const fontSizePx = draft ? Math.max(1, draft.fontSize * viewport.scale) : 14;

  const HS = 10;
  const handleStyle: React.CSSProperties = {
    position: 'absolute', width: HS, height: HS,
    borderRadius: '50%', background: '#fff', border: '2px solid #3b82f6',
    zIndex: 70, pointerEvents: 'auto',
  };

  let previewRect: React.CSSProperties | null = null;
  if (phase === 'drawing' && drawPreview) {
    const tl = transformPoint({ x: drawPreview.x, y: drawPreview.y }, viewport, canvasWidth, canvasHeight);
    const br = transformPoint({ x: drawPreview.x + drawPreview.w, y: drawPreview.y + drawPreview.h }, viewport, canvasWidth, canvasHeight);
    previewRect = { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  }

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: phase === 'editing' ? 'default' : 'text' }}>
      {phase !== 'editing' && (
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-auto z-30"
          style={{ touchAction: 'none' }}
          onMouseDown={handleOverlayDown}
          onMouseMove={handleOverlayMove}
          onMouseUp={handleOverlayUp}
          onMouseLeave={handleOverlayUp}
        />
      )}

      {phase === 'drawing' && previewRect && (
        <div
          className="absolute pointer-events-none z-40 border-2 border-dashed border-blue-400 bg-blue-50/10"
          style={previewRect}
        />
      )}

      {phase === 'editing' && draft && (
        <div
          ref={(node) => {
            editorRef.current = node;
            if (editorDivRef) (editorDivRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          data-world-x={draft.worldX}
          data-world-y={draft.worldY}
          data-world-w={draft.worldW}
          data-world-h={localHeight}
          className="absolute pointer-events-auto z-50"
          style={{
            left: edLeft, top: edTop, width: edWidth, height: edHeight,
            overflow: 'visible', boxShadow: '0 0 0 2px #3b82f6',
          }}
        >
          <div className="absolute -top-12 left-0 z-50">
            <TextMiniToolbar
              style={{ fontSize: draft.fontSize, color: draft.color, fontWeight: draft.fontWeight, fontStyle: draft.fontStyle, textAlign: draft.textAlign }}
              onChange={(updates) => setDraft(prev => prev ? { ...prev, ...updates } : prev)}
            />
          </div>

          <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', overflow: 'hidden', background: 'transparent' }}>
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); handleCancel(); } }}
              placeholder="Wpisz tekst..."
              className="no-scrollbar p-0 m-0 border-none bg-transparent resize-none outline-none block"
              style={{
                fontSize:     `${fontSizePx}px`,
                color:         draft.color,
                fontFamily:    draft.fontFamily,
                fontWeight:    draft.fontWeight,
                fontStyle:     draft.fontStyle,
                textAlign:     draft.textAlign,
                lineHeight:    '1.4',
                overflowWrap: 'break-word',
                whiteSpace:   'pre-wrap',
                wordBreak:    'break-word',
                overflowX:    'hidden',
                overflowY:    'hidden',
                width:        '100%',
                height:       '100%',
                boxSizing:    'border-box',
              }}
            />
          </div>

          <div style={{ ...handleStyle, left: 0, top: 0, transform: 'translate(-50%,-50%)', cursor: 'nwse-resize' }} onMouseDown={makeResizeHandler('tl')} />
          <div style={{ ...handleStyle, right: 0, top: 0, transform: 'translate(50%,-50%)',  cursor: 'nesw-resize' }} onMouseDown={makeResizeHandler('tr')} />
          <div style={{ ...handleStyle, left: 0, bottom: 0, transform: 'translate(-50%,50%)', cursor: 'nesw-resize' }} onMouseDown={makeResizeHandler('bl')} />
          <div style={{ ...handleStyle, right: 0, bottom: 0, transform: 'translate(50%,50%)',  cursor: 'nwse-resize' }} onMouseDown={makeResizeHandler('br')} />
        </div>
      )}
    </div>
  );
}
