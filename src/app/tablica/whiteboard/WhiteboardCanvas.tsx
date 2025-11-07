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
 * - ../toolbar/ImageTool (ImageTool)
 * - ./types (Point, ViewportTransform, DrawingElement, DrawingPath, Shape, TextElement, FunctionPlot, ImageElement)
 * - ./viewport (panViewportWithWheel, zoomViewport, constrainViewport, inverseTransformPoint)
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
 * - ImageTool.tsx - logika wstawiania obrazów (aktywny gdy tool='image')
 * - SelectTool.tsx - logika zaznaczania (aktywny gdy tool='select')
 * - TextTool.tsx - logika tekstu (aktywny gdy tool='text')
 * 
 * ⚠️ WAŻNE - WHEEL/PAN/ZOOM:
 * - Canvas ma pointerEvents: 'none' - wszystkie narzędzia mają swoje overlaye
 * - Kontener obsługuje wheel events (backup dla gdy żadne narzędzie nie jest aktywne)
 * - Każde narzędzie obsługuje własne wheel events przez onViewportChange
 * 
 * ⚠️ GLOBALNE FUNKCJE OBRAZÓW:
 * - Ctrl+V (wklejanie ze schowka) działa ZAWSZE, niezależnie od aktywnego narzędzia
 * - Drag & Drop obrazów działa ZAWSZE na głównym kontenerze
 * - ImageTool zapewnia dodatkowe opcje gdy tool='image'
 * 
 * ⚠️ KLUCZOWE CALLBACKI:
 * - handlePathCreate - tworzenie ścieżek (PenTool)
 * - handleShapeCreate - tworzenie kształtów (ShapeTool)
 * - handleFunctionCreate - tworzenie funkcji (FunctionTool)
 * - handleImageCreate - tworzenie obrazów (ImageTool + globalne)
 * - handleTextCreate/Update/Delete - zarządzanie tekstami (TextTool)
 * - handleSelectionChange/ElementUpdate - zarządzanie zaznaczeniem (SelectTool)
 * - handleViewportChange - synchronizacja viewport między narzędziami
 * - handleTextEdit - double-click w SelectTool otwiera edytor tekstu
 * - handleGlobalPasteImage - globalne wklejanie obrazów (Ctrl+V)
 * - handleGlobalDropImage - globalne drag&drop obrazów
 * 
 * ⚠️ KEYBOARD SHORTCUTS:
 * - Ctrl+V: Wklej obraz ze schowka (globalne - działa zawsze)
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 * - Delete: Usuń zaznaczone elementy
 * - ESC: Powrót do SelectTool
 * 
 * PRZEZNACZENIE:
 * Główny komponent tablicy - zarządza viewport, elements, historią,
 * koordynuje narzędzia (pen/shape/text/select/function/image), renderuje canvas.
 * Każde narzędzie jest teraz osobnym komponentem z własną logiką.
 * Obsługuje globalne wklejanie i drag&drop obrazów niezależnie od aktywnego narzędzia.
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
import { PanTool } from '../toolbar/PanTool';
import { FunctionTool } from '../toolbar/FunctionTool';
import { ImageTool, ImageToolRef } from '../toolbar/ImageTool';

// Import wszystkich modułów
import {
  Point,
  ViewportTransform,
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ImageElement
} from './types';

import {
  panViewportWithWheel,
  panViewportWithMouse,
  zoomViewport,
  constrainViewport,
  inverseTransformPoint
} from './viewport';

import { drawGrid } from './Grid';
import { drawElement } from './rendering';

interface WhiteboardCanvasProps {
  className?: string;
}

