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
import NextImage from 'next/image';
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
import { MarkdownNoteTool, MarkdownNoteView } from '../toolbar/MarkdownNoteTool';
import { TableTool, TableView } from '../toolbar/TableTool';
import { CalculatorTool } from '../toolbar/CalculatorTool';
import { MathChatbot } from '../toolbar/MathChatbot';
import { OnlineUsers } from './OnlineUsers';
import { RemoteCursors } from './RemoteCursors';

// 🆕 Import SmartSearch
import { SmartSearchBar, CardViewer, FormulaResource, CardResource } from '../smartsearch';

// 🆕 Import hooka Realtime
import { useBoardRealtime } from '@/app/context/BoardRealtimeContext';

// 🆕 Import snap utilities
import { GuideLine, collectGuidelinesFromImages } from '../utils/snapUtils';

// 🆕 Import API dla elementów tablicy
import { saveBoardElementsBatch, loadBoardElements, deleteBoardElement } from '@/boards_api/api';

import {
  Point,
  ViewportTransform,
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ImageElement,
  MarkdownNote,
  TableElement,
  MomentumState 
} from './types';

import {
  panViewportWithWheel,
  panViewportWithMouse,
  zoomViewport,
  constrainViewport,
  inverseTransformPoint,
  transformPoint,
  updateMomentum,   
  startMomentum,     
  stopMomentum     
} from './viewport';

import { drawGrid } from './Grid';
import { drawElement } from './rendering';

interface WhiteboardCanvasProps {
  className?: string;
  boardId: string; // 🆕 boardId z URL params (page.tsx)
}

export default function WhiteboardCanvas({ className = '', boardId }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageToolRef = useRef<ImageToolRef>(null);
  
  // 🆕 boardId pochodzi z props (przekazany z page.tsx)
  // Automatycznie aktualizuje się gdy URL się zmienia
  const [boardIdState, setBoardIdState] = useState<string>(boardId);
  
  // Synchronizuj boardIdState gdy boardId prop się zmienia
  useEffect(() => {
    setBoardIdState(boardId);
    console.log('📋 Board ID zaktualizowany:', boardId);
  }, [boardId]);
  
  // 🆕 REALTIME HOOK
  const {
    broadcastElementCreated,
    broadcastElementUpdated,
    broadcastElementDeleted,
    broadcastElementsBatch,
    broadcastCursorMove,
    remoteCursors,
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
  const [polygonSides, setPolygonSides] = useState(5); // Liczba boków dla wielokąta
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [fillShape, setFillShape] = useState(false);
  
  // 🆕 LOADING STATE - wyświetlanie overlay podczas ładowania
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 🆕 KALKULATOR - osobny state (zawsze aktywny po włączeniu)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // 🆕 SNAP GUIDES - aktywne linie prowadzące
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);

  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Cześć! 👋 Jestem **Math Tutor**!

Mogę Ci pomóc z:
• 📐 Rozwiązywaniem zadań
• 💡 Podpowiedziami  
• ✅ Sprawdzaniem rozwiązań
• 📚 Wyjaśnianiem wzorów

Zadaj pytanie! 🤔`,
      timestamp: new Date(),
    }
  ]);
  
  // Elements state
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingMarkdownId, setEditingMarkdownId] = useState<string | null>(null); // 🆕 Edycja markdown
  const [debugMode, setDebugMode] = useState(false);
  
  // 🆕 Szerokość okna dla responsywności
  const [windowWidth, setWindowWidth] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  
  // 🆕 ZAPISYWANIE - state i refs
  const [unsavedElements, setUnsavedElements] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const unsavedElementsRef = useRef<Set<string>>(new Set());
  
  // 🆕 SMARTSEARCH - state
  const [activeCard, setActiveCard] = useState<CardResource | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false); // Blokuje zoom gdy search otwarty
  const [isCardViewerActive, setIsCardViewerActive] = useState(false); // Blokuje canvas gdy CardViewer otwarty
  
  // History state
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [imageProcessing, setImageProcessing] = useState(false);
  
  const redrawCanvasRef = useRef<() => void>(() => {});
  const handleGlobalPasteImageRef = useRef<() => void>(() => {});
  
  // 🆕 Clipboard dla kopiowania/wklejania elementów
  const copiedElementsRef = useRef<DrawingElement[]>([]);
  
  // 🆕 Refs dla undo/redo (żeby uniknąć problemu z kolejnością deklaracji)
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
  
  // Refs for stable callbacks
  const elementsRef = useRef(elements);
  const saveToHistoryRef = useRef<(els: DrawingElement[]) => void>(() => {});
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);
  const selectedElementIdsRef = useRef(selectedElementIds);
  const viewportRef = useRef(viewport);
  const boardIdStateRef = useRef(boardIdState);
  const loadedImagesRef = useRef(loadedImages);
  
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    loadedImagesRef.current = loadedImages;
  }, [loadedImages]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    selectedElementIdsRef.current = selectedElementIds;
  }, [selectedElementIds]);
  
  useEffect(() => {
    boardIdStateRef.current = boardIdState;
  }, [boardIdState]);
  
  // 🆕 Synchronizacja unsavedElementsRef
  useEffect(() => {
    unsavedElementsRef.current = unsavedElements;
  }, [unsavedElements]);

  // 🆕 Śledzenie szerokości okna dla responsywności
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize(); // Inicjalne ustawienie
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      
      // 🆕 Jeśli to obraz, załaduj go do loadedImages
      if (element.type === 'image' && (element as ImageElement).src) {
        console.log(`🖼️ Ładowanie zdalnego obrazu ${element.id}...`);
        const img = new Image();
        img.src = (element as ImageElement).src;
        img.onload = () => {
          console.log(`✅ Załadowano zdalny obraz ${element.id}`);
          setLoadedImages(prev => new Map(prev).set(element.id, img));
        };
        img.onerror = () => {
          console.error(`❌ Błąd ładowania zdalnego obrazu ${element.id}`);
        };
      }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🖱️ BROADCAST CURSOR POSITION - ZOPTYMALIZOWANE (cache rect, ResizeObserver)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const lastCursorBroadcastRef = useRef<number>(0);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const CURSOR_BROADCAST_INTERVAL = 100; // Zwiększ do 100ms (10 FPS wystarczy dla kursorów)
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Cache rect - aktualizuj tylko przy resize
    const updateRect = () => {
      cachedRectRef.current = container.getBoundingClientRect();
    };
    updateRect();
    
    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(container);
    
    const handlePointerMove = (e: PointerEvent) => {
      // ✅ Throttle PRZED jakimikolwiek obliczeniami
      const now = performance.now();
      if (now - lastCursorBroadcastRef.current < CURSOR_BROADCAST_INTERVAL) return;
      lastCursorBroadcastRef.current = now;
      
      // ✅ Użyj cached rect zamiast getBoundingClientRect()
      const rect = cachedRectRef.current;
      if (!rect) return;
      
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      const worldPos = inverseTransformPoint(
        { x: screenX, y: screenY },
        viewportRef.current,
        rect.width,
        rect.height
      );
      
      // Broadcast pozycji
      broadcastCursorMove(worldPos.x, worldPos.y);
    };
    
    // ✅ PASSIVE + CAPTURE false - pozwól innym handlerom działać
    container.addEventListener('pointermove', handlePointerMove, { 
      passive: true,
      capture: false
    });
    
    return () => {
      container.removeEventListener('pointermove', handlePointerMove);
      resizeObserver.disconnect();
    };
  }, [broadcastCursorMove]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 💾 DEBOUNCED SAVE - Zapisywanie elementów z opóźnieniem 2s
  // ═══════════════════════════════════════════════════════════════════════════
  
  const debouncedSave = useCallback(async (boardId: string) => {
    // Anuluj poprzedni timer
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Ustaw nowy timer (2 sekundy)
    saveTimeoutRef.current = setTimeout(async () => {
      // Walidacja: boardId musi być liczbą
      const boardIdNum = parseInt(boardId);
      if (isNaN(boardIdNum)) {
        console.warn('⚠️ Nieprawidłowy boardId, pomijam zapis');
        return;
      }
      
      // Jeśli już trwa zapisywanie lub brak unsaved, wyjdź
      if (isSavingRef.current || unsavedElementsRef.current.size === 0) {
        return;
      }
      
      try {
        setIsSaving(true);
        isSavingRef.current = true;
        
        // Znajdź elementy do zapisania
        const currentElements = elementsRef.current;
        const currentUnsaved = unsavedElementsRef.current;
        
        const elementsToSave = currentElements
          .filter(el => currentUnsaved.has(el.id))
          .map(el => ({
            element_id: el.id,
            type: el.type,
            data: el
          }));
        
        if (elementsToSave.length === 0) {
          return;
        }
        
        console.log(`💾 Zapisuję ${elementsToSave.length} elementów...`);
        
        // ZAPISZ BATCH
        const result = await saveBoardElementsBatch(boardIdNum, elementsToSave);
        
        console.log(`✅ Zapisano ${result.saved} elementów`);
        
        // Wyczyść zapisane elementy z unsaved
        const savedIds = new Set(elementsToSave.map(e => e.element_id));
        setUnsavedElements(prev => {
          const newSet = new Set(prev);
          savedIds.forEach(id => newSet.delete(id));
          return newSet;
        });
        
      } catch (err) {
        console.error('❌ Błąd zapisu:', err);
        // NIE czyść unsavedElements - spróbuj ponownie później
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
        
        // Jeśli pojawiły się nowe unsaved podczas zapisu, zaplanuj kolejny
        if (unsavedElementsRef.current.size > 0) {
          console.log(`🔄 Są nowe unsaved (${unsavedElementsRef.current.size}), planuję kolejny zapis...`);
          debouncedSave(boardId);
        }
      }
    }, 2000);  // 2 sekundy opóźnienia
  }, []);  // PUSTE! - używamy elementsRef.current, nie potrzebujemy elements

  // ═══════════════════════════════════════════════════════════════════════════
  // 📥 ŁADOWANIE ELEMENTÓW - Przy otwarciu tablicy
  // ═══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const loadElements = async () => {
      if (!boardIdState) {
        setIsLoading(false);
        return;
      }
      
      // Walidacja boardId
      const boardIdNum = parseInt(boardIdState);
      if (isNaN(boardIdNum)) {
        console.warn('⚠️ Nieprawidłowy boardId, pomijam ładowanie');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setLoadingProgress(10);
        console.log(`📥 Ładowanie elementów dla board ${boardIdNum}...`);
        
        const data = await loadBoardElements(boardIdNum);
        setLoadingProgress(50);
        
        // Ustaw elementy (mapuj data → element)
        const loadedElements = data.elements.map(e => e.data);
        setElements(loadedElements);
        setLoadingProgress(70);
        
        // 🆕 Ustaw początkową historię na załadowane elementy
        setHistory([loadedElements]);
        setHistoryIndex(0);
        
        console.log(`✅ Załadowano ${loadedElements.length} elementów`);
        setLoadingProgress(90);
        
        // Załaduj obrazy
        let loadedImagesCount = 0;
        const imageElements = loadedElements.filter(el => el.type === 'image');
        
        if (imageElements.length === 0) {
          setLoadingProgress(100);
          setTimeout(() => setIsLoading(false), 300);
        } else {
          const imagePromises = imageElements.map((el: DrawingElement) => {
            return new Promise<void>((resolve) => {
              if (el.type === 'image' && (el as ImageElement).src) {
                const img = new Image();
                img.src = (el as ImageElement).src;
                img.onload = () => {
                  setLoadedImages(prev => new Map(prev).set(el.id, img));
                  loadedImagesCount++;
                  setLoadingProgress(90 + (loadedImagesCount / imageElements.length) * 10);
                  resolve();
                };
                img.onerror = () => {
                  console.error('Failed to load image:', el.id);
                  loadedImagesCount++;
                  setLoadingProgress(90 + (loadedImagesCount / imageElements.length) * 10);
                  resolve();
                };
              } else {
                resolve();
              }
            });
          });
          
          await Promise.all(imagePromises);
          setLoadingProgress(100);
          setTimeout(() => setIsLoading(false), 300);
        }
        
      } catch (err) {
        console.error('❌ Błąd ładowania elementów:', err);
        setIsLoading(false);
      }
    };
    
    loadElements();
  }, [boardIdState]);

  // ========================================
  // KEYBOARD SHORTCUTS (bez zmian)
  // ========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }
      
      // 🆕 CTRL+C - Kopiuj zaznaczone elementy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const currentSelectedIds = selectedElementIdsRef.current;
        if (currentSelectedIds.size > 0) {
          e.preventDefault();
          const selectedElements = elementsRef.current.filter(el => currentSelectedIds.has(el.id));
          copiedElementsRef.current = selectedElements;
          console.log(`📋 Skopiowano ${selectedElements.length} elementów`);
        }
        return;
      }
      
      // 🆕 CTRL+V - Wklej skopiowane elementy (lub obraz)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        
        // Jeśli są skopiowane elementy, wklej je
        if (copiedElementsRef.current.length > 0) {
          const offset = 20; // Przesunięcie wklejonych elementów
          const newElements = copiedElementsRef.current.map(el => {
            const newId = `${el.type}-${Date.now()}-${Math.random()}`;
            
            // Skopiuj element z przesunięciem (różne typy mają różne pola pozycji)
            let newElement: DrawingElement;
            
            if (el.type === 'path') {
              // Path - przesuń wszystkie punkty
              newElement = {
                ...el,
                id: newId,
                points: el.points.map(p => ({ x: p.x + offset, y: p.y + offset }))
              };
            } else if (el.type === 'shape') {
              // Shape - przesuń startX/startY i endX/endY
              newElement = {
                ...el,
                id: newId,
                startX: el.startX + offset,
                startY: el.startY + offset,
                endX: el.endX + offset,
                endY: el.endY + offset
              };
            } else if (el.type === 'text' || el.type === 'image' || el.type === 'markdown' || el.type === 'table') {
              // Text/Image/Markdown/Table - mają x/y
              newElement = {
                ...el,
                id: newId,
                x: (el as any).x + offset,
                y: (el as any).y + offset
              };
            } else {
              // Fallback (function i inne) - skopiuj bez zmian pozycji
              newElement = { ...el, id: newId };
            }
            
            // 🆕 Dla obrazów, skopiuj także do loadedImages
            if (el.type === 'image') {
              const originalImage = loadedImagesRef.current.get(el.id);
              if (originalImage) {
                setTimeout(() => {
                  setLoadedImages(prev => new Map(prev).set(newId, originalImage));
                }, 0);
              }
            }
            
            return newElement;
          });
          
          const updatedElements = [...elementsRef.current, ...newElements];
          setElements(updatedElements);
          saveToHistoryRef.current(updatedElements);
          
          // Zaznacz nowo wklejone elementy
          const newIds = new Set(newElements.map(el => el.id));
          setSelectedElementIds(newIds);
          
          // 🆕 Oznacz jako unsaved i broadcast
          setUnsavedElements(prev => {
            const newSet = new Set(prev);
            newIds.forEach(id => newSet.add(id));
            return newSet;
          });
          
          // Broadcast do innych użytkowników
          newElements.forEach(el => {
            broadcastElementCreated(el);
          });
          
          // Zaplanuj zapis
          if (boardIdStateRef.current) {
            debouncedSave(boardIdStateRef.current);
          }
          
          console.log(`📥 Wklejono ${newElements.length} elementów`);
        } else {
          // Jeśli brak skopiowanych elementów, spróbuj wkleić obraz ze schowka
          handleGlobalPasteImageRef.current();
        }
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
        undoRef.current();
      }
      
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redoRef.current();
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
          
          // Najpierw zapisz niezapisane elementy
          const unsavedToDelete = currentElements.filter(el => 
            currentSelectedIds.has(el.id) && unsavedElementsRef.current.has(el.id)
          );
          
          if (unsavedToDelete.length > 0 && boardIdStateRef.current) {
            const numericBoardId = parseInt(boardIdStateRef.current);
            if (!isNaN(numericBoardId)) {
              const elementsToSave = unsavedToDelete.map(el => ({
                element_id: el.id,
                type: el.type,
                data: el
              }));
              saveBoardElementsBatch(numericBoardId, elementsToSave)
                .then(() => console.log('✅ Zapisano przed usunięciem:', unsavedToDelete.length))
                .catch(err => console.error('❌ Błąd zapisywania przed usunięciem:', err));
            }
          }
          
          // 🆕 BROADCAST DELETE + API DELETE
          currentSelectedIds.forEach(id => {
            broadcastElementDeleted(id);
            if (boardIdStateRef.current) {
              const numericBoardId = parseInt(boardIdStateRef.current);
              if (!isNaN(numericBoardId)) {
                deleteBoardElement(numericBoardId, id).catch(err => {
                  console.error('❌ Błąd usuwania elementu:', id, err);
                });
              }
            }
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
  }, [tool, selectedElementIds, broadcastElementDeleted, broadcastElementCreated, debouncedSave]);

  // Canvas setup - z obsługą zoom przeglądarki
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    let resizeTimeout: NodeJS.Timeout | null = null;
    let lastDpr = window.devicePixelRatio || 1;
    
    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      
      const currentWidth = canvas.width / dpr;
      const currentHeight = canvas.height / dpr;
      if (Math.abs(width - currentWidth) < 2 && Math.abs(height - currentHeight) < 2 && dpr === lastDpr) {
        return;
      }
      
      lastDpr = dpr;
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
    
    // Nasłuchuj na zmiany zoom przeglądarki (Ctrl +/-)
    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const handleZoomChange = () => {
      console.log('🔍 Zoom przeglądarki zmieniony, aktualizuję canvas...');
      debouncedUpdateCanvasSize();
    };
    
    // Nowoczesne API
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleZoomChange);
    } else {
      // Fallback dla starszych przeglądarek
      mediaQuery.addListener(handleZoomChange);
    }
    
    const resizeObserver = new ResizeObserver(() => {
      debouncedUpdateCanvasSize();
    });
    resizeObserver.observe(container);
    
    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      window.removeEventListener('resize', debouncedUpdateCanvasSize);
      
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleZoomChange);
      } else {
        mediaQuery.removeListener(handleZoomChange);
      }
      
      resizeObserver.disconnect();
    };
  }, []);
  
  // Wheel/Touchpad handling - NAPRAWIONE: używamy ref zamiast viewport w dependencies
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (e: WheelEvent) => {
      // 🚫 Blokada gdy SmartSearch lub CardViewer są otwarte
      if (isSearchActive || isCardViewerActive) {
        return; // Pozwól przeglądarce obsłużyć scroll w tych komponentach
      }
      
      e.preventDefault();
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;
      
      const currentViewport = viewportRef.current;
      
      if (e.ctrlKey) {
        // Ctrl+scroll = zoom
        const newViewport = zoomViewport(currentViewport, e.deltaY, mouseX, mouseY, width, height);
        setViewport(constrainViewport(newViewport));
      } else {
        // Normalny scroll = przesuwanie (pan)
        const newViewport = panViewportWithWheel(currentViewport, e.deltaX, e.deltaY);
        setViewport(constrainViewport(newViewport));
      }
    };
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isSearchActive, isCardViewerActive]); // 🚫 Re-attach gdy się zmienia status blokady

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

  // Redraw canvas - ZOPTYMALIZOWANE z requestAnimationFrame
  const rafIdRef = useRef<number | null>(null);
  
  const redrawCanvas = useCallback(() => {
    // Anuluj poprzedni zaplanowany frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    rafIdRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      
      // Używamy REFÓW żeby nie tworzyć nowego callbacka przy każdym renderze!
      const currentElements = elementsRef.current;
      const currentViewport = viewportRef.current;
      const currentLoadedImages = loadedImagesRef.current;
      
      // Reset transform i ustaw nową skalę DPR
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      
      drawGrid(ctx, currentViewport, width, height);
      
      currentElements.forEach(element => {
        if (element.id === editingTextId) return;
        drawElement(ctx, element, currentViewport, width, height, currentLoadedImages, debugMode, handleAutoExpand);
      });
      
      rafIdRef.current = null;
    });
  }, [editingTextId, debugMode, handleAutoExpand]);  // USUNIĘTO loadedImages!
  
  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    redrawCanvasRef.current = redrawCanvas;
  }, [redrawCanvas]);

  // Przerysuj canvas gdy zmieni się elements, viewport, lub loadedImages
  useEffect(() => {
    redrawCanvas();
  }, [elements, viewport, loadedImages, redrawCanvas]);

  // History - uproszczona i stabilna wersja
  const MAX_HISTORY_SIZE = 50;
  
  const saveToHistory = useCallback((newElements: DrawingElement[]) => {
    setHistory(prevHistory => {
      const currentIndex = historyIndexRef.current;
      // Odetnij przyszłość (jeśli cofnęliśmy i teraz robimy nową akcję)
      const newHistory = prevHistory.slice(0, currentIndex + 1);
      // Dodaj nowy stan
      newHistory.push([...newElements]); // kopia tablicy
      
      // Ogranicz rozmiar historii
      if (newHistory.length > MAX_HISTORY_SIZE) {
        const trimmed = newHistory.slice(newHistory.length - MAX_HISTORY_SIZE);
        historyIndexRef.current = trimmed.length - 1;
        setHistoryIndex(trimmed.length - 1);
        return trimmed;
      }
      
      historyIndexRef.current = newHistory.length - 1;
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, []);

  useEffect(() => {
    saveToHistoryRef.current = saveToHistory;
  }, [saveToHistory]);

  // 🆕 BROADCAST VIEWPORT - throttled update viewport presence
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__updateViewportPresence) {
      const throttleDelay = 500; // 500ms throttle
      const timeoutId = setTimeout(() => {
        (window as any).__updateViewportPresence(viewport.x, viewport.y, viewport.scale);
        console.log('📡 Viewport updated in presence:', viewport);
      }, throttleDelay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [viewport.x, viewport.y, viewport.scale]);

  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      const newElements = [...currentHistory[newIndex]];
      setElements(newElements);
      setSelectedElementIds(new Set());
      
      // 🆕 Broadcast batch update (bez zapisywania do bazy - przywracamy stan który już był zapisany)
      if (boardIdStateRef.current) {
        broadcastElementsBatch(newElements);
      }
    }
  }, [broadcastElementsBatch]);

  const redo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex < currentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      const newElements = [...currentHistory[newIndex]];
      setElements(newElements);
      setSelectedElementIds(new Set());
      
      // 🆕 Broadcast batch update (bez zapisywania do bazy - przywracamy stan który już był zapisany)
      if (boardIdStateRef.current) {
        broadcastElementsBatch(newElements);
      }
    }
  }, [broadcastElementsBatch]);

  // 🆕 Zapisz undo/redo do refów dla handleKeyDown
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  }, [undo, redo]);

  // 🆕 FOLLOW USER - przeniesienie viewport do lokalizacji innego użytkownika
  const handleFollowUser = useCallback((userId: number, userViewportX: number, userViewportY: number, userViewportScale: number) => {
    console.log('👁️ Follow user:', userId, 'viewport:', userViewportX, userViewportY, userViewportScale);
    setViewport({
      x: userViewportX,
      y: userViewportY,
      scale: userViewportScale
    });
  }, []);

  const clearCanvas = useCallback(async () => {
    // Usuń wszystkie elementy z bazy danych
    const numericBoardId = parseInt(boardIdState);
    if (!isNaN(numericBoardId)) {
      // Najpierw zapisz wszystkie niezapisane
      const unsavedToDelete = elements.filter(el => unsavedElements.has(el.id));
      if (unsavedToDelete.length > 0) {
        try {
          const elementsToSave = unsavedToDelete.map(el => ({
            element_id: el.id,
            type: el.type,
            data: el
          }));
          await saveBoardElementsBatch(numericBoardId, elementsToSave);
          console.log('✅ Zapisano niezapisane elementy przed wyczyszczeniem:', unsavedToDelete.length);
        } catch (err) {
          console.error('❌ Błąd zapisywania przed wyczyszczeniem:', err);
        }
      }
      
      // Teraz usuń
      elements.forEach(el => {
        deleteBoardElement(numericBoardId, el.id).catch(err => {
          console.error('❌ Błąd usuwania elementu:', el.id, err);
        });
      });
    }
    
    setElements([]);
    saveToHistory([]);
    setSelectedElementIds(new Set());
    setLoadedImages(new Map()); // Wyczyść też załadowane obrazy
  }, [saveToHistory, boardIdState, elements, unsavedElements]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 📦 EKSPORT/IMPORT TABLICY
  // ═══════════════════════════════════════════════════════════════════════════

  const handleExport = useCallback(() => {
    try {
      const exportData = {
        version: '1.0',
        boardId: boardIdState,
        exportedAt: new Date().toISOString(),
        elements: elements.map(el => {
          // Dla obrazów z data URL - zachowaj je
          // Dla obrazów z external URL - też zachowaj
          return { ...el };
        })
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `tablica-${boardIdState || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('✅ Eksport zakończony:', elements.length, 'elementów');
    } catch (err) {
      console.error('❌ Błąd eksportu:', err);
      alert('Wystąpił błąd podczas eksportu tablicy');
    }
  }, [elements, boardIdState]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // Walidacja formatu
        if (!importData.version || !Array.isArray(importData.elements)) {
          throw new Error('Nieprawidłowy format pliku');
        }
        
        // Generuj nowe ID dla importowanych elementów żeby uniknąć konfliktów
        const importedElements = importData.elements.map((el: DrawingElement) => ({
          ...el,
          id: `${el.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
        
        // Dodaj do istniejących elementów
        const newElements = [...elements, ...importedElements];
        setElements(newElements);
        saveToHistory(newElements);
        
        // Zapisz do bazy
        if (boardIdState) {
          importedElements.forEach((el: DrawingElement) => {
            setUnsavedElements(prev => new Set(prev).add(el.id));
          });
          debouncedSave(boardIdState);
        }
        
        // Broadcast do innych użytkowników
        if (importedElements.length > 0) {
          broadcastElementsBatch(importedElements);
        }
        
        console.log('✅ Import zakończony:', importedElements.length, 'elementów');
      } catch (err) {
        console.error('❌ Błąd importu:', err);
        alert('Wystąpił błąd podczas importu. Upewnij się, że wybrałeś prawidłowy plik.');
      }
    };
    
    input.click();
  }, [elements, saveToHistory, boardIdState, debouncedSave, broadcastElementsBatch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 CALLBACKI DLA NARZĘDZI - Z BROADCAST
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handlePathCreate = useCallback((path: DrawingPath) => {
    const newElements = [...elements, path];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(path);
    
    // 🆕 ZAPISYWANIE - oznacz jako unsaved i zaplanuj zapis
    setUnsavedElements(prev => new Set(prev).add(path.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [elements, saveToHistory, broadcastElementCreated, boardIdState, debouncedSave]);

  const handleShapeCreate = useCallback((shape: Shape) => {
    const newElements = [...elements, shape];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(shape);
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(shape.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [elements, saveToHistory, broadcastElementCreated, boardIdState, debouncedSave]);

  const handleFunctionCreate = useCallback((func: FunctionPlot) => {
    const newElements = [...elements, func];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(func);
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(func.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [elements, saveToHistory, broadcastElementCreated, boardIdState, debouncedSave]);

  const handleTextCreate = useCallback((text: TextElement) => {
    const newElements = [...elements, text];
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST
    broadcastElementCreated(text);
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(text.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [elements, saveToHistory, broadcastElementCreated, boardIdState, debouncedSave]);

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
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [elements, saveToHistory, broadcastElementUpdated, boardIdState, debouncedSave]);

  const handleTextDelete = useCallback(async (id: string) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST DELETE + API DELETE
    broadcastElementDeleted(id);
    const numericBoardId = parseInt(boardIdState);
    if (!isNaN(numericBoardId)) {
      // Zapisz jeśli unsaved
      if (unsavedElements.has(id)) {
        const elementToSave = elements.find(el => el.id === id);
        if (elementToSave) {
          try {
            await saveBoardElementsBatch(numericBoardId, [{
              element_id: elementToSave.id,
              type: elementToSave.type,
              data: elementToSave
            }]);
          } catch (err) {
            console.error('❌ Błąd zapisywania przed usunięciem:', err);
          }
        }
      }
      
      deleteBoardElement(numericBoardId, id).catch(err => {
        console.error('❌ Błąd usuwania elementu:', id, err);
      });
    }
  }, [elements, saveToHistory, broadcastElementDeleted, boardIdState, unsavedElements]);

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
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(image.id));
    if (boardIdState) debouncedSave(boardIdState);
    
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
  }, [elements, saveToHistory, broadcastElementCreated, boardIdState, debouncedSave]);



  // 🆕 MARKDOWN NOTE - tworzenie notatki
  const handleMarkdownNoteCreate = useCallback((note: MarkdownNote) => {
    // TYLKO setElements - bez saveToHistory (powoduje lagi)
    setElements(prev => [...prev, note]);
    
    broadcastElementCreated(note);
    setUnsavedElements(prev => new Set(prev).add(note.id));
    if (boardIdState) debouncedSave(boardIdState);
    
    // Po utworzeniu przełącz na select i od razu włącz edycję
    setTool('select');
    setSelectedElementIds(new Set([note.id]));
    setEditingMarkdownId(note.id);
  }, [broadcastElementCreated, boardIdState, debouncedSave]);

  // 🆕 CHATBOT - dodawanie odpowiedzi AI jako notatki na tablicy
  const handleChatbotAddToBoard = useCallback((content: string) => {
    const currentViewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Większy rozmiar notatki - 5x4 jednostki = 500x400px przy scale=1
    const noteWidth = 5;
    const noteHeight = 4;
    
    // 🆕 Środek widocznego ekranu (canvas center) w jednostkach świata
    const rect = canvas.getBoundingClientRect();
    const centerScreen = { x: rect.width / 2, y: rect.height / 2 };
    const centerWorld = inverseTransformPoint(centerScreen, currentViewport, rect.width, rect.height);
    
    const newNote: MarkdownNote = {
      id: `chatbot-note-${Date.now()}`,
      type: 'markdown',
      x: centerWorld.x - noteWidth / 2,
      y: centerWorld.y - noteHeight / 2,
      width: noteWidth,
      height: noteHeight,
      content: content,
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
    };
    
    // TYLKO setElements - bez saveToHistory (to powodowało lagi)
    // Historia zostanie zapisana przy następnej operacji lub przy zapisie do DB
    setElements(prev => [...prev, newNote]);
    
    // Broadcast i zapis do DB
    broadcastElementCreated(newNote);
    setUnsavedElements(prev => new Set(prev).add(newNote.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [broadcastElementCreated, boardIdState, debouncedSave]);

  // 🆕 TABLE - tworzenie tabeli
  const handleTableCreate = useCallback((table: TableElement) => {
    const newElements = [...elements, table];
    setElements(newElements);
    saveToHistory(newElements);
    
    broadcastElementCreated(table);
    setUnsavedElements(prev => new Set(prev).add(table.id));
    if (boardIdState) debouncedSave(boardIdState);
    
    // Po utworzeniu przełącz na select żeby można było edytować
    setTool('select');
    setSelectedElementIds(new Set([table.id]));
  }, [elements, saveToHistory, broadcastElementCreated, boardIdState, debouncedSave]);

  // 🆕 TABLE - zmiana komórki tabeli
  const handleTableCellChange = useCallback((tableId: string, row: number, col: number, value: string) => {
    setElements(prev => {
      const newElements = prev.map(el => {
        if (el.id === tableId && el.type === 'table') {
          const table = el as TableElement;
          const newCells = table.cells.map((r, ri) => 
            ri === row ? r.map((c, ci) => ci === col ? value : c) : [...r]
          );
          return { ...table, cells: newCells };
        }
        return el;
      });
      
      // Zapisz do historii
      saveToHistory(newElements);
      
      // Oznacz jako niezapisane
      setUnsavedElements(prevSet => new Set(prevSet).add(tableId));
      if (boardIdState) debouncedSave(boardIdState);
      
      return newElements;
    });
  }, [saveToHistory, boardIdState, debouncedSave]);

  // 🆕 MARKDOWN - zmiana treści notatki
  const handleMarkdownContentChange = useCallback((noteId: string, content: string) => {
    setElements(prev => {
      const newElements = prev.map(el => {
        if (el.id === noteId && el.type === 'markdown') {
          return { ...el, content };
        }
        return el;
      });
      
      saveToHistory(newElements);
      setUnsavedElements(prevSet => new Set(prevSet).add(noteId));
      if (boardIdState) debouncedSave(boardIdState);
      
      return newElements;
    });
  }, [saveToHistory, boardIdState, debouncedSave]);

  // 🆕 STABILNE CALLBACKI dla MarkdownNoteView (żeby nie łamać memo!)
  const handleMarkdownEditStart = useCallback((noteId: string) => {
    setEditingMarkdownId(noteId);
  }, []);

  const handleMarkdownEditEnd = useCallback(() => {
    setEditingMarkdownId(null);
  }, []);

  // handleMarkdownHeightChange usunięty - notatki mają stały rozmiar, user zmienia resize handlerem

  const handleViewportChange = useCallback((newViewport: ViewportTransform) => {
    setViewport(newViewport);
  }, []);

  const handleElementDelete = useCallback(async (id: string) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST DELETE + API DELETE
    broadcastElementDeleted(id);
    const numericBoardId = parseInt(boardIdState);
    if (!isNaN(numericBoardId)) {
      // Jeśli element jest niezapisany, najpierw go zapisz
      if (unsavedElements.has(id)) {
        const elementToSave = elements.find(el => el.id === id);
        if (elementToSave) {
          try {
            await saveBoardElementsBatch(numericBoardId, [{
              element_id: elementToSave.id,
              type: elementToSave.type,
              data: elementToSave
            }]);
            console.log('✅ Zapisano element przed usunięciem:', id);
          } catch (err) {
            console.error('❌ Błąd zapisywania przed usunięciem:', id, err);
          }
        }
      }
      
      // Teraz usuń z bazy
      deleteBoardElement(numericBoardId, id).catch(err => {
        console.error('❌ Błąd usuwania elementu:', id, err);
      });
    }
  }, [elements, saveToHistory, broadcastElementDeleted, boardIdState, unsavedElements]);

  // 🆕 PARTIAL ERASE - usuwa fragment ścieżki i tworzy nowe
  const handlePathPartialErase = useCallback((pathId: string, newPaths: DrawingPath[]) => {
    // Usuń oryginalną ścieżkę
    let newElements = elements.filter(el => el.id !== pathId);
    
    // Dodaj nowe segmenty (jeśli są)
    if (newPaths.length > 0) {
      newElements = [...newElements, ...newPaths];
    }
    
    setElements(newElements);
    saveToHistory(newElements);
    
    // API: Usuń oryginalną ścieżkę
    const numericBoardId = parseInt(boardIdState);
    if (!isNaN(numericBoardId)) {
      // Zapisz jeśli unsaved
      if (unsavedElements.has(pathId)) {
        const pathToSave = elements.find(el => el.id === pathId);
        if (pathToSave) {
          saveBoardElementsBatch(numericBoardId, [{
            element_id: pathToSave.id,
            type: pathToSave.type,
            data: pathToSave
          }])
            .catch(err => console.error('❌ Błąd zapisywania przed usunięciem:', err));
        }
      }
      
      deleteBoardElement(numericBoardId, pathId).catch(err => {
        console.error('❌ Błąd usuwania ścieżki:', pathId, err);
      });
      
      // Zapisz nowe segmenty
      newPaths.forEach(path => {
        setUnsavedElements(prev => new Set(prev).add(path.id));
      });
      if (newPaths.length > 0) {
        debouncedSave(boardIdState);
      }
    }
    
    // Broadcast: usuń oryginalną i wyślij nowe
    broadcastElementDeleted(pathId);
    if (newPaths.length > 0) {
      broadcastElementsBatch(newPaths);
    }
  }, [elements, saveToHistory, boardIdState, debouncedSave, broadcastElementDeleted, broadcastElementsBatch]);

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
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [elements, saveToHistory, broadcastElementUpdated, boardIdState, debouncedSave]);

  const handleElementsUpdate = useCallback((updates: Map<string, Partial<DrawingElement>>) => {
    const newElements = elements.map(el => {
      const update = updates.get(el.id);
      return update ? { ...el, ...update } as DrawingElement : el;
    });
    setElements(newElements);
  }, [elements]);

  const handleSelectionFinish = useCallback(() => {
    saveToHistory(elements);
    
    // 🆕 BROADCAST wszystkie zmienione elementy + zapisz do bazy
    elements.forEach(element => {
      if (selectedElementIds.has(element.id)) {
        broadcastElementUpdated(element);
        setUnsavedElements(prev => new Set(prev).add(element.id));
      }
    });
    
    // Zapisz do bazy
    if (boardIdState) debouncedSave(boardIdState);
  }, [elements, selectedElementIds, saveToHistory, broadcastElementUpdated, boardIdState, debouncedSave]);

  const deleteSelectedElements = useCallback(async () => {
    if (selectedElementIds.size === 0) return;
    
    const newElements = elements.filter(el => !selectedElementIds.has(el.id));
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST DELETE + API DELETE dla każdego
    const numericBoardId = parseInt(boardIdState);
    
    // Najpierw zapisz wszystkie niezapisane elementy
    const unsavedToDelete = elements.filter(el => 
      selectedElementIds.has(el.id) && unsavedElements.has(el.id)
    );
    
    if (unsavedToDelete.length > 0 && !isNaN(numericBoardId)) {
      try {
        const elementsToSave = unsavedToDelete.map(el => ({
          element_id: el.id,
          type: el.type,
          data: el
        }));
        await saveBoardElementsBatch(numericBoardId, elementsToSave);
        console.log('✅ Zapisano niezapisane elementy przed usunięciem:', unsavedToDelete.length);
      } catch (err) {
        console.error('❌ Błąd zapisywania przed usunięciem:', err);
      }
    }
    
    // Teraz usuń z bazy i broadcast
    selectedElementIds.forEach(id => {
      broadcastElementDeleted(id);
      if (!isNaN(numericBoardId)) {
        deleteBoardElement(numericBoardId, id).catch(err => {
          console.error('❌ Błąd usuwania elementu:', id, err);
        });
      }
    });
    
    setSelectedElementIds(new Set());
  }, [elements, selectedElementIds, saveToHistory, broadcastElementDeleted, boardIdState, unsavedElements]);

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

  // 🆕 SMARTSEARCH HANDLERS
  // Używamy jednostek świata (world units), nie pikseli!
  // Typowa szerokość obrazu to 3-5 jednostek świata
  const FORMULA_WORLD_WIDTH = 4; // szerokość wzoru w jednostkach świata
  
  const handleFormulaSelect = useCallback((formula: FormulaResource) => {
    // Najpierw załaduj obraz, żeby poznać proporcje
    const img = new Image();
    img.src = formula.path;
    
    img.onload = () => {
      // Oblicz proporcje i wymiary w jednostkach świata
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      const worldWidth = FORMULA_WORLD_WIDTH;
      const worldHeight = worldWidth * aspectRatio;
      
      // Środek ekranu w jednostkach świata
      const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
      const centerWorld = inverseTransformPoint(centerScreen, viewport, canvasWidth, canvasHeight);
      
      const newImage: ImageElement = {
        id: `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        x: centerWorld.x - worldWidth / 2,
        y: centerWorld.y - worldHeight / 2,
        width: worldWidth,
        height: worldHeight,
        src: formula.path,
        alt: formula.title
      };
      
      // Dodaj do elementów
      setElements(prev => {
        const updated = [...prev, newImage];
        saveToHistory(updated);
        return updated;
      });
      
      // Zapisz załadowany obraz
      setLoadedImages(prev => new Map(prev).set(newImage.id, img));
      
      // Broadcast i zapis
      broadcastElementCreated(newImage);
      setUnsavedElements(prev => new Set(prev).add(newImage.id));
      if (boardIdState) debouncedSave(boardIdState);
    };
    
    img.onerror = () => {
      console.error('❌ Nie można załadować wzoru:', formula.path);
    };
  }, [viewport, canvasWidth, canvasHeight, saveToHistory, broadcastElementCreated, boardIdState, debouncedSave]);

  const handleCardSelect = useCallback((card: CardResource) => {
    setActiveCard(card);
  }, []);

  const handleAddFormulasFromCard = useCallback((formulas: FormulaResource[]) => {
    // Używamy jednostek świata, nie pikseli!
    const WORLD_PADDING = 0.5; // padding w jednostkach świata
    const COLS = 2;
    const WORLD_WIDTH = 3.5; // szerokość każdego wzoru w jednostkach świata
    
    // Środek ekranu w jednostkach świata
    const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
    const centerWorld = inverseTransformPoint(centerScreen, viewport, canvasWidth, canvasHeight);
    
    // Załaduj wszystkie obrazy równolegle
    const imagePromises = formulas.map((formula, index) => {
      return new Promise<{formula: FormulaResource, img: HTMLImageElement, index: number}>((resolve, reject) => {
        const img = new Image();
        img.src = formula.path;
        img.onload = () => resolve({ formula, img, index });
        img.onerror = () => reject(new Error(`Failed to load: ${formula.path}`));
      });
    });
    
    Promise.all(imagePromises)
      .then(loadedFormulas => {
        // Oblicz pozycje w jednostkach świata
        const newImages = loadedFormulas.map(({ formula, img, index }) => {
          // Oblicz proporcje i wymiary w jednostkach świata
          const aspectRatio = img.naturalHeight / img.naturalWidth;
          const worldWidth = WORLD_WIDTH;
          const worldHeight = worldWidth * aspectRatio;
          
          const col = index % COLS;
          const row = Math.floor(index / COLS);
          
          const offsetX = col * (WORLD_WIDTH + WORLD_PADDING);
          const offsetY = row * (worldHeight + WORLD_PADDING);
          
          const startX = centerWorld.x - ((COLS - 1) * (WORLD_WIDTH + WORLD_PADDING)) / 2;
          const startY = centerWorld.y - 2; // trochę wyżej od środka
          
          const imageElement: ImageElement = {
            id: `formula-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'image' as const,
            x: startX + offsetX - worldWidth / 2,
            y: startY + offsetY,
            width: worldWidth,
            height: worldHeight,
            src: formula.path,
            alt: formula.title,
          };
          
          return { imageElement, loadedImg: img };
        });

        // Batch update - dodaj wszystkie naraz
        setElements(prev => {
          const updated = [...prev, ...newImages.map(({ imageElement }) => imageElement)];
          saveToHistory(updated);
          return updated;
        });

        // Zapisz załadowane obrazy i broadcast
        newImages.forEach(({ imageElement, loadedImg }) => {
          setLoadedImages(prev => new Map(prev).set(imageElement.id, loadedImg));
          broadcastElementCreated(imageElement);
          setUnsavedElements(prev => new Set(prev).add(imageElement.id));
        });
        
        console.log(`✅ Dodano ${newImages.length} wzorów z karty`);
        if (boardIdState) debouncedSave(boardIdState);
        setActiveCard(null);
      })
      .catch(err => {
        console.error('❌ Błąd ładowania wzorów:', err);
        setActiveCard(null);
      });
  }, [viewport, canvasWidth, canvasHeight, saveToHistory, broadcastElementCreated, boardIdState, debouncedSave]);
  
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

  // 🆕 Konwersja PDF → obrazki (wszystkie strony) dla drag&drop
  const convertPDFToImages = async (file: File): Promise<string[]> => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];

    // Konwertuj wszystkie strony
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const pdfViewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Cannot get canvas context');

      canvas.width = pdfViewport.width;
      canvas.height = pdfViewport.height;

      await page.render({
        canvasContext: context,
        viewport: pdfViewport,
        canvas: canvas,
      }).promise;

      images.push(canvas.toDataURL('image/jpeg', 0.9));
    }

    console.log(`✅ Skonwertowano ${images.length} stron PDF`);
    return images;
  };

  const handleGlobalDropImage = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('🎯 handleGlobalDropImage called');
    const file = e.dataTransfer.files?.[0];
    if (!file) {
      console.log('❌ No file dropped');
      return;
    }

    console.log('📁 Dropped file:', file.name, 'type:', file.type);
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';

    if (!isImage && !isPDF) {
      console.log('❌ Not an image or PDF');
      return;
    }

    console.log('✅ File accepted, starting processing...');
    setImageProcessing(true);

    try {
      let data: string;
      let width: number;
      let height: number;

      const dropScreen = { x: e.clientX, y: e.clientY };
      const dropWorld = inverseTransformPoint(dropScreen, viewport, canvasWidth, canvasHeight);
      
      // 🆕 Obsługa PDF → konwersja wszystkich stron do obrazków
      if (isPDF) {
        console.log('📄 Converting dropped PDF to images...');
        const images = await convertPDFToImages(file);
        
        const worldWidth = 3;
        const padding = 0.1; // Odstęp między stronami
        let currentY = dropWorld.y;
        
        const newImages: ImageElement[] = [];
        
        // Stwórz wszystkie strony jako ImageElement[]
        for (let i = 0; i < images.length; i++) {
          const dataUrl = images[i];
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
          });
          
          const aspectRatio = img.height / img.width;
          const worldHeight = worldWidth * aspectRatio;
          
          const newImage: ImageElement = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-page-${i + 1}`,
            type: 'image',
            x: dropWorld.x - worldWidth / 2,
            y: currentY,
            width: worldWidth,
            height: worldHeight,
            src: dataUrl,
            alt: `${file.name} - Strona ${i + 1}/${images.length}`,
          };

          console.log(`✅ Creating page ${i + 1}/${images.length}, ID: ${newImage.id}`);
          newImages.push(newImage);
          currentY += worldHeight + padding; // Następna strona niżej
          
          // Małe opóźnienie żeby ID były unikalne
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Dodaj wszystkie strony naraz
        const newElements = [...elements, ...newImages];
        setElements(newElements);
        saveToHistory(newElements);
        
        // Broadcast i zapisywanie dla wszystkich stron
        newImages.forEach(image => {
          broadcastElementCreated(image);
          setUnsavedElements(prev => new Set(prev).add(image.id));
          
          // Załaduj obrazek do pamięci
          if (image.src) {
            const img = new Image();
            img.src = image.src;
            img.onload = () => {
              setLoadedImages(prev => new Map(prev).set(image.id, img));
            };
          }
        });
        
        if (boardIdState) debouncedSave(boardIdState);
        
        console.log(`✅ Dodano ${newImages.length} stron z PDF`);
        setImageProcessing(false);
        return;
      } else {
        // Zwykły obrazek
        const result = await fileToBase64(file);
        data = result.data;
        width = result.width;
        height = result.height;
        
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
        console.log('✅ Image created from dropped image');
      }
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
      {/* 🆕 LOADING OVERLAY */}
      {isLoading && (
        <div className="absolute inset-0 z-[9999] bg-white/20 backdrop-blur-md flex flex-col items-center justify-center">
          {/* Logo */}
          <div className="mb-8">
            <NextImage 
              src="/resources/LogoEasyLesson.webp" 
              alt="EasyLesson" 
              width={200} 
              height={80}
              priority
            />
          </div>
          
          {/* Progress Bar */}
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          
          {/* Progress Text */}
          <p className="mt-4 text-sm text-gray-600">
            Ładowanie tablicy... {Math.round(loadingProgress)}%
          </p>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="absolute inset-0 overflow-hidden touch-none overscroll-none"
        onContextMenu={(e) => e.preventDefault()}
        style={{
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'none'
        }}
      >
        {/* 🆕 KOMPONENT ONLINE USERS */}
        <OnlineUsers onFollowUser={handleFollowUser} />
        
        <Toolbar
          tool={tool}
          setTool={handleToolChange}
          selectedShape={selectedShape}
          setSelectedShape={handleShapeChange}
          polygonSides={polygonSides}
          setPolygonSides={setPolygonSides}
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
          hasSelection={selectedElementIds.size > 0}
          onDeleteSelected={deleteSelectedElements}
          onExport={handleExport}
          onImport={handleImport}
          onImagePaste={handleImageToolPaste}
          onImageUpload={handleImageToolUpload}
          isCalculatorOpen={isCalculatorOpen}
          onCalculatorToggle={() => setIsCalculatorOpen(!isCalculatorOpen)}
        />
        
        {/* 🆕 SMARTSEARCH BAR - na górze, wycentrowany, responsywny */}
        <div className="absolute top-4 z-50 pointer-events-auto" style={{
          left: windowWidth <= 760 ? '90px' : windowWidth <= 1550 ? '90px' : '50%',
          transform: windowWidth <= 760 ? 'none' : windowWidth <= 1550 ? 'none' : 'translateX(-50%)',
          right: windowWidth <= 760 ? '16px' : windowWidth <= 1550 ? '330px' : 'auto',
          width: windowWidth <= 760 ? 'auto' : windowWidth <= 1550 ? 'auto' : 'auto',
          maxWidth: windowWidth <= 760 ? 'calc(100vw - 90px - 16px)' : windowWidth <= 1550 ? 'calc(100vw - 90px - 330px)' : '900px'
        }}>
          <SmartSearchBar
            onFormulaSelect={handleFormulaSelect}
            onCardSelect={handleCardSelect}
            onActiveChange={setIsSearchActive}
          />
        </div>
        
        {/* 🆕 CARD VIEWER MODAL */}
        {activeCard && (
          <CardViewer
            card={activeCard}
            onClose={() => setActiveCard(null)}
            onAddFormulas={handleAddFormulasFromCard}
            onActiveChange={setIsCardViewerActive}
          />
        )}
        
        <ZoomControls
          zoom={viewport.scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
        />
        
        {/* NARZĘDZIA - BLOKOWANE gdy modal aktywny */}
        {!isSearchActive && tool === 'text' && canvasWidth > 0 && (
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

        {!isSearchActive && tool === 'select' && canvasWidth > 0 && (
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
            onMarkdownEdit={(id) => setEditingMarkdownId(id)}
            onViewportChange={handleViewportChange}
            onActiveGuidesChange={setActiveGuides}
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
            polygonSides={polygonSides}
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

        {tool === 'markdown' && canvasWidth > 0 && (
          <MarkdownNoteTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onNoteCreate={handleMarkdownNoteCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {tool === 'table' && canvasWidth > 0 && (
          <TableTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onTableCreate={handleTableCreate}
            onViewportChange={handleViewportChange}
          />
        )}

        {/* 🧮 KALKULATOR - zawsze dostępny gdy isCalculatorOpen */}
        {isCalculatorOpen && (
          <CalculatorTool
            viewport={viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onViewportChange={handleViewportChange}
            onClose={() => setIsCalculatorOpen(false)}
          />
        )}

    {/* 🤖 MATH CHATBOT - zawsze widoczny jako bąbelek */}
    <MathChatbot
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      onAddToBoard={handleChatbotAddToBoard}
      messages={chatMessages}
      setMessages={setChatMessages}
      onActiveChange={setIsSearchActive}
    />

        {/* 🆕 INTERACTIVE MARKDOWN OVERLAYS - Nakładki dla edycji notatek Markdown */}
        {elements.filter(el => el.type === 'markdown').map(el => {
          const note = el as MarkdownNote;

          // Pozycja w pikselach ekranu (stała)
          const topLeft = transformPoint({ x: note.x, y: note.y }, viewport, canvasWidth, canvasHeight);

          // STAŁY rozmiar bazowy (100px = 1 jednostka świata)
          const baseWidth = note.width * 100;
          const baseHeight = note.height * 100;

          // Rozmiar po skalowaniu (używany jedynie do culling)
          const scaledWidth = baseWidth * viewport.scale;
          const scaledHeight = baseHeight * viewport.scale;

          // Nie renderuj jeśli poza ekranem lub za małe
          if (scaledWidth < 30 || scaledHeight < 30) return null;
          if (topLeft.x + scaledWidth < 0 || topLeft.x > canvasWidth) return null;
          if (topLeft.y + scaledHeight < 0 || topLeft.y > canvasHeight) return null;

          const isBeingEdited = editingMarkdownId === note.id;
          // Skala zawartości (domyślnie 1)
          const contentScale = note.contentScale ?? 1;

          return (
            <div
              key={note.id}
              className="absolute rounded-lg shadow-md border overflow-hidden"
              style={{
                left: topLeft.x,
                top: topLeft.y,
                width: baseWidth,
                height: baseHeight,
                transform: `scale(${viewport.scale})`,
                transformOrigin: 'top left',
                willChange: 'transform',
                backgroundColor: note.backgroundColor || '#fffde7',
                borderColor: note.borderColor || '#fbc02d',
                pointerEvents: isBeingEdited ? 'auto' : 'none',
                zIndex: isBeingEdited ? 50 : 10,
              }}
            >
              {/* INNER WRAPPER dla contentScale */}
              <div
                style={{
                  width: `${100 / contentScale}%`,
                  height: `${100 / contentScale}%`,
                  transform: `scale(${contentScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <MarkdownNoteView
                  note={note}
                  noteId={note.id}
                  isEditing={isBeingEdited}
                  onContentChange={handleMarkdownContentChange}
                  onEditStart={handleMarkdownEditStart}
                  onEditEnd={handleMarkdownEditEnd}
                />
              </div>
            </div>
          );
        })}

        {/* 🆕 INTERACTIVE TABLE OVERLAYS - Nakładki dla edycji tabel */}
        {elements.filter(el => el.type === 'table').map(el => {
          const table = el as TableElement;
          const topLeft = transformPoint({ x: table.x, y: table.y }, viewport, canvasWidth, canvasHeight);
          const bottomRight = transformPoint(
            { x: table.x + table.width, y: table.y + table.height },
            viewport,
            canvasWidth,
            canvasHeight
          );
          const screenWidth = bottomRight.x - topLeft.x;
          const screenHeight = bottomRight.y - topLeft.y;
          
          // Nie renderuj jeśli poza ekranem lub za małe
          if (screenWidth < 20 || screenHeight < 20) return null;
          if (topLeft.x + screenWidth < 0 || topLeft.x > canvasWidth) return null;
          if (topLeft.y + screenHeight < 0 || topLeft.y > canvasHeight) return null;
          
          const isSelected = selectedElementIds.has(table.id);
          
          return (
            <div
              key={table.id}
              className="absolute"
              style={{
                left: topLeft.x,
                top: topLeft.y,
                width: screenWidth,
                minHeight: screenHeight,
                pointerEvents: isSelected ? 'auto' : 'none',
                zIndex: isSelected ? 35 : 10,
                overflow: 'visible',
              }}
            >
              <TableView
                table={table}
                onCellChange={(row, col, value) => handleTableCellChange(table.id, row, col, value)}
              />
            </div>
          );
        })}
        
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
        
        {/* 🆕 REMOTE CURSORS - Kursory innych użytkowników */}
        <RemoteCursors
          cursors={remoteCursors}
          viewport={viewport}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
        
        {imageProcessing && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="text-sm text-gray-700">Przetwarzanie obrazu...</span>
            </div>
          </div>
        )}
        
        {/* 🆕 UI INDICATOR - Zapisywanie */}
        {isSaving && (
          <div className="absolute top-20 right-4 bg-green-100 text-green-700 px-4 py-2 rounded-lg shadow-md flex items-center gap-2 z-50">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
            <span className="text-sm font-medium">Zapisywanie...</span>
          </div>
        )}

        {/* 🆕 UI INDICATOR - Niezapisane zmiany */}
        {unsavedElements.size > 0 && !isSaving && (
          <div className="absolute top-20 right-4 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg shadow-md flex items-center gap-2 z-50">
            <span className="text-sm font-medium">Niezapisane zmiany: {unsavedElements.size}</span>
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

        {/* 🆕 SNAP GUIDES - Niebieskie przerywane linie */}
        {activeGuides.length > 0 && (
          <svg className="absolute inset-0 pointer-events-none" 
          style={{ 
            zIndex: 1000, 
            pointerEvents: 'none',
            width: '100%',
            height: '100%',
            strokeWidth: "10",
            opacity: "1"
          }}>
            {activeGuides.map((guide, idx) => {
              // ✅ POPRAWKA: Użyj transformPoint żeby przeliczyć world → screen
              
              if (guide.orientation === 'vertical') {
                // Pionowa linia - stała X w world space
                const worldX = guide.value;
                
                // Przelicz 2 punkty na ekran (góra i dół canvas)
                const topPoint = transformPoint(
                  { x: worldX, y: viewport.y - 100 }, // punkt bardzo wysoko
                  viewport,
                  canvasWidth,
                  canvasHeight
                );
                
                const bottomPoint = transformPoint(
                  { x: worldX, y: viewport.y + 100 }, // punkt bardzo nisko
                  viewport,
                  canvasWidth,
                  canvasHeight
                );
                
                // Linia przez cały ekran pionowo
                const screenX = topPoint.x;
                
                return (
                  <line
                    key={`${guide.sourceId}-v-${idx}`}
                    x1={screenX}
                    y1={0}
                    x2={screenX}
                    y2={canvasHeight}
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="8 4"
                    opacity="1"
                  />
                );
              } else {
                // Pozioma linia - stała Y w world space
                const worldY = guide.value;
                
                // Przelicz 2 punkty na ekran (lewy i prawy brzeg)
                const leftPoint = transformPoint(
                  { x: viewport.x - 100, y: worldY }, // punkt bardzo z lewej
                  viewport,
                  canvasWidth,
                  canvasHeight
                );
                
                const rightPoint = transformPoint(
                  { x: viewport.x + 100, y: worldY }, // punkt bardzo z prawej
                  viewport,
                  canvasWidth,
                  canvasHeight
                );
                
                // Linia przez cały ekran poziomo
                const screenY = leftPoint.y;
                
                return (
                  <line
                    key={`${guide.sourceId}-h-${idx}`}
                    x1={0}
                    y1={screenY}
                    x2={canvasWidth}
                    y2={screenY}
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="8 4"
                    opacity="0.8"
                  />
                );
              }
            })}
          </svg>
        )}
      </div>
    </div>
  );
}