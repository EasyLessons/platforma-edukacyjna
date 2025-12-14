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

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, memo } from 'react';
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
  
  // Ref do viewport żeby uniknąć re-subscribe wheel listenera
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // Wheel events dla pan/zoom - używa viewportRef
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !onViewportChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const currentViewport = viewportRef.current;

      if (e.ctrlKey) {
        const newViewport = zoomViewport(currentViewport, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight);
        onViewportChange(constrainViewport(newViewport));
      } else {
        const newViewport = panViewportWithWheel(currentViewport, e.deltaX, e.deltaY);
        onViewportChange(constrainViewport(newViewport));
      }
    };

    overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', handleNativeWheel);
  }, [canvasWidth, canvasHeight, onViewportChange]);

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

    // Minimalna wielkość - jeśli za mały, nie twórz (wymaga przeciągnięcia)
    if (width < 0.3 || height < 0.2) {
      setIsCreating(false);
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

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
        className="absolute pointer-events-none border-2 border-dashed border-blue-500 bg-blue-50/30 rounded-lg z-40"
        style={{
          left: screenX,
          top: screenY,
          width: Math.max(0, screenWidth),
          height: Math.max(0, screenHeight),
        }}
      />
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

// Komponent do wyświetlania i edycji notatki Markdown (używany w renderowaniu)
// MEMOIZOWANY - nie re-renderuje się gdy zmienia się tylko viewport
interface MarkdownNoteViewProps {
  note: MarkdownNote;
  isEditing: boolean;
  onContentChange: (content: string) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onHeightChange?: (newHeight: number) => void; // Callback gdy treść wymaga więcej miejsca
}

export const MarkdownNoteView = memo(function MarkdownNoteView({
  note,
  isEditing,
  onContentChange,
  onEditStart,
  onEditEnd,
  onHeightChange,
}: MarkdownNoteViewProps) {
  const [editContent, setEditContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastReportedHeightRef = useRef<number>(0); // Zapobiegamy wielokrotnym wywołaniom

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditContent(note.content);
  }, [note.content]);

  // Mierz wysokość treści po renderze i rozszerz notatkę jeśli potrzeba
  // TYLKO gdy zmienia się content - nie containerHeight!
  useLayoutEffect(() => {
    if (!isEditing && contentRef.current && onHeightChange) {
      // Daj moment na render ReactMarkdown i KaTeX
      const timer = setTimeout(() => {
        if (contentRef.current) {
          const contentHeight = contentRef.current.scrollHeight;
          // Wywołuj tylko jeśli wysokość ZNACZNIE się zmieniła (>20px różnicy)
          // i nie jest taka sama jak ostatnio zgłoszona
          if (Math.abs(contentHeight - lastReportedHeightRef.current) > 20) {
            lastReportedHeightRef.current = contentHeight;
            onHeightChange(contentHeight);
          }
        }
      }, 100); // Dłuższy delay żeby KaTeX się wyrenderował
      return () => clearTimeout(timer);
    }
  }, [note.content, isEditing, onHeightChange]); // BEZ containerHeight!

  // Auto-resize textarea podczas edycji
  useEffect(() => {
    if (isEditing && textareaRef.current && onHeightChange) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      // Wywołuj tylko jeśli znaczna różnica
      if (Math.abs(scrollHeight - lastReportedHeightRef.current) > 20) {
        lastReportedHeightRef.current = scrollHeight;
        onHeightChange(scrollHeight);
      }
    }
  }, [editContent, isEditing, onHeightChange]);

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

  // Stały rozmiar czcionki - bez dynamicznego skalowania dla lepszej wydajności
  const fontSize = 14;

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full p-3 resize-none border-none outline-none bg-transparent font-mono text-sm text-black"
        style={{ 
          fontSize: `${fontSize}px`,
          minHeight: '100%',
          height: 'auto',
        }}
        placeholder="Wpisz tekst..."
      />
    );
  }

  return (
    <div
      ref={contentRef}
      className="w-full p-2 cursor-pointer text-black"
      style={{ 
        fontSize: `${fontSize}px`,
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        minHeight: '100%',
      }}
      onDoubleClick={onEditStart}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({children}) => <h1 className="text-2xl font-bold my-2">{children}</h1>,
          h2: ({children}) => <h2 className="text-xl font-bold my-2">{children}</h2>,
          h3: ({children}) => <h3 className="text-lg font-semibold my-1">{children}</h3>,
          h4: ({children}) => <h4 className="text-base font-semibold my-1">{children}</h4>,
          p: ({children}) => <p className="my-1">{children}</p>,
          strong: ({children}) => <strong className="font-bold">{children}</strong>,
          em: ({children}) => <em className="italic">{children}</em>,
          ul: ({children}) => <ul className="list-disc pl-5 my-1">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal pl-5 my-1">{children}</ol>,
          li: ({children}) => <li className="my-0.5">{children}</li>,
          code: ({children, className}) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return <code className={`block bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto ${className}`}>{children}</code>;
            }
            return <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>;
          },
          pre: ({children}) => <pre className="bg-gray-100 p-2 rounded my-2 overflow-x-auto">{children}</pre>,
          blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-2 text-gray-600 italic">{children}</blockquote>,
        }}
      >
        {note.content || 'Kliknij 2x...'}
      </ReactMarkdown>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render only when these change
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.content === nextProps.note.content &&
    prevProps.isEditing === nextProps.isEditing
  );
});