export function WhiteboardCanvas({ className = '' }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageToolRef = useRef<ImageToolRef>(null); // 🖼️ Ref dla ImageTool
  
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
  const [debugMode, setDebugMode] = useState(false); // 🔍 Debug mode for text sizing
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map()); // 🖼️ Cache dla obrazów
  
  // History state - inicjalizacja z pustym stanem
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // 🖼️ State dla wklejania/dropowania obrazów (globalne)
  const [imageProcessing, setImageProcessing] = useState(false);
  
  const redrawCanvasRef = useRef<() => void>(() => {});
  const handleGlobalPasteImageRef = useRef<() => void>(() => {});
  
  // Refs for stable callbacks
  const elementsRef = useRef(elements);
  const saveToHistoryRef = useRef<(els: DrawingElement[]) => void>(() => {});
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const selectedElementIdsRef = useRef(selectedElementIds);
  const viewportRef = useRef(viewport);
  
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  
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
      // 🔥 WAŻNE: Jeśli event pochodzi z input/textarea, ignoruj go całkowicie
      // (pozwól input obsłużyć swoje własne eventy)
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return; // Wyjdź natychmiast - input/textarea obsługuje to sam
      }
      
      // 🖼️ Ctrl+V - wklej obraz ze schowka (globalne - działa zawsze)
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        handleGlobalPasteImageRef.current();
        return;
      }
      
      // ESC - powrót do SelectTool
      if (e.key === 'Escape') {
        e.preventDefault();
        setTool('select');
        setSelectedElementIds(new Set());
        setEditingTextId(null);
      }
      
      // 🆕 Typing on selected text - enter edit mode and replace text
      // Tylko gdy: tool='select', zaznaczony dokładnie 1 element typu text, normalny znak
      if (
        tool === 'select' &&
        selectedElementIds.size === 1 &&
        e.key.length === 1 && // Pojedynczy znak (a-z, 0-9, spacja, etc.)
        !e.ctrlKey && !e.metaKey && !e.altKey // Bez modyfikatorów (Ctrl, Cmd, Alt)
      ) {
        const selectedId = Array.from(selectedElementIds)[0];
        const selectedElement = elementsRef.current.find(el => el.id === selectedId);
        
        if (selectedElement && selectedElement.type === 'text') {
          e.preventDefault();
          // Wejdź w tryb edycji i zastąp tekst wpisanym znakiem
          setEditingTextId(selectedId);
          setTool('text');
          
          // Wyczyść tekst i dodaj pierwszy znak (to zostanie obsłużone przez TextTool)
          const newElements = elementsRef.current.map(el =>
            el.id === selectedId ? { ...el, text: e.key } as DrawingElement : el
          );
          setElements(newElements);
        }
      }
      
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
      
      // 🔍 D key - Toggle debug mode
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setDebugMode(prev => {
          console.log('🔍 Debug mode:', !prev ? 'ON' : 'OFF');
          return !prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool, selectedElementIds]); // ✅ Dependencies dla keyboard shortcuts

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
  // 🔍 Auto-expand text boxes when text doesn't fit
  const handleAutoExpand = useCallback((elementId: string, newHeight: number) => {
    setElements(prevElements => {
      const updated = prevElements.map(el => {
        if (el.id === elementId && el.type === 'text') {
          const currentHeight = el.height || 0;
          // Only expand, never shrink automatically
          if (newHeight > currentHeight) {
            console.log(`📏 Auto-expanding ${elementId}: ${currentHeight.toFixed(2)} → ${newHeight.toFixed(2)}`);
            return { ...el, height: newHeight };
          }
        }
        return el;
      });
      return updated;
    });
  }, []);

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
    
    // Draw all elements (pomijamy element który jest aktualnie edytowany)
    elements.forEach(element => {
      // Nie rysuj elementu który jest aktualnie edytowany w TextTool
      if (element.id === editingTextId) return;
      drawElement(ctx, element, viewport, width, height, loadedImages, debugMode, handleAutoExpand);
    });
  }, [elements, viewport, editingTextId, debugMode, handleAutoExpand, loadedImages]);

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
    setTool('select'); // 🆕 Automatyczne przełączenie na narzędzie zaznaczania po zapisaniu tekstu
  }, []);

  // ========================================
  // 🖼️ CALLBACKI DLA IMAGETOOL
  // ========================================
  const handleImageCreate = useCallback((image: ImageElement) => {
    const newElements = [...elements, image];
    setElements(newElements);
    saveToHistory(newElements);
    
    // Preload obrazu do cache
    if (image.src) {
      const img = new Image();
      img.src = image.src;
      img.onload = () => {
        setLoadedImages(prev => new Map(prev).set(image.id, img));
      };
      img.onerror = () => {
        console.error('Failed to load image:', image.id);
      };
    }
  }, [elements, saveToHistory]);

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

  // 🆕 Handler dla aktualizacji z natychmiastowym zapisem (np. formatowanie tekstu)
  const handleElementUpdateWithHistory = useCallback((id: string, updates: Partial<DrawingElement>) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } as DrawingElement : el
    );
    setElements(newElements);
    saveToHistory(newElements); // ✅ Zapisz do historii od razu
  }, [elements, saveToHistory]);

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
  
  // ========================================
  // 🖼️ GLOBALNE CALLBACKI DLA OBRAZÓW (działają zawsze, niezależnie od narzędzia)
  // ========================================
  
  // 🖼️ Konwersja File/Blob do base64 z kompresją
  const fileToBase64 = useCallback((file: Blob): Promise<{ data: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Cannot get canvas context'));
            return;
          }

          let width = img.width;
          let height = img.height;

          // 🔥 Kompresja jeśli obraz jest za duży (>1000px lub rozmiar >500KB)
          const MAX_DIMENSION = 1000;
          const maxSize = Math.max(width, height);
          
          if (maxSize > MAX_DIMENSION || file.size > 500000) {
            const scale = MAX_DIMENSION / maxSize;
            width = Math.floor(width * scale);
            height = Math.floor(height * scale);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Konwersja do base64 (JPEG dla lepszej kompresji)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          
          resolve({ 
            data: dataUrl, 
            width: img.width,
            height: img.height 
          });
        };
        
        img.onerror = () => reject(new Error('Cannot load image'));
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => reject(new Error('Cannot read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  // 🖼️ Globalne wklejanie obrazu ze schowka (Ctrl+V) - działa zawsze
  const handleGlobalPasteImage = useCallback(async () => {
    setImageProcessing(true);

    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        const imageTypes = item.types.filter(type => type.startsWith('image/'));
        
        if (imageTypes.length > 0) {
          const blob = await item.getType(imageTypes[0]);
          const { data, width, height } = await fileToBase64(blob);
          
          // Wstaw obraz w centrum widoku
          const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
          const centerWorld = inverseTransformPoint(centerScreen, viewport, canvasWidth, canvasHeight);
          
          // Domyślny rozmiar: 3 jednostki szerokości (zachowaj proporcje)
          const aspectRatio = height / width;
          const worldWidth = 3;
          const worldHeight = worldWidth * aspectRatio;
          
          const newImage: ImageElement = {
            id: Date.now().toString(),
            type: 'image',
            x: centerWorld.x - worldWidth / 2,
            y: centerWorld.y - worldHeight / 2,
            width: worldWidth,
            height: worldHeight,
            src: data,
            alt: 'Pasted image',
          };

          handleImageCreate(newImage);
          setImageProcessing(false);
          return;
        }
      }
      
      console.log('No image in clipboard');
    } catch (err) {
      console.error('Clipboard paste error:', err);
    } finally {
      setImageProcessing(false);
    }
  }, [viewport, canvasWidth, canvasHeight, fileToBase64, handleImageCreate]);

  // 🖼️ Globalny drag & drop obrazu - działa zawsze
  const handleGlobalDropImage = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    setImageProcessing(true);

    try {
      const { data, width, height } = await fileToBase64(file);
      
      // Pozycja gdzie upuszczono
      const dropScreen = { x: e.clientX, y: e.clientY };
      const dropWorld = inverseTransformPoint(dropScreen, viewport, canvasWidth, canvasHeight);
      
      // Domyślny rozmiar: 3 jednostki szerokości (zachowaj proporcje)
      const aspectRatio = height / width;
      const worldWidth = 3;
      const worldHeight = worldWidth * aspectRatio;
      
      const newImage: ImageElement = {
        id: Date.now().toString(),
        type: 'image',
        x: dropWorld.x - worldWidth / 2,
        y: dropWorld.y - worldHeight / 2,
        width: worldWidth,
        height: worldHeight,
        src: data,
        alt: 'Dropped image',
      };

      handleImageCreate(newImage);
    } catch (err) {
      console.error('Drop error:', err);
    } finally {
      setImageProcessing(false);
    }
  }, [viewport, canvasWidth, canvasHeight, fileToBase64, handleImageCreate]);
  
  // Zaktualizuj ref dla handleGlobalPasteImage
  useEffect(() => {
    handleGlobalPasteImageRef.current = handleGlobalPasteImage;
  }, [handleGlobalPasteImage]);
  
  // 🖼️ Handlery dla przycisków w ToolbarUI (ImageTool)
  const handleImageToolPaste = useCallback(() => {
    imageToolRef.current?.handlePasteFromClipboard();
  }, []);
  
  const handleImageToolUpload = useCallback(() => {
    imageToolRef.current?.triggerFileUpload();
  }, []);
  
  // ========================================
  // 🆕 MIDDLE BUTTON (SCROLL) - BEZPOŚREDNI PAN
  // ========================================
  useEffect(() => {
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      // Middle button (button 1)
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        document.body.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      
      lastX = e.clientX;
      lastY = e.clientY;
      
      const currentViewport = viewportRef.current;
      
      // Pan viewport - bez minusa, żeby kierunek był naturalny
      const newViewport = panViewportWithMouse(currentViewport, dx, dy);
      
      setViewport(constrainViewport(newViewport));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        isPanning = false;
        document.body.style.cursor = '';
      }
    };

    // Capture phase = true - przechwytuj eventy PRZED innymi narzędziami
    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = '';
    };
  }, []); // Pusta tablica - używamy refs
  
  return (
    <div 
      className={`relative w-full h-full bg-white ${className}`}
      onDrop={handleGlobalDropImage}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
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
          canUndo={canUndo}
          canRedo={canRedo}
          onImagePaste={handleImageToolPaste}
          onImageUpload={handleImageToolUpload}
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
            onElementUpdateWithHistory={handleElementUpdateWithHistory}
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

        {/* 🆕 PANTOOL - aktywny gdy tool === 'pan' */}
        {tool === 'pan' && canvasWidth > 0 && (
          <PanTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onViewportChange={handleViewportChange}
          />
        )}

        {/* 🆕 FUNCTIONTOOL - aktywny gdy tool === 'function' */}
        {tool === 'function' && canvasWidth > 0 && (
          <FunctionTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            color={color}
            lineWidth={lineWidth}
            onFunctionCreate={handleFunctionCreate}
            onColorChange={handleColorChange}
            onLineWidthChange={handleLineWidthChange}
            onViewportChange={handleViewportChange}
          />
        )}

        {/* 🖼️ IMAGETOOL - aktywny gdy tool === 'image' */}
        {tool === 'image' && canvasWidth > 0 && (
          <ImageTool
            ref={imageToolRef}
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onImageCreate={handleImageCreate}
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
        
        {/* 🖼️ Wskaźnik ładowania podczas przetwarzania obrazu */}
        {imageProcessing && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-700">Przetwarzanie obrazu...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WhiteboardCanvas;
