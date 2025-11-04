/**
 * ============================================================================
 * PLIK: src/app/tablica/whiteboard/WhiteboardCanvas.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, useRef, useEffect, useCallback)
 * - ../toolbar/Toolbar (Toolbar, Tool, ShapeType)
 * - ../toolbar/ZoomControls (ZoomControls)
 * - ../toolbar/TextTool (TextTool)
 * - ../toolbar/SelectTool (SelectTool)
 * - ../toolbar/PenTool (PenTool)
 * - ../toolbar/ShapeTool (ShapeTool)
 * - ../toolbar/FunctionTool (FunctionTool)
 * - ./types (Point, ViewportTransform, DrawingElement, DrawingPath, Shape, TextElement, FunctionPlot)
 * - ./viewport (panViewportWithWheel, zoomViewport, constrainViewport)
 * - ./Grid (drawGrid)
 * - ./rendering (drawElement)
 * 
 * EKSPORTUJE:
 * - WhiteboardCanvas (component, default) - główny komponent tablicy interaktywnej
 * 
 * UŻYWANE PRZEZ:
 * - ../page.tsx (strona /tablica)
 * 
 * ⚠️ ZALEŻNOŚCI - TO JEST GŁÓWNY HUB PROJEKTU:
 * - types.ts - definiuje wszystkie typy elementów
 * - viewport.ts - transformacje i zoom/pan (wheel events dla kontenera)
 * - rendering.ts - renderowanie elementów na canvas
 * - Grid.tsx - renderowanie siatki kartezjańskiej
 * - Toolbar.tsx - UI narzędzi
 * - PenTool.tsx - logika rysowania piórem (aktywny gdy tool='pen')
 * - ShapeTool.tsx - logika wstawiania kształtów (aktywny gdy tool='shape')
 * - FunctionTool.tsx - logika rysowania funkcji (aktywny gdy tool='function')
 * - SelectTool.tsx - logika zaznaczania (aktywny gdy tool='select')
 * - TextTool.tsx - logika tekstu (aktywny gdy tool='text')
 * 
 * ⚠️ WAŻNE - WHEEL/PAN/ZOOM:
 * - Canvas ma pointerEvents: 'none' - wszystkie narzędzia mają swoje overlaye
 * - Kontener obsługuje wheel events (backup dla gdy żadne narzędzie nie jest aktywne)
 * - Każde narzędzie obsługuje własne wheel events przez onViewportChange
 * 
 * ⚠️ KLUCZOWE CALLBACKI:
 * - handlePathCreate - tworzenie ścieżek (PenTool)
 * - handleShapeCreate - tworzenie kształtów (ShapeTool)
 * - handleFunctionCreate - tworzenie funkcji (FunctionTool)
 * - handleTextCreate/Update/Delete - zarządzanie tekstami (TextTool)
 * - handleSelectionChange/ElementUpdate - zarządzanie zaznaczeniem (SelectTool)
 * - handleViewportChange - synchronizacja viewport między narzędziami
 * - handleTextEdit - double-click w SelectTool otwiera edytor tekstu
 * 
 * ⚠️ KEYBOARD SHORTCUTS:
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 * - Delete: Usuń zaznaczone elementy
 * 
 * PRZEZNACZENIE:
 * Główny komponent tablicy - zarządza viewport, elements, historią,
 * koordynuje narzędzia (pen/shape/text/select/function), renderuje canvas.
 * Każde narzędzie jest teraz osobnym komponentem z własną logiką.
 * ============================================================================
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Toolbar, { Tool, ShapeType } from '../toolbar/Toolbar';
import { ZoomControls } from '../toolbar/ZoomControls';
import { TextTool } from '../toolbar/TextTool';
import { SelectTool } from '../toolbar/SelectTool';
import { PenTool } from '../toolbar/PenTool';
import { ShapeTool } from '../toolbar/ShapeTool';

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
  
  // Viewport state
  const [viewport, setViewport] = useState<ViewportTransform>({ 
    x: 0,
    y: 0,
    scale: 1
  });
  
  // Drawing state
  const [tool, setTool] = useState<Tool>('select');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [fillShape, setFillShape] = useState(false);
  
  // Elements state
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const [editingTextId, setEditingTextId] = useState<string | null>(null); // 🆕 Dla edycji tekstu
  
  // History state - inicjalizacja z pustym stanem
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const redrawCanvasRef = useRef<() => void>(() => {});
  
  // Refs for stable callbacks
  const elementsRef = useRef(elements);
  const saveToHistoryRef = useRef<(els: DrawingElement[]) => void>(() => {});
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const selectedElementIdsRef = useRef(selectedElementIds);
  
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    selectedElementIdsRef.current = selectedElementIds;
  }, [selectedElementIds]);

  // ========================================
  // 🆕 KEYBOARD SHORTCUTS
  // ========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z - Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = historyIndexRef.current;
        const currentHistory = historyRef.current;
        
        if (currentIndex > 0) {
          const newIndex = currentIndex - 1;
          setHistoryIndex(newIndex);
          setElements(currentHistory[newIndex]);
          setSelectedElementIds(new Set());
        }
      }
      
      // Ctrl+Y lub Ctrl+Shift+Z - Redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        const currentIndex = historyIndexRef.current;
        const currentHistory = historyRef.current;
        
        if (currentIndex < currentHistory.length - 1) {
          const newIndex = currentIndex + 1;
          setHistoryIndex(newIndex);
          setElements(currentHistory[newIndex]);
          setSelectedElementIds(new Set());
        }
      }
      
      // Delete - usuń wybrane elementy
      if (e.key === 'Delete') {
        const currentSelectedIds = selectedElementIdsRef.current;
        const currentElements = elementsRef.current;
        
        if (currentSelectedIds.size > 0) {
          e.preventDefault();
          const newElements = currentElements.filter(el => !currentSelectedIds.has(el.id));
          setElements(newElements);
          saveToHistoryRef.current(newElements);
          setSelectedElementIds(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const container = containerRef.current; // ✅ CONTAINER zamiast canvas!
  if (!container) return;
  
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    
    const rect = container.getBoundingClientRect(); // ← container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    
    if (e.ctrlKey) {
      const newViewport = zoomViewport(viewport, e.deltaY, mouseX, mouseY, width, height);
      setViewport(constrainViewport(newViewport));
    } else {
      const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
      setViewport(constrainViewport(newViewport));
    }
  };
  
  container.addEventListener('wheel', handleWheel, { passive: false });
  return () => container.removeEventListener('wheel', handleWheel);
}, [viewport]);

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
    
    // Draw grid
    drawGrid(ctx, viewport, width, height);
    
    // Draw all elements
    elements.forEach(element => drawElement(ctx, element, viewport, width, height));
  }, [elements, viewport]);

  useEffect(() => {
    redrawCanvasRef.current = redrawCanvas;
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // History - POPRAWIONE: limit 50 stanów, nie obcina historii przy nowym stanie
  const MAX_HISTORY_SIZE = 50;
  
  const saveToHistory = useCallback((newElements: DrawingElement[]) => {
    setHistoryIndex(prevIndex => {
      setHistory(prevHistory => {
        // Gdy dodajemy nowy stan w środku historii, obcinamy przyszłość
        const newHistory = prevHistory.slice(0, prevIndex + 1);
        newHistory.push(newElements);
        
        // Ogranicz historię do ostatnich MAX_HISTORY_SIZE stanów
        if (newHistory.length > MAX_HISTORY_SIZE) {
          const trimmed = newHistory.slice(newHistory.length - MAX_HISTORY_SIZE);
          // Zwróć przycięta historię i przesuń indeks
          setHistoryIndex(trimmed.length - 1);
          return trimmed;
        }
        
        return newHistory;
      });
      
      // Zwróć nowy indeks (ostatni element w historii)
      return Math.min(prevIndex + 1, MAX_HISTORY_SIZE - 1);
    });
  }, []);

  useEffect(() => {
    saveToHistoryRef.current = saveToHistory;
  }, [saveToHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementIds(new Set());
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
      setSelectedElementIds(new Set());
    }
  }, [historyIndex, history]);

  const clearCanvas = useCallback(() => {
    setElements([]);
    saveToHistory([]);
    setSelectedElementIds(new Set());
  }, [saveToHistory]);

  // ========================================
  // 🆕 CALLBACKI DLA PENTOOL
  // ========================================
  const handlePathCreate = useCallback((path: DrawingPath) => {
    const newElements = [...elements, path];
    setElements(newElements);
    saveToHistory(newElements);
  }, [elements, saveToHistory]);

  // ========================================
  // 🆕 CALLBACKI DLA SHAPETOOL
  // ========================================
  const handleShapeCreate = useCallback((shape: Shape) => {
    const newElements = [...elements, shape];
    setElements(newElements);
    saveToHistory(newElements);
  }, [elements, saveToHistory]);

  // ========================================
  // 🆕 CALLBACKI DLA FUNCTIONTOOL - funkcja w properties
  // ========================================
  const handleFunctionCreate = useCallback((func: FunctionPlot) => {
    const newElements = [...elements, func];
    setElements(newElements);
    saveToHistory(newElements);
  }, [elements, saveToHistory]);

  const handleGenerateFunction = useCallback((expression: string) => {
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
    
    handleFunctionCreate(newFunction);
  }, [color, lineWidth, handleFunctionCreate]);

  // ========================================
  // 🆕 CALLBACKI DLA TEXTTOOL
  // ========================================
  const handleTextCreate = useCallback((text: TextElement) => {
    const newElements = [...elements, text];
    setElements(newElements);
    saveToHistory(newElements);
    // NIE przełączaj automatycznie na select - użytkownik może chcieć dodać więcej tekstów
  }, [elements, saveToHistory]);

  const handleTextUpdate = useCallback((id: string, updates: Partial<TextElement>) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } as DrawingElement : el
    );
    setElements(newElements);
    saveToHistory(newElements);
  }, [elements, saveToHistory]);

  const handleTextDelete = useCallback((id: string) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    saveToHistory(newElements);
  }, [elements, saveToHistory]);

  // 🆕 Handler do edycji tekstu (double-click w SelectTool)
  const handleTextEdit = useCallback((id: string) => {
    setEditingTextId(id);
    setTool('text'); // Przełącz na narzędzie text
  }, []);

  // 🆕 Handler do zakończenia edycji tekstu
  const handleEditingComplete = useCallback(() => {
    setEditingTextId(null);
  }, []);

  // 🆕 Handler do zmiany viewport (dla SelectTool i TextTool wheel events)
  const handleViewportChange = useCallback((newViewport: ViewportTransform) => {
    setViewport(newViewport);
  }, []);

  // ========================================
  // 🆕 CALLBACKI DLA SELECTTOOL
  // ========================================
  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedElementIds(ids);
  }, []);

  const handleElementUpdate = useCallback((id: string, updates: Partial<DrawingElement>) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } as DrawingElement : el
    );
    setElements(newElements);
    // Nie zapisujemy do historii przy każdym ruchu - tylko przy mouseUp
  }, [elements]);

  const handleElementsUpdate = useCallback((updates: Map<string, Partial<DrawingElement>>) => {
    const newElements = elements.map(el => {
      const update = updates.get(el.id);
      return update ? { ...el, ...update } as DrawingElement : el;
    });
    setElements(newElements);
  }, [elements]);

  // Zapisz do historii po zakończeniu dragowania/resizowania
  const handleSelectionFinish = useCallback(() => {
    saveToHistory(elements);
  }, [elements, saveToHistory]);

  // Funkcja usuwania wybranych elementów (dostępna z klawiatury Delete)
  const deleteSelectedElements = useCallback(() => {
    if (selectedElementIds.size === 0) return;
    
    const newElements = elements.filter(el => !selectedElementIds.has(el.id));
    setElements(newElements);
    saveToHistory(newElements);
    setSelectedElementIds(new Set());
  }, [elements, selectedElementIds, saveToHistory]);

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
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Get canvas dimensions for tools
  const getCanvasDimensions = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 0, height: 0 };
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
  
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
        
        {/* 🆕 TEXTTOOL - aktywny gdy tool === 'text' */}
        {tool === 'text' && canvasWidth > 0 && (
          <TextTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            elements={elements.filter(el => el.type === 'text') as TextElement[]}
            editingTextId={editingTextId}
            onTextCreate={handleTextCreate}
            onTextUpdate={handleTextUpdate}
            onTextDelete={handleTextDelete}
            onEditingComplete={handleEditingComplete}
            onViewportChange={handleViewportChange}
          />
        )}

        {/* 🆕 SELECTTOOL - aktywny gdy tool === 'select' */}
        {tool === 'select' && canvasWidth > 0 && (
          <SelectTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            elements={elements}
            selectedIds={selectedElementIds}
            onSelectionChange={handleSelectionChange}
            onElementUpdate={handleElementUpdate}
            onElementsUpdate={handleElementsUpdate}
            onOperationFinish={handleSelectionFinish}
            onTextEdit={handleTextEdit}
            onViewportChange={handleViewportChange}
          />
        )}

        {/* 🆕 PENTOOL - aktywny gdy tool === 'pen' */}
        {tool === 'pen' && canvasWidth > 0 && (
          <PenTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            color={color}
            lineWidth={lineWidth}
            onPathCreate={handlePathCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {/* 🆕 SHAPETOOL - aktywny gdy tool === 'shape' */}
        {tool === 'shape' && canvasWidth > 0 && (
          <ShapeTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            selectedShape={selectedShape}
            color={color}
            lineWidth={lineWidth}
            fillShape={fillShape}
            onShapeCreate={handleShapeCreate}
            onViewportChange={handleViewportChange}
          />
        )}
        
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor: 
              tool === 'pan' ? 'grab' : 
              tool === 'select' ? 'default' : 
              tool === 'text' ? 'crosshair' :
              'crosshair',
            willChange: 'auto',
            imageRendering: 'crisp-edges',
            pointerEvents: 'none' // ⚠️ WAŻNE! Wszystkie narzędzia mają swoje overlaye
          }}
        />
      </div>
    </div>
  );
}

export default WhiteboardCanvas;
// import Toolbar, { Tool, ShapeType } from '../toolbar/Toolbar';
// import { ZoomControls } from '../toolbar/ZoomControls';
// import { TextTool } from '../toolbar/TextTool';
// import { SelectTool } from '../toolbar/SelectTool';

// // Import wszystkich modułów
// import {
//   Point,
//   ViewportTransform,
//   DrawingElement,
//   DrawingPath,
//   Shape,
//   TextElement,
//   FunctionPlot
// } from './types';

// import {
//   transformPoint,
//   inverseTransformPoint,
//   panViewportWithMouse,
//   panViewportWithWheel,
//   zoomViewport,
//   constrainViewport
// } from './viewport';

// import { drawGrid } from './Grid';
// import { drawElement } from './rendering';

// interface WhiteboardCanvasProps {
//   className?: string;
// }

// export function WhiteboardCanvas({ className = '' }: WhiteboardCanvasProps) {
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const containerRef = useRef<HTMLDivElement>(null);
  
//   // Viewport state
//   const [viewport, setViewport] = useState<ViewportTransform>({ 
//     x: 0,
//     y: 0,
//     scale: 1
//   });
//   const [isPanning, setIsPanning] = useState(false);
//   const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  
//   // Drawing state
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState<Tool>('select');
//   const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
//   const [color, setColor] = useState('#000000');
//   const [lineWidth, setLineWidth] = useState(3);
//   const [fontSize, setFontSize] = useState(24);
//   const [fillShape, setFillShape] = useState(false);
  
//   // Elements state
//   const [elements, setElements] = useState<DrawingElement[]>([]);
//   const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
//   const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  
//   // History state - inicjalizacja z pustym stanem
//   const [history, setHistory] = useState<DrawingElement[][]>([[]]);
//   const [historyIndex, setHistoryIndex] = useState(0);
  
//   const redrawCanvasRef = useRef<() => void>(() => {});
  
//   // Refs for stable callbacks
//   const elementsRef = useRef(elements);
//   const saveToHistoryRef = useRef<(els: DrawingElement[]) => void>(() => {});
//   const historyRef = useRef(history);
//   const historyIndexRef = useRef(historyIndex);
//   const selectedElementIdsRef = useRef(selectedElementIds);
  
//   useEffect(() => {
//     elementsRef.current = elements;
//   }, [elements]);

//   useEffect(() => {
//     historyRef.current = history;
//   }, [history]);

//   useEffect(() => {
//     historyIndexRef.current = historyIndex;
//   }, [historyIndex]);

//   useEffect(() => {
//     selectedElementIdsRef.current = selectedElementIds;
//   }, [selectedElementIds]);

//   // ========================================
//   // 🆕 KEYBOARD SHORTCUTS
//   // ========================================
//   useEffect(() => {
//     const handleKeyDown = (e: KeyboardEvent) => {
//       // Ctrl+Z - Undo
//       if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
//         e.preventDefault();
//         const currentIndex = historyIndexRef.current;
//         const currentHistory = historyRef.current;
        
//         if (currentIndex > 0) {
//           const newIndex = currentIndex - 1;
//           setHistoryIndex(newIndex);
//           setElements(currentHistory[newIndex]);
//           setSelectedElementIds(new Set());
//         }
//       }
      
//       // Ctrl+Y lub Ctrl+Shift+Z - Redo
//       if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
//         e.preventDefault();
//         const currentIndex = historyIndexRef.current;
//         const currentHistory = historyRef.current;
        
//         if (currentIndex < currentHistory.length - 1) {
//           const newIndex = currentIndex + 1;
//           setHistoryIndex(newIndex);
//           setElements(currentHistory[newIndex]);
//           setSelectedElementIds(new Set());
//         }
//       }
      
//       // Delete - usuń wybrane elementy
//       if (e.key === 'Delete') {
//         const currentSelectedIds = selectedElementIdsRef.current;
//         const currentElements = elementsRef.current;
        
//         if (currentSelectedIds.size > 0) {
//           e.preventDefault();
//           const newElements = currentElements.filter(el => !currentSelectedIds.has(el.id));
//           setElements(newElements);
//           saveToHistoryRef.current(newElements);
//           setSelectedElementIds(new Set());
//         }
//       }
//     };

//     window.addEventListener('keydown', handleKeyDown);
//     return () => window.removeEventListener('keydown', handleKeyDown);
//   }, []); // Pusta tablica zależności - używamy ref-ów

//   // Canvas setup
//   useEffect(() => {
//     const canvas = canvasRef.current;
//     const container = containerRef.current;
//     if (!canvas || !container) return;
    
//     let resizeTimeout: NodeJS.Timeout | null = null;
    
//     const updateCanvasSize = () => {
//       const dpr = window.devicePixelRatio || 1;
//       const rect = container.getBoundingClientRect();
//       const width = Math.ceil(rect.width);
//       const height = Math.ceil(rect.height);
      
//       const currentWidth = canvas.width / dpr;
//       const currentHeight = canvas.height / dpr;
//       if (Math.abs(width - currentWidth) < 2 && Math.abs(height - currentHeight) < 2) {
//         return;
//       }
      
//       canvas.width = width * dpr;
//       canvas.height = height * dpr;
//       canvas.style.width = `${width}px`;
//       canvas.style.height = `${height}px`;
      
//       const ctx = canvas.getContext('2d');
//       if (ctx) {
//         ctx.scale(dpr, dpr);
//         redrawCanvasRef.current();
//       }
//     };
    
//     const debouncedUpdateCanvasSize = () => {
//       if (resizeTimeout) {
//         clearTimeout(resizeTimeout);
//       }
//       resizeTimeout = setTimeout(updateCanvasSize, 100);
//     };
    
//     updateCanvasSize();
//     window.addEventListener('resize', debouncedUpdateCanvasSize);
    
//     const resizeObserver = new ResizeObserver(() => {
//       debouncedUpdateCanvasSize();
//     });
//     resizeObserver.observe(container);
    
//     return () => {
//       if (resizeTimeout) {
//         clearTimeout(resizeTimeout);
//       }
//       window.removeEventListener('resize', debouncedUpdateCanvasSize);
//       resizeObserver.disconnect();
//     };
//   }, []);
  
//   // Wheel/Touchpad handling
//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
    
//     const handleWheel = (e: WheelEvent) => {
//       // Jeśli aktywny TextTool lub SelectTool - nie scrolluj
//       if (tool === 'text' || tool === 'select') return;
      
//       e.preventDefault();
      
//       const rect = canvas.getBoundingClientRect();
//       const mouseX = e.clientX - rect.left;
//       const mouseY = e.clientY - rect.top;
//       const width = rect.width;
//       const height = rect.height;
      
//       if (e.ctrlKey) {
//         const newViewport = zoomViewport(viewport, e.deltaY, mouseX, mouseY, width, height);
//         setViewport(constrainViewport(newViewport));
//       } else {
//         const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
//         setViewport(constrainViewport(newViewport));
//       }
//     };
    
//     canvas.addEventListener('wheel', handleWheel, { passive: false });
//     return () => canvas.removeEventListener('wheel', handleWheel);
//   }, [viewport, tool]);

//   // Redraw canvas
//   const redrawCanvas = useCallback(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
    
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;
    
//     const width = canvas.width / (window.devicePixelRatio || 1);
//     const height = canvas.height / (window.devicePixelRatio || 1);
    
//     // Clear
//     ctx.clearRect(0, 0, width, height);
    
//     // Draw grid
//     drawGrid(ctx, viewport, width, height);
    
//     // Draw all elements
//     elements.forEach(element => drawElement(ctx, element, viewport, width, height));
    
//     // Draw current element
//     if (currentElement) {
//       drawElement(ctx, currentElement, viewport, width, height);
//     }
//   }, [elements, currentElement, viewport]);

//   useEffect(() => {
//     redrawCanvasRef.current = redrawCanvas;
//   }, [redrawCanvas]);

//   useEffect(() => {
//     redrawCanvas();
//   }, [redrawCanvas]);

//   // History - POPRAWIONE: limit 50 stanów, nie obcina historii przy nowym stanie
//   const MAX_HISTORY_SIZE = 50;
  
//   const saveToHistory = useCallback((newElements: DrawingElement[]) => {
//     setHistoryIndex(prevIndex => {
//       setHistory(prevHistory => {
//         // Gdy dodajemy nowy stan w środku historii, obcinamy przyszłość
//         const newHistory = prevHistory.slice(0, prevIndex + 1);
//         newHistory.push(newElements);
        
//         // Ogranicz historię do ostatnich MAX_HISTORY_SIZE stanów
//         if (newHistory.length > MAX_HISTORY_SIZE) {
//           const trimmed = newHistory.slice(newHistory.length - MAX_HISTORY_SIZE);
//           // Zwróć przycięta historię i przesuń indeks
//           setHistoryIndex(trimmed.length - 1);
//           return trimmed;
//         }
        
//         return newHistory;
//       });
      
//       // Zwróć nowy indeks (ostatni element w historii)
//       return Math.min(prevIndex + 1, MAX_HISTORY_SIZE - 1);
//     });
//   }, []);

//   useEffect(() => {
//     saveToHistoryRef.current = saveToHistory;
//   }, [saveToHistory]);

//   const undo = useCallback(() => {
//     if (historyIndex > 0) {
//       const newIndex = historyIndex - 1;
//       setHistoryIndex(newIndex);
//       setElements(history[newIndex]);
//       setSelectedElementIds(new Set());
//     }
//   }, [historyIndex, history]);

//   const redo = useCallback(() => {
//     if (historyIndex < history.length - 1) {
//       const newIndex = historyIndex + 1;
//       setHistoryIndex(newIndex);
//       setElements(history[newIndex]);
//       setSelectedElementIds(new Set());
//     }
//   }, [historyIndex, history]);

//   const clearCanvas = useCallback(() => {
//     setElements([]);
//     saveToHistory([]);
//     setSelectedElementIds(new Set());
//   }, [saveToHistory]);

//   // ========================================
//   // 🆕 CALLBACKI DLA TEXTTOOL
//   // ========================================
//   const handleTextCreate = useCallback((text: TextElement) => {
//     const newElements = [...elements, text];
//     setElements(newElements);
//     saveToHistory(newElements);
//     setTool('select'); // Po utworzeniu tekstu przełącz na select
//   }, [elements, saveToHistory]);

//   const handleTextUpdate = useCallback((id: string, updates: Partial<TextElement>) => {
//     const newElements = elements.map(el => 
//       el.id === id ? { ...el, ...updates } as DrawingElement : el
//     );
//     setElements(newElements);
//     saveToHistory(newElements);
//   }, [elements, saveToHistory]);

//   const handleTextDelete = useCallback((id: string) => {
//     const newElements = elements.filter(el => el.id !== id);
//     setElements(newElements);
//     saveToHistory(newElements);
//   }, [elements, saveToHistory]);

//   // ========================================
//   // 🆕 CALLBACKI DLA SELECTTOOL
//   // ========================================
//   const handleSelectionChange = useCallback((ids: Set<string>) => {
//     setSelectedElementIds(ids);
//   }, []);

//   const handleElementUpdate = useCallback((id: string, updates: Partial<DrawingElement>) => {
//     const newElements = elements.map(el => 
//       el.id === id ? { ...el, ...updates } as DrawingElement : el
//     );
//     setElements(newElements);
//     // Nie zapisujemy do historii przy każdym ruchu - tylko przy mouseUp
//   }, [elements]);

//   const handleElementsUpdate = useCallback((updates: Map<string, Partial<DrawingElement>>) => {
//     const newElements = elements.map(el => {
//       const update = updates.get(el.id);
//       return update ? { ...el, ...update } as DrawingElement : el;
//     });
//     setElements(newElements);
//   }, [elements]);

//   // Zapisz do historii po zakończeniu dragowania/resizowania
//   const handleSelectionFinish = useCallback(() => {
//     saveToHistory(elements);
//   }, [elements, saveToHistory]);

//   // Funkcja usuwania wybranych elementów (dostępna z klawiatury Delete)
//   const deleteSelectedElements = useCallback(() => {
//     if (selectedElementIds.size === 0) return;
    
//     const newElements = elements.filter(el => !selectedElementIds.has(el.id));
//     setElements(newElements);
//     saveToHistory(newElements);
//     setSelectedElementIds(new Set());
//   }, [elements, selectedElementIds, saveToHistory]);

//   // ========================================
//   // STARE MOUSE HANDLERS (tylko dla pen/shape/function)
//   // ========================================
//   const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
//     // Jeśli aktywny TextTool lub SelectTool - ignoruj stare handlery
//     if (tool === 'text' || tool === 'select') return;
    
//     const canvas = canvasRef.current;
//     if (!canvas) return;
    
//     const rect = canvas.getBoundingClientRect();
//     const screenX = e.clientX - rect.left;
//     const screenY = e.clientY - rect.top;
//     const width = rect.width;
//     const height = rect.height;
//     const worldPoint = inverseTransformPoint({ x: screenX, y: screenY }, viewport, width, height);

//     if (tool === 'pan' || e.button === 1 || (e.button === 0 && e.ctrlKey)) {
//       setIsPanning(true);
//       setLastPanPoint({ x: screenX, y: screenY });
//       return;
//     }

//     setIsDrawing(true);

//     if (tool === 'pen') {
//       const newPath: DrawingPath = {
//         id: Date.now().toString(),
//         type: 'path',
//         points: [worldPoint],
//         color,
//         width: lineWidth
//       };
//       setCurrentElement(newPath);
//     } else if (tool === 'shape') {
//       const newShape: Shape = {
//         id: Date.now().toString(),
//         type: 'shape',
//         shapeType: selectedShape,
//         startX: worldPoint.x,
//         startY: worldPoint.y,
//         endX: worldPoint.x,
//         endY: worldPoint.y,
//         color,
//         strokeWidth: lineWidth,
//         fill: fillShape
//       };
//       setCurrentElement(newShape);
//     }
//   };

//   const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
//     // Jeśli aktywny TextTool lub SelectTool - ignoruj
//     if (tool === 'text' || tool === 'select') return;
    
//     const canvas = canvasRef.current;
//     if (!canvas) return;
    
//     const rect = canvas.getBoundingClientRect();
//     const screenX = e.clientX - rect.left;
//     const screenY = e.clientY - rect.top;
//     const width = rect.width;
//     const height = rect.height;

//     if (isPanning && lastPanPoint) {
//       const dx = screenX - lastPanPoint.x;
//       const dy = screenY - lastPanPoint.y;
      
//       const newViewport = panViewportWithMouse(viewport, dx, dy);
//       setViewport(constrainViewport(newViewport));
//       setLastPanPoint({ x: screenX, y: screenY });
//       return;
//     }

//     if (!isDrawing || !currentElement) return;

//     const worldPoint = inverseTransformPoint({ x: screenX, y: screenY }, viewport, width, height);

//     if (currentElement.type === 'path') {
//       setCurrentElement({
//         ...currentElement,
//         points: [...currentElement.points, worldPoint]
//       });
//     } else if (currentElement.type === 'shape') {
//       setCurrentElement({
//         ...currentElement,
//         endX: worldPoint.x,
//         endY: worldPoint.y
//       });
//     }
//   };

//   const handleMouseUp = () => {
//     // Jeśli aktywny TextTool lub SelectTool - ignoruj
//     if (tool === 'text' || tool === 'select') return;
    
//     if (isPanning) {
//       setIsPanning(false);
//       setLastPanPoint(null);
//       return;
//     }

//     if (isDrawing && currentElement) {
//       const newElements = [...elements, currentElement];
//       setElements(newElements);
//       saveToHistory(newElements);
//       setCurrentElement(null);
//       setIsDrawing(false);
//     }
//   };

//   // Zoom functions
//   const zoomInRef = useRef(() => {
//     setViewport(prev => {
//       const newScale = Math.min(prev.scale * 1.2, 5.0);
//       return constrainViewport({ ...prev, scale: newScale });
//     });
//   });

//   const zoomOutRef = useRef(() => {
//     setViewport(prev => {
//       const newScale = Math.max(prev.scale / 1.2, 0.2);
//       return constrainViewport({ ...prev, scale: newScale });
//     });
//   });

//   const resetView = useCallback(() => {
//     setViewport({ x: 0, y: 0, scale: 1 });
//   }, []);

//   const zoomIn = useCallback(() => zoomInRef.current(), []);
//   const zoomOut = useCallback(() => zoomOutRef.current(), []);

//   // Stable callbacks for Toolbar
//   const handleToolChangeRef = useRef((newTool: Tool) => setTool(newTool));
//   const handleShapeChangeRef = useRef((shape: ShapeType) => setSelectedShape(shape));
//   const handleColorChangeRef = useRef((newColor: string) => setColor(newColor));
//   const handleLineWidthChangeRef = useRef((width: number) => setLineWidth(width));
//   const handleFontSizeChangeRef = useRef((size: number) => setFontSize(size));
//   const handleFillShapeChangeRef = useRef((fill: boolean) => setFillShape(fill));
  
//   useEffect(() => {
//     handleToolChangeRef.current = (newTool: Tool) => setTool(newTool);
//     handleShapeChangeRef.current = (shape: ShapeType) => setSelectedShape(shape);
//     handleColorChangeRef.current = (newColor: string) => setColor(newColor);
//     handleLineWidthChangeRef.current = (width: number) => setLineWidth(width);
//     handleFontSizeChangeRef.current = (size: number) => setFontSize(size);
//     handleFillShapeChangeRef.current = (fill: boolean) => setFillShape(fill);
//   });
  
//   const handleToolChange = useCallback((newTool: Tool) => {
//     handleToolChangeRef.current(newTool);
//   }, []);
  
//   const handleShapeChange = useCallback((shape: ShapeType) => {
//     handleShapeChangeRef.current(shape);
//   }, []);
  
//   const handleColorChange = useCallback((newColor: string) => {
//     handleColorChangeRef.current(newColor);
//   }, []);
  
//   const handleLineWidthChange = useCallback((width: number) => {
//     handleLineWidthChangeRef.current(width);
//   }, []);
  
//   const handleFontSizeChange = useCallback((size: number) => {
//     handleFontSizeChangeRef.current(size);
//   }, []);
  
//   const handleFillShapeChange = useCallback((fill: boolean) => {
//     handleFillShapeChangeRef.current(fill);
//   }, []);
  
//   const handleGenerateFunctionRef = useRef((expression: string) => {
//     const xRange = 50;
//     const yRange = 50;
    
//     const newFunction: FunctionPlot = {
//       id: Date.now().toString(),
//       type: 'function',
//       expression,
//       color,
//       strokeWidth: lineWidth,
//       xRange,
//       yRange
//     };
    
//     const currentElements = elementsRef.current;
//     const newElements = [...currentElements, newFunction];
//     setElements(newElements);
//     saveToHistoryRef.current(newElements);
//     setTool('select');
//   });
  
//   useEffect(() => {
//     handleGenerateFunctionRef.current = (expression: string) => {
//       const xRange = 50;
//       const yRange = 50;
      
//       const newFunction: FunctionPlot = {
//         id: Date.now().toString(),
//         type: 'function',
//         expression,
//         color,
//         strokeWidth: lineWidth,
//         xRange,
//         yRange
//       };
      
//       const currentElements = elementsRef.current;
//       const newElements = [...currentElements, newFunction];
//       setElements(newElements);
//       saveToHistoryRef.current(newElements);
//       setTool('select');
//     };
//   }, [color, lineWidth]);
  
//   const handleGenerateFunction = useCallback((expression: string) => {
//     handleGenerateFunctionRef.current(expression);
//   }, []);
  
//   const canUndo = historyIndex > 0;
//   const canRedo = historyIndex < history.length - 1;
  
//   // Touch events handlers
//   const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
//     if (tool === 'text' || tool === 'select') return;
    
//     e.preventDefault();
//     if (e.touches.length === 1) {
//       const touch = e.touches[0];
//       const canvas = canvasRef.current;
//       if (!canvas) return;
      
//       const mouseEvent = {
//         clientX: touch.clientX,
//         clientY: touch.clientY,
//         button: 0,
//         ctrlKey: false,
//         metaKey: false,
//         preventDefault: () => {}
//       } as unknown as React.MouseEvent<HTMLCanvasElement>;
      
//       handleMouseDown(mouseEvent);
//     }
//   };
  
//   const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
//     if (tool === 'text' || tool === 'select') return;
    
//     e.preventDefault();
//     if (e.touches.length === 1) {
//       const touch = e.touches[0];
//       const mouseEvent = {
//         clientX: touch.clientX,
//         clientY: touch.clientY,
//         button: 0,
//         preventDefault: () => {}
//       } as unknown as React.MouseEvent<HTMLCanvasElement>;
      
//       handleMouseMove(mouseEvent);
//     }
//   };
  
//   const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
//     if (tool === 'text' || tool === 'select') return;
    
//     e.preventDefault();
//     handleMouseUp();
//   };

//   // Get canvas dimensions for tools
//   const getCanvasDimensions = () => {
//     const canvas = canvasRef.current;
//     if (!canvas) return { width: 0, height: 0 };
//     const rect = canvas.getBoundingClientRect();
//     return { width: rect.width, height: rect.height };
//   };

//   const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
  
//   return (
//     <div className={`relative w-full h-full bg-white ${className}`}>
//       <div ref={containerRef} className="absolute inset-0 overflow-hidden">
//         <Toolbar
//           tool={tool}
//           setTool={handleToolChange}
//           selectedShape={selectedShape}
//           setSelectedShape={handleShapeChange}
//           color={color}
//           setColor={handleColorChange}
//           lineWidth={lineWidth}
//           setLineWidth={handleLineWidthChange}
//           fontSize={fontSize}
//           setFontSize={handleFontSizeChange}
//           fillShape={fillShape}
//           setFillShape={handleFillShapeChange}
//           onUndo={undo}
//           onRedo={redo}
//           onClear={clearCanvas}
//           onResetView={resetView}
//           onGenerateFunction={handleGenerateFunction}
//           canUndo={canUndo}
//           canRedo={canRedo}
//         />
        
//         <ZoomControls
//           zoom={viewport.scale}
//           onZoomIn={zoomIn}
//           onZoomOut={zoomOut}
//           onResetView={resetView}
//         />
        
//         {/* 🆕 TEXTTOOL - aktywny gdy tool === 'text' */}
//         {tool === 'text' && canvasWidth > 0 && (
//           <TextTool
//             viewport={viewport}
//             canvasWidth={canvasWidth}
//             canvasHeight={canvasHeight}
//             onTextCreate={handleTextCreate}
//             onTextUpdate={handleTextUpdate}
//             onTextDelete={handleTextDelete}
//           />
//         )}

//         {/* 🆕 SELECTTOOL - aktywny gdy tool === 'select' */}
//         {tool === 'select' && canvasWidth > 0 && (
//           <SelectTool
//             viewport={viewport}
//             canvasWidth={canvasWidth}
//             canvasHeight={canvasHeight}
//             elements={elements}
//             selectedIds={selectedElementIds}
//             onSelectionChange={handleSelectionChange}
//             onElementUpdate={handleElementUpdate}
//             onElementsUpdate={handleElementsUpdate}
//             onOperationFinish={handleSelectionFinish}
//           />
//         )}
        
//         <canvas
//           ref={canvasRef}
//           onMouseDown={handleMouseDown}
//           onMouseMove={handleMouseMove}
//           onMouseUp={handleMouseUp}
//           onMouseLeave={handleMouseUp}
//           onTouchStart={handleTouchStart}
//           onTouchMove={handleTouchMove}
//           onTouchEnd={handleTouchEnd}
//           onContextMenu={(e) => e.preventDefault()}
//           className="absolute inset-0 w-full h-full"
//           style={{
//             cursor: 
//               tool === 'pan' || isPanning ? 'grab' : 
//               tool === 'select' ? 'default' : 
//               tool === 'text' ? 'crosshair' :
//               'crosshair',
//             willChange: 'auto',
//             imageRendering: 'crisp-edges',
//             pointerEvents: tool === 'text' || tool === 'select' ? 'none' : 'auto' // ⚠️ WAŻNE!
//           }}
//         />
//       </div>
//     </div>
//   );
// }

// export default WhiteboardCanvas;