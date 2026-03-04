/**
 * ============================================================================
 * PLIK: text-tool.tsx — model Miro
 * ============================================================================
 *
 * TWORZENIE:
 *   Przeciągnij → ramka definiuje JEDEN WIERSZ tekstu.
 *   Czcionka dopasowuje się do WYSOKOŚCI ramki (fontSize = worldH * 100 * FONT_HEIGHT_RATIO).
 *   Po puszczeniu myszy → od razu tryb edycji, cały tekst zaznaczony.
 *
 * EDYCJA:
 *   • Textarea siedzi DOKŁADNIE na elemencie (te same world-coords co canvas).
 *   • Widoczna niebieska ramka + 4 uchwyty narożnikowe.
 *   • Tekst zawija się do nowej linii gdy nie mieści się w szerokości (overflowX hidden).
 *   • Na początku cały tekst zaznaczony → wpisanie ZASTĘPUJE go (Miro-style).
 *   • Ponowne kliknięcie w textarea → zwykłe ustawienie kursora.
 *   • ESC / klik poza = zapis.
 *
 * RESIZE:
 *   4 narożniki (tl/tr/bl/br). Każdy przesuwa odpowiednie krawędzie.
 *   Czcionka automatycznie przeliczana z nowej wysokości.
 *
 * INTEGRACJA Z SelectTool:
 *   • Double-click na tekst (cold start) → onTextEdit(id)
 *   • Single-click na już zaznaczony tekst → onTextEdit(id)  [select-tool.tsx]
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

// ─── STAŁA SKALOWANIA CZCIONKI ─────────────────────────────────────────────
// fontSize (px przy scale=1) = worldH * 100 * FONT_HEIGHT_RATIO
//
// Jak to działa:
//   worldH = wysokość ramki w jednostkach świata (1 world unit = 100px przy scale=1)
//   worldH * 100 = wysokość ramki w pikselach przy scale=1
//   * FONT_HEIGHT_RATIO = jaki procent tej wysokości zajmuje czcionka
//
// Przykład: worldH=0.4 → box=40px, fontSize=26px, linia=26*1.4=36.4px ≤ 40px ✓
// Wzór działa tak samo przy każdym zoom — zarówno canvas jak textarea skalują przez scale
const FONT_HEIGHT_RATIO = 0.65;

// Minimalne rozmiary ramki (world units) — żeby nie można było "spłaszczyć" do zera
const MIN_WORLD_W = 0.8;  // 80px przy scale=1
const MIN_WORLD_H = 0.18; // 18px przy scale=1

// ─── INTERFEJSY ─────────────────────────────────────────────────────────────
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
  /** Ref do outer diva edytora — aktualizowany przez whiteboard-canvas w RAF (zero-lag pan) */
  editorDivRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Draft = roboczy obiekt edytowanego/tworzonego tekstu.
 * TYLKO world-units (nie screen-px) — przeliczamy na ekran w każdym renderze.
 * Dzięki temu po pan/zoom edytor automatycznie trafia w dobre miejsce.
 *
 * @property isExisting  - true gdy edytujemy istniejący element (nie nowo tworzony)
 * @property fontSize    - px przy scale=1, obliczany z worldH * 100 * FONT_HEIGHT_RATIO
 */
interface Draft {
  id:         string;
  worldX:     number; // lewy górny X
  worldY:     number; // lewy górny Y
  worldW:     number; // szerokość
  worldH:     number; // wysokość
  fontSize:   number; // px przy scale=1
  color:      string;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle:  'normal' | 'italic';
  textAlign:  'left' | 'center' | 'right';
  isExisting: boolean;
}

