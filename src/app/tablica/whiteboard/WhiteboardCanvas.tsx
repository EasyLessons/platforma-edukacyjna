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
import { RemoteCursorsContainer } from './RemoteCursors';

// 🆕 Import SmartSearch
import { SmartSearchBar, CardViewer, FormulaResource, CardResource } from '../smartsearch';

// 🆕 Import hooka Realtime + typ TypingUser + RemoteViewport
import { useBoardRealtime, TypingUser, RemoteViewport } from '@/app/context/BoardRealtimeContext';

// 🆕 Import hooka Auth (dla Activity History)
import { useAuth } from '@/app/context/AuthContext';

// 🆕 Import snap utilities
import { GuideLine, collectGuidelinesFromImages } from '../utils/snapUtils';

// 🆕 Import API dla elementów tablicy
import { saveBoardElementsBatch, loadBoardElements, deleteBoardElement, BoardElementWithAuthor } from '@/boards_api/api';

// 🆕 Import ActivityHistory
import { ActivityHistory } from '../toolbar/ActivityHistory';

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
  PDFElement,
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
  stopMomentum,
  isElementInViewport
} from './viewport';

import { drawGrid } from './Grid';
import { drawElement } from './rendering';

// 🆕 Helper do obliczania bounding box elementu (dla viewport culling)
function getElementBounds(element: DrawingElement): { x: number; y: number; width: number; height: number } {
  switch (element.type) {
    case 'path': {
      if (element.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const point of element.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      // Dodaj margines dla width (grubość linii)
      const margin = (element.width || 2) / 100;
      return { x: minX - margin, y: minY - margin, width: maxX - minX + margin * 2, height: maxY - minY + margin * 2 };
    }
    case 'shape': {
      const minX = Math.min(element.startX, element.endX);
      const minY = Math.min(element.startY, element.endY);
      const width = Math.abs(element.endX - element.startX);
      const height = Math.abs(element.endY - element.startY);
      return { x: minX, y: minY, width, height };
    }
    case 'text':
      return { x: element.x, y: element.y, width: element.width || 2, height: element.height || 0.5 };
    case 'function':
      // Funkcje są renderowane w całym zakresie - zawsze widoczne
      return { x: -element.xRange, y: -element.yRange, width: element.xRange * 2, height: element.yRange * 2 };
    case 'image':
    case 'pdf':
    case 'markdown':
    case 'table':
      return { x: element.x, y: element.y, width: element.width, height: element.height };
    default:
      return { x: 0, y: 0, width: 10, height: 10 };
  }
}

// 🆕 Typ akcji użytkownika dla stosu undo/redo (poza komponentem dla wydajności)
type UserAction = { type: 'create', element: DrawingElement } | { type: 'delete', element: DrawingElement };

interface WhiteboardCanvasProps {
  className?: string;
  boardId: string; // 🆕 boardId z URL params (page.tsx)
  arkuszPath?: string | null; // 🆕 ścieżka do folderu z arkuszem PDF
  userRole?: 'owner' | 'editor' | 'viewer'; // 🆕 Rola użytkownika
}

export default function WhiteboardCanvas({ className = '', boardId, arkuszPath, userRole = 'editor' }: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageToolRef = useRef<ImageToolRef>(null);
  
  // Debug userRole
  useEffect(() => {
    console.log('🔐 WhiteboardCanvas otrzymał userRole:', userRole);
  }, [userRole]);
  
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
    broadcastTypingStarted,
    broadcastTypingStopped,
    broadcastViewportChange,
    subscribeTyping,
    subscribeViewports,
    onRemoteElementCreated,
    onRemoteElementUpdated,
    onRemoteElementDeleted,
    isConnected
  } = useBoardRealtime();
  
  // 🆕 AUTH HOOK (dla Activity History - currentUserId)
  const { user } = useAuth();
  
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
  const [elementsWithAuthor, setElementsWithAuthor] = useState<BoardElementWithAuthor[]>([]); // 🆕 Elementy z info o autorze (dla Activity History)
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingMarkdownId, setEditingMarkdownId] = useState<string | null>(null); // 🆕 Edycja markdown
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]); // 🆕 Kto edytuje jakie elementy (realtime)
  const [followingUserId, setFollowingUserId] = useState<number | null>(null); // 🆕 FOLLOW MODE - kogo śledzimy
  const [debugMode, setDebugMode] = useState(false);
  
  // 🆕 COPY/PASTE - schowek dla elementów
  const [copiedElements, setCopiedElements] = useState<DrawingElement[]>([]);
  const [lastCopyWasInternal, setLastCopyWasInternal] = useState(false); // 🆕 Czy ostatnie Ctrl+C było w aplikacji
  
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
  
  // History state (legacy - pełna historia stanów)
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // 🆕 USER ACTION STACK - stos akcji tylko dla bieżącego użytkownika (Ctrl+Z/Y)
  const [userUndoStack, setUserUndoStack] = useState<UserAction[]>([]);
  const [userRedoStack, setUserRedoStack] = useState<UserAction[]>([]);
  const userUndoStackRef = useRef<UserAction[]>([]);
  const userRedoStackRef = useRef<UserAction[]>([]);
  
  const [imageProcessing, setImageProcessing] = useState(false);
  
  // Wymuszenie pan dla viewera
  useEffect(() => {
    if (userRole === 'viewer' && tool !== 'pan') {
      setTool('pan');
      console.log('🔒 Viewer - wymuszono narzędzie pan');
    }
  }, [userRole, tool]);
  
  const redrawCanvasRef = useRef<() => void>(() => {});
  const handleGlobalPasteImageRef = useRef<() => Promise<boolean>>(async () => false);
  
  // Refs for stable callbacks
  const elementsRef = useRef(elements);
  const saveToHistoryRef = useRef<(els: DrawingElement[]) => void>(() => {});
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
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

  // 🆕 Synchronizacja user action stack refs
  useEffect(() => {
    userUndoStackRef.current = userUndoStack;
  }, [userUndoStack]);

  useEffect(() => {
    userRedoStackRef.current = userRedoStack;
  }, [userRedoStack]);

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

  // 🆕 Resetowanie flagi lastCopyWasInternal gdy użytkownik wychodzi z okna
  // (może skopiować screenshot lub coś z zewnątrz)
  useEffect(() => {
    const handleWindowBlur = () => {
      // Gdy użytkownik wychodzi z okna, resetuj flagę
      // (mógł zrobić screenshot lub skopiować coś z innej aplikacji)
      setLastCopyWasInternal(false);
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
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
      
      // 🆕 Aktualizuj elementsWithAuthor dla Activity History
      setElementsWithAuthor(prev => {
        if (prev.some(el => el.element_id === element.id)) {
          return prev;
        }
        return [...prev, {
          element_id: element.id,
          type: element.type,
          data: element,
          created_by_id: userId,
          created_by_username: username,
          created_at: new Date().toISOString()
        }];
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
      
      // 🆕 Aktualizuj elementsWithAuthor
      setElementsWithAuthor(prev =>
        prev.map(el => (el.element_id === element.id ? { ...el, data: element } : el))
      );
    });
    
    // Handler: Usunięcie elementu przez innego użytkownika
    onRemoteElementDeleted((elementId, userId, username) => {
      console.log(`📥 [${username}] usunął element:`, elementId);
      
      setElements(prev => prev.filter(el => el.id !== elementId));
      
      // 🆕 Usuń z elementsWithAuthor
      setElementsWithAuthor(prev => prev.filter(el => el.element_id !== elementId));
    });
  }, [onRemoteElementCreated, onRemoteElementUpdated, onRemoteElementDeleted]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 TYPING INDICATOR SUBSCRIPTION - kto edytuje jakie elementy
  // ═══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const unsubscribe = subscribeTyping((users) => {
      setTypingUsers(users);
    });
    return unsubscribe;
  }, [subscribeTyping]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 VIEWPORT TRACKING FOR FOLLOW MODE - śledź viewporty innych użytkowników
  // ═══════════════════════════════════════════════════════════════════════════
  
  const remoteViewportsRef = useRef<RemoteViewport[]>([]);
  
  useEffect(() => {
    const unsubscribe = subscribeViewports((viewports) => {
      remoteViewportsRef.current = viewports;
      
      // Jeśli śledzimy użytkownika, zaktualizuj nasz viewport
      if (followingUserId) {
        const followedViewport = viewports.find(v => v.userId === followingUserId);
        if (followedViewport) {
          setViewport({
            x: followedViewport.x,
            y: followedViewport.y,
            scale: followedViewport.scale
          });
        }
      }
    });
    return unsubscribe;
  }, [subscribeViewports, followingUserId]);

  // 🆕 BROADCAST VIEWPORT CHANGE - gdy mój viewport się zmienia, wyślij do innych
  const lastViewportBroadcastRef = useRef<number>(0);
  const VIEWPORT_BROADCAST_INTERVAL = 50; // 50ms = 20 FPS
  
  useEffect(() => {
    // Throttle broadcast żeby nie zalewać sieci
    const now = Date.now();
    if (now - lastViewportBroadcastRef.current < VIEWPORT_BROADCAST_INTERVAL) return;
    lastViewportBroadcastRef.current = now;
    
    // Nie broadcastuj gdy jesteśmy w follow mode (bo wtedy viewport jest kopiowany)
    if (followingUserId) return;
    
    broadcastViewportChange(viewport.x, viewport.y, viewport.scale);
  }, [viewport, broadcastViewportChange, followingUserId]);

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
        setDbElementsLoaded(true);
        setDbWasEmpty(true);
        return;
      }
      
      // Walidacja boardId
      const boardIdNum = parseInt(boardIdState);
      if (isNaN(boardIdNum)) {
        console.warn('⚠️ Nieprawidłowy boardId, pomijam ładowanie');
        setIsLoading(false);
        setDbElementsLoaded(true);
        setDbWasEmpty(true);
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
        setElementsWithAuthor(data.elements); // 🆕 Zapisz pełne dane z autorem dla Activity History
        setLoadingProgress(70);
        
        // 🆕 Ustaw początkową historię na załadowane elementy
        setHistory([loadedElements]);
        setHistoryIndex(0);
        
        // 🆕 Ustaw flagi dla ładowania arkusza
        setDbElementsLoaded(true);
        setDbWasEmpty(loadedElements.length === 0);
        
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
  // COPY/PASTE HANDLERS
  // ========================================
  // 🆕 COPY - kopiowanie zaznaczonych elementów (Ctrl+C)
  const handleCopy = useCallback(() => {
    const selectedIds = selectedElementIdsRef.current;
    if (selectedIds.size === 0) return;
    
    const elementsToCopy = elementsRef.current.filter(el => selectedIds.has(el.id));
    setCopiedElements(elementsToCopy);
    setLastCopyWasInternal(true); // 🆕 Oznacz że kopiowanie było w aplikacji
    
    console.log('📋 Skopiowano elementów:', elementsToCopy.length);
  }, []);

  // 🆕 PASTE - wklejanie skopiowanych elementów (Ctrl+V)
  const handlePaste = useCallback(() => {
    if (copiedElements.length === 0) return;
    
    const currentViewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Wylicz punkt wklejenia (środek ekranu)
    const centerScreen = { x: canvas.width / 2, y: canvas.height / 2 };
    const centerWorld = inverseTransformPoint(
      centerScreen, 
      currentViewport, 
      canvas.width, 
      canvas.height
    );
    
    // Oblicz środek zaznaczenia oryginalnego
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    copiedElements.forEach(el => {
      if (el.type === 'path') {
        el.points.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      } else if (el.type === 'shape') {
        minX = Math.min(minX, el.startX, el.endX);
        minY = Math.min(minY, el.startY, el.endY);
        maxX = Math.max(maxX, el.startX, el.endX);
        maxY = Math.max(maxY, el.startY, el.endY);
      } else if (el.type === 'text' || el.type === 'image' || el.type === 'markdown' || el.type === 'table' || el.type === 'pdf') {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + (el.width || 0));
        maxY = Math.max(maxY, el.y + (el.height || 0));
      } else if (el.type === 'function') {
        // Funkcje nie mają dokładnej pozycji, pomijamy
      }
    });
    
    const originalCenterX = (minX + maxX) / 2;
    const originalCenterY = (minY + maxY) / 2;
    
    // Oblicz offset (różnica między nową a starą pozycją)
    const offsetX = centerWorld.x - originalCenterX;
    const offsetY = centerWorld.y - originalCenterY;
    
    // Twórz nowe elementy z przesuniętymi pozycjami i nowymi ID
    const newElements: DrawingElement[] = [];
    const newIds: string[] = [];
    
    copiedElements.forEach(el => {
      const newId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      newIds.push(newId);
      
      if (el.type === 'path') {
        const newPath: DrawingPath = {
          ...el,
          id: newId,
          points: el.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }))
        };
        newElements.push(newPath);
      } else if (el.type === 'shape') {
        const newShape: Shape = {
          ...el,
          id: newId,
          startX: el.startX + offsetX,
          startY: el.startY + offsetY,
          endX: el.endX + offsetX,
          endY: el.endY + offsetY
        };
        newElements.push(newShape);
      } else if (el.type === 'text') {
        const newText: TextElement = {
          ...el,
          id: newId,
          x: el.x + offsetX,
          y: el.y + offsetY
        };
        newElements.push(newText);
      } else if (el.type === 'image') {
        const newImage: ImageElement = {
          ...el,
          id: newId,
          x: el.x + offsetX,
          y: el.y + offsetY
        };
        newElements.push(newImage);
        
        // Załaduj obraz do pamięci
        if (el.src) {
          const img = new Image();
          img.src = el.src;
          img.onload = () => {
            setLoadedImages(prev => new Map(prev).set(newId, img));
          };
        }
      } else if (el.type === 'markdown') {
        const newMarkdown: MarkdownNote = {
          ...el,
          id: newId,
          x: el.x + offsetX,
          y: el.y + offsetY
        };
        newElements.push(newMarkdown);
      } else if (el.type === 'table') {
        const newTable: TableElement = {
          ...el,
          id: newId,
          x: el.x + offsetX,
          y: el.y + offsetY,
          cells: el.cells.map(row => [...row]) // Deep copy komórek
        };
        newElements.push(newTable);
      } else if (el.type === 'function') {
        const newFunction: FunctionPlot = {
          ...el,
          id: newId
        };
        newElements.push(newFunction);
      } else if (el.type === 'pdf') {
        const newPDF: PDFElement = {
          ...el,
          id: newId,
          x: el.x + offsetX,
          y: el.y + offsetY
        };
        newElements.push(newPDF);
      }
    });
    
    // Dodaj nowe elementy do tablicy
    const allElements = [...elementsRef.current, ...newElements];
    setElements(allElements);
    saveToHistoryRef.current(allElements);
    
    // Zaznacz nowo wklejone elementy
    setSelectedElementIds(new Set(newIds));
    
    // Broadcast i zapisz każdy nowy element
    newElements.forEach(el => {
      broadcastElementCreated(el);
      setUnsavedElements(prev => new Set(prev).add(el.id));
    });
    
    if (boardIdStateRef.current) {
      debouncedSave(boardIdStateRef.current);
    }
    
    console.log('📌 Wklejono elementów:', newElements.length);
  }, [copiedElements, broadcastElementCreated, debouncedSave]);

  // ========================================
  // KEYBOARD SHORTCUTS (bez zmian)
  // ========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }
      
      // 🆕 Ctrl+C - kopiowanie zaznaczonych elementów
      if (e.ctrlKey && e.key === 'c') {
        const currentSelectedIds = selectedElementIdsRef.current;
        if (currentSelectedIds.size > 0) {
          e.preventDefault();
          handleCopy();
          return;
        }
      }
      
      // 🆕 Ctrl+V - wklejanie
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        
        // 🎯 INTELIGENTNE WKLEJANIE:
        // Jeśli ostatnie Ctrl+C było W APLIKACJI → użyj pamięci wewnętrznej
        // Jeśli ostatnie Ctrl+C było POZA APLIKACJĄ → sprawdź schowek systemowy
        
        if (lastCopyWasInternal && copiedElements.length > 0) {
          // Użytkownik skopiował element w aplikacji - wklej go
          handlePaste();
        } else {
          // Użytkownik prawdopodobnie skopiował coś z zewnątrz (screenshot itp.)
          // Sprawdź schowek systemowy
          handleGlobalPasteImageRef.current().then((imageWasPasted: boolean) => {
            // Jeśli NIE było obrazka w schowku I mamy skopiowane elementy, wklej je
            if (!imageWasPasted && copiedElements.length > 0) {
              handlePaste();
            }
          });
        }
        
        return;
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        setTool('select');
        setSelectedElementIds(new Set());
        setEditingTextId(null);
      }
      
      // 🆕 Skróty klawiszowe do narzędzi (bez Ctrl/Alt/Meta)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        // V = Select (Zaznacz)
        if (e.key === 'v') {
          e.preventDefault();
          setTool('select');
          return;
        }
        
        // H = Pan (Przesuwaj)
        if (e.key === 'h') {
          e.preventDefault();
          setTool('pan');
          return;
        }
        
        // P = Pen (Rysuj)
        if (e.key === 'p') {
          e.preventDefault();
          setTool('pen');
          return;
        }
        
        // T = Text (Tekst)
        if (e.key === 't') {
          e.preventDefault();
          setTool('text');
          return;
        }
        
        // S = Shape (Kształty)
        if (e.key === 's') {
          e.preventDefault();
          setTool('shape');
          return;
        }
        
        // F = Function (Funkcja)
        if (e.key === 'f') {
          e.preventDefault();
          setTool('function');
          return;
        }
        
        // I = Image (Obraz)
        if (e.key === 'i') {
          e.preventDefault();
          setTool('image');
          return;
        }
        
        // E = Eraser (Gumka)
        if (e.key === 'e') {
          e.preventDefault();
          setTool('eraser');
          return;
        }
        
        // M = Markdown (Notatka)
        if (e.key === 'm') {
          e.preventDefault();
          setTool('markdown');
          return;
        }
      }
      
      // Specjalna logika dla edycji tekstu (tylko dla pojedynczego zaznaczenia)
      if (
        tool === 'select' &&
        selectedElementIds.size === 1 &&
        e.key.length === 1 &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        // Sprawdź czy to nie jest klawisz narzędzia
        !['v', 'h', 'p', 't', 's', 'f', 'i', 'e', 'm'].includes(e.key.toLowerCase())
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
        // Użyj nowej zsynchronizowanej funkcji undo
        undoRef.current?.();
      }
      
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        // Użyj nowej zsynchronizowanej funkcji redo
        redoRef.current?.();
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
      
      // 🆕 Ctrl+D - duplikacja zaznaczonych elementów
      if (e.ctrlKey && e.key === 'd') {
        const currentSelectedIds = selectedElementIdsRef.current;
        if (currentSelectedIds.size > 0) {
          e.preventDefault();
          
          // Pobierz zaznaczone elementy
          const elementsToDuplicate = elementsRef.current.filter(el => currentSelectedIds.has(el.id));
          
          if (elementsToDuplicate.length === 0) return;
          
          // Offset dla duplikacji (lekkie przesunięcie w prawo i dół)
          const offsetX = 0.3;
          const offsetY = 0.3;
          
          // Twórz zduplikowane elementy z nowymi ID
          const newElements: DrawingElement[] = [];
          const newIds: string[] = [];
          
          elementsToDuplicate.forEach(el => {
            const newId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
            newIds.push(newId);
            
            if (el.type === 'path') {
              const newPath: DrawingPath = {
                ...el,
                id: newId,
                points: el.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }))
              };
              newElements.push(newPath);
            } else if (el.type === 'shape') {
              const newShape: Shape = {
                ...el,
                id: newId,
                startX: el.startX + offsetX,
                startY: el.startY + offsetY,
                endX: el.endX + offsetX,
                endY: el.endY + offsetY
              };
              newElements.push(newShape);
            } else if (el.type === 'text') {
              const newText: TextElement = {
                ...el,
                id: newId,
                x: el.x + offsetX,
                y: el.y + offsetY
              };
              newElements.push(newText);
            } else if (el.type === 'image') {
              const newImage: ImageElement = {
                ...el,
                id: newId,
                x: el.x + offsetX,
                y: el.y + offsetY
              };
              newElements.push(newImage);
              
              // Załaduj obraz do pamięci
              if (el.src) {
                const img = new Image();
                img.src = el.src;
                img.onload = () => {
                  setLoadedImages(prev => new Map(prev).set(newId, img));
                };
              }
            } else if (el.type === 'markdown') {
              const newMarkdown: MarkdownNote = {
                ...el,
                id: newId,
                x: el.x + offsetX,
                y: el.y + offsetY
              };
              newElements.push(newMarkdown);
            } else if (el.type === 'table') {
              const newTable: TableElement = {
                ...el,
                id: newId,
                x: el.x + offsetX,
                y: el.y + offsetY,
                cells: el.cells.map(row => [...row]) // Deep copy komórek
              };
              newElements.push(newTable);
            } else if (el.type === 'function') {
              const newFunction: FunctionPlot = {
                ...el,
                id: newId
              };
              newElements.push(newFunction);
            } else if (el.type === 'pdf') {
              const newPDF: PDFElement = {
                ...el,
                id: newId,
                x: el.x + offsetX,
                y: el.y + offsetY
              };
              newElements.push(newPDF);
            }
          });
          
          // Dodaj nowe elementy
          const allElements = [...elementsRef.current, ...newElements];
          setElements(allElements);
          saveToHistoryRef.current(allElements);
          
          // Zaznacz zduplikowane elementy
          setSelectedElementIds(new Set(newIds));
          
          // Broadcast i zapisz każdy nowy element
          newElements.forEach(el => {
            broadcastElementCreated(el);
            setUnsavedElements(prev => new Set(prev).add(el.id));
          });
          
          if (boardIdStateRef.current) {
            debouncedSave(boardIdStateRef.current);
          }
          
          console.log('📋 Zduplikowano elementów:', newElements.length);
          return;
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
  }, [tool, selectedElementIds, broadcastElementDeleted, handleCopy, handlePaste, copiedElements, lastCopyWasInternal, broadcastElementCreated, debouncedSave]);

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
      
      // 🆕 Wyłącz follow mode gdy user sam nawiguje
      setFollowingUserId(null);
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;
      
      const currentViewport = viewportRef.current;
      
      if (e.ctrlKey) {
        // Ctrl+scroll = zoom
        const newViewport = zoomViewport(currentViewport, e.deltaY, mouseX, mouseY, width, height);
        const constrained = constrainViewport(newViewport);
        viewportRef.current = constrained;
        setViewport(constrained);
      } else {
        // Normalny scroll = przesuwanie (pan)
        const newViewport = panViewportWithWheel(currentViewport, e.deltaX, e.deltaY);
        const constrained = constrainViewport(newViewport);
        viewportRef.current = constrained;
        setViewport(constrained);
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
      
      // 🆕 VIEWPORT CULLING - renderuj tylko widoczne elementy
      let culledCount = 0;
      currentElements.forEach(element => {
        if (element.id === editingTextId) return;
        
        // Sprawdź czy element jest w viewport
        const bounds = getElementBounds(element);
        if (!isElementInViewport(bounds.x, bounds.y, bounds.width, bounds.height, currentViewport, width, height)) {
          culledCount++;
          return; // Pomiń renderowanie - element poza ekranem
        }
        
        drawElement(ctx, element, currentViewport, width, height, currentLoadedImages, debugMode, handleAutoExpand);
      });
      
      // Debug: pokaż ile elementów pominięto
      if (debugMode && culledCount > 0) {
        console.log(`🎯 Viewport Culling: pominięto ${culledCount}/${currentElements.length} elementów`);
      }
      
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
        // Usunięto console.log dla wydajności
      }, throttleDelay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [viewport.x, viewport.y, viewport.scale]);

  // 🆕 NOWY SYSTEM UNDO - cofa tylko akcje bieżącego użytkownika
  const undo = useCallback(() => {
    const undoStack = userUndoStackRef.current;
    
    if (undoStack.length === 0) {
      return;
    }
    
    // Zdejmij ostatnią akcję ze stosu undo
    const lastAction = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    userUndoStackRef.current = newUndoStack;
    setUserUndoStack(newUndoStack);
    
    // Przenieś akcję na stos redo
    const newRedoStack = [...userRedoStackRef.current, lastAction];
    userRedoStackRef.current = newRedoStack;
    setUserRedoStack(newRedoStack);
    
    if (lastAction.type === 'create') {
      // Akcja 'create' = użytkownik stworzył element → cofnij = USUŃ element
      const elementToRemove = lastAction.element;
      
      // Usuń z lokalnego stanu
      setElements(prev => prev.filter(el => el.id !== elementToRemove.id));
      
      // Usuń z bazy danych (jeśli był zapisany)
      if (boardIdStateRef.current) {
        const numericBoardId = parseInt(boardIdStateRef.current);
        if (!isNaN(numericBoardId) && !unsavedElementsRef.current.has(elementToRemove.id)) {
          deleteBoardElement(numericBoardId, elementToRemove.id).catch(err => {
            console.error('❌ Błąd usuwania elementu podczas undo:', err);
          });
        }
      }
      
      // Broadcast do innych użytkowników
      broadcastElementDeleted(elementToRemove.id);
      
    } else if (lastAction.type === 'delete') {
      // Akcja 'delete' = użytkownik usunął element → cofnij = PRZYWRÓĆ element
      const elementToRestore = lastAction.element;
      
      // Dodaj z powrotem do lokalnego stanu
      setElements(prev => [...prev, elementToRestore]);
      
      // Zapisz z powrotem do bazy danych
      if (boardIdStateRef.current) {
        const numericBoardId = parseInt(boardIdStateRef.current);
        if (!isNaN(numericBoardId)) {
          saveBoardElementsBatch(numericBoardId, [{
            element_id: elementToRestore.id,
            type: elementToRestore.type,
            data: elementToRestore
          }]).catch(err => {
            console.error('❌ Błąd przywracania elementu podczas undo:', err);
          });
        }
      }
      
      // Broadcast do innych użytkowników
      broadcastElementCreated(elementToRestore);
    }
    
    setSelectedElementIds(new Set());
  }, [broadcastElementDeleted, broadcastElementCreated]);

  // 🆕 NOWY SYSTEM REDO - ponawia tylko akcje bieżącego użytkownika
  const redo = useCallback(() => {
    const redoStack = userRedoStackRef.current;
    
    if (redoStack.length === 0) {
      return;
    }
    
    // Zdejmij ostatnią akcję ze stosu redo
    const lastAction = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    userRedoStackRef.current = newRedoStack;
    setUserRedoStack(newRedoStack);
    
    // Przenieś akcję na stos undo
    const newUndoStack = [...userUndoStackRef.current, lastAction];
    userUndoStackRef.current = newUndoStack;
    setUserUndoStack(newUndoStack);
    
    if (lastAction.type === 'create') {
      // Akcja 'create' = użytkownik stworzył element → redo = PRZYWRÓĆ element
      const elementToRestore = lastAction.element;
      
      // Dodaj z powrotem do lokalnego stanu
      setElements(prev => [...prev, elementToRestore]);
      
      // Zapisz do bazy danych
      if (boardIdStateRef.current) {
        const numericBoardId = parseInt(boardIdStateRef.current);
        if (!isNaN(numericBoardId)) {
          saveBoardElementsBatch(numericBoardId, [{
            element_id: elementToRestore.id,
            type: elementToRestore.type,
            data: elementToRestore
          }]).catch(err => {
            console.error('❌ Błąd przywracania elementu podczas redo:', err);
          });
        }
      }
      
      // Broadcast do innych użytkowników
      broadcastElementCreated(elementToRestore);
      
    } else if (lastAction.type === 'delete') {
      // Akcja 'delete' = użytkownik usunął element → redo = USUŃ element ponownie
      const elementToRemove = lastAction.element;
      
      // Usuń z lokalnego stanu
      setElements(prev => prev.filter(el => el.id !== elementToRemove.id));
      
      // Usuń z bazy danych
      if (boardIdStateRef.current) {
        const numericBoardId = parseInt(boardIdStateRef.current);
        if (!isNaN(numericBoardId) && !unsavedElementsRef.current.has(elementToRemove.id)) {
          deleteBoardElement(numericBoardId, elementToRemove.id).catch(err => {
            console.error('❌ Błąd usuwania elementu podczas redo:', err);
          });
        }
      }
      
      // Broadcast do innych użytkowników
      broadcastElementDeleted(elementToRemove.id);
    }
    
    setSelectedElementIds(new Set());
  }, [broadcastElementDeleted, broadcastElementCreated]);

  // Aktualizuj refs dla undo/redo
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  }, [undo, redo]);

  // 🆕 FOLLOW USER - przeniesienie viewport do lokalizacji innego użytkownika + włącz follow mode
  const handleFollowUser = useCallback((userId: number, userViewportX: number, userViewportY: number, userViewportScale: number) => {
    console.log('👁️ Follow user:', userId, 'viewport:', userViewportX, userViewportY, userViewportScale);
    // Ustaw początkowy viewport
    setViewport({
      x: userViewportX,
      y: userViewportY,
      scale: userViewportScale
    });
    // Włącz follow mode - viewport będzie podążał za kursorem użytkownika
    setFollowingUserId(userId);
  }, []);

  // 🆕 STOP FOLLOWING - wyłącz follow mode
  const handleStopFollowing = useCallback(() => {
    console.log('🛑 Stop following');
    setFollowingUserId(null);
  }, []);

  // 🆕 CENTER VIEW ON ELEMENT - dla Activity History
  const handleCenterViewAndSelectElements = useCallback((targetX: number, targetY: number, scale?: number, bounds?: {minX: number, minY: number, maxX: number, maxY: number}, elementIds?: string[]) => {
    console.log('🎯 handleCenterViewAndSelectElements wywołane:', {
      targetX,
      targetY,
      scale,
      bounds,
      elementIds,
      currentViewport: viewport
    });
    
    setViewport(prev => ({
      x: targetX,
      y: targetY,
      scale: scale ?? prev.scale
    }));
    
    // Zaznacz elementy jeśli IDs są przekazane
    if (elementIds && elementIds.length > 0) {
      console.log('✅ Zaznaczam elementy:', elementIds);
      setSelectedElementIds(new Set(elementIds));
      // Zmień tool na select żeby pokazać zaznaczenie
      setTool('select');
    }
  }, [viewport]);
  
  // Handler dla ActivityHistory - tylko zaznaczanie elementów
  const handleSelectElementsFromHistory = useCallback((elementIds: string[]) => {
    console.log('📝 Zaznaczam elementy z historii:', elementIds);
    setSelectedElementIds(new Set(elementIds));
    setTool('select');
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
        
        // Dodaj do istniejących elementów - używamy functional update
        setElements(prev => {
          const newElements = [...prev, ...importedElements];
          saveToHistory(newElements);
          return newElements;
        });
        
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
  }, [saveToHistory, boardIdState, debouncedSave, broadcastElementsBatch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 CALLBACKI DLA NARZĘDZI - Z BROADCAST
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🆕 Helper: Dodaje element do Activity History (elementsWithAuthor) przy lokalnym tworzeniu
  const addToActivityHistory = useCallback((element: DrawingElement) => {
    setElementsWithAuthor(prev => {
      if (prev.some(el => el.element_id === element.id)) {
        return prev;
      }
      return [...prev, {
        element_id: element.id,
        type: element.type,
        data: element,
        created_by_id: user?.id || null,
        created_by_username: user?.username || null,
        created_at: new Date().toISOString()
      }];
    });
  }, [user?.id, user?.username]);
  
  // 🆕 Helper: Usuwa element z Activity History
  const removeFromActivityHistory = useCallback((elementId: string) => {
    setElementsWithAuthor(prev => prev.filter(el => el.element_id !== elementId));
  }, []);
  
  // 🆕 Helper: Dodaje akcję 'create' na stos użytkownika (dla undo)
  const pushCreateAction = useCallback((element: DrawingElement) => {
    const action = { type: 'create' as const, element };
    setUserUndoStack(prev => [...prev, action]);
    userUndoStackRef.current = [...userUndoStackRef.current, action];
    // Wyczyść stos redo przy nowej akcji
    setUserRedoStack([]);
    userRedoStackRef.current = [];
  }, []);
  
  // 🆕 Helper: Dodaje akcję 'delete' na stos użytkownika (dla undo)
  const pushDeleteAction = useCallback((element: DrawingElement) => {
    const action = { type: 'delete' as const, element };
    setUserUndoStack(prev => [...prev, action]);
    userUndoStackRef.current = [...userUndoStackRef.current, action];
    // Wyczyść stos redo przy nowej akcji
    setUserRedoStack([]);
    userRedoStackRef.current = [];
  }, []);
  
  const handlePathCreate = useCallback((path: DrawingPath) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    setElements(prev => {
      const newElements = [...prev, path];
      saveToHistory(newElements);
      return newElements;
    });
    
    // 🆕 BROADCAST + Activity History + User Action Stack
    broadcastElementCreated(path);
    addToActivityHistory(path);
    pushCreateAction(path);
    
    // 🆕 ZAPISYWANIE - oznacz jako unsaved i zaplanuj zapis
    setUnsavedElements(prev => new Set(prev).add(path.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [userRole, saveToHistory, broadcastElementCreated, addToActivityHistory, pushCreateAction, boardIdState, debouncedSave]);

  const handleShapeCreate = useCallback((shape: Shape) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    setElements(prev => {
      const newElements = [...prev, shape];
      saveToHistory(newElements);
      return newElements;
    });
    
    // 🆕 BROADCAST + Activity History + User Action Stack
    broadcastElementCreated(shape);
    addToActivityHistory(shape);
    pushCreateAction(shape);
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(shape.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [saveToHistory, broadcastElementCreated, addToActivityHistory, pushCreateAction, boardIdState, debouncedSave]);

  const handleFunctionCreate = useCallback((func: FunctionPlot) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    setElements(prev => {
      const newElements = [...prev, func];
      saveToHistory(newElements);
      return newElements;
    });
    
    // 🆕 BROADCAST + Activity History + User Action Stack
    broadcastElementCreated(func);
    addToActivityHistory(func);
    pushCreateAction(func);
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(func.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [userRole, saveToHistory, broadcastElementCreated, addToActivityHistory, pushCreateAction, boardIdState, debouncedSave]);

  const handleTextCreate = useCallback((text: TextElement) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    setElements(prev => {
      const newElements = [...prev, text];
      saveToHistory(newElements);
      return newElements;
    });
    
    // 🆕 BROADCAST + Activity History + User Action Stack
    broadcastElementCreated(text);
    addToActivityHistory(text);
    pushCreateAction(text);
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(text.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [saveToHistory, broadcastElementCreated, addToActivityHistory, pushCreateAction, boardIdState, debouncedSave]);

  const handleTextUpdate = useCallback((id: string, updates: Partial<TextElement>) => {
    let updatedElement: DrawingElement | undefined;
    
    setElements(prev => {
      const newElements = prev.map(el => {
        if (el.id === id) {
          updatedElement = { ...el, ...updates } as DrawingElement;
          return updatedElement;
        }
        return el;
      });
      saveToHistory(newElements);
      return newElements;
    });
    
    // 🆕 BROADCAST UPDATE (używamy updatedElement ustawionego w setElements)
    if (updatedElement) {
      broadcastElementUpdated(updatedElement);
    }
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [saveToHistory, broadcastElementUpdated, boardIdState, debouncedSave]);

  const handleTextDelete = useCallback(async (id: string) => {
    // 🆕 Zapisz element przed usunięciem (dla undo) - używamy ref
    const currentElements = elementsRef.current;
    const elementToDelete = currentElements.find(el => el.id === id);
    
    const newElements = currentElements.filter(el => el.id !== id);
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 User Action Stack - zapisz akcję usunięcia
    if (elementToDelete) {
      pushDeleteAction(elementToDelete);
    }
    
    // 🆕 BROADCAST DELETE + API DELETE
    broadcastElementDeleted(id);
    removeFromActivityHistory(id);
    const numericBoardId = parseInt(boardIdState);
    if (!isNaN(numericBoardId)) {
      // Zapisz jeśli unsaved
      if (unsavedElementsRef.current.has(id)) {
        if (elementToDelete) {
          try {
            await saveBoardElementsBatch(numericBoardId, [{
              element_id: elementToDelete.id,
              type: elementToDelete.type,
              data: elementToDelete
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
  }, [saveToHistory, broadcastElementDeleted, removeFromActivityHistory, pushDeleteAction, boardIdState]);

  const handleTextEdit = useCallback((id: string) => {
    setEditingTextId(id);
    setTool('text');
  }, []);

  const handleEditingComplete = useCallback(() => {
    setEditingTextId(null);
    setTool('select');
  }, []);

  const handleImageCreate = useCallback((image: ImageElement) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    // Używamy functional update żeby uniknąć stale closure
    setElements(prev => {
      const newElements = [...prev, image];
      saveToHistory(newElements);
      return newElements;
    });
    
    // 🆕 BROADCAST + Activity History + User Action Stack
    broadcastElementCreated(image);
    addToActivityHistory(image);
    pushCreateAction(image);
    
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
  }, [userRole, saveToHistory, broadcastElementCreated, addToActivityHistory, pushCreateAction, boardIdState, debouncedSave]);



  // 🆕 MARKDOWN NOTE - tworzenie notatki
  const handleMarkdownNoteCreate = useCallback((note: MarkdownNote) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    // TYLKO setElements - bez saveToHistory (powoduje lagi)
    setElements(prev => [...prev, note]);
    
    // 🆕 User Action Stack
    broadcastElementCreated(note);
    addToActivityHistory(note);
    pushCreateAction(note);
    setUnsavedElements(prev => new Set(prev).add(note.id));
    if (boardIdState) debouncedSave(boardIdState);
    
    // Po utworzeniu przełącz na select i od razu włącz edycję
    setTool('select');
    setSelectedElementIds(new Set([note.id]));
    setEditingMarkdownId(note.id);
  }, [broadcastElementCreated, addToActivityHistory, pushCreateAction, boardIdState, debouncedSave]);

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
    
    // 🆕 Broadcast, Activity History i User Action Stack + zapis do DB
    broadcastElementCreated(newNote);
    addToActivityHistory(newNote);
    pushCreateAction(newNote);
    setUnsavedElements(prev => new Set(prev).add(newNote.id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [broadcastElementCreated, addToActivityHistory, pushCreateAction, boardIdState, debouncedSave]);

  // 🆕 TABLE - tworzenie tabeli
  const handleTableCreate = useCallback((table: TableElement) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    setElements(prev => {
      const newElements = [...prev, table];
      saveToHistory(newElements);
      return newElements;
    });
    
    // 🆕 Activity History + User Action Stack
    broadcastElementCreated(table);
    addToActivityHistory(table);
    pushCreateAction(table);
    setUnsavedElements(prev => new Set(prev).add(table.id));
    if (boardIdState) debouncedSave(boardIdState);
    
    // Po utworzeniu przełącz na select żeby można było edytować
    setTool('select');
    setSelectedElementIds(new Set([table.id]));
  }, [userRole, saveToHistory, broadcastElementCreated, addToActivityHistory, pushCreateAction, boardIdState, debouncedSave]);

  // 🆕 TABLE - zmiana komórki tabeli
  const handleTableCellChange = useCallback((tableId: string, row: number, col: number, value: string) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
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
          const updatedElement = { ...el, content };
          // 🆕 Broadcast zmianę do innych użytkowników!
          broadcastElementUpdated(updatedElement);
          return updatedElement;
        }
        return el;
      });
      
      saveToHistory(newElements);
      setUnsavedElements(prevSet => new Set(prevSet).add(noteId));
      if (boardIdState) debouncedSave(boardIdState);
      
      return newElements;
    });
  }, [saveToHistory, boardIdState, debouncedSave, broadcastElementUpdated]);

  // 🆕 STABILNE CALLBACKI dla MarkdownNoteView (żeby nie łamać memo!)
  const handleMarkdownEditStart = useCallback((noteId: string) => {
    setEditingMarkdownId(noteId);
    // 🆕 Broadcast: zacząłem edytować element
    broadcastTypingStarted(noteId);
  }, [broadcastTypingStarted]);

  const handleMarkdownEditEnd = useCallback(() => {
    // 🆕 Broadcast: skończyłem edytować element
    if (editingMarkdownId) {
      broadcastTypingStopped(editingMarkdownId);
    }
    setEditingMarkdownId(null);
  }, [editingMarkdownId, broadcastTypingStopped]);

  // handleMarkdownHeightChange usunięty - notatki mają stały rozmiar, user zmienia resize handlerem

  const handleViewportChange = useCallback((newViewport: ViewportTransform) => {
    setViewport(newViewport);
  }, []);

  const handleElementDelete = useCallback(async (id: string) => {
    // 🆕 Zapisz element przed usunięciem (dla undo) - używamy ref
    const currentElements = elementsRef.current;
    const elementToDelete = currentElements.find(el => el.id === id);
    
    const newElements = currentElements.filter(el => el.id !== id);
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 User Action Stack - zapisz akcję usunięcia
    if (elementToDelete) {
      pushDeleteAction(elementToDelete);
    }
    
    // 🆕 BROADCAST DELETE + API DELETE
    broadcastElementDeleted(id);
    const numericBoardId = parseInt(boardIdState);
    if (!isNaN(numericBoardId)) {
      // Jeśli element jest niezapisany, najpierw go zapisz
      if (unsavedElementsRef.current.has(id)) {
        if (elementToDelete) {
          try {
            await saveBoardElementsBatch(numericBoardId, [{
              element_id: elementToDelete.id,
              type: elementToDelete.type,
              data: elementToDelete
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
  }, [saveToHistory, broadcastElementDeleted, pushDeleteAction, boardIdState]);

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
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...updates } as DrawingElement : el
    ));
  }, [userRole]);

  const handleElementUpdateWithHistory = useCallback((id: string, updates: Partial<DrawingElement>) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    let updatedElement: DrawingElement | undefined;
    
    setElements(prev => {
      const newElements = prev.map(el => {
        if (el.id === id) {
          updatedElement = { ...el, ...updates } as DrawingElement;
          return updatedElement;
        }
        return el;
      });
      saveToHistory(newElements);
      return newElements;
    });
    
    // 🆕 BROADCAST UPDATE
    if (updatedElement) {
      broadcastElementUpdated(updatedElement);
    }
    
    // 🆕 ZAPISYWANIE
    setUnsavedElements(prev => new Set(prev).add(id));
    if (boardIdState) debouncedSave(boardIdState);
  }, [userRole, saveToHistory, broadcastElementUpdated, boardIdState, debouncedSave]);

  const handleElementsUpdate = useCallback((updates: Map<string, Partial<DrawingElement>>) => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    setElements(prev => prev.map(el => {
      const update = updates.get(el.id);
      return update ? { ...el, ...update } as DrawingElement : el;
    }));
  }, [userRole]);

  const handleSelectionFinish = useCallback(() => {
    // Używamy ref żeby mieć aktualny stan
    const currentElements = elementsRef.current;
    const currentSelectedIds = selectedElementIdsRef.current;
    
    saveToHistory(currentElements);
    
    // 🆕 BROADCAST wszystkie zmienione elementy + zapisz do bazy
    currentElements.forEach(element => {
      if (currentSelectedIds.has(element.id)) {
        broadcastElementUpdated(element);
        setUnsavedElements(prev => new Set(prev).add(element.id));
      }
    });
    
    // Zapisz do bazy
    if (boardIdState) debouncedSave(boardIdState);
  }, [saveToHistory, broadcastElementUpdated, boardIdState, debouncedSave]);

  const deleteSelectedElements = useCallback(async () => {
    if (userRole === 'viewer') return; // 🔒 Blokada dla viewerów
    
    // Używamy refs żeby mieć aktualny stan
    const currentSelectedIds = selectedElementIdsRef.current;
    const currentElements = elementsRef.current;
    const currentUnsaved = unsavedElementsRef.current;
    
    if (currentSelectedIds.size === 0) return;
    
    // 🆕 Zapisz usuwane elementy do stosu akcji użytkownika (dla undo)
    const elementsToDelete = currentElements.filter(el => currentSelectedIds.has(el.id));
    elementsToDelete.forEach(el => {
      pushDeleteAction(el);
    });
    
    const newElements = currentElements.filter(el => !currentSelectedIds.has(el.id));
    setElements(newElements);
    saveToHistory(newElements);
    
    // 🆕 BROADCAST DELETE + API DELETE dla każdego
    const numericBoardId = parseInt(boardIdState);
    
    // Najpierw zapisz wszystkie niezapisane elementy
    const unsavedToDelete = currentElements.filter(el => 
      currentSelectedIds.has(el.id) && currentUnsaved.has(el.id)
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
    currentSelectedIds.forEach(id => {
      broadcastElementDeleted(id);
      if (!isNaN(numericBoardId)) {
        deleteBoardElement(numericBoardId, id).catch(err => {
          console.error('❌ Błąd usuwania elementu:', id, err);
        });
      }
    });
    
    setSelectedElementIds(new Set());
  }, [saveToHistory, broadcastElementDeleted, pushDeleteAction, boardIdState]);

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
  
  // 🆕 canUndo/canRedo bazują na stosie akcji użytkownika (nie starej historii)
  const canUndo = userUndoStack.length > 0;
  const canRedo = userRedoStack.length > 0;

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
      addToActivityHistory(newImage);
      setUnsavedElements(prev => new Set(prev).add(newImage.id));
      if (boardIdState) debouncedSave(boardIdState);
    };
    
    img.onerror = () => {
      console.error('❌ Nie można załadować wzoru:', formula.path);
    };
  }, [viewport, canvasWidth, canvasHeight, saveToHistory, broadcastElementCreated, addToActivityHistory, boardIdState, debouncedSave]);

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
          addToActivityHistory(imageElement);
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
  }, [viewport, canvasWidth, canvasHeight, saveToHistory, broadcastElementCreated, addToActivityHistory, boardIdState, debouncedSave]);
  
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

  const handleGlobalPasteImage = useCallback(async (): Promise<boolean> => {
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
          return true; // ✅ Udało się wkleić obrazek
        }
      }
      
      console.log('No image in clipboard');
      setImageProcessing(false);
      return false; // ❌ Brak obrazka w schowku
    } catch (err) {
      console.error('Clipboard paste error:', err);
      setImageProcessing(false);
      return false; // ❌ Błąd
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

  // 🆕 Konwersja PDF z URL → obrazki (dla arkuszy egzaminacyjnych)
  const convertPDFFromUrlToImages = async (pdfUrl: string): Promise<string[]> => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

    const pdf = await pdfjs.getDocument(pdfUrl).promise;
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

    console.log(`✅ Skonwertowano ${images.length} stron PDF z URL`);
    return images;
  };

  // 🆕 Ładowanie arkusza PDF z folderu (gdy arkuszPath jest podany)
  const [arkuszLoaded, setArkuszLoaded] = useState(false);
  const [dbElementsLoaded, setDbElementsLoaded] = useState(false);
  const [dbWasEmpty, setDbWasEmpty] = useState(false);
  
  useEffect(() => {
    // Czekaj aż elementy z bazy zostaną załadowane
    if (!arkuszPath || arkuszLoaded || !dbElementsLoaded) return;
    
    // Ładuj arkusz tylko jeśli baza była pusta
    if (!dbWasEmpty) {
      console.log('📄 Tablica ma już elementy, pomijam ładowanie arkusza');
      setArkuszLoaded(true);
      return;
    }
    
    const loadArkusz = async () => {
      console.log('📄 Ładowanie arkusza z:', arkuszPath);
      setImageProcessing(true);
      
      try {
        // Pobierz listę plików z folderu (manifest.json)
        const manifestUrl = `${arkuszPath}/manifest.json`;
        let pdfFiles: string[] = [];
        
        try {
          const manifestResponse = await fetch(manifestUrl);
          if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            pdfFiles = manifest.files || [];
            console.log('📋 Znaleziono pliki z manifest:', pdfFiles);
          }
        } catch {
          // Brak manifestu - spróbuj domyślnej nazwy
          console.log('📋 Brak manifest.json, próbuję domyślnej nazwy arkusz.pdf');
          pdfFiles = ['arkusz.pdf'];
        }
        
        if (pdfFiles.length === 0) {
          console.log('❌ Brak plików PDF w arkuszu');
          setImageProcessing(false);
          setArkuszLoaded(true);
          return;
        }
        
        // Załaduj pierwszy PDF
        const pdfUrl = `${arkuszPath}/${pdfFiles[0]}`;
        console.log('📄 Ładowanie PDF:', pdfUrl);
        
        const images = await convertPDFFromUrlToImages(pdfUrl);
        
        if (images.length === 0) {
          console.log('❌ Nie udało się skonwertować PDF');
          setImageProcessing(false);
          setArkuszLoaded(true);
          return;
        }
        
        // Dodaj strony jako ImageElement na tablicę
        const worldWidth = 4; // szerokość w jednostkach świata
        const padding = 0.2; // odstęp między stronami
        let currentY = 0;
        
        const newImages: ImageElement[] = [];
        
        for (let i = 0; i < images.length; i++) {
          const dataUrl = images[i];
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUrl;
          });
          
          const aspectRatio = img.height / img.width;
          const worldHeight = worldWidth * aspectRatio;
          
          const newImage: ImageElement = {
            id: `arkusz-${Date.now()}-${i}`,
            type: 'image',
            x: -worldWidth / 2, // wyśrodkowane
            y: currentY,
            width: worldWidth,
            height: worldHeight,
            src: dataUrl,
            alt: `Arkusz - strona ${i + 1}/${images.length}`,
          };
          
          newImages.push(newImage);
          currentY += worldHeight + padding;
          
          // Zapisz załadowany obraz
          setLoadedImages(prev => new Map(prev).set(newImage.id, img));
        }
        
        // Dodaj wszystkie strony naraz
        setElements(newImages);
        saveToHistory(newImages);
        
        // Broadcast i zapisywanie
        newImages.forEach(image => {
          broadcastElementCreated(image);
          addToActivityHistory(image);
          setUnsavedElements(prev => new Set(prev).add(image.id));
        });
        
        if (boardIdState) debouncedSave(boardIdState);
        
        console.log(`✅ Załadowano arkusz: ${newImages.length} stron`);
        
        // Ustaw viewport na początek arkusza
        setViewport({ x: 0, y: 1, scale: 0.8 });
        
      } catch (err) {
        console.error('❌ Błąd ładowania arkusza:', err);
      } finally {
        setImageProcessing(false);
        setArkuszLoaded(true);
      }
    };
    
    // Opóźnij ładowanie żeby dać czas na inicjalizację
    const timer = setTimeout(loadArkusz, 500);
    return () => clearTimeout(timer);
  }, [arkuszPath, arkuszLoaded, dbElementsLoaded, dbWasEmpty, boardIdState, broadcastElementCreated, addToActivityHistory, debouncedSave, saveToHistory]);

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
        
        // Dodaj wszystkie strony naraz - używamy functional update
        setElements(prev => {
          const newElements = [...prev, ...newImages];
          saveToHistory(newElements);
          return newElements;
        });
        
        // Broadcast i zapisywanie dla wszystkich stron
        newImages.forEach(image => {
          broadcastElementCreated(image);
          addToActivityHistory(image);
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
  }, [viewport, canvasWidth, canvasHeight, fileToBase64, handleImageCreate, saveToHistory, broadcastElementCreated, addToActivityHistory, boardIdState, debouncedSave]);
  
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
        
        // 🆕 Wyłącz follow mode gdy user sam nawiguje
        setFollowingUserId(null);
        
        const currentViewport = viewportRef.current;
        const newViewport = panViewportWithMouse(currentViewport, dx, dy);
        const constrained = constrainViewport(newViewport);
        
        viewportRef.current = constrained;
        setViewport(constrained);
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
        setViewport(prev => {
          const newViewport = constrainViewport({
            x: prev.x + viewportChange.x,
            y: prev.y + viewportChange.y,
            scale: prev.scale
          });
          viewportRef.current = newViewport;
          return newViewport;
        });
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
        <OnlineUsers onFollowUser={handleFollowUser} userRole={userRole} />
        
        {/* 🆕 FOLLOW MODE INDICATOR - pasek gdy śledzimy użytkownika */}
        {followingUserId && (
          <div className="absolute top-20 right-4 z-50 bg-blue-500 text-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-3 animate-pulse">
            <span className="text-sm font-medium">👁️ Śledzisz użytkownika</span>
            <button
              onClick={handleStopFollowing}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Przestań śledzić
            </button>
          </div>
        )}
        
        {/* 🔒 BANNER TRYBU TYLKO DO ODCZYTU */}
        {userRole === 'viewer' && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[150] bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-lg shadow-md flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="font-medium">Tryb tylko do odczytu</span>
          </div>
        )}
        
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
          isReadOnly={userRole === 'viewer'}
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
            userRole={userRole}
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
        
        {/* 🆕 ACTIVITY HISTORY - historia elementów */}
        <ActivityHistory
          elements={elementsWithAuthor}
          currentUserId={user?.id}
          onCenterView={handleCenterViewAndSelectElements}
          onSelectElements={handleSelectElementsFromHistory}
          viewport={viewport}
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
      userRole={userRole}
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
                  remoteTypingUser={typingUsers.find(t => t.elementId === note.id)?.username}
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
        
        {/* 🆕 REMOTE CURSORS - Kursory innych użytkowników (sam subskrybuje - nie powoduje re-renderów!) */}
        <RemoteCursorsContainer
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