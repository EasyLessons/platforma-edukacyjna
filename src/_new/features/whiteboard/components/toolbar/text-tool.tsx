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

// Domyślne wartości dla nowego tekstu (w jednostkach świata)
const DEFAULT_FONT_SIZE = 24; 
const MIN_WORLD_W = 0.8;  // 80px przy scale=1
const MIN_WORLD_H = 0.18; // 18px przy scale=1

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
}

interface Draft {
  id:         string;
  worldX:     number;
  worldY:     number;
  worldW:     number;
  worldH:     number;
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
}: TextToolProps) {

  const [phase, setPhase] = useState<'idle' | 'drawing' | 'editing'>('idle');
  const [draft, setDraft] = useState<Draft | null>(null);

  const drawStartWorld = useRef<Point | null>(null);
  const drawCurrWorld  = useRef<Point | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isResizing, setIsResizing] = useState(false);
  const resizeHandleRef     = useRef<string>('');             
  const resizeStartMouse    = useRef<Point>({ x: 0, y: 0 }); 
  const resizeDraftSnapshot = useRef<Draft | null>(null);     

  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  // 1. OTWIERANIE EDYCJI ISTNIEJĄCEGO TEKSTU
  useEffect(() => {
    if (!editingTextId) return;
    const el = elements.find((e) => e.id === editingTextId);
    if (!el) return;

    setDraft({
      id:         el.id,
      worldX:     el.x,
      worldY:     el.y,
      worldW:     el.width  ?? 3,
      worldH:     el.height ?? 0.4,
      fontSize:   el.fontSize,
      color:      el.color,
      fontFamily: el.fontFamily  ?? 'Arial, sans-serif',
      fontWeight: el.fontWeight  ?? 'normal',
      fontStyle:  el.fontStyle   ?? 'normal',
      textAlign:  el.textAlign   ?? 'left',
      isExisting: true,
    });
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

  // 2. RESIZE (PROPORCJONALNE SKALOWANIE W STYLU MIRO)
  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      const snap   = resizeDraftSnapshot.current;
      const handle = resizeHandleRef.current;
      if (!snap) return;

      const worldCursor = inverseTransformPoint(
        { x: e.clientX, y: e.clientY },
        viewportRef.current,
        canvasWidth,
        canvasHeight
      );
      const cx = worldCursor.x;
      const cy = worldCursor.y;

      const origLeft   = snap.worldX;
      const origTop    = snap.worldY;
      const origRight  = snap.worldX + snap.worldW;
      const origBottom = snap.worldY + snap.worldH;

      let newLeft = origLeft, newTop = origTop;
      let newRight = origRight, newBottom = origBottom;

      if (handle === 'tl') { newLeft = cx; newTop = cy; }
      if (handle === 'tr') { newRight = cx; newTop = cy; }
      if (handle === 'bl') { newLeft = cx; newBottom = cy; }
      if (handle === 'br') { newRight = cx; newBottom = cy; }

      // Wymuś minimum szerokości
      if (newRight - newLeft < MIN_WORLD_W) {
        if (handle === 'tl' || handle === 'bl') newLeft = newRight - MIN_WORLD_W;
        else                                    newRight = newLeft + MIN_WORLD_W;
      }

      const newW = newRight - newLeft;

      // PROPORCJONALNE SKALOWANIE:
      const scaleRatio = newW / snap.worldW;
      const newFontSize = snap.fontSize * scaleRatio;
      const newH = snap.worldH * scaleRatio;

      // Korekta pozycji Y, żeby zachować proporcje ramki
      if (handle === 'tl' || handle === 'tr') {
        newTop = origBottom - newH;
      } else {
        newBottom = origTop + newH;
      }

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
    document.addEventListener('mouseup',  onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isResizing, canvasWidth, canvasHeight]);

  // 3. AUTO-EXPAND HEIGHT
  useEffect(() => {
    if (phase !== 'editing' || !textareaRef.current) return;
    const textarea = textareaRef.current;

    // Najpierw zwijamy textarea, by poprawnie zmierzyć jeśli usunięto tekst
    textarea.style.height = '0px'; 
    const scrollH = textarea.scrollHeight;
    textarea.style.height = '100%';

    const newWorldH = Math.max(MIN_WORLD_H, scrollH / (100 * viewportRef.current.scale));

    setDraft(prev => {
      if (!prev) return prev;
      if (Math.abs(newWorldH - prev.worldH) < 0.005) return prev;
      return { ...prev, worldH: newWorldH };
    });
  // Szerokość (worldW) w dependencies, aby po zmianie rozmiaru ponownie przeliczyć wysokość
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editText, phase, draft?.worldW]);

  // 4. ZAPIS
  const handleSave = useCallback(() => {
    if (!draft) return;
    const trimmed = editText.trim();

    if (!trimmed) {
      if (draft.isExisting) onTextDelete(draft.id);
      setPhase('idle'); setDraft(null); setEditText('');
      onEditingComplete?.();
      return;
    }

    const data: Partial<TextElement> = {
      x: draft.worldX, y: draft.worldY, width: draft.worldW, height: draft.worldH,
      text: editText, fontSize: draft.fontSize,
      color: draft.color, fontFamily: draft.fontFamily,
      fontWeight: draft.fontWeight, fontStyle: draft.fontStyle, textAlign: draft.textAlign,
    };

    if (draft.isExisting) onTextUpdate(draft.id, data);
    else onTextCreate({ id: draft.id, type: 'text', ...data } as TextElement);

    setPhase('idle'); setDraft(null); setEditText('');
    onEditingComplete?.();
  }, [draft, editText, onTextCreate, onTextUpdate, onTextDelete, onEditingComplete]);

  const handleCancel = useCallback(() => {
    setPhase('idle'); setDraft(null); setEditText(''); setIsResizing(false);
    onEditingComplete?.();
  }, [onEditingComplete]);

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

  useEffect(() => {
    if (phase !== 'editing' || !draft?.isExisting) return;
    onTextUpdate(draft.id, {
      x: draft.worldX, y: draft.worldY, width: draft.worldW, height: draft.worldH,
      text: editText, fontSize: draft.fontSize,
      color: draft.color, fontFamily: draft.fontFamily,
      fontWeight: draft.fontWeight, fontStyle: draft.fontStyle, textAlign: draft.textAlign,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editText, draft?.worldX, draft?.worldY, draft?.worldW, draft?.worldH,
      draft?.fontSize, draft?.color, draft?.fontWeight, draft?.fontStyle, draft?.textAlign]);

  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;
    const onWheel = (e: WheelEvent) => {
      if (phase === 'editing') return; 
      e.preventDefault(); e.stopPropagation();
      const vp = viewportRef.current;
      if (e.ctrlKey) onViewportChange(constrainViewport(zoomViewport(vp, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight)));
      else           onViewportChange(constrainViewport(panViewportWithWheel(vp, e.deltaX, e.deltaY)));
    };
    overlay.addEventListener('wheel', onWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', onWheel);
  }, [canvasWidth, canvasHeight, onViewportChange, phase]);

  // 5. RYSOWANIE NOWEJ RAMKI
  const handleOverlayDown = (e: React.MouseEvent) => {
    if (phase === 'editing' || e.button !== 0) return;
    const world = inverseTransformPoint({ x: e.clientX, y: e.clientY }, viewport, canvasWidth, canvasHeight);
    drawStartWorld.current = world;
    drawCurrWorld.current  = world;
    setPhase('drawing');
    setDrawPreview({ x: world.x, y: world.y, w: 0, h: 0 });
  };

  const handleOverlayMove = (e: React.MouseEvent) => {
    if (phase !== 'drawing' || !drawStartWorld.current) return;
    const world = inverseTransformPoint({ x: e.clientX, y: e.clientY }, viewport, canvasWidth, canvasHeight);
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

    let worldX = Math.min(sx, ex), worldY = Math.min(sy, ey);
    let worldW = Math.abs(ex - sx);

    // Kiedy użytkownik tylko kliknie (lub zrobi bardzo małą ramkę)
    if (worldW < MIN_WORLD_W) {
      worldW = 3.0; // Domyślna szerokość
    }

    // W Miro nowa ramka zawsze ma domyślny rozmiar czcionki
    const initialFontSize = DEFAULT_FONT_SIZE;
    // Orientacyjna wysokość startowa - autoexpand z useEffect i tak ją zaraz poprawi
    const worldH = (initialFontSize * 1.5) / 100;

    setDraft({
      id: Date.now().toString(),
      worldX, worldY, worldW, worldH,
      fontSize:   initialFontSize,
      color:      '#000000',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      fontStyle:  'normal',
      textAlign:  'left',
      isExisting: false,
    });
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
    resizeDraftSnapshot.current = draft ? { ...draft } : null;
    setIsResizing(true);
  };

  let edLeft = 0, edTop = 0, edWidth = 0, edHeight = 0;
  if (draft && phase === 'editing') {
    const tl = transformPoint({ x: draft.worldX, y: draft.worldY }, viewport, canvasWidth, canvasHeight);
    const br = transformPoint({ x: draft.worldX + draft.worldW, y: draft.worldY + draft.worldH }, viewport, canvasWidth, canvasHeight);
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
          data-world-h={draft.worldH}
          className="absolute pointer-events-auto z-50"
          style={{ left: edLeft, top: edTop, width: edWidth, height: edHeight, overflow: 'visible', boxShadow: '0 0 0 2px #3b82f6' }}
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
          <div style={{ ...handleStyle, right: 0, top: 0, transform: 'translate(50%,-50%)', cursor: 'nesw-resize' }} onMouseDown={makeResizeHandler('tr')} />
          <div style={{ ...handleStyle, left: 0, bottom: 0, transform: 'translate(-50%,50%)', cursor: 'nesw-resize' }} onMouseDown={makeResizeHandler('bl')} />
          <div style={{ ...handleStyle, right: 0, bottom: 0, transform: 'translate(50%,50%)', cursor: 'nwse-resize' }} onMouseDown={makeResizeHandler('br')} />
        </div>
      )}
    </div>
  );
}