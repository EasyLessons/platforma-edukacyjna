/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/WhiteboardCanvas.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, useRef, useEffect, useCallback)
 * - ../toolbar/Toolbar (Toolbar, Tool, ShapeType, ZoomControls)
 * - ./types (Point, ViewportTransform, DrawingElement, DrawingPath, Shape, TextElement, FunctionPlot)
 * - ./viewport (transformPoint, inverseTransformPoint, panViewportWithMouse, panViewportWithWheel, zoomViewport, constrainViewport)
 * - ./Grid (drawGrid)
 * - ./rendering (drawElement)
 * 
 * EKSPORTUJE:
 * - WhiteboardCanvas (named) - główny komponent canvas tablicy
 * - WhiteboardCanvas (default) - eksport domyślny
 * 
 * UŻYWANE PRZEZ:
 * - page.tsx (strona /tablica)
 * 
 * PRZEZNACZENIE:
 * Główny komponent tablicy interaktywnej. Zarządza canvas, viewport (pan/zoom),
 * narzędziami rysowania (pen, shape, text, function), zaznaczaniem elementów,
 * historią (undo/redo), oraz obsługą myszy/touchpada. Integruje wszystkie
 * moduły whiteboard w jedną spójną aplikację.
 * ============================================================================
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Toolbar, { Tool, ShapeType, ZoomControls } from '../toolbar/Toolbar';

// Import wszystkich modułów
import {
  Point,
  ViewportTransform,
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot
} from './types';

import {
  transformPoint,
  inverseTransformPoint,
  panViewportWithMouse,
  panViewportWithWheel,
  zoomViewport,
  constrainViewport
} from './viewport';

import { drawGrid } from './Grid';
import { drawElement } from './rendering';

interface WhiteboardCanvasProps {
  className?: string;
}

export function WhiteboardCanvas({ className = '' }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Viewport state
  const [viewport, setViewport] = useState<ViewportTransform>({ 
    x: 0,
    y: 0,
    scale: 1
  });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [fillShape, setFillShape] = useState(false);
  
  // Elements state
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  
  // Selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);
  
  // Text editing state
  const [isEditingText, setIsEditingText] = useState(false);
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [textBoxSize, setTextBoxSize] = useState<{ width: number; height: number } | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [pendingTextId, setPendingTextId] = useState<string | null>(null);
  
  // History state
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Drag state
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
  const [draggedElementsStart, setDraggedElementsStart] = useState<Map<string, DrawingElement>>(new Map());
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeOriginalElement, setResizeOriginalElement] = useState<DrawingElement | null>(null);
  
  const redrawCanvasRef = useRef<() => void>(() => {});
  
  // Refs for stable callbacks
  const elementsRef = useRef(elements);
  const saveToHistoryRef = useRef<(els: DrawingElement[]) => void>(() => {});
  
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    let resizeTimeout: NodeJS.Timeout | null = null;
    
    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      
      const currentWidth = canvas.width / dpr;
      const currentHeight = canvas.height / dpr;
      if (Math.abs(width - currentWidth) < 2 && Math.abs(height - currentHeight) < 2) {
        return;
      }
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        redrawCanvasRef.current();
      }
    };
    
    const debouncedUpdateCanvasSize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(updateCanvasSize, 100);
    };
    
    updateCanvasSize();
    window.addEventListener('resize', debouncedUpdateCanvasSize);
    
    const resizeObserver = new ResizeObserver(() => {
      debouncedUpdateCanvasSize();
    });
    resizeObserver.observe(container);
    
    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      window.removeEventListener('resize', debouncedUpdateCanvasSize);
      resizeObserver.disconnect();
    };
  }, []);
  
  // Wheel/Touchpad handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleWheel = (e: WheelEvent) => {
      if (isEditingText) return;
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;
      
      if (e.ctrlKey) {
        // PINCH ZOOM (dwa palce: do siebie/od siebie)
        const newViewport = zoomViewport(viewport, e.deltaY, mouseX, mouseY, width, height);
        setViewport(constrainViewport(newViewport));
      } else {
        // SCROLL/PAN (dwa palce: w lewo/prawo/góra/dół)
        const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
        setViewport(constrainViewport(newViewport));
      }
    };
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [viewport, isEditingText]);

  // Redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid (z modułu Grid.tsx)
    drawGrid(ctx, viewport, width, height);
    
    // Draw all elements (z modułu rendering.ts)
    elements.forEach(element => drawElement(ctx, element, viewport, width, height));
    
    // Draw current element
    if (currentElement) {
      drawElement(ctx, currentElement, viewport, width, height);
    }
    
    // Draw selection box
    if (isSelecting && selectionStart && selectionEnd) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      const selWidth = selectionEnd.x - selectionStart.x;
      const selHeight = selectionEnd.y - selectionStart.y;
      
      ctx.fillRect(selectionStart.x, selectionStart.y, selWidth, selHeight);
      ctx.strokeRect(selectionStart.x, selectionStart.y, selWidth, selHeight);
      ctx.setLineDash([]);
    }
  }, [elements, currentElement, viewport, isSelecting, selectionStart, selectionEnd]);

  useEffect(() => {
    redrawCanvasRef.current = redrawCanvas;
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // History
  const saveToHistory = useCallback((newElements: DrawingElement[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  useEffect(() => {
    saveToHistoryRef.current = saveToHistory;
  }, [saveToHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementIds(new Set());
      setSelectedElementId(null);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementIds(new Set());
      setSelectedElementId(null);
    }
  }, [historyIndex, history]);

  const clearCanvas = useCallback(() => {
    setElements([]);
    saveToHistory([]);
    setSelectedElementIds(new Set());
    setSelectedElementId(null);
  }, [saveToHistory]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isEditingText) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    const worldPoint = inverseTransformPoint({ x: screenX, y: screenY }, viewport, width, height);

    if (tool === 'pan' || e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      setIsPanning(true);
      setLastPanPoint({ x: screenX, y: screenY });
      return;
    }

    if (tool === 'select') {
      setIsSelecting(true);
      setSelectionStart({ x: screenX, y: screenY });
      setSelectionEnd({ x: screenX, y: screenY });
      return;
    }

    if (tool === 'text') {
      setIsEditingText(true);
      setTextPosition({ x: screenX, y: screenY });
      setTextBoxSize({ width: 300, height: 100 });
      setTextDraft('');
      setPendingTextId(Date.now().toString());
      return;
    }

    setIsDrawing(true);

    if (tool === 'pen') {
      const newPath: DrawingPath = {
        id: Date.now().toString(),
        type: 'path',
        points: [worldPoint],
        color,
        width: lineWidth
      };
      setCurrentElement(newPath);
    } else if (tool === 'shape') {
      const newShape: Shape = {
        id: Date.now().toString(),
        type: 'shape',
        shapeType: selectedShape,
        startX: worldPoint.x,
        startY: worldPoint.y,
        endX: worldPoint.x,
        endY: worldPoint.y,
        color,
        strokeWidth: lineWidth,
        fill: fillShape
      };
      setCurrentElement(newShape);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    if (isPanning && lastPanPoint) {
      const dx = screenX - lastPanPoint.x;
      const dy = screenY - lastPanPoint.y;
      
      // Pan z myszką (z modułu viewport.ts)
      const newViewport = panViewportWithMouse(viewport, dx, dy);
      setViewport(constrainViewport(newViewport));
      setLastPanPoint({ x: screenX, y: screenY });
      return;
    }

    if (isSelecting && selectionStart) {
      setSelectionEnd({ x: screenX, y: screenY });
      return;
    }

    if (!isDrawing || !currentElement) return;

    const worldPoint = inverseTransformPoint({ x: screenX, y: screenY }, viewport, width, height);

    if (currentElement.type === 'path') {
      setCurrentElement({
        ...currentElement,
        points: [...currentElement.points, worldPoint]
      });
    } else if (currentElement.type === 'shape') {
      setCurrentElement({
        ...currentElement,
        endX: worldPoint.x,
        endY: worldPoint.y
      });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (isSelecting) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    if (isDrawing && currentElement) {
      const newElements = [...elements, currentElement];
      setElements(newElements);
      saveToHistory(newElements);
      setCurrentElement(null);
      setIsDrawing(false);
    }
  };

  const finishTextInput = () => {
    const canvas = canvasRef.current;
    if (!canvas || !textPosition) return;
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (textDraft.trim() && pendingTextId) {
      const worldPos = inverseTransformPoint(textPosition, viewport, width, height);
      
      const newText: TextElement = {
        id: pendingTextId,
        type: 'text',
        x: worldPos.x,
        y: worldPos.y,
        text: textDraft.trim(),
        fontSize: fontSize,
        color: color
      };
      
      const newElements = [...elements, newText];
      setElements(newElements);
      saveToHistory(newElements);
    }
    
    setIsEditingText(false);
    setTextPosition(null);
    setTextBoxSize(null);
    setTextDraft('');
    setPendingTextId(null);
    setTool('select');
  };

  // Zoom functions
  const zoomInRef = useRef(() => {
    setViewport(prev => {
      const newScale = Math.min(prev.scale * 1.2, 5.0);
      return constrainViewport({ ...prev, scale: newScale });
    });
  });

  const zoomOutRef = useRef(() => {
    setViewport(prev => {
      const newScale = Math.max(prev.scale / 1.2, 0.2);
      return constrainViewport({ ...prev, scale: newScale });
    });
  });

  const resetView = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomIn = useCallback(() => zoomInRef.current(), []);
  const zoomOut = useCallback(() => zoomOutRef.current(), []);

  // Stable callbacks for Toolbar
  const handleToolChangeRef = useRef((newTool: Tool) => setTool(newTool));
  const handleShapeChangeRef = useRef((shape: ShapeType) => setSelectedShape(shape));
  const handleColorChangeRef = useRef((newColor: string) => setColor(newColor));
  const handleLineWidthChangeRef = useRef((width: number) => setLineWidth(width));
  const handleFontSizeChangeRef = useRef((size: number) => setFontSize(size));
  const handleFillShapeChangeRef = useRef((fill: boolean) => setFillShape(fill));
  
  useEffect(() => {
    handleToolChangeRef.current = (newTool: Tool) => setTool(newTool);
    handleShapeChangeRef.current = (shape: ShapeType) => setSelectedShape(shape);
    handleColorChangeRef.current = (newColor: string) => setColor(newColor);
    handleLineWidthChangeRef.current = (width: number) => setLineWidth(width);
    handleFontSizeChangeRef.current = (size: number) => setFontSize(size);
    handleFillShapeChangeRef.current = (fill: boolean) => setFillShape(fill);
  });
  
  const handleToolChange = useCallback((newTool: Tool) => {
    handleToolChangeRef.current(newTool);
  }, []);
  
  const handleShapeChange = useCallback((shape: ShapeType) => {
    handleShapeChangeRef.current(shape);
  }, []);
  
  const handleColorChange = useCallback((newColor: string) => {
    handleColorChangeRef.current(newColor);
  }, []);
  
  const handleLineWidthChange = useCallback((width: number) => {
    handleLineWidthChangeRef.current(width);
  }, []);
  
  const handleFontSizeChange = useCallback((size: number) => {
    handleFontSizeChangeRef.current(size);
  }, []);
  
  const handleFillShapeChange = useCallback((fill: boolean) => {
    handleFillShapeChangeRef.current(fill);
  }, []);
  
  const handleGenerateFunctionRef = useRef((expression: string) => {
    const xRange = 50;
    const yRange = 50;
    
    const newFunction: FunctionPlot = {
      id: Date.now().toString(),
      type: 'function',
      expression,
      color,
      strokeWidth: lineWidth,
      xRange,
      yRange
    };
    
    const currentElements = elementsRef.current;
    const newElements = [...currentElements, newFunction];
    setElements(newElements);
    saveToHistoryRef.current(newElements);
    setTool('select');
  });
  
  useEffect(() => {
    handleGenerateFunctionRef.current = (expression: string) => {
      const xRange = 50;
      const yRange = 50;
      
      const newFunction: FunctionPlot = {
        id: Date.now().toString(),
        type: 'function',
        expression,
        color,
        strokeWidth: lineWidth,
        xRange,
        yRange
      };
      
      const currentElements = elementsRef.current;
      const newElements = [...currentElements, newFunction];
      setElements(newElements);
      saveToHistoryRef.current(newElements);
      setTool('select');
    };
  }, [color, lineWidth]);
  
  const handleGenerateFunction = useCallback((expression: string) => {
    handleGenerateFunctionRef.current(expression);
  }, []);
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  // Touch events handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        ctrlKey: false,
        metaKey: false,
        preventDefault: () => {}
      } as unknown as React.MouseEvent<HTMLCanvasElement>;
      
      handleMouseDown(mouseEvent);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        preventDefault: () => {}
      } as unknown as React.MouseEvent<HTMLCanvasElement>;
      
      handleMouseMove(mouseEvent);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUp();
  };
  
  return (
    <div className={`relative w-full h-full bg-white ${className}`}>
      <div ref={containerRef} className="absolute inset-0 overflow-hidden">
        <Toolbar
          tool={tool}
          setTool={handleToolChange}
          selectedShape={selectedShape}
          setSelectedShape={handleShapeChange}
          color={color}
          setColor={handleColorChange}
          lineWidth={lineWidth}
          setLineWidth={handleLineWidthChange}
          fontSize={fontSize}
          setFontSize={handleFontSizeChange}
          fillShape={fillShape}
          setFillShape={handleFillShapeChange}
          onUndo={undo}
          onRedo={redo}
          onClear={clearCanvas}
          onResetView={resetView}
          onGenerateFunction={handleGenerateFunction}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        
        <ZoomControls
          zoom={viewport.scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
        />
        
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor: 
              tool === 'pan' || isPanning ? 'grab' : 
              tool === 'select' ? 'default' : 
              tool === 'text' ? 'text' :
              'crosshair',
            willChange: 'auto',
            imageRendering: 'crisp-edges'
          }}
        />
        
        {isEditingText && textPosition && textBoxSize && (
          <textarea
            ref={textInputRef}
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finishTextInput();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                finishTextInput();
              }
            }}
            onBlur={finishTextInput}
            placeholder=""
            className="absolute z-50 px-2 py-1 outline-none border-2 border-blue-500 bg-white/90 resize-none overflow-hidden"
            style={{
              left: `${textPosition.x}px`,
              top: `${textPosition.y}px`,
              width: `${textBoxSize.width}px`,
              height: `${textBoxSize.height}px`,
              fontSize: `${fontSize}px`,
              color: color,
              lineHeight: '1.2',
              fontFamily: 'Arial, sans-serif',
              whiteSpace: 'pre-wrap',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
        )}
      </div>
    </div>
  );
}

export default WhiteboardCanvas;