// ─── GŁÓWNY KOMPONENT ────────────────────────────────────────────────────────
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

  // ── FAZY ────────────────────────────────────────────────────────────────
  // 'idle'    → overlay wychwytuje kliknięcia, nic nie jest otwarte
  // 'drawing' → użytkownik przeciąga myszką tworząc nową ramkę
  // 'editing' → edytor tekstowy widoczny, textarea aktywna
  const [phase, setPhase] = useState<'idle' | 'drawing' | 'editing'>('idle');

  // ── DRAFT — roboczy obiekt tekstu ────────────────────────────────────────
  const [draft, setDraft] = useState<Draft | null>(null);

  // Punkty startu/końca podczas przeciągania (refs = nie powodują re-renderów)
  const drawStartWorld = useRef<Point | null>(null);
  const drawCurrWorld  = useRef<Point | null>(null);

  // Preview ramki podczas rysowania (state bo musi triggerować re-render)
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // ── TEKST EDYTORA ────────────────────────────────────────────────────────
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── RESIZE ───────────────────────────────────────────────────────────────
  // isResizing=true blokuje clickOutside (żeby nie zamknąć edytora podczas resize)
  const [isResizing, setIsResizing] = useState(false);
  const resizeHandleRef     = useRef<string>('');             // 'tl'|'tr'|'bl'|'br'
  const resizeStartMouse    = useRef<Point>({ x: 0, y: 0 }); // pozycja myszy na starcie
  const resizeDraftSnapshot = useRef<Draft | null>(null);     // kopia draftu na starcie

  // ── REF DO OUTER DIVA EDYTORA ─────────────────────────────────────────
  const editorRef = useRef<HTMLDivElement | null>(null);

  // ── VIEWPORT REF (dla wheel handlera bez re-subscribe) ──────────────────
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER: fontSize z wysokości ramki
  // ══════════════════════════════════════════════════════════════════════════
  /**
   * Oblicza fontSize (px przy scale=1) na podstawie wysokości w world units.
   * Na canvas: rendering.ts używa clampFontSize(fontSize, scale) = fontSize*scale
   * W edytorze: textarea używa fontSize*viewport.scale
   * → obydwa źródła wyglądają identycznie przy każdym zoom ✓
   */
  const fontSizeFromHeight = (worldH: number): number =>
    Math.max(8, worldH * 100 * FONT_HEIGHT_RATIO);

  // ══════════════════════════════════════════════════════════════════════════
  // OTWIERANIE EDYCJI ISTNIEJĄCEGO TEKSTU (sygnał z SelectTool)
  // ══════════════════════════════════════════════════════════════════════════
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
  // Celowo pomijamy `elements` — chcemy odpalić tylko gdy zmienia się id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTextId]);

  // Gdy faza zmienia się na 'editing' → zaznacz cały tekst (Miro: pisanie zastępuje)
  // requestAnimationFrame żeby textarea zdążyła się zamontować
  useEffect(() => {
    if (phase !== 'editing') return;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
  }, [phase]);

  // ══════════════════════════════════════════════════════════════════════════
  // RESIZE — document-level mouse listeners
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      const snap   = resizeDraftSnapshot.current;
      const handle = resizeHandleRef.current;
      if (!snap) return;

      // Piksele przesunięcia → world units
      // pxPerUnit = ile pikseli ekranu odpowiada 1 world unit przy bieżącym zoom
      const pxPerUnit = viewport.scale * 100;
      const dxW = (e.clientX - resizeStartMouse.current.x) / pxPerUnit;
      const dyW = (e.clientY - resizeStartMouse.current.y) / pxPerUnit;

      // Każdy narożnik przesuwa odpowiednie dwie krawędzie:
      //   'l' = lewa krawędź → X zwiększa się, W maleje o tę samą deltę
      //   'r' = prawa krawędź → W rośnie
      //   't' = górna krawędź → Y zwiększa się, H maleje
      //   'b' = dolna krawędź → H rośnie
      let newX = snap.worldX, newY = snap.worldY;
      let newW = snap.worldW, newH = snap.worldH;

      if (handle.includes('l')) { newX = snap.worldX + dxW; newW = snap.worldW - dxW; }
      if (handle.includes('r')) {                            newW = snap.worldW + dxW; }
      if (handle.includes('t')) { newY = snap.worldY + dyW; newH = snap.worldH - dyW; }
      if (handle.includes('b')) {                            newH = snap.worldH + dyW; }

      // Wymuś minima — nie pozwól "odwrócić" ramki
      if (newW < MIN_WORLD_W) { if (handle.includes('l')) newX = snap.worldX + snap.worldW - MIN_WORLD_W; newW = MIN_WORLD_W; }
      if (newH < MIN_WORLD_H) { if (handle.includes('t')) newY = snap.worldY + snap.worldH - MIN_WORLD_H; newH = MIN_WORLD_H; }

      setDraft(prev => prev ? { ...prev, worldX: newX, worldY: newY, worldW: newW, worldH: newH, fontSize: fontSizeFromHeight(newH) } : prev);
    };

    const onUp = () => setIsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',  onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  // viewport.scale potrzebny do przeliczenia px→world podczas resize
  }, [isResizing, viewport.scale]);

  // ══════════════════════════════════════════════════════════════════════════
  // ZAPIS / ANULOWANIE
  // ══════════════════════════════════════════════════════════════════════════
  const handleSave = useCallback(() => {
    if (!draft) return;
    const trimmed = editText.trim();

    if (!trimmed) {
      // Pusty tekst → usuń istniejący lub po prostu zamknij
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

  // ══════════════════════════════════════════════════════════════════════════
  // KLIK POZA EDYTOREM = ZAPIS
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== 'editing') return;

    const onDown = (e: MouseEvent) => {
      if (isResizing) return; // resize w toku — nie zamykaj
      if (editorRef.current?.contains(e.target as Node)) return;
      handleSave();
    };

    // Delay 100ms — żeby nie zapalić się od mousedown który otworzył edytor
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 100);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); };
  }, [phase, isResizing, handleSave]);

  // ══════════════════════════════════════════════════════════════════════════
  // LIVE UPDATE CANVAS podczas pisania/resize (tylko istniejące elementy)
  // ══════════════════════════════════════════════════════════════════════════
  // Nowe elementy live-update nie mają sensu — element jeszcze nie istnieje na canvas.
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

  // ══════════════════════════════════════════════════════════════════════════
  // WHEEL — PAN/ZOOM (wyłączony podczas edycji — textarea ma własny scroll)
  // ══════════════════════════════════════════════════════════════════════════
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;
    const onWheel = (e: WheelEvent) => {
      if (phase === 'editing') return; // textarea obsługuje scroll sama
      e.preventDefault(); e.stopPropagation();
      const vp = viewportRef.current;
      if (e.ctrlKey) onViewportChange(constrainViewport(zoomViewport(vp, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight)));
      else           onViewportChange(constrainViewport(panViewportWithWheel(vp, e.deltaX, e.deltaY)));
    };
    overlay.addEventListener('wheel', onWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', onWheel);
  }, [canvasWidth, canvasHeight, onViewportChange, phase]);

  // ══════════════════════════════════════════════════════════════════════════
  // RYSOWANIE NOWEJ RAMKI
  // ══════════════════════════════════════════════════════════════════════════
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
    let worldW = Math.abs(ex - sx), worldH = Math.abs(ey - sy);

    // Klik bez przeciągnięcia → domyślna ramka (3 world wide × 0.4 high)
    if (worldW < MIN_WORLD_W || worldH < MIN_WORLD_H) {
      worldW = 3.0; worldH = 0.4;
    }

    setDraft({
      id: Date.now().toString(),
      worldX, worldY, worldW, worldH,
      fontSize:   fontSizeFromHeight(worldH),
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

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER UCHWYTÓW RESIZE
  // ══════════════════════════════════════════════════════════════════════════
  /**
   * Zwraca onMouseDown dla narożnika 'tl'|'tr'|'bl'|'br'.
   * Zapisuje snapshot draftu i pozycję myszy → aktywuje document-level listener.
   */
  const makeResizeHandler = (handle: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // blokuje clickOutside
    resizeHandleRef.current     = handle;
    resizeStartMouse.current    = { x: e.clientX, y: e.clientY };
    resizeDraftSnapshot.current = draft ? { ...draft } : null;
    setIsResizing(true);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Pozycja ekranowa edytora (z world coords + bieżącego viewport)
  // Przeliczane w każdym renderze → edytor zawsze na właściwym miejscu po pan/zoom
  let edLeft = 0, edTop = 0, edWidth = 0, edHeight = 0;
  if (draft && phase === 'editing') {
    const tl = transformPoint({ x: draft.worldX, y: draft.worldY }, viewport, canvasWidth, canvasHeight);
    const br = transformPoint({ x: draft.worldX + draft.worldW, y: draft.worldY + draft.worldH }, viewport, canvasWidth, canvasHeight);
    edLeft = tl.x; edTop = tl.y; edWidth = br.x - tl.x; edHeight = br.y - tl.y;
  }

  // fontSize w pikselach ekranu = worldFontSize * scale
  // Taki sam wzór jak w rendering.ts (clampFontSize) → edytor = canvas ✓
  const fontSizePx = draft ? Math.max(8, draft.fontSize * viewport.scale) : 14;

  // Styl wspólny dla 4 uchwytów
  const HS = 10; // rozmiar kółka w px
  const handleStyle: React.CSSProperties = {
    position: 'absolute', width: HS, height: HS,
    borderRadius: '50%', background: '#fff', border: '2px solid #3b82f6',
    zIndex: 70, pointerEvents: 'auto',
  };

  // Preview ramki (world → screen)
  let previewRect: React.CSSProperties | null = null;
  if (phase === 'drawing' && drawPreview) {
    const tl = transformPoint({ x: drawPreview.x, y: drawPreview.y }, viewport, canvasWidth, canvasHeight);
    const br = transformPoint({ x: drawPreview.x + drawPreview.w, y: drawPreview.y + drawPreview.h }, viewport, canvasWidth, canvasHeight);
    previewRect = { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  }

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: phase === 'editing' ? 'default' : 'text' }}>

      {/* OVERLAY — wychwytuje kliknięcia do rysowania (tylko gdy nie edytujemy) */}
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

      {/* PREVIEW RAMKI podczas rysowania */}
      {phase === 'drawing' && previewRect && (
        <div
          className="absolute pointer-events-none z-40 border-2 border-dashed border-blue-400 bg-blue-50/10"
          style={previewRect}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          EDYTOR TEKSTOWY — dwuwarstwowy:
          ┌─ OUTER WRAPPER (overflow:visible) ──────────────────────────────┐
          │  handles resign na narożnikach (wychodzą poza border = visible) │
          │  ┌─ INNER BOX (overflow:hidden + border 2px blue) ────────────┐ │
          │  │  textarea 100%×100%                                        │ │
          │  │  overflowX:hidden → tekst zawija się po szerokości         │ │
          │  └────────────────────────────────────────────────────────────┘ │
          └──────────────────────────────────────────────────────────────────┘
          ════════════════════════════════════════════════════════════════════ */}
      {phase === 'editing' && draft && (
        // OUTER WRAPPER
        <div
          ref={(node) => {
            editorRef.current = node;
            if (editorDivRef) (editorDivRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className="absolute pointer-events-auto z-50"
          style={{ left: edLeft, top: edTop, width: edWidth, height: edHeight, overflow: 'visible', outline: '2px solid #3b82f6', outlineOffset: '0px' }}
        >
          {/* MINI TOOLBAR */}
          <div className="absolute -top-12 left-0 z-50">
            <TextMiniToolbar
              style={{ fontSize: draft.fontSize, color: draft.color, fontWeight: draft.fontWeight, fontStyle: draft.fontStyle, textAlign: draft.textAlign }}
              onChange={(updates) => setDraft(prev => prev ? { ...prev, ...updates } : prev)}
            />
          </div>

          {/* INNER BOX — overflow:hidden przycina textarea → zawijanie tekstu */}
          <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', overflow: 'hidden', background: 'rgba(255,255,255,0.93)' }}>
            {/*
              TEXTAREA
              overflowX:hidden  → brak poziomego scrolla → tekst MUSI zawijać do nowej linii
              overflowY:auto    → pionowy scroll gdy wiele linii
              whiteSpace:pre-wrap     → zachowuje entery i spacje, ale zawija długie linie
              overflowWrap:break-word → łamie bardzo długie słowa bez spacji
              fontSize = draft.fontSize * scale → identycznie jak canvas (clampFontSize)
            */}
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); handleCancel(); } }}
              placeholder="Wpisz tekst..."
              className="no-scrollbar px-3 py-2 border-none bg-transparent resize-none outline-none"
              style={{
                fontSize:     `${fontSizePx}px`,
                color:         draft.color,
                fontFamily:    draft.fontFamily,
                fontWeight:    draft.fontWeight,
                fontStyle:     draft.fontStyle,
                textAlign:     draft.textAlign,
                lineHeight:    '1.4',
                overflowWrap: 'break-word' as const,
                whiteSpace:   'pre-wrap'   as const,
                overflowX:    'hidden'     as const,
                overflowY:    'auto'       as const,
                width:        '100%',
                height:       '100%',
                boxSizing:    'border-box',
              }}
            />
          </div>

          {/* 4 UCHWYTY RESIZE (position:absolute względem OUTER WRAPPERA)
              translate(-50%,-50%) centruje kółko dokładnie na narożniku outer diva
              Widoczne bo outer ma overflow:visible */}

          {/* Lewy górny — przesuwa lewą i górną krawędź */}
          <div style={{ ...handleStyle, left: 0, top: 0, transform: 'translate(-50%,-50%)', cursor: 'nwse-resize' }} onMouseDown={makeResizeHandler('tl')} />
          {/* Prawy górny — przesuwa prawą i górną krawędź */}
          <div style={{ ...handleStyle, right: 0, top: 0, transform: 'translate(50%,-50%)', cursor: 'nesw-resize' }} onMouseDown={makeResizeHandler('tr')} />
          {/* Lewy dolny — przesuwa lewą i dolną krawędź */}
          <div style={{ ...handleStyle, left: 0, bottom: 0, transform: 'translate(-50%,50%)', cursor: 'nesw-resize' }} onMouseDown={makeResizeHandler('bl')} />
          {/* Prawy dolny — przesuwa prawą i dolną krawędź */}
          <div style={{ ...handleStyle, right: 0, bottom: 0, transform: 'translate(50%,50%)', cursor: 'nwse-resize' }} onMouseDown={makeResizeHandler('br')} />
        </div>
      )}
    </div>
  );
}
