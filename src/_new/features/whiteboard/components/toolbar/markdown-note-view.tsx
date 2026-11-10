/**
 * Widok notatki Markdown + KaTeX (react-markdown, remark-gfm, remark-math, rehype-katex).
 *
 * Używany przez element `note` tablicy Excalidraw (board-engine/elements/note.tsx), który
 * czyta z notatki tylko `content`. Narzędzie rysowania notatki starego silnika zostało usunięte
 * w etapie F (docs/architecture/ADR-silnik-tablicy.md).
 */

'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import type { MarkdownNote } from '@/_new/features/whiteboard/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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
  noteId: string; // ID notatki - używane zamiast closure w callbackach
  onContentChange: (noteId: string, content: string) => void; // Stabilny callback z noteId
  onEditStart: (noteId: string) => void; // Stabilny callback z noteId
  onEditEnd: () => void; // Stabilny callback bez argumentów
  remoteTypingUser?: string; // 🆕 Nazwa użytkownika który aktualnie edytuje (realtime)
}

export const MarkdownNoteView = memo(
  function MarkdownNoteView({
    note,
    isEditing,
    noteId,
    onContentChange,
    onEditStart,
    onEditEnd,
    remoteTypingUser,
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
          className="w-full h-full p-2 resize-none border-none outline-none backdrop-blur-md bg-white/60 font-mono text-black no-scrollbar"
          style={{ fontSize: `${fontSize}px` }}
          placeholder="Wpisz tekst markdown..."
        />
      );
    }

    return (
      <div className="relative w-full h-full">
        {/* 🆕 TYPING INDICATOR - kto edytuje */}
        {remoteTypingUser && (
          <div className="absolute top-0 left-0 right-0 bg-blue-500/90 text-white text-xs px-2 py-0.5 z-10 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-medium">{remoteTypingUser}</span>
            <span className="opacity-80">edytuje...</span>
          </div>
        )}
        <div
          className="w-full h-full p-2 overflow-hidden cursor-pointer text-black"
          style={{ fontSize: `${fontSize}px`, paddingTop: remoteTypingUser ? '24px' : '8px' }}
          onDoubleClick={() => onEditStart(noteId)}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              h1: ({ children }) => <h1 className="text-xl font-bold my-1">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-bold my-1">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-semibold my-0.5">{children}</h3>,
              h4: ({ children }) => <h4 className="font-semibold my-0.5">{children}</h4>,
              p: ({ children }) => <p className="my-0.5">{children}</p>,
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="list-disc pl-4 my-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 my-0.5">{children}</ol>,
              li: ({ children }) => <li className="my-0">{children}</li>,
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <code
                      className={`block bg-gray-100 p-1 rounded text-xs font-mono overflow-x-auto ${className}`}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="bg-gray-100 px-0.5 rounded text-xs font-mono">{children}</code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-gray-100 p-1 rounded my-1 overflow-x-auto text-xs">
                  {children}
                </pre>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-gray-300 pl-2 my-1 text-gray-600 italic text-sm">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <table className="border-collapse my-1 text-xs">{children}</table>
              ),
              th: ({ children }) => (
                <th className="border border-gray-300 px-1 py-0.5 bg-gray-100 font-semibold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-gray-300 px-1 py-0.5">{children}</td>
              ),
            }}
          >
            {note.content || 'Kliknij 2x aby edytować...'}
          </ReactMarkdown>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Re-render TYLKO gdy zmienia się content, edycja lub remoteTypingUser
    // NIE przy pan/zoom - to eliminuje ghosting
    // WAŻNE: NIE porównujemy callbacków bo są teraz stabilne (useCallback w parent)
    return (
      prevProps.noteId === nextProps.noteId &&
      prevProps.note.content === nextProps.note.content &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.remoteTypingUser === nextProps.remoteTypingUser
    );
  }
);
