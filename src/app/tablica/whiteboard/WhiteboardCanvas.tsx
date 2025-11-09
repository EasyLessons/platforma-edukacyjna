/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                    WHITEBOARD CANVAS - REALTIME VERSION
 *                         Tablica z Synchronizacją
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔄 ZMIANY:
 * - Dodano useBoardRealtime() hook
 * - Automatyczne wysyłanie zmian do innych użytkowników
 * - Automatyczne odbieranie zmian od innych użytkowników
 * - Komponent OnlineUsers w prawym górnym rogu
 * 
 * 📝 MODYFIKACJE:
 * 1. handlePathCreate → broadcastElementCreated
 * 2. handleShapeCreate → broadcastElementCreated
 * 3. handleFunctionCreate → broadcastElementCreated
 * 4. handleTextCreate → broadcastElementCreated
 * 5. handleImageCreate → broadcastElementCreated
 * 6. handleElementUpdate → broadcastElementUpdated
 * 7. handleElementDelete → broadcastElementDeleted
 * 8. useEffect → onRemoteElementCreated/Updated/Deleted
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
import { EraserTool } from '../toolbar/EraserTool';
import { OnlineUsers } from './OnlineUsers'; // 🆕 Import komponentu OnlineUsers

// 🆕 Import hooka Realtime
import { useBoardRealtime } from '@/app/context/BoardRealtimeContext';

import {
  Point,
  ViewportTransform,
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ImageElement,
  MomentumState 
} from './types';

import {
  panViewportWithWheel,
  panViewportWithMouse,
  zoomViewport,
  constrainViewport,
  inverseTransformPoint,
  updateMomentum,   
  startMomentum,     
  stopMomentum     
} from './viewport';

import { drawGrid } from './Grid';
import { drawElement } from './rendering';

interface WhiteboardCanvasProps {
  className?: string;
}

