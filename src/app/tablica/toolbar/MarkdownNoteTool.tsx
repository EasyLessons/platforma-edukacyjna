/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/MarkdownNoteTool.tsx
 * ============================================================================
 * 
 * Narzędzie do tworzenia notatek Markdown na tablicy.
 * Przygotowane pod chatbota - będzie generował odpowiedzi w takich blokach.
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, ViewportTransform, MarkdownNote } from '../whiteboard/types';
import { inverseTransformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownNoteToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onNoteCreate: (note: MarkdownNote) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function MarkdownNoteTool({
  viewport,
  canvasWidth,
  canvasHeight,
  onNoteCreate,
  onViewportChange,
}: MarkdownNoteToolProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Wheel events dla pan/zoom
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey) {
        const newViewport = zoomViewport(viewport, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight);
        onViewportChange(constrainViewport(newViewport));
      } else {
        const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    };

    overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleNativeWheel);
  }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);
    
    setIsCreating(true);
    setStartPoint(worldPoint);
    setCurrentPoint(worldPoint);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isCreating) return;
    
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);
    setCurrentPoint(worldPoint);
  };

  const handleMouseUp = () => {
    if (!isCreating || !startPoint || !currentPoint) {
      setIsCreating(false);
      return;
    }

    const minX = Math.min(startPoint.x, currentPoint.x);
    const minY = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    // Minimalna wielkość
    if (width < 0.3 || height < 0.2) {
      // Jeśli za mały, utwórz z domyślnym małym rozmiarem
      const newNote: MarkdownNote = {
        id: Date.now().toString(),
        type: 'markdown',
        x: startPoint.x,
        y: startPoint.y,
        width: 1.5,
        height: 1,
        content: '',
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
      };
      onNoteCreate(newNote);
    } else {
      const newNote: MarkdownNote = {
        id: Date.now().toString(),
        type: 'markdown',
        x: minX,
        y: minY,
        width,
        height,
        content: '',
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
      };
      onNoteCreate(newNote);
    }

    setIsCreating(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  // Renderuj preview prostokąta podczas tworzenia
  const renderPreview = () => {
    if (!isCreating || !startPoint || !currentPoint) return null;
    if (canvasWidth <= 0 || canvasHeight <= 0) return null;

    const minX = Math.min(startPoint.x, currentPoint.x);
    const minY = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    // Transformuj do współrzędnych ekranu
    const screenX = (minX + viewport.x) * viewport.scale + canvasWidth / 2;
    const screenY = (minY + viewport.y) * viewport.scale + canvasHeight / 2;
    const screenWidth = width * viewport.scale;
    const screenHeight = height * viewport.scale;

    // Sprawdź czy wartości są poprawne
    if (!isFinite(screenX) || !isFinite(screenY) || !isFinite(screenWidth) || !isFinite(screenHeight)) {
      return null;
    }

    return (
      <div
        className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-50/30 rounded-lg"
        style={{
          left: screenX,
          top: screenY,
          width: Math.max(0, screenWidth),
          height: Math.max(0, screenHeight),
        }}
      >
        <div className="absolute top-2 left-2 text-xs text-blue-600 font-medium">
          Notatka Markdown
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: 'crosshair' }}>
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {renderPreview()}
    </div>
  );
}

// 🆕 Komponent do wyświetlania i edycji notatki Markdown (używany w renderowaniu)
interface MarkdownNoteViewProps {
  note: MarkdownNote;
  isEditing: boolean;
  onContentChange: (content: string) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  scale: number; // viewport scale - już nie używamy do skalowania tekstu
}

export function MarkdownNoteView({
  note,
  isEditing,
  onContentChange,
  onEditStart,
  onEditEnd,
  scale,
}: MarkdownNoteViewProps) {
  const [editContent, setEditContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditContent(note.content);
  }, [note.content]);

  const handleBlur = () => {
    onContentChange(editContent);
    onEditEnd();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditContent(note.content);
      onEditEnd();
    }
  };

  // 🆕 Skalowanie tekstu względem rozmiaru notatki (nie viewport!)
  // Bazowa wielkość notatki to 1.5x1 jednostki (domyślna przy kliknięciu)
  // Tekst bazowy: 14px przy width=1.5
  const baseWidth = 1.5;
  const textScale = note.width / baseWidth;
  const baseFontSize = 14;
  const scaledFontSize = Math.max(10, Math.min(32, baseFontSize * textScale));

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full p-3 resize-none border-none outline-none bg-transparent font-mono text-sm text-black"
        style={{ fontSize: `${scaledFontSize}px` }}
        placeholder="Wpisz tekst..."
      />
    );
  }

  return (
    <div
      className="w-full h-full p-2 overflow-auto cursor-pointer text-black markdown-note"
      style={{ fontSize: `${scaledFontSize}px` }}
      onDoubleClick={onEditStart}
    >
      <style jsx>{`
        .markdown-note h1 { font-size: 1.5em; font-weight: bold; margin: 0.3em 0; }
        .markdown-note h2 { font-size: 1.3em; font-weight: bold; margin: 0.3em 0; }
        .markdown-note h3 { font-size: 1.1em; font-weight: bold; margin: 0.2em 0; }
        .markdown-note p { margin: 0.2em 0; }
        .markdown-note strong { font-weight: bold; }
        .markdown-note em { font-style: italic; }
        .markdown-note ul, .markdown-note ol { padding-left: 1.2em; margin: 0.2em 0; }
        .markdown-note li { margin: 0.1em 0; }
        .markdown-note code { background: #f3f4f6; padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace; }
        .markdown-note pre { background: #f3f4f6; padding: 0.5em; border-radius: 4px; overflow-x: auto; }
        .markdown-note blockquote { border-left: 3px solid #d1d5db; padding-left: 0.5em; margin: 0.3em 0; color: #6b7280; }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {note.content || 'Kliknij 2x...'}
      </ReactMarkdown>
    </div>
  );
}
