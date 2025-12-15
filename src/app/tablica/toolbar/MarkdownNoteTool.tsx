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

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
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

    // Używaj tej samej formuły co transformPoint!
    // scale = viewport.scale * 100 (100px = 1 jednostka)
    const scale = viewport.scale * 100;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    const screenX = (minX - viewport.x) * scale + centerX;
    const screenY = (minY - viewport.y) * scale + centerY;
    const screenWidth = width * scale;
    const screenHeight = height * scale;

    // Sprawdź czy wartości są poprawne
    if (!isFinite(screenX) || !isFinite(screenY) || !isFinite(screenWidth) || !isFinite(screenHeight)) {
      return null;
    }

    return (
      <div
        className="absolute pointer-events-none border-2 border-dashed border-yellow-500 bg-yellow-50/30 rounded-lg z-40"
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
// PROSTA ARCHITEKTURA:
// - Notatka ma STAŁY rozmiar (user zmienia resize handlerem)
// - Font STAŁY 14px - notatka skaluje się z viewport (CSS transform)
// - Overflow scroll dla długich treści
// - ZERO re-renderów przy pan/zoom - tylko przy zmianie content/editing
// - WAŻNE: używamy noteId + stabilnych callbacków zamiast inline funkcji żeby nie łamać memo!
interface MarkdownNoteViewProps {
  note: MarkdownNote;
  isEditing: boolean;
  noteId: string;  // ID notatki - używane zamiast closure w callbackach
  onContentChange: (noteId: string, content: string) => void;  // Stabilny callback z noteId
  onEditStart: (noteId: string) => void;  // Stabilny callback z noteId
  onEditEnd: () => void;  // Stabilny callback bez argumentów
}

export const MarkdownNoteView = memo(function MarkdownNoteView({
  note,
  isEditing,
  noteId,
  onContentChange,
  onEditStart,
  onEditEnd,
}: MarkdownNoteViewProps) {
  const [editContent, setEditContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditContent(note.content);
  }, [note.content]);

  const handleBlur = () => {
    onContentChange(noteId, editContent);
    onEditEnd();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditContent(note.content);
      onEditEnd();
    }
  };

  // Stały rozmiar czcionki - notatka skaluje się przez CSS transform kontenera
  const fontSize = 14;

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full p-2 resize-none border-none outline-none bg-white/50 font-mono text-black"
        style={{ fontSize: `${fontSize}px` }}
        placeholder="Wpisz tekst markdown..."
      />
    );
  }

  return (
    <div
      className="w-full h-full p-2 overflow-auto cursor-pointer text-black"
      style={{ fontSize: `${fontSize}px` }}
      onDoubleClick={() => onEditStart(noteId)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({children}) => <h1 className="text-xl font-bold my-1">{children}</h1>,
          h2: ({children}) => <h2 className="text-lg font-bold my-1">{children}</h2>,
          h3: ({children}) => <h3 className="text-base font-semibold my-0.5">{children}</h3>,
          h4: ({children}) => <h4 className="font-semibold my-0.5">{children}</h4>,
          p: ({children}) => <p className="my-0.5">{children}</p>,
          strong: ({children}) => <strong className="font-bold">{children}</strong>,
          em: ({children}) => <em className="italic">{children}</em>,
          ul: ({children}) => <ul className="list-disc pl-4 my-0.5">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal pl-4 my-0.5">{children}</ol>,
          li: ({children}) => <li className="my-0">{children}</li>,
          code: ({children, className}) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return <code className={`block bg-gray-100 p-1 rounded text-xs font-mono overflow-x-auto ${className}`}>{children}</code>;
            }
            return <code className="bg-gray-100 px-0.5 rounded text-xs font-mono">{children}</code>;
          },
          pre: ({children}) => <pre className="bg-gray-100 p-1 rounded my-1 overflow-x-auto text-xs">{children}</pre>,
          blockquote: ({children}) => <blockquote className="border-l-2 border-gray-300 pl-2 my-1 text-gray-600 italic text-sm">{children}</blockquote>,
          table: ({children}) => <table className="border-collapse my-1 text-xs">{children}</table>,
          th: ({children}) => <th className="border border-gray-300 px-1 py-0.5 bg-gray-100 font-semibold">{children}</th>,
          td: ({children}) => <td className="border border-gray-300 px-1 py-0.5">{children}</td>,
        }}
      >
        {note.content || 'Kliknij 2x aby edytować...'}
      </ReactMarkdown>
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render TYLKO gdy zmienia się content lub edycja
  // NIE przy pan/zoom - to eliminuje ghosting
  // WAŻNE: NIE porównujemy callbacków bo są teraz stabilne (useCallback w parent)
  return (
    prevProps.noteId === nextProps.noteId &&
    prevProps.note.content === nextProps.note.content &&
    prevProps.isEditing === nextProps.isEditing
  );
});