export function WhiteboardCanvas({ className = '' }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageToolRef = useRef<ImageToolRef>(null);
  
  // 🆕 REALTIME HOOK
  const {
    broadcastElementCreated,
    broadcastElementUpdated,
    broadcastElementDeleted,
    onRemoteElementCreated,
    onRemoteElementUpdated,
    onRemoteElementDeleted,
    isConnected
  } = useBoardRealtime();
  
  // Viewport state
  const [viewport, setViewport] = useState<ViewportTransform>({ 
    x: 0,
    y: 0,
    scale: 1
  });

  const [momentum, setMomentum] = useState<MomentumState>({
    velocityX: 0,
    velocityY: 0,
    isActive: false,
    lastTimestamp: performance.now()
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
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  
  // History state
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 REALTIME - ODBIERANIE ZMIAN OD INNYCH UŻYTKOWNIKÓW
  // ═══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    // Handler: Nowy element od innego użytkownika
    onRemoteElementCreated((element, userId, username) => {
      console.log(`📥 [${username}] dodał element:`, element.id);
      
      setElements(prev => {
        // Sprawdź czy element już istnieje (unikaj duplikatów)
        if (prev.some(el => el.id === element.id)) {
          return prev;
        }
        return [...prev, element];
      });
    });
    
    // Handler: Aktualizacja elementu od innego użytkownika
    onRemoteElementUpdated((element, userId, username) => {
      console.log(`📥 [${username}] zaktualizował element:`, element.id);
      
      setElements(prev =>
        prev.map(el => (el.id === element.id ? element : el))
      );
    });
    
    // Handler: Usunięcie elementu przez innego użytkownika
    onRemoteElementDeleted((elementId, userId, username) => {
      console.log(`📥 [${username}] usunął element:`, elementId);
      
      setElements(prev => prev.filter(el => el.id !== elementId));
    });
  }, [onRemoteElementCreated, onRemoteElementUpdated, onRemoteElementDeleted]);

  // ========================================
  // KEYBOARD SHORTCUTS (bez zmian)
  // ========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        handleGlobalPasteImageRef.current();
        return;
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        setTool('select');
        setSelectedElementIds(new Set());
        setEditingTextId(null);
      }
      
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setTool('eraser');
      }
      
      if (
        tool === 'select' &&
        selectedElementIds.size === 1 &&
        e.key.length === 1 &&
        !e.ctrlKey && !e.metaKey && !e.altKey
      ) {
        const selectedId = Array.from(selectedElementIds)[0];
        const selectedElement = elementsRef.current.find(el => el.id === selectedId);
        
        if (selectedElement && selectedElement.type === 'text') {
          e.preventDefault();
          setEditingTextId(selectedId);
          setTool('text');
          
          const newElements = elementsRef.current.map(el =>
            el.id === selectedId ? { ...el, text: e.key } as DrawingElement : el
          );
          setElements(newElements);
        }
      }
      
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
      
      if (e.key === 'Delete') {
        const currentSelectedIds = selectedElementIdsRef.current;
        const currentElements = elementsRef.current;
        
        if (currentSelectedIds.size > 0) {
          e.preventDefault();
          const newElements = currentElements.filter(el => !currentSelectedIds.has(el.id));
          setElements(newElements);
          saveToHistoryRef.current(newElements);
          setSelectedElementIds(new Set());
          
          // 🆕 BROADCAST DELETE
          currentSelectedIds.forEach(id => {
            broadcastElementDeleted(id);
          });
        }
      }
      
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
  }, [tool, selectedElementIds, broadcastElementDeleted]);

  // Canvas setup (bez zmian)
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
  
  // Wheel/Touchpad handling (bez zmian)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = container.getBoundingClientRect();
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

  // Auto-expand (bez zmian)
  const handleAutoExpand = useCallback((elementId: string, newHeight: number) => {
    setElements(prevElements => {
      const updated = prevElements.map(el => {
        if (el.id === elementId && el.type === 'text') {
          const currentHeight = el.height || 0;
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

  // Redraw canvas (bez zmian)
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    
    ctx.clearRect(0, 0, width, height);
    drawGrid(ctx, viewport, width, height);
    
    elements.forEach(element => {
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

  // History (bez zmian)
  const MAX_HISTORY_SIZE = 50;
  
  const saveToHistory = useCallback((newElements: DrawingElement[]) => {
    setHistoryIndex(prevIndex => {
      setHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, prevIndex + 1);
        newHistory.push(newElements);
        
        if (newHistory.length > MAX_HISTORY_SIZE) {
          const trimmed = newHistory.slice(newHistory.length - MAX_HISTORY_SIZE);
          setHistoryIndex(trimmed.length - 1);
          return trimmed;
        }
        
        return newHistory;
      });
      
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 CALLBACKI DLA NARZĘDZI - Z BROADCAST
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handlePathCreate = useCallback((path: DrawingPath) => {
    const newElements = [...elements, path];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(path);
  }, [elements, saveToHistory, broadcastElementCreated]);

  const handleShapeCreate = useCallback((shape: Shape) => {
    const newElements = [...elements, shape];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(shape);
  }, [elements, saveToHistory, broadcastElementCreated]);

  const handleFunctionCreate = useCallback((func: FunctionPlot) => {
    const newElements = [...elements, func];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(func);
  }, [elements, saveToHistory, broadcastElementCreated]);

  const handleTextCreate = useCallback((text: TextElement) => {
    const newElements = [...elements, text];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(text);
  }, [elements, saveToHistory, broadcastElementCreated]);

  const handleTextUpdate = useCallback((id: string, updates: Partial<TextElement>) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } as DrawingElement : el
    );
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST UPDATE
    const updatedElement = newElements.find(el => el.id === id);
    if (updatedElement) {
      broadcastElementUpdated(updatedElement);
    }
  }, [elements, saveToHistory, broadcastElementUpdated]);

  const handleTextDelete = useCallback((id: string) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST DELETE
    broadcastElementDeleted(id);
  }, [elements, saveToHistory, broadcastElementDeleted]);

  const handleTextEdit = useCallback((id: string) => {
    setEditingTextId(id);
    setTool('text');
  }, []);

  const handleEditingComplete = useCallback(() => {
    setEditingTextId(null);
    setTool('select');
  }, []);

  const handleImageCreate = useCallback((image: ImageElement) => {
    const newElements = [...elements, image];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(image);
    
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
  }, [elements, saveToHistory, broadcastElementCreated]);

  const handleViewportChange = useCallback((newViewport: ViewportTransform) => {
    setViewport(newViewport);
  }, []);

  const handleElementDelete = useCallback((id: string) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST DELETE
    broadcastElementDeleted(id);
  }, [elements, saveToHistory, broadcastElementDeleted]);

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedElementIds(ids);
  }, []);

  const handleElementUpdate = useCallback((id: string, updates: Partial<DrawingElement>) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } as DrawingElement : el
    );
    setElements(newElements);
  }, [elements]);

  const handleElementUpdateWithHistory = useCallback((id: string, updates: Partial<DrawingElement>) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } as DrawingElement : el
    );
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST UPDATE
    const updatedElement = newElements.find(el => el.id === id);
    if (updatedElement) {
      broadcastElementUpdated(updatedElement);
    }
  }, [elements, saveToHistory, broadcastElementUpdated]);

  const handleElementsUpdate = useCallback((updates: Map<string, Partial<DrawingElement>>) => {
    const newElements = elements.map(el => {
      const update = updates.get(el.id);
      return update ? { ...el, ...update } as DrawingElement : el;
    });
    setElements(newElements);
  }, [elements]);

  const handleSelectionFinish = useCallback(() => {
    saveToHistory(elements);
    
    // 🆕 BROADCAST wszystkie zmienione elementy
    elements.forEach(element => {
      if (selectedElementIds.has(element.id)) {
        broadcastElementUpdated(element);
      }
    });
  }, [elements, selectedElementIds, saveToHistory, broadcastElementUpdated]);

  const deleteSelectedElements = useCallback(() => {
    if (selectedElementIds.size === 0) return;
    
    const newElements = elements.filter(el => !selectedElementIds.has(el.id));
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST DELETE dla każdego
    selectedElementIds.forEach(id => {
      broadcastElementDeleted(id);
    });
    
    setSelectedElementIds(new Set());
  }, [elements, selectedElementIds, saveToHistory, broadcastElementDeleted]);

  // Zoom functions (bez zmian)
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

  // Stable callbacks (bez zmian)
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

  const getCanvasDimensions = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 0, height: 0 };
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
  
  // Globalne obrazy (bez zmian)
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

  const handleGlobalPasteImage = useCallback(async () => {
    setImageProcessing(true);

    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        const imageTypes = item.types.filter(type => type.startsWith('image/'));
        
        if (imageTypes.length > 0) {
          const blob = await item.getType(imageTypes[0]);
          const { data, width, height } = await fileToBase64(blob);
          
          const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
          const centerWorld = inverseTransformPoint(centerScreen, viewport, canvasWidth, canvasHeight);
          
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
      
      const dropScreen = { x: e.clientX, y: e.clientY };
      const dropWorld = inverseTransformPoint(dropScreen, viewport, canvasWidth, canvasHeight);
      
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
  
  useEffect(() => {
    handleGlobalPasteImageRef.current = handleGlobalPasteImage;
  }, [handleGlobalPasteImage]);
  
  const handleImageToolPaste = useCallback(() => {
    imageToolRef.current?.handlePasteFromClipboard();
  }, []);
  
  const handleImageToolUpload = useCallback(() => {
    imageToolRef.current?.triggerFileUpload();
  }, []);
  
  // Middle button pan (bez zmian)
  useEffect(() => {
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;
    let startX = 0;
    let startY = 0;
    let lastMoveTime = 0;
    
    const velocityHistory: Array<{ vx: number; vy: number }> = [];

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        
        setMomentum(prev => stopMomentum(prev));
        
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        startX = e.clientX;
        startY = e.clientY;
        lastMoveTime = performance.now();
        velocityHistory.length = 0;
        document.body.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const currentTime = performance.now();
      const deltaTime = currentTime - lastMoveTime;
      
      if (deltaTime > 0 && deltaTime < 50) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        const vx = dx / deltaTime;
        const vy = dy / deltaTime;
        
        velocityHistory.push({ vx, vy });
        
        if (velocityHistory.length > 5) {
          velocityHistory.shift();
        }
        
        lastX = e.clientX;
        lastY = e.clientY;
        lastMoveTime = currentTime;
        
        const currentViewport = viewportRef.current;
        const newViewport = panViewportWithMouse(currentViewport, dx, dy);
        
        setViewport(constrainViewport(newViewport));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        
        if (isPanning && velocityHistory.length >= 2) {
          const totalDx = e.clientX - startX;
          const totalDy = e.clientY - startY;
          const totalDistance = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
          
          if (totalDistance < 50) {
            isPanning = false;
            document.body.style.cursor = '';
            return;
          }
          
          const recentSamples = velocityHistory.slice(-3);
          let avgVx = 0;
          let avgVy = 0;
          
          recentSamples.forEach(sample => {
            avgVx += sample.vx;
            avgVy += sample.vy;
          });
          
          avgVx /= recentSamples.length;
          avgVy /= recentSamples.length;
          
          const speed = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
          
          if (speed < 0.5) {
            isPanning = false;
            document.body.style.cursor = '';
            return;
          }
          
          let multiplier = 0.05 + (totalDistance * 0.0002);
          multiplier = Math.min(multiplier, 0.5);
          
          const currentScale = viewportRef.current.scale;
          const scaleMultiplier = 1 / currentScale;
          
          setMomentum(prev => startMomentum(
            prev, 
            -avgVx * 2 * multiplier * scaleMultiplier, 
            -avgVy * 2 * multiplier * scaleMultiplier
          ));
        }
        
        isPanning = false;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = '';
    };
  }, []);

  // Momentum animation (bez zmian)
  useEffect(() => {
    if (!momentum.isActive) return;
    
    let animationFrameId: number;
    
    const animate = () => {
      const currentTime = performance.now();
      const { momentum: newMomentum, viewport: viewportChange } = updateMomentum(momentum, currentTime);
      
      if (viewportChange) {
        setViewport(prev => constrainViewport({
          x: prev.x + viewportChange.x,
          y: prev.y + viewportChange.y,
          scale: prev.scale
        }));
      }
      
      setMomentum(newMomentum);
      
      if (newMomentum.isActive) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [momentum]);
  
  return (
    <div 
      className={`relative w-full h-full bg-[#FEF2F2] ${className}`}
      onDrop={handleGlobalDropImage}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div ref={containerRef} className="absolute inset-0 overflow-hidden">
        {/* 🆕 KOMPONENT ONLINE USERS */}
        <OnlineUsers />
        
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

        {tool === 'pan' && canvasWidth > 0 && (
          <PanTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onViewportChange={handleViewportChange}
          />
        )}

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

        {tool === 'eraser' && canvasWidth > 0 && (
          <EraserTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            elements={elements}
            onElementDelete={handleElementDelete}
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
              tool === 'eraser' ? 'none' :
              'crosshair',
            willChange: 'auto',
            imageRendering: 'crisp-edges',
            pointerEvents: 'none'
          }}
        />
        
        {imageProcessing && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-700">Przetwarzanie obrazu...</span>
            </div>
          </div>
        )}
        
        {/* 🆕 INDICATOR POŁĄCZENIA */}
        {!isConnected && (
          <div className="absolute bottom-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg px-3 py-2 shadow-lg z-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span className="text-sm text-yellow-800">Reconnecting...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WhiteboardCanvas;