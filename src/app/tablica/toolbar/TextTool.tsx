'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react';
import { Point, ViewportTransform, TextElement } from '../whiteboard/types';
import { transformPoint, inverseTransformPoint } from '../whiteboard/viewport';

interface TextToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onTextCreate: (text: TextElement) => void;
  onTextUpdate: (id: string, updates: Partial<TextElement>) => void;
  onTextDelete: (id: string) => void;
}

interface TextDraft {
  id: string;
  screenStart: Point;
  screenEnd: Point;
  worldStart: Point;
  worldEnd: Point;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
}

export function TextTool({
  viewport,
  canvasWidth,
  canvasHeight,
  onTextCreate,
  onTextUpdate,
  onTextDelete,
}: TextToolProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Start dragging to create text box
  const handleMouseDown = (e: React.MouseEvent) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    const newDraft: TextDraft = {
      id: Date.now().toString(),
      screenStart: screenPoint,
      screenEnd: screenPoint,
      worldStart: worldPoint,
      worldEnd: worldPoint,
      text: '',
      fontSize: 24,
      color: '#000000',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
    };

    setTextDraft(newDraft);
    setIsDragging(true);
  };

  // Update text box size while dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !textDraft) return;

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    setTextDraft({
      ...textDraft,
      screenEnd: screenPoint,
      worldEnd: worldPoint,
    });
  };

  // Finish dragging and show textarea
  const handleMouseUp = () => {
    if (!isDragging || !textDraft) return;

    setIsDragging(false);

    // Calculate box dimensions
    const width = Math.abs(textDraft.screenEnd.x - textDraft.screenStart.x);
    const height = Math.abs(textDraft.screenEnd.y - textDraft.screenStart.y);

    // Minimum size: 100x50
    if (width < 100 || height < 50) {
      // Too small - show default size
      setTextDraft({
        ...textDraft,
        screenEnd: {
          x: textDraft.screenStart.x + 300,
          y: textDraft.screenStart.y + 100,
        },
      });
    }

    setIsEditing(true);
    setEditingText('');
  };

  // Save text element
  const handleSaveText = () => {
    if (!textDraft || !editingText.trim()) {
      // Cancel if no text
      setTextDraft(null);
      setIsEditing(false);
      setEditingText('');
      return;
    }

    const width = Math.abs(textDraft.worldEnd.x - textDraft.worldStart.x);
    const height = Math.abs(textDraft.worldEnd.y - textDraft.worldStart.y);

    const newText: TextElement = {
      id: textDraft.id,
      type: 'text',
      x: Math.min(textDraft.worldStart.x, textDraft.worldEnd.x),
      y: Math.min(textDraft.worldStart.y, textDraft.worldEnd.y),
      width: width,
      height: height,
      text: editingText.trim(),
      fontSize: textDraft.fontSize,
      color: textDraft.color,
      fontFamily: textDraft.fontFamily,
      fontWeight: textDraft.fontWeight,
      fontStyle: textDraft.fontStyle,
      textAlign: textDraft.textAlign,
    };

    onTextCreate(newText);

    // Reset
    setTextDraft(null);
    setIsEditing(false);
    setEditingText('');
  };

  // Cancel text creation
  const handleCancel = () => {
    setTextDraft(null);
    setIsEditing(false);
    setEditingText('');
  };

  // Auto-focus textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ cursor: 'crosshair' }}
    >
      {/* Invisible overlay for mouse events */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {/* Dragging box preview */}
      {isDragging && textDraft && (
        <div
          className="absolute border-2 border-dashed border-blue-500 bg-blue-50/20 pointer-events-none"
          style={{
            left: Math.min(textDraft.screenStart.x, textDraft.screenEnd.x),
            top: Math.min(textDraft.screenStart.y, textDraft.screenEnd.y),
            width: Math.abs(textDraft.screenEnd.x - textDraft.screenStart.x),
            height: Math.abs(textDraft.screenEnd.y - textDraft.screenStart.y),
          }}
        />
      )}

      {/* Text editor */}
      {isEditing && textDraft && (
        <div
          className="absolute"
          style={{
            left: Math.min(textDraft.screenStart.x, textDraft.screenEnd.x),
            top: Math.min(textDraft.screenStart.y, textDraft.screenEnd.y),
            width: Math.abs(textDraft.screenEnd.x - textDraft.screenStart.x),
            height: Math.abs(textDraft.screenEnd.y - textDraft.screenStart.y),
          }}
        >
          {/* Mini Toolbar */}
          <div className="absolute -top-12 left-0 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-1 p-1 z-50">
            {/* Font size */}
            <input
              type="number"
              value={textDraft.fontSize}
              onChange={(e) =>
                setTextDraft({ ...textDraft, fontSize: Number(e.target.value) })
              }
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
              min="8"
              max="120"
            />

            {/* Color */}
            <input
              type="color"
              value={textDraft.color}
              onChange={(e) => setTextDraft({ ...textDraft, color: e.target.value })}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
            />

            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Bold */}
            <button
              onClick={() =>
                setTextDraft({
                  ...textDraft,
                  fontWeight: textDraft.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
              className={`p-1.5 rounded transition-colors ${
                textDraft.fontWeight === 'bold'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Pogrubienie"
            >
              <Bold className="w-4 h-4" />
            </button>

            {/* Italic */}
            <button
              onClick={() =>
                setTextDraft({
                  ...textDraft,
                  fontStyle: textDraft.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
              className={`p-1.5 rounded transition-colors ${
                textDraft.fontStyle === 'italic'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Kursywa"
            >
              <Italic className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Align Left */}
            <button
              onClick={() => setTextDraft({ ...textDraft, textAlign: 'left' })}
              className={`p-1.5 rounded transition-colors ${
                textDraft.textAlign === 'left'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Do lewej"
            >
              <AlignLeft className="w-4 h-4" />
            </button>

            {/* Align Center */}
            <button
              onClick={() => setTextDraft({ ...textDraft, textAlign: 'center' })}
              className={`p-1.5 rounded transition-colors ${
                textDraft.textAlign === 'center'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Wyśrodkuj"
            >
              <AlignCenter className="w-4 h-4" />
            </button>

            {/* Align Right */}
            <button
              onClick={() => setTextDraft({ ...textDraft, textAlign: 'right' })}
              className={`p-1.5 rounded transition-colors ${
                textDraft.textAlign === 'right'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Do prawej"
            >
              <AlignRight className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Cancel */}
            <button
              onClick={handleCancel}
              className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
              title="Anuluj"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={handleSaveText}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
              }
              // Enter = nowa linia (Shift+Enter też)
              // Ctrl+Enter = zapisz
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleSaveText();
              }
            }}
            placeholder="Wpisz tekst... (Ctrl+Enter aby zapisać)"
            className="w-full h-full px-3 py-2 border-2 border-blue-500 rounded bg-white/95 resize-none outline-none"
            style={{
              fontSize: `${textDraft.fontSize}px`,
              color: textDraft.color,
              fontFamily: textDraft.fontFamily,
              fontWeight: textDraft.fontWeight,
              fontStyle: textDraft.fontStyle,
              textAlign: textDraft.textAlign,
              lineHeight: '1.4',
            }}
          />

          {/* Hint */}
          <div className="absolute -bottom-8 left-0 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm">
            Ctrl+Enter = Zapisz | Escape = Anuluj
          </div>
        </div>
      )}
    </div>
  );
}