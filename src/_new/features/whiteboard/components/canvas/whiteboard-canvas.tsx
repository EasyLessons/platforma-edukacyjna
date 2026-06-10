/**
 * whiteboard-canvas.tsx
 *
 * GŁÓWNY ORKIESTRATOR tablicy. Etap 6 — FINALNE SPINANIE.
 *
 * ODPOWIEDZIALNOŚĆ:
 *  - Spina razem 6 hooków: useViewport, useElements, useHistory,
 *    useClipboard, useSelection, useRealtime
 *  - Importuje i renderuje WSZYSTKIE stare narzędzia (SelectTool, PenTool,
 *    ShapeTool, TextTool, PanTool, EraserTool, FunctionTool, ImageTool,
 *    MarkdownNoteTool, TableTool, ArrowTool) — re-use as-is, podłączone do hooków
 *  - Renderuje HTML overlays dla markdown (MarkdownNoteView) i tabel (TableView)
 *  - Renderuje Toolbar, ZoomControls, OnlineUsers, RemoteCursors
 *  - Obsługuje resize canvas + pętlę renderowania (requestAnimationFrame)
 *  - Obsługuje kółko myszy (zoom + pan)
 *  - Obsługuje skróty klawiszowe (Ctrl+Z/Y, Ctrl+C/V/D, Delete, Escape, litery)
 *
 * ZMIANY vs Etap 5:
 *  - Dodano canvasWidth/canvasHeight state (potrzebne przez komponenty narzędzi)
 *  - Dodano wszystkie handler callbacks dla narzędzi
 *  - Dodano renderowanie narzędzi, overlayów MD/table, Toolbar, ZoomControls
 *  - Dodano imageToolRef (ImageTool to forwardRef)
 *  - Dodano handleFollowUser/handleStopFollowing (OnlineUsers)
 *  - Dodano clearCanvas, deleteSelectedElements, zoomIn, zoomOut
 *
 * STATUS: Etap 6 — gotowy do podmiany w page.tsx
 */

'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { flushSync } from 'react-dom';

// ─── Nowe hooki ───────────────────────────────────────────────────────────────
import { useViewport } from '../../hooks/use-viewport';
import { useElements } from '../../hooks/use-elements';
import { useHistory } from '../../hooks/use-history';
import { useClipboard, offsetElement } from '../../hooks/use-clipboard';
import { useSelection } from '../../hooks/use-selection';
import { useRealtime } from '../../hooks/use-realtime';

// ─── Komponenty narzędzi (przez re-exportery _new/) ──────────────────────────
import Toolbar from '../toolbar/toolbar';
import { ZoomControls } from '../toolbar/zoom-controls';
// Komponenty narzędzi są teraz renderowane przez rejestr (tools/*.tool.tsx),
// nie bezpośrednio w canvasie. Zostają tylko: typ refa ImageTool oraz widok
// notatki Markdown (overlay HTML renderowany poza systemem narzędzi).
import type { ImageToolRef } from '../toolbar/image-tool';
import { MarkdownNoteView } from '../toolbar/markdown-note-tool';
import { CalculatorTool } from '../toolbar/calculator-tool';
import { ActivityHistory } from '../toolbar/activity-history';
import { OnlineUsers } from './online-users';
import { RemoteCursorsContainer } from './remote-cursors';
import { SavedAssetsPanel } from '../panels/saved-assets-panel';
import { normalizeElementsForAsset, generateElementsSvgThumbnail } from '../../utils/asset-helpers';
import { saveUserAsset } from '../../api/assets-api';
import { FolderPlus } from 'lucide-react';

// ─── Nowe komponenty UI ───────────────────────────────────────────────────────
import { LoadingOverlay } from './loading-overlay';
import { StatusIndicators } from './status-indicators';
import { SnapGuides } from './snap-guides';

// ─── SmartSearch ─────────────────────────────────────────────────────────────
import { SmartSearchBar, CardViewer } from '@/_new/features/whiteboard/components/smartsearch';
import type { FormulaResource, CardResource } from '@/_new/features/whiteboard/components/smartsearch';

// ─── MathChatbot ─────────────────────────────────────────────────────────────
import { MathChatbot } from '@/_new/features/whiteboard/components/toolbar/math-chatbot';

// ─── Renderowanie canvas ──────────────────────────────────────────────────────
import { drawElement } from '../../elements/rendering';
import { drawGrid } from './grid';

// ─── Matematyka viewportu ─────────────────────────────────────────────────────
import {
  constrainViewport,
  zoomViewport,
  panViewportWithWheel,
  panViewportWithMouse,
  inverseTransformPoint,
  transformPoint,
  computePathBbox,
} from '../../navigation/viewport-math';

// ─── Typy ─────────────────────────────────────────────────────────────────────
import type {
  DrawingElement,
  DrawingPath,
  Shape,
  TextElement,
  FunctionPlot,
  ImageElement,
  MarkdownNote,
  TableElement,
  ArrowElement,
  ViewportTransform,
} from '../../types';
import type { GuideLine } from '../../selection/snap-utils';
import type { BoardSettings } from '@/_new/features/board/types';


import { useBoardRealtime } from '@/app/context/BoardRealtimeContext';

// ─── Gesty multi-touch (pan + zoom) ───────────────────────────────────────────────
import { useMultiTouchGestures } from '../../hooks/use-multi-touch-gestures';

// ─── Store narzędzi (zustand) ─────────────────────────────────────────────────────
import { useToolStore } from '../../stores/tool-store';

// ─── Silnik tablicy (WhiteboardEngine) ────────────────────────────────────────────
import { useWhiteboardEngine } from '../../engine/use-whiteboard-engine';

// ─── Rejestr narzędzi (wtyczki) ───────────────────────────────────────────────────
import { ToolHostProvider, type ToolHostContextValue } from '../../tools/tool-host-context';
import { ActiveToolOverlay } from '../../tools/active-tool-overlay';
import { getTool, TOOL_SHORTCUTS } from '../../tools/registry';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WhiteboardCanvasNewProps {
  /** ID tablicy (liczba jako string, z URL params) */
  boardId: string;
  /** Ścieżka do folderu z arkuszem PDF do wczytania jako tło — opcjonalne */
  arkuszPath?: string | null;
  /** Rola użytkownika — viewer dostaje tylko 'pan' */
  userRole?: 'owner' | 'editor' | 'viewer';
  /** Ustawienia tablicy z backendu (JSONB) */
  boardSettings?: BoardSettings;
  /** Offset px od lewej krawędzi dla toolbara (sidebar strip = zawsze 48, + sidebar gdy otwarty) */
  toolbarLeftOffset?: number;
  /** Czy sidebar tablicy jest aktualnie otwarty */
  isSidebarOpen?: boolean;
  className?: string;
}

// ─── Komponent ────────────────────────────────────────────────────────────────

const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  ai_enabled: true,
  grid_visible: true,
  smartsearch_visible: true,
  toolbar_visible: true,
};

export default function WhiteboardCanvasNew({
  boardId,
  arkuszPath: _arkuszPath,
  userRole = 'editor',
  boardSettings: boardSettingsProp,
  toolbarLeftOffset = 0,
  isSidebarOpen = false,
  className = '',
}: WhiteboardCanvasNewProps) {
  const boardRt = useBoardRealtime();
  const [isGestureActive, setIsGestureActive] = useState(false);
  // Zmerguj props z domyślnymi — używamy ref żeby nie powiązać przez state
  const settings = boardSettingsProp ?? DEFAULT_BOARD_SETTINGS;
  // Ref do settings — unika stale closure w useCallback renderowania
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  // ─── Refs do DOM ────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Stabilna referencja do boardId — bezpieczna w event handlerach */
  const boardIdRef = useRef<string>(boardId);
  /** Ref do ImageTool (forwardRef — potrzebny do triggerFileUpload / handlePasteFromClipboard) */
  const imageToolRef = useRef<ImageToolRef>(null);
  /** Ref do wrappera HTMLoverlayów SelectTool — ukrywany podczas pan by uniknąć lag pozycjonowania */
  const htmlOverlaysRef = useRef<HTMLDivElement>(null);
  /** Ref do wrappera Markdown overlayów — transform aktualizowany synchronicznie z RAF canvasa */
  const mdTableOverlaysRef = useRef<HTMLDivElement>(null);
  /** Ref do RemoteCursors — transform aktualizowany synchronicznie z RAF canvasa */
  const remoteCursorsRef = useRef<HTMLDivElement>(null);
  /** Ref do kontenera edytora tekstu — pozycja aktualizowana w RAF (zero-lag pan/zoom) */
  const textEditorDivRef = useRef<HTMLDivElement | null>(null);
  /** Czy trwa aktywny pan gestem (PanTool lub wheel) — pomija setViewport w hot-path */
  const isPanningRef = useRef(false);
  /** Czy overlaye są FAKTYCZNIE widoczne (false = ukryte podczas scroll/pan/wheel) - STATE aby wymusić re-render SelectTool */
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  /** Debounced timer do przywrócenia overlayów po zakończeniu viewport scrollu/pana */
  const viewportChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    boardIdRef.current = boardId;
  }, [boardId]);

  // ─── Aktywne narzędzie — store zustand ──────────────────────────────────────
  // Właściwości narzędzi (color/lineWidth/…) czytają już bezpośrednio adaptery
  // i panele PropertiesPanel ze store'a — canvas ich nie przepycha (Faza 3).
  const tool = useToolStore((s) => s.activeTool);
  const setTool = useToolStore((s) => s.setActiveTool);
  // Rejestr akcji narzędzia Obraz dla panelu ImageProperties (poniżej, w useEffect).
  const setImageActions = useToolStore((s) => s.setImageActions);

  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // ─── Stan SmartSearch ───────────────────────────────────────────────────────
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isCardViewerActive, setIsCardViewerActive] = useState(false);
  const [activeCard, setActiveCard] = useState<CardResource | null>(null);
  const [windowWidth, setWindowWidth] = useState(0);
  const [windowHeight, setWindowHeight] = useState(0);
  const [bottomToastState, setBottomToastState] = useState<{ id: number; message: string } | null>(null);
  const [isBottomToastExiting, setIsBottomToastExiting] = useState(false);

  // ─── Stan MathChatbot ───────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }>
  >([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Cześć! 👋 Jestem **Math Tutor**!\n\nMogę Ci pomóc z:\n• 📐 Rozwiązywaniem zadań\n• 💡 Podpowiedziami  \n• ✅ Sprawdzaniem rozwiązań\n• 📚 Wyjaśnianiem wzorów\n\nZadaj pytanie! 🤔`,
      timestamp: new Date(),
    },
  ]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  /** Aktywne linie snap — aktualizuje SelectTool podczas przeciągania */
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);

  // ─── Edytor komórki tabeli ──────────────────────────────────────────
  /** Aktualnie edytowana komórka tabeli — null gdy żadna nie jest edytowana */
  const [editingTableCell, setEditingTableCell] = useState<{
    tableId: string;
    row: number;
    col: number;
  } | null>(null);
  const cellEditorInputRef = useRef<HTMLTextAreaElement>(null);
  /** Aktualny stan editingTableCell bez stałej closure — do użytku w handlerach */
  const editingTableCellRef = useRef(editingTableCell);
  useEffect(() => { editingTableCellRef.current = editingTableCell; }, [editingTableCell]);
  // Autofocus + zaznaczenie całości przy otwarciu edytora
  useEffect(() => {
    if (editingTableCell) {
      cellEditorInputRef.current?.focus();
      cellEditorInputRef.current?.select();
    }
  }, [editingTableCell]);

  /**
   * Wymiary canvasa w CSS-px — potrzebne przez wszystkie komponenty narzędzi.
   * Inicjalizowane na 0, aktualizowane przez ResizeObserver w effekcie resize.
   * Narzędzia renderują się dopiero gdy > 0 (guard: `canvasWidth > 0`).
   */
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  // Asset template save states
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [frozenElementsForAsset, setFrozenElementsForAsset] = useState<DrawingElement[]>([]);
  const [showAssetsLibrary, setShowAssetsLibrary] = useState(false);
  const [assetsRefreshKey, setAssetsRefreshKey] = useState(0);

  // Viewer = tylko pan (nie może rysować)
  useEffect(() => {
    if (userRole === 'viewer') setTool('pan');
  }, [userRole]);

  // ─── windowWidth dla responsywnego pozycjonowania SmartSearch ──────────────
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!bottomToastState) return;

    const exitTimer = window.setTimeout(() => setIsBottomToastExiting(true), 2600);
    const hideTimer = window.setTimeout(() => {
      setBottomToastState(null);
      setIsBottomToastExiting(false);
    }, 3200);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [bottomToastState]);

  // ─── Broadcast refs — rozwiązanie problemu "kółkowej zależności" ────────────
  // hist potrzebuje rt.broadcastElementCreated, ale rt inicjalizujemy po hist.
  // Rozwiązanie: ref do funkcji broadcastu, wypełniany po inicjalizacji rt.
  const broadcastCreatedRef = useRef<(el: DrawingElement) => Promise<void>>(
    async () => {}
  );
  const broadcastDeletedRef = useRef<(id: string) => Promise<void>>(
    async () => {}
  );
  const broadcastUpdatedRef = useRef<(el: DrawingElement) => Promise<void>>(
    async () => {}
  );

  // ─── HOOK: viewport ─────────────────────────────────────────────────────────
  const vp = useViewport();

  // ─── HOOK: elements ─────────────────────────────────────────────────────────
  const el = useElements({ boardId });

  // ─── HOOK: selection ────────────────────────────────────────────────────────
  const sel = useSelection();

  // ─── HOOK: history ──────────────────────────────────────────────────────────
  const hist = useHistory({
    onDeleteElement: (boardIdNum, elementId) =>
      el.deleteElementDirectly(boardIdNum, elementId),
    onSaveElement: (boardIdNum, element) =>
      el.saveElementDirectly(boardIdNum, element),
    // Używamy ref żeby nie tworzyć pętli zależności z rt
    onBroadcastCreated: (element) => broadcastCreatedRef.current(element),
    onBroadcastDeleted: (elementId) => broadcastDeletedRef.current(elementId),
    onBroadcastUpdated: (element) => broadcastUpdatedRef.current(element),
    onRemoveElement: (elementId) => el.removeElement(elementId),
    onAddElement: (element) => el.addElements([element]),
    onUpdateElement: (element) => el.updateElement(element),
    onClearSelection: sel.clearSelection,
    unsavedElementsRef: el.unsavedElementsRef,
    boardIdRef,
  });

  // ─── HOOK: realtime ─────────────────────────────────────────────────────────
  const rt = useRealtime({
    onRemoteElementAdded: (element) => {
      // Uzupełnij bbox dla ścieżek przychodzących przez realtime (nie mają cache)
      if (element.type === 'path' && !element.bbox) {
        (element as DrawingPath).bbox = computePathBbox(element);
      }
      el.addElements([element]);
    },
    onRemoteElementUpdated: (element) => {
      // Przy update ścieżki unieważnij cache — punkty mogły się zmienić
      if (element.type === 'path') {
        (element as DrawingPath).bbox = computePathBbox(element);
      }
      el.updateElement(element);
    },
    onRemoteElementDeleted: (elementId) => {
      el.removeElement(elementId);
    },
    onLoadRemoteImage: el.loadImage,
    onRemoteViewport: vp.applyRemoteViewport,

    onElementsUpdated: (elements) => {
          if (el.updateElements) {
            el.updateElements(elements);
          } else {
            elements.forEach(e => el.updateElement(e));
          }
        },
        
// 🔥 [SYNC] Ktoś wszedł i prosi o dane - wyślij mu całą naszą tablicę z pamięci RAM!
    onSyncRequest: (requestingUserId) => {
      // ⚠️ UŻYWAMY boardRt ZAMIAST rt!
      if (el.elementsRef.current.length > 0 && boardRt.broadcastSyncResponse) {
        boardRt.broadcastSyncResponse(el.elementsRef.current, requestingUserId).catch(console.error);
      }
    },
    
    // 🔥 DODANE [SYNC] To my weszliśmy i ktoś nam przysłał najświeższe dane - łatajmy dziury!
    onSyncResponse: (incomingElements) => {
      const currentMap = new Map(el.elementsRef.current.map(e => [e.id, e]));
      const toAdd: DrawingElement[] = [];
      const toUpdate: DrawingElement[] = [];

      incomingElements.forEach(incoming => {
        // Uzupełnij bbox dla ścieżek z sync (przyszły z sieci, nie mają cache)
        if (incoming.type === 'path' && !incoming.bbox) {
          (incoming as DrawingPath).bbox = computePathBbox(incoming);
        }
        if (currentMap.has(incoming.id)) {
          toUpdate.push(incoming);
        } else {
          toAdd.push(incoming);
        }
      });

      if (toAdd.length > 0) el.addElements(toAdd);
      if (toUpdate.length > 0 && el.updateElements) el.updateElements(toUpdate);
    },
 
      });

  // Wypełnij broadcast refs gdy rt jest dostępne (bez ponownego renderowania)
  useEffect(() => {
    broadcastCreatedRef.current = rt.broadcastElementCreated;
    broadcastDeletedRef.current = rt.broadcastElementDeleted;
    broadcastUpdatedRef.current = rt.broadcastElementUpdated;
  }, [rt.broadcastElementCreated, rt.broadcastElementDeleted, rt.broadcastElementUpdated]);

  // ─── HOOK: clipboard ────────────────────────────────────────────────────────
  const clip = useClipboard({
    elementsRef: el.elementsRef,
    selectedElementIdsRef: sel.selectedElementIdsRef,
    viewportRef: vp.viewportRef,
    canvasRef,
    boardIdRef,
    onAddElements: el.addElements,
    onBroadcastCreated: rt.broadcastElementCreated,
    onBroadcastBatch: rt.broadcastElementsBatch,
    onMarkUnsaved: el.markUnsaved,
    // markUnsaved już wywołuje debouncedSave wewnętrznie — no-op tu wystarczy
    onDebouncedSave: () => {},
    onSelectElements: sel.selectElements,
    onLoadImage: el.loadImage,
    onRecordCommand: hist.recordCommand,
  });

  // ─── SILNIK: WhiteboardEngine ────────────────────────────────────────────────
  // Fasada nad hookami. Intencje create/update/delete zwijają rytuał
  // (stan lokalny + persist + broadcast + zapis komendy) w jedno miejsce.
  // Obiekt jest stabilny referencyjnie (useMemo []) — czyta runtime przez depsRef.
  const engine = useWhiteboardEngine({
    elementsRef: el.elementsRef,
    loadedImages: el.loadedImages,
    addElements: el.addElements,
    updateElements: el.updateElements,
    removeElement: el.removeElement,
    markUnsaved: el.markUnsaved,
    deleteElementDirectly: el.deleteElementDirectly,
    selectedElementIds: sel.selectedElementIds,
    selectElements: sel.selectElements,
    clearSelection: sel.clearSelection,
    viewportRef: vp.viewportRef,
    broadcastElementCreated: rt.broadcastElementCreated,
    broadcastElementUpdated: rt.broadcastElementUpdated,
    broadcastElementDeleted: rt.broadcastElementDeleted,
    broadcastElementsBatch: rt.broadcastElementsBatch,
    recordCommand: hist.recordCommand,
    undo: hist.undo,
    redo: hist.redo,
    canUndo: hist.canUndo,
    canRedo: hist.canRedo,
    canvasSize: { width: canvasWidth, height: canvasHeight },
    boardIdRef,
    userRole,
  });

  // ─── OBSŁUGA SZABLONÓW (Assets) ─────────────────────────────────────────────
  const handleSaveGroupTemplate = useCallback((selectedElements: DrawingElement[]) => {
    setFrozenElementsForAsset(selectedElements);
    setAssetModalOpen(true);
    setAssetName('');
  }, []);

  const submitSaveAsset = async () => {
    if (!assetName.trim()) return;
    try {
      const normalizedElements = normalizeElementsForAsset(frozenElementsForAsset);
      const thumbnail = generateElementsSvgThumbnail(normalizedElements);
      await saveUserAsset({
        name: assetName,
        elements_data: normalizedElements,
        thumbnail
      });
      setAssetModalOpen(false);
      setFrozenElementsForAsset([]);
      setShowAssetsLibrary(true);
      setAssetsRefreshKey(k => k + 1);
    } catch (err) {
      console.error(err);
      alert("Wystąpił błąd podczas zapisywania szablonu");
    }
  };

  const handleAssetDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('application/x-whiteboard-asset')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleAssetDropCenter = (e: React.DragEvent<HTMLDivElement>) => {
    const data = e.dataTransfer.getData('application/x-whiteboard-asset');
    if (data) {
      e.preventDefault();
      try {
        const parsedElements = JSON.parse(data) as DrawingElement[];
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const dropScreenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const dropWorldPt = inverseTransformPoint(dropScreenPt, vp.viewportRef.current, rect.width, rect.height);

        const now = Date.now();
        const insertedElements = parsedElements.map(el => {
          // Tworzymy głęboką kopię elementu, aby nie referować do starych danych
          const copy = structuredClone(el) as any;

          copy.id = crypto.randomUUID();
          copy.created_at = now;
          copy.updated_at = now;
          
          if (copy.type === 'path') {
            copy.points = copy.points.map((p: any) => ({
              x: p.x + dropWorldPt.x,
              y: p.y + dropWorldPt.y,
            }));
          } else if (copy.type === 'shape') {
            copy.startX += dropWorldPt.x;
            copy.startY += dropWorldPt.y;
            copy.endX += dropWorldPt.x;
            copy.endY += dropWorldPt.y;
          } else if (copy.type === 'arrow') {
            copy.startX += dropWorldPt.x;
            copy.startY += dropWorldPt.y;
            copy.endX += dropWorldPt.x;
            copy.endY += dropWorldPt.y;
            if (copy.controlPoints) {
              copy.controlPoints = copy.controlPoints.map((p: any) => ({
                x: p.x + dropWorldPt.x,
                y: p.y + dropWorldPt.y,
              }));
            }
          } else if ('x' in copy && 'y' in copy) {
            (copy as any).x += dropWorldPt.x;
            (copy as any).y += dropWorldPt.y;
          }
          
          return copy as DrawingElement;
        });

        engine.createElements(insertedElements);
        sel.selectElements(insertedElements.map(e => e.id));

        // Load images if there are any
        insertedElements.forEach(item => {
          if (item.type === 'image' && (item as ImageElement).src) {
            el.loadImage(item.id, (item as ImageElement).src);
          }
        });

      } catch (err) {
        console.error("Błąd podczas upuszczania zasobu:", err);
      }
    }
  };

  const handleViewportChange = useCallback((newVp: ViewportTransform) => {
    const constrained = constrainViewport(newVp);
    
    // 1. Zaktualizuj stabilną referencję (Ref) - to daje płynność Canvasowi (60 FPS)
    vp.viewportRef.current = constrained;

    // 2. Jeśli overlaye są widoczne, ukryj je TYLKO wizualnie (bez czyszczenia zaznaczenia!)
    // Używamy CSS dla szybkości, by nie wymuszać ciężkiego re-renderu całego drzewa Reacta
    if (htmlOverlaysRef.current && htmlOverlaysRef.current.style.visibility !== 'hidden') {
      htmlOverlaysRef.current.style.visibility = 'hidden';
    }

    // 3. Zarządzanie renderowaniem:
    // Jeśli używamy narzędzia Pan lub gestów (isPanningRef), nie robimy setViewport (stanu React),
    // bo to by zabiło wydajność mobilną przez ciągłe re-rendery.
    if (isPanningRef.current) {
      // Tylko przerysowujemy Canvas "na żywo"
      requestAnimationFrame(() => redrawCanvasRef.current());
    } else {
      // Jeśli to np. Zoom z przycisku, aktualizujemy stan normalnie
      vp.setViewport(constrained);
    }

    // 4. Przywróć overlaye po zakończeniu ruchu (Debounce)
    if (viewportChangeTimerRef.current) clearTimeout(viewportChangeTimerRef.current);
    viewportChangeTimerRef.current = setTimeout(() => {
      viewportChangeTimerRef.current = null;
      if (isPanningRef.current) return; 

      // Dopiero po zatrzymaniu ruchu synchronizujemy stan Reacta
      vp.setViewport(vp.viewportRef.current);
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = '';
    }, 100);
  }, [vp.setViewport, vp.viewportRef]); // Usunąłem 'sel' z zależności - funkcja jest teraz stabilna!



useMultiTouchGestures({
    containerRef,
    viewportRef: vp.viewportRef,
    onGestureStart: () => {
      setIsGestureActive(true);      // Blokuje PenTool i inne narzędzia
      isPanningRef.current = true;   // Flaga dla wydajności rysowania
      // Ukrywamy ramkę zaznaczenia natychmiast, żeby nie "pływała"
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';
    },
    onGestureEnd: () => {
      setIsGestureActive(false);     // Odblokowuje narzędzia rysowania
      // isPanningRef zostaje true — momentum kontynuuje pan bez setViewport per klatka
    },
    onMomentumEnd: () => {
      // Momentum wygasło — synchronizuj stan React i przywróć overlaye
      isPanningRef.current = false;
      vp.setViewport(vp.viewportRef.current);
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = '';
    },
    onViewportChange: handleViewportChange,
  });

  // ─── Broadcast viewport throttled ──────────────────────────────────────────
  const lastVpBroadcastRef = useRef(0);
  useEffect(() => {
    // Nie broadcastuj gdy kanał WebSocket nie jest gotowy
    if (!rt.isConnected) return;
    // Nie broadcastuj gdy jesteśmy w follow mode
    if (vp.followingUserId) return;
    const now = Date.now();
    if (now - lastVpBroadcastRef.current < 50) return; // 20 FPS max
    lastVpBroadcastRef.current = now;
    rt.broadcastViewportChange(vp.viewport.x, vp.viewport.y, vp.viewport.scale);
  }, [vp.viewport, vp.followingUserId, rt.broadcastViewportChange, rt.isConnected]);

// 📡 [SYNC] Gdy kanał WebSocket się połączy, poproś innych graczy o niezapisany stan
  useEffect(() => {
    if (rt.isConnected && rt.broadcastSyncRequest) {
      rt.broadcastSyncRequest().catch(console.error);
    }
  }, [rt.isConnected, rt.broadcastSyncRequest]);

  // ─── RENDEROWANIE CANVAS ────────────────────────────────────────────────────

  const rafIdRef = useRef<number | null>(null);

  // Ref do editingTextId — canvas zawsze ma aktualną wartość bez przechwytywania
  const editingTextIdRef = useRef<string | null>(sel.editingTextId);

  // Wszystkie wartości runtime potrzebne w redrawCanvas trzymamy w jednym stabilnym ref.
  // Dzięki temu useCallback ma puste deps i nigdy nie jest rekreowany — zero zbędnych
  // re-renderów i efektów wynikających ze zmiany referencji funkcji.
  const renderStateRef = useRef({
    elementsRef: el.elementsRef,
    loadedImages: el.loadedImages,
    spatialIndex: el.spatialIndex,
    viewportRef: vp.viewportRef,
    handleElementUpdate: null as unknown as (id: string, updates: Partial<DrawingElement>) => void,
  });

  // Aktualizuj renderStateRef przy każdej zmianie wartości — bez rekracji redrawCanvas
  useEffect(() => {
    renderStateRef.current.elementsRef = el.elementsRef;
  }, [el.elementsRef]);
  useEffect(() => {
    renderStateRef.current.loadedImages = el.loadedImages;
  }, [el.loadedImages]);
  useEffect(() => {
    renderStateRef.current.spatialIndex = el.spatialIndex;
  }, [el.spatialIndex]);
  useEffect(() => {
    renderStateRef.current.viewportRef = vp.viewportRef;
  }, [vp.viewportRef]);

  // redrawCanvas — stabilna przez cały czas życia komponentu, nigdy nie rekreowana
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { elementsRef, loadedImages, spatialIndex, viewportRef, handleElementUpdate: handleElUpdate } = renderStateRef.current;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const viewport = viewportRef.current;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    drawGrid(ctx, viewport, width, height, settingsRef.current.grid_visible);

    // ─── 🚀 VIEWPORT CULLING — R-Tree spatial index O(log n + k) ───
    const CULL_MARGIN_PX = 150;
    const scale100 = viewport.scale * 100;
    const worldMargin = CULL_MARGIN_PX / scale100;
    const worldMinX = viewport.x - (width / 2) / scale100 - worldMargin;
    const worldMinY = viewport.y - (height / 2) / scale100 - worldMargin;
    const worldMaxX = viewport.x + (width / 2) / scale100 + worldMargin;
    const worldMaxY = viewport.y + (height / 2) / scale100 + worldMargin;

    const visibleIds = spatialIndex.query(worldMinX, worldMinY, worldMaxX, worldMaxY);

    for (const element of elementsRef.current) {
      if (!visibleIds.has(element.id)) continue;
      if (element.type === 'markdown') continue;
      if (element.type === 'text' && element.id === editingTextIdRef.current) continue;

      const onAutoExpand = (id: string, newHeight: number) => {
        setTimeout(() => {
          const current = elementsRef.current.find((e) => e.id === id);
          if (current && 'height' in current) {
            if (Math.abs((current.height ?? 0) - newHeight) > 0.05) {
              handleElUpdate?.(id, { height: newHeight });
            }
          }
        }, 0);
      };

      drawElement(ctx, element, viewport, width, height, loadedImages, false, onAutoExpand, elementsRef.current);
    }

    // Overlay transform — synchronicznie z canvasem, zero lagu przy pan/zoom
    const overlayTransform =
      `translate(${width / 2}px, ${height / 2}px) ` +
      `scale(${viewport.scale}) ` +
      `translate(${-viewport.x * 100}px, ${-viewport.y * 100}px)`;
    if (mdTableOverlaysRef.current) mdTableOverlaysRef.current.style.transform = overlayTransform;
    if (remoteCursorsRef.current) remoteCursorsRef.current.style.transform = overlayTransform;

    // Imperatywny update edytora tekstu
    if (editingTextIdRef.current && textEditorDivRef.current) {
      const d = textEditorDivRef.current;
      const wx = parseFloat(d.getAttribute('data-world-x') || '0');
      const wy = parseFloat(d.getAttribute('data-world-y') || '0');
      const ww = parseFloat(d.getAttribute('data-world-w') || '0');
      const wh = parseFloat(d.getAttribute('data-world-h') || '0');
      const tl = transformPoint({ x: wx, y: wy }, viewport, width, height);
      d.style.left   = `${tl.x}px`;
      d.style.top    = `${tl.y}px`;
      d.style.width  = `${ww * viewport.scale * 100}px`;
      d.style.height = `${wh * viewport.scale * 100}px`;
    }

    // Imperatywny update edytora komórki tabeli
    if (editingTableCellRef.current && cellEditorInputRef.current) {
      const editing = editingTableCellRef.current;
      const table = elementsRef.current.find((e) => e.id === editing.tableId);
      if (table && table.type === 'table') {
        const t = table as TableElement;
        const cellW = t.width / t.cols;
        const cellH = t.height / t.rows;
        const tl = transformPoint(
          { x: t.x + editing.col * cellW, y: t.y + editing.row * cellH },
          viewport, width, height
        );
        const br = transformPoint(
          { x: t.x + (editing.col + 1) * cellW, y: t.y + (editing.row + 1) * cellH },
          viewport, width, height
        );
        const inp = cellEditorInputRef.current;
        inp.style.left     = `${tl.x}px`;
        inp.style.top      = `${tl.y}px`;
        inp.style.width    = `${br.x - tl.x}px`;
        inp.style.height   = `${br.y - tl.y}px`;
        inp.style.fontSize = `${Math.max(10, Math.min((br.y - tl.y) * 0.42, 30))}px`;
      }
    }

    ctx.restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Stabilna — wszystkie wartości runtime przez renderStateRef

  // Przechowuj redrawCanvas w ref — teraz zbędne bo jest już stabilna, ale zostawiamy
  // dla kompatybilności z event handlerami które odwołują się do redrawCanvasRef
  const redrawCanvasRef = useRef(redrawCanvas);

  // Aktualizuj editingTextIdRef i przerysuj canvas gdy zmienia się edytowany element
  useEffect(() => {
    editingTextIdRef.current = sel.editingTextId;
    requestAnimationFrame(() => redrawCanvasRef.current());
  }, [sel.editingTextId]);

  // Przerysuj przy każdej zmianie elementów / viewportu / obrazów / settings
  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      redrawCanvasRef.current();
      rafIdRef.current = null;
    });
  }, [el.elements, el.loadedImages, vp.viewport, boardSettingsProp]);

  // ─── FOCUS na kontenerze przy starcie (skróty działają bez klikania w tablicę) ──
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // ─── RESIZE CANVAS ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = Math.ceil(rect.width);
      const h = Math.ceil(rect.height);

      // Guard: nie aktualizuj jeśli rozmiar się nie zmienił — na DPR=2 subpikselowe
      // oscylacje rect mogą triggerować ResizeObserver w kółko i powodować pętlę re-renderów
      const prevW = canvas.width / dpr;
      const prevH = canvas.height / dpr;
      if (w === prevW && h === prevH) return;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // Zaktualizuj stan — narzędzia czekają na canvasWidth > 0
      setCanvasWidth(w);
      setCanvasHeight(h);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Reset transform to identity - scaling is handled in redrawCanvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        redrawCanvasRef.current();
      }
    };

    const debouncedUpdate = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateSize, 100);
    };

    updateSize();
    window.addEventListener('resize', debouncedUpdate);
    const ro = new ResizeObserver(debouncedUpdate);
    ro.observe(container);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedUpdate);
      ro.disconnect();
    };
  }, []); // Celowo pusta — setup jednorazowy, korzystamy z redrawCanvasRef

  // ─── ZOOM + PAN (kółko myszy / touchpad) ───────────────────────────────────
  //
  // ⚡ PERF: Nie wołamy setViewport w hot-path każdego eventu!
  //   - viewportRef.current aktualizowany natychmiast (canvas RAF reads this)
  //   - redrawCanvasRef.current() wołane bezpośrednio przez RAF
  //   - setViewport wywołany przez debounce (co 80ms) — synchronizuje React state
  //     (ZoomControls, HTMLoverlays) bez jitter klatka-po-klatce

  const wheelSetViewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Po każdej aktualizacji React-stanu viewportu (po re-renderze z poprawnymi pozycjami) — przywróć widoczność wszystkich HTML overlaysów
  useEffect(() => {
    if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = '';
  }, [vp.viewport]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      vp.handleStopFollowing();
      // Ukryj SelectTool overlay — wyrówna się po zsynchronizowaniu React-stanu viewport.
      // Markdown i kursory nie są ukrywane — transform CSS nadraża za canvasem natychmiast.
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const current = vp.viewportRef.current;

      const next = e.ctrlKey
        ? zoomViewport(current, e.deltaY, mouseX, mouseY, rect.width, rect.height)
        : panViewportWithWheel(current, e.deltaX, e.deltaY);

      const constrained = constrainViewport(next);

      // 1. Zaktualizuj ref natychmiast — canvas RAF odczyta nową wartość
      vp.viewportRef.current = constrained;

      // 2. Narysuj canvas bezpośrednio (bez czekania na React re-render)
      requestAnimationFrame(() => redrawCanvasRef.current());

      // 3. Zsynchronizuj React state z debounce — aktualizuje ZoomControls + HTML overlays
      if (wheelSetViewportTimerRef.current) clearTimeout(wheelSetViewportTimerRef.current);
      wheelSetViewportTimerRef.current = setTimeout(() => {
        vp.setViewport(vp.viewportRef.current);
      }, 80);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [vp.handleStopFollowing, vp.setViewport, vp.viewportRef]);

// ─── BROADCAST CURSOR (pointermove → world coords → WebSocket) ──────────

  const lastCursorBroadcastRef = useRef(0); // pamięć czasu

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerMove = (e: PointerEvent) => {
      // 🔥 DODANE: THROTTLE (ogranicznik częstotliwości)
      const now = Date.now();
      if (now - lastCursorBroadcastRef.current < 40) return; 
      lastCursorBroadcastRef.current = now;

      const rect = container.getBoundingClientRect();
      const worldPos = inverseTransformPoint(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        vp.viewportRef.current,
        rect.width,
        rect.height
      );
      rt.broadcastCursorMove(worldPos.x, worldPos.y);
    };

    container.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => container.removeEventListener('pointermove', handlePointerMove);
  }, [rt.broadcastCursorMove, vp.viewportRef]);

  // ─── DBLCLICK na tabeli → edytor komórki ───────────────────────────────
  // Double-click wykrywa która komórka tabeli została kliknięta i otwiera
  // pływający <input> na jej pozycji ekranowej (nie wrapper-transform).

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDblClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const worldPos = inverseTransformPoint(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        vp.viewportRef.current,
        rect.width,
        rect.height
      );
      const tables = el.elementsRef.current.filter((el) => el.type === 'table') as TableElement[];
      for (const t of tables) {
        if (
          worldPos.x >= t.x && worldPos.x <= t.x + t.width &&
          worldPos.y >= t.y && worldPos.y <= t.y + t.height
        ) {
          const col = Math.min(Math.floor((worldPos.x - t.x) / (t.width / t.cols)), t.cols - 1);
          const row = Math.min(Math.floor((worldPos.y - t.y) / (t.height / t.rows)), t.rows - 1);
          // Oblicz pozycję ekranową komórki z aktualnego vp.viewportRef
          const cellW = t.width / t.cols;
          const cellH = t.height / t.rows;
          const tl = transformPoint(
            { x: t.x + col * cellW, y: t.y + row * cellH },
            vp.viewportRef.current, rect.width, rect.height
          );
          const br = transformPoint(
            { x: t.x + (col + 1) * cellW, y: t.y + (row + 1) * cellH },
            vp.viewportRef.current, rect.width, rect.height
          );
          setEditingTableCell({ tableId: t.id, row, col });
          return;
        }
      }
    };

    container.addEventListener('dblclick', handleDblClick);
    return () => container.removeEventListener('dblclick', handleDblClick);
  }, [el.elementsRef, vp.viewportRef]);

  // ─── PAN środkowym przyciskiem myszy (scroll) lub prawym (PPM) ──────────────
  //
  // Strategia: pointerdown w capture phase NA KONTENERZE — łapie event PRZED
  // tool-overlayami (SelectTool, PenTool itd.). stopPropagation blokuje narzędzia
  // od widzenia pointerdown. pointermove/pointerup na document (bubble) — zawsze
  // docierają bo nie używamy pointer-capture API.
  //
  // WAŻNE: Stan pana (isPanningRef, panLastPos) trzymany w REFS — przeżywają
  // re-rendery Reacta. Poprzednia wersja z let isPanning w closure była resetowana
  // gdy effect re-runował z powodu zmiany zależności (np. sel).

  const panLastPosRef = useRef({ x: 0, y: 0 });
  /** Który przycisk rozpoczął pan (1=MMB, 2=PPM) — używane do filtrowania pointerup */
  const panButtonRef = useRef<number>(-1);
  /** Czy PPM/MMB pan właśnie się zakończył — blokuje contextmenu po puszczeniu PPM */
  const panDidDragRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // pointerdown w capture phase na kontenerze — odpala się PRZED tool-overlayami
    const handlePointerDown = (e: PointerEvent) => {
      // button 1 = scroll (MMB), button 2 = PPM
      if (e.button !== 1 && e.button !== 2) return;

      e.preventDefault();      // blokuje autoscroll (MMB) + zapobiega mousedown
      e.stopPropagation();     // blokuje tool-overlay od widzenia pointerdown

      isPanningRef.current = true;
      panButtonRef.current = e.button;  // 1=MMB, 2=PPM
      panDidDragRef.current = false;
      panLastPosRef.current = { x: e.clientX, y: e.clientY };

      document.body.style.cursor = 'grabbing';
      vp.handleStopFollowing();

      // Ukryj SelectTool overlay (stare pozycje zaznaczenia) — wróci po pointerup.
      // Markdown i kursory nie są ukrywane — CSS transform nadraża w tym samym RAF.
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;

      // e.buttons to bitmask aktualnie wciśniętych przycisków:
      // 1=LPM, 2=PPM, 4=MMB. Jeśli przycisk który zaczął pan nie jest już
      // wciśnięty — zatrzymaj pan teraz, nawet jeśli pointerup zniknął.
      const expectedMask = panButtonRef.current === 2 ? 2 : 4; // PPM=2, MMB=4
      if ((e.buttons & expectedMask) === 0) {
        stopPan();
        return;
      }

      const dx = e.clientX - panLastPosRef.current.x;
      const dy = e.clientY - panLastPosRef.current.y;
      panLastPosRef.current = { x: e.clientX, y: e.clientY };

      if (dx !== 0 || dy !== 0) panDidDragRef.current = true;

      const next = panViewportWithMouse(vp.viewportRef.current, dx, dy);
      const constrained = constrainViewport(next);
      vp.viewportRef.current = constrained;
      requestAnimationFrame(() => redrawCanvasRef.current());
    };

    const stopPan = () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      document.body.style.cursor = '';

      // Przywróć SelectTool overlay
      if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = '';

      // Zsynchronizuj React state — aktualizuje ZoomControls + HTML overlays
      vp.setViewport(vp.viewportRef.current);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button !== panButtonRef.current) return;
      stopPan();
    };

    // Fallback: mouseup łapie puszczenie PPM gdy pointerup nie dotrze
    // (np. gdy przeglądarka pochłonęła zdarzenie przez context menu)
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== panButtonRef.current) return;
      stopPan();
    };

    // pointercancel — np. gdy okno traci fokus w trakcie pana
    const handlePointerCancel = () => stopPan();

    // Blokuj gest "wstecz/naprzód" przeglądarki (Chrome: PPM + ruch w lewo/prawo).
    // MUSI być na mousedown w capture phase — pointerdown nie zawsze wystarczy.
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.button === 1) e.preventDefault();
    };

    // Blokuj context menu po zakończonym panie PPM + zatrzymaj pan.
    // Zawsze preventDefault — na tablicy nie potrzebujemy menu kontekstowego przeglądarki.
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      panDidDragRef.current = false;
      stopPan();
    };

    container.addEventListener('mousedown', handleMouseDown, { capture: true });
    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointercancel', handlePointerCancel);
    container.addEventListener('contextmenu', handleContextMenu);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown, { capture: true });
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      container.removeEventListener('contextmenu', handleContextMenu);
      // Cleanup gdyby pan był aktywny w momencie odmontowania
      if (isPanningRef.current) {
        isPanningRef.current = false;
        document.body.style.cursor = '';
      }
    };
  }, [vp.handleStopFollowing, vp.setViewport, vp.viewportRef]);

  // ─── SKRÓTY KLAWISZOWE ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      // Ctrl+Z — cofnij (odporne na Caps Lock)
      if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        hist.undo();
        return;
      }
      // Ctrl+Y / Ctrl+Shift+Z — ponów
      if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        hist.redo();
        return;
      }
      // Ctrl+C — kopiuj
      if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (sel.selectedElementIds.size > 0) {
          e.preventDefault();
          clip.handleCopy();
        }
        return;
      }
      // Ctrl+V — wklej (zawsze najpierw sprawdź schowek OS pod kątem obrazu)
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handleOsClipboardPasteRef.current().then((pastedImage) => {
          if (!pastedImage && clip.copiedElements.length > 0) {
            clip.handlePaste();
          }
        });
        return;
      }
      // Ctrl+D — duplikuj
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        if (sel.selectedElementIds.size > 0) {
          e.preventDefault();
          clip.handleDuplicate();
        }
        return;
      }
      // Delete — usuń zaznaczone
      if (e.key === 'Delete') {
        if (sel.selectedElementIds.size > 0) {
          e.preventDefault();
          deleteSelectedElementsRef.current();
        }
        return;
      }
      // Escape — odznacz + wróć do select
      if (e.key === 'Escape') {
        e.preventDefault();
        sel.clearSelection();
        if (userRole !== 'viewer') setTool('select');
        return;
      }

      // Skróty narzędzi (bez Ctrl/Alt/Meta) — z rejestru (TOOL_SHORTCUTS)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && userRole !== 'viewer') {
        const toolId = TOOL_SHORTCUTS.get(e.key.toLowerCase());
        if (toolId) {
          e.preventDefault();
          setTool(toolId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hist.undo, hist.redo,
    sel.selectedElementIds, sel.clearSelection,
    clip.handleCopy, clip.handlePaste, clip.handleDuplicate,
    userRole,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLER VIEWPORT (wywołują narzędzia podczas pan/zoom przez touch/drag)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Ukrywa wszystkie HTML-overlaye natychmiast — bez re-renderu React */
  const hideOverlaysForPan = useCallback(() => {
    isPanningRef.current = true;
    // 🆕 Wyczyść zaznaczenie SYNCHRONICZNIE (flushSync) — panel zniknie natychmiast
    flushSync(() => {
      setOverlaysVisible(false); // 🆕 SYNCHRONICZNIE - wymusza natychmiastowy re-render SelectTool
      sel.clearSelection();
    });
    if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = 'hidden';
    // Markdown i kursory nie potrzebują ukrywania — CSS transform zawsze aktualny
  }, [sel]);

  /** Przywraca overlaye i synchronizuje React viewport state raz po zakończeniu pana */
  const restoreOverlaysAfterPan = useCallback(() => {
    isPanningRef.current = false;
    // Anuluj debounce — przywróć natychmiast (gest skończony, pozycja znana)
    if (viewportChangeTimerRef.current) {
      clearTimeout(viewportChangeTimerRef.current);
      viewportChangeTimerRef.current = null;
    }
    // Najpierw synchronicznie zaktualizuj React state — React przerenderuje
    // wszystkie pozycje (w tym SelectionPropertiesPanel) jeszcze zanim
    // overlaye staną się widoczne. Bez tego panel przez ułamek sekundy
    // byłby widoczny na starej pozycji (efekt "leci za nami").
    flushSync(() => {
      vp.setViewport(vp.viewportRef.current);
      setOverlaysVisible(true); // 🆕 State → wymusza re-render SelectTool SYNCHRONICZNIE
    });
    // Dopiero teraz odkryj overlaye — panele są już na właściwych pozycjach
    if (htmlOverlaysRef.current) htmlOverlaysRef.current.style.visibility = '';
  }, [vp.setViewport, vp.viewportRef]);


  /** Używane przez ActivityHistory — centruje widok i zaznacza elementy */
  const handleCenterViewAndSelectElements = useCallback((
    x: number,
    y: number,
    scale?: number,
    _bounds?: { minX: number; minY: number; maxX: number; maxY: number }
  ) => {
    const constrained = constrainViewport({ x, y, scale: scale ?? vp.viewport.scale });
    vp.viewportRef.current = constrained;
    vp.setViewport(constrained);
  }, [vp.setViewport, vp.viewportRef, vp.viewport.scale]);

  /** Używane przez ActivityHistory — zaznacza elementy i przełącza na select */
  const handleSelectElementsFromHistory = useCallback((elementIds: string[]) => {
    sel.selectElements(elementIds);
    setTool('select');
  }, [sel.selectElements]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERY TWORZENIA ELEMENTÓW
  // ═══════════════════════════════════════════════════════════════════════════

  /** Wspólna logika: dodaj element + broadcast + history */
  const createElement = useCallback((element: DrawingElement) => {
    engine.createElements([element]);
  }, [engine]);

  const handlePathCreate = useCallback(
    (path: DrawingPath) => {
      // Oblicz bbox raz przy zakończeniu rysowania — pętla renderowania użyje cache
      const withBbox: DrawingPath = { ...path, bbox: computePathBbox(path) };
      createElement(withBbox);
    },
    [createElement]
  );

  const handleShapeCreate = useCallback(
    (shape: Shape) => createElement(shape),
    [createElement]
  );

  const handleFunctionCreate = useCallback(
    (func: FunctionPlot) => createElement(func),
    [createElement]
  );

  const handleArrowCreate = useCallback(
    (arrow: ArrowElement) => createElement(arrow as DrawingElement),
    [createElement]
  );

  const handleImageCreate = useCallback((image: ImageElement) => {
    if (engine.isReadOnly) return;
    engine.createElements([image]);
    if (image.src) el.loadImage(image.id, image.src);
    setTool('select');
  }, [engine, el.loadImage]);

  // ─── SmartSearch handlers ──────────────────────────────────────────────────

  const handleFormulaSelect = useCallback((formula: FormulaResource) => {
    const img = new Image();
    img.src = formula.path;
    img.onload = () => {
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      const worldWidth = 12.0; // 2x większe niż 6.0
      const worldHeight = worldWidth * aspectRatio;
      const centerWorld = inverseTransformPoint(
        { x: canvasWidth / 2, y: canvasHeight / 2 },
        vp.viewportRef.current,
        canvasWidth,
        canvasHeight
      );
      const newImage: ImageElement = {
        id: `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        x: centerWorld.x - worldWidth / 2,
        y: centerWorld.y - worldHeight / 2,
        width: worldWidth,
        height: worldHeight,
        src: formula.path,
        alt: formula.title,
      };
      handleImageCreate(newImage);
      setIsBottomToastExiting(false);
      setBottomToastState({
        id: Date.now() + Math.floor(Math.random() * 1000),
        message: `Dodano: ${formula.title}`,
      });
    };
  }, [canvasWidth, canvasHeight, vp.viewportRef, handleImageCreate]);

  const handleCardSelect = useCallback((card: CardResource) => {
    setActiveCard(card);
  }, []);

  const handleChatbotAddToBoard = useCallback((content: string) => {
    const centerWorld = engine.centerOfViewport();
    const noteWidth = 5;
    const noteHeight = 4;
    const newNote: MarkdownNote = {
      id: `chatbot-note-${Date.now()}`,
      type: 'markdown',
      x: centerWorld.x - noteWidth / 2,
      y: centerWorld.y - noteHeight / 2,
      width: noteWidth,
      height: noteHeight,
      content,
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
    };
    engine.createElements([newNote]);
  }, [engine]);

  const handleAddFormulasFromCard = useCallback((formulas: FormulaResource[]) => {
    const COLS = 2, WORLD_WIDTH = 12.0, WORLD_PADDING = 1.0; // 2x większe niż poprzednie 6.0
    const centerWorld = inverseTransformPoint(
      { x: canvasWidth / 2, y: canvasHeight / 2 },
      vp.viewportRef.current,
      canvasWidth,
      canvasHeight
    );
    const imagePromises = formulas.map((formula, index) =>
      new Promise<{ formula: FormulaResource; img: HTMLImageElement; index: number }>((resolve, reject) => {
        const img = new Image();
        img.src = formula.path;
        img.onload = () => resolve({ formula, img, index });
        img.onerror = () => reject(new Error(`Failed to load: ${formula.path}`));
      })
    );
    Promise.allSettled(imagePromises)
      .then((results) => {
        const loaded = results
          .filter((res): res is PromiseFulfilledResult<{ formula: FormulaResource; img: HTMLImageElement; index: number }> => res.status === 'fulfilled')
          .map(res => res.value);
        
        if (loaded.length === 0) return; // all failed

        const newImages = loaded.map(({ formula, img, index }) => {
          const aspectRatio = img.naturalHeight / img.naturalWidth;
          const worldHeight = WORLD_WIDTH * aspectRatio;
          const col = index % COLS;
          const row = Math.floor(index / COLS);
          const startX = centerWorld.x - ((COLS - 1) * (WORLD_WIDTH + WORLD_PADDING)) / 2;
          const startY = centerWorld.y - 2;
          const imageEl: ImageElement = {
            id: `formula-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'image',
            x: startX + col * (WORLD_WIDTH + WORLD_PADDING) - WORLD_WIDTH / 2,
            y: startY + row * (worldHeight + WORLD_PADDING),
            width: WORLD_WIDTH,
            height: worldHeight,
            src: formula.path,
            alt: formula.title,
          };
          return { imageEl, img };
        });
        const elements = newImages.map(({ imageEl }) => imageEl);
        // Jedno grupowe cofnięcie (Ctrl+Z usuwa całą wklejoną kartę naraz)
        engine.createElements(elements);
        elements.forEach((imageEl) => el.loadImage(imageEl.id, imageEl.src!));
        const toastMessage =
          loaded.length === 1
            ? `Dodano: ${loaded[0].formula.title}`
            : `Dodano: ${loaded.length} elementow z karty`;
        setIsBottomToastExiting(false);
        setBottomToastState({
          id: Date.now() + Math.floor(Math.random() * 1000),
          message: toastMessage,
        });
        setActiveCard(null);
      })
      .catch((err) => {
        console.error('❌ Błąd ładowania wzorów z karty:', err);
        setActiveCard(null);
      });
  }, [canvasWidth, canvasHeight, vp.viewportRef, el, engine]);

  /**
   * Wklejanie obrazka ze schowka systemowego (screenshot, Ctrl+C z przeglądarki itp.).
   * Czyta navigator.clipboard.read() i tworzy ImageElement w centrum widoku.
   * Zwraca true jeśli obraz został wklejony, false gdy schowek nie zawiera obrazka.
   */
  const handleOsClipboardPaste = useCallback(async (): Promise<boolean> => {
    if (userRole === 'viewer') return false;
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        // Blob → base64 data URL
        const data: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        // Pobierz naturalne wymiary obrazka
        const { width: imgW, height: imgH } = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.src = data;
        });
        const centerWorld = inverseTransformPoint(
          { x: canvasWidth / 2, y: canvasHeight / 2 },
          vp.viewportRef.current,
          canvasWidth,
          canvasHeight
        );
        const aspectRatio = imgH / Math.max(imgW, 1);
        const worldWidth = 5.0;
        const worldHeight = worldWidth * aspectRatio;
        const newImage: ImageElement = {
          id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
          type: 'image',
          x: centerWorld.x - worldWidth / 2,
          y: centerWorld.y - worldHeight / 2,
          width: worldWidth,
          height: worldHeight,
          src: data,
          alt: 'Pasted image',
        };
        handleImageCreate(newImage);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [userRole, canvasWidth, canvasHeight, vp.viewportRef, handleImageCreate]);

  // Ref — umożliwia wywołanie w async then-chain wewnątrz useEffect (keydown handler)
  const handleOsClipboardPasteRef = useRef(handleOsClipboardPaste);
  useEffect(() => { handleOsClipboardPasteRef.current = handleOsClipboardPaste; }, [handleOsClipboardPaste]);

  const handleMarkdownNoteCreate = useCallback((note: MarkdownNote) => {
    if (engine.isReadOnly) return;
    engine.createElements([note]);
    setTool('select');
    sel.setSelectedElementIds(new Set([note.id]));
    sel.setEditingMarkdownId(note.id);
  }, [engine, sel.setSelectedElementIds, sel.setEditingMarkdownId]);

  const handleTableCreate = useCallback((table: TableElement) => {
    if (engine.isReadOnly) return;
    engine.createElements([table]);
    setTool('select');
    sel.setSelectedElementIds(new Set([table.id]));
  }, [engine, sel.setSelectedElementIds]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERY TextTool
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTextCreate = useCallback(
    (text: TextElement) => createElement(text),
    [createElement]
  );

  const handleTextUpdate = useCallback((id: string, updates: Partial<TextElement>) => {
    if (userRole === 'viewer') return;
    const current = el.elementsRef.current.find((e) => e.id === id);
    if (!current) return;
    const updated = { ...current, ...updates } as DrawingElement;
    el.updateElement(updated);
    el.markUnsaved([id]);
    rt.broadcastElementUpdated(updated);
  }, [userRole, el.elementsRef, el.updateElement, el.markUnsaved, rt.broadcastElementUpdated]);

  const handleTextDelete = useCallback((id: string) => {
    const current = engine.getById(id);
    if (!current) return;
    engine.deleteElements([current]);
  }, [engine]);

  const handleEditingComplete = useCallback(() => {
    sel.setEditingTextId(null);
    if (userRole !== 'viewer') setTool('select');
  }, [sel.setEditingTextId, userRole]);

  const handleTextEdit = useCallback((id: string) => {
    sel.setEditingTextId(id);
    setTool('text');
  }, [sel.setEditingTextId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERY SelectTool
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    sel.setSelectedElementIds(ids);
  }, [sel.setSelectedElementIds]);

  /** Szybki update bez historii (podczas przeciągania) */
  const handleElementUpdate = useCallback((id: string, updates: Partial<DrawingElement>) => {
    if (userRole === 'viewer') return;
    const current = el.elementsRef.current.find((e) => e.id === id);
    if (!current) return;
    el.updateElement({ ...current, ...updates } as DrawingElement);
  }, [userRole, el.elementsRef, el.updateElement]);

  // Podpina handleElementUpdate do renderStateRef żeby redrawCanvas miał zawsze świeżą wersję
  useEffect(() => {
    renderStateRef.current.handleElementUpdate = handleElementUpdate;
  }, [handleElementUpdate]);

  /** Update z historią (po zakończeniu przeciągania / zmianie rozmiaru) */
  const handleElementUpdateWithHistory = useCallback(
    (id: string, updates: Partial<DrawingElement>) => {
      if (engine.isReadOnly) return;
      const current = engine.getById(id);
      if (!current) return;
      const updated = { ...current, ...updates } as DrawingElement;
      engine.updateElements([current], [updated]);
    },
    [engine]
  );

  /** Batch update LIVE (SelectTool przesuwa wiele elementów naraz, bez historii) */
  const handleElementsUpdate = useCallback(
    (updates: Map<string, Partial<DrawingElement>>) => {
      engine.updateElementsLive(updates);
    },
    [engine]
  );
  
  /** Wywoływane przez SelectTool po zakończeniu operacji (mouseup) */
  const handleSelectionFinish = useCallback((originalElementsMap?: Map<string, DrawingElement>) => {
    if (engine.isReadOnly || !originalElementsMap || originalElementsMap.size === 0) return;
    const current = engine.getElements();
    const before: DrawingElement[] = [];
    const after: DrawingElement[] = [];
    for (const id of sel.selectedElementIdsRef.current) {
      const b = originalElementsMap.get(id);
      const a = current.find((e) => e.id === id);
      if (b && a && JSON.stringify(b) !== JSON.stringify(a)) {
        before.push(b);
        after.push(a);
      }
    }
    // Commit tylko realnie zmienionych elementów — silnik robi persist + broadcast
    // + zapis komendy (UpdateElementsCommand) + legacy snapshot.
    if (after.length > 0) engine.updateElements(before, after);
  }, [engine, sel.selectedElementIdsRef]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLER EraserTool
  // ═══════════════════════════════════════════════════════════════════════════

  const handleElementDelete = useCallback((id: string) => {
    const current = engine.getById(id);
    if (!current) return;
    engine.deleteElements([current]);
  }, [engine]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERY HTML OVERLAYS (Markdown + Table)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleMarkdownContentChange = useCallback((noteId: string, content: string) => {
    if (userRole === 'viewer') return;
    const current = el.elementsRef.current.find((e) => e.id === noteId);
    if (!current || current.type !== 'markdown') return;
    const updated = { ...current, content } as DrawingElement;
    el.updateElement(updated);
    el.markUnsaved([noteId]);
    rt.broadcastElementUpdated(updated);
  }, [userRole, el.elementsRef, el.updateElement, el.markUnsaved, rt.broadcastElementUpdated]);

  const handleMarkdownEditStart = useCallback((noteId: string) => {
    sel.setEditingMarkdownId(noteId);
    rt.broadcastTypingStarted(noteId);
  }, [sel.setEditingMarkdownId, rt.broadcastTypingStarted]);

  const handleMarkdownEditEnd = useCallback(() => {
    const editingId = sel.editingMarkdownId;
    if (editingId) rt.broadcastTypingStopped(editingId);
    sel.setEditingMarkdownId(null);
  }, [sel.editingMarkdownId, sel.setEditingMarkdownId, rt.broadcastTypingStopped]);

  const handleTableCellChange = useCallback(
    (tableId: string, row: number, col: number, value: string) => {
      if (userRole === 'viewer') return;
      const current = el.elementsRef.current.find((e) => e.id === tableId);
      if (!current || current.type !== 'table') return;
      const table = current as TableElement;
      const newCells = table.cells.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? value : c)) : [...r]
      );
      const updated = { ...table, cells: newCells } as DrawingElement;
      el.updateElement(updated);
      el.markUnsaved([tableId]);
      rt.broadcastElementUpdated(updated);
    },
    [userRole, el.elementsRef, el.updateElement, el.markUnsaved, rt.broadcastElementUpdated]
  );

  /** Przechodzi do następnej komórki tabeli (Tab) lub zamyka edytor (Enter/Escape) */
  const openCellEditor = useCallback((tableId: string, row: number, col: number) => {
    setEditingTableCell({ tableId, row, col });
  }, []);

  const handleCellEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const editing = editingTableCellRef.current;
    if (!editing) return;
    const table = el.elementsRef.current.find((el) => el.id === editing.tableId) as TableElement | undefined;
    if (!table) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = editing.col + 1;
      const nextRow = editing.row + 1;
      if (nextCol < table.cols) {
        openCellEditor(editing.tableId, editing.row, nextCol);
      } else if (nextRow < table.rows) {
        openCellEditor(editing.tableId, nextRow, 0);
      } else {
        setEditingTableCell(null);
      }
    } else if (e.key === 'Escape') {
      setEditingTableCell(null);
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter kończy edytowanie
      setEditingTableCell(null);
    }
    // Zwykły Enter (bez Shift) dodaje nową linię w textarea
  }, [el.elementsRef, openCellEditor]);

  // ═══════════════════════════════════════════════════════════════════════════
  // USUWANIE ZAZNACZONYCH
  // ═══════════════════════════════════════════════════════════════════════════

  const deleteSelectedElements = useCallback(() => {
    const elementsToDelete = Array.from(sel.selectedElementIdsRef.current)
      .map((id) => engine.getById(id))
      .filter((e): e is DrawingElement => e !== undefined);
    if (elementsToDelete.length === 0) return;
    engine.deleteElements(elementsToDelete); // lokalnie + historia + broadcast/baza w chunkach
    engine.clearSelection();
  }, [engine, sel.selectedElementIdsRef]);

  // Aktualizuj ref (używany w keyDown handler)
  const deleteSelectedElementsRef = useRef<() => void>(deleteSelectedElements);
  useEffect(() => {
    deleteSelectedElementsRef.current = deleteSelectedElements;
  }, [deleteSelectedElements]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ZOOM CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  const resetView = useCallback(() => {
    const neutral = constrainViewport({ x: 0, y: 0, scale: 1 });
    vp.viewportRef.current = neutral;
    vp.setViewport(neutral);
  }, [vp.setViewport, vp.viewportRef]);

  const zoomIn = useCallback(() => {
    vp.setViewport((prev: ViewportTransform) =>
      constrainViewport({ ...prev, scale: Math.min(prev.scale * 1.2, 5.0) })
    );
  }, [vp.setViewport]);

  const zoomOut = useCallback(() => {
    vp.setViewport((prev: ViewportTransform) =>
      constrainViewport({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) })
    );
  }, [vp.setViewport]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR CANVAS
  // ═══════════════════════════════════════════════════════════════════════════

  const clearCanvas = useCallback(() => {
    const snapshot = [...engine.getElements()];
    if (snapshot.length === 0) return;
    engine.deleteElements(snapshot); // lokalnie + historia + broadcast/baza w chunkach
    engine.clearSelection();
  }, [engine]);

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE TOOL WRAPPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleImageToolPaste = useCallback(() => {
    imageToolRef.current?.handlePasteFromClipboard();
  }, []);

  const handleImageToolUpload = useCallback(() => {
    imageToolRef.current?.triggerFileUpload();
  }, []);

  // Rejestruj akcje narzędzia Obraz w store — używa ich panel ImageProperties
  // (renderowany w toolbarze, poza zasięgiem imageToolRef). pdfUpload = upload.
  useEffect(() => {
    setImageActions({
      paste: handleImageToolPaste,
      upload: handleImageToolUpload,
      pdfUpload: handleImageToolUpload,
    });
  }, [setImageActions, handleImageToolPaste, handleImageToolUpload]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FOLLOW MODE
  // ═══════════════════════════════════════════════════════════════════════════

  const handleFollowUser = useCallback(
    (userId: number, x: number, y: number, scale: number) => {
      vp.handleFollowUser(userId, x, y, scale);
    },
    [vp.handleFollowUser]
  );

  const handleStopFollowing = useCallback(() => {
    vp.handleStopFollowing();
  }, [vp.handleStopFollowing]);


// ═══════════════════════════════════════════════════════════════════════════
  // DRAG & DROP (Globalny nasłuchiwacz na całe okno)
  // ═══════════════════════════════════════════════════════════════════════════
 // ═══════════════════════════════════════════════════════════════════════════
  // DRAG & DROP (Globalny nasłuchiwacz na całe okno)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (userRole === 'viewer') return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault(); // 🔥 KRYTYCZNE: Blokuje otwieranie pliku w nowej karcie!
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';

        // Odrzucamy pliki, które nie są obrazkiem ani PDF-em
        if (!isImage && !isPdf) return;
        
        const rect = containerRef.current?.getBoundingClientRect();
        const mouseX = e.clientX - (rect?.left || 0);
        const mouseY = e.clientY - (rect?.top || 0);
        const worldPos = inverseTransformPoint(
          { x: mouseX, y: mouseY }, vp.viewportRef.current, canvasWidth, canvasHeight
        );

        // 📄 OBSŁUGA PDF (Drag & Drop)
        if (isPdf) {
          try {
            // Dynamiczny import - ładujemy bibliotekę dopiero gdy user wrzuci PDF
            const pdfjs = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            
            const worldWidth = 5.0;
            const padding = 0.5; // Odstęp między wygenerowanymi stronami
            let currentY = worldPos.y; // Zaczynamy dokładnie tam, gdzie upuszczono plik

            // Konwertujemy każdą stronę PDF na obrazek
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const pdfViewport = page.getViewport({ scale: 2.0 }); // Skala 2x dla lepszej czytelności
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (!context) continue;

              canvas.width = pdfViewport.width;
              canvas.height = pdfViewport.height;

              await page.render({
                canvasContext: context,
                viewport: pdfViewport,
                canvas: canvas,
              }).promise;

              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              const aspectRatio = pdfViewport.height / Math.max(pdfViewport.width, 1);
              const worldHeight = worldWidth * aspectRatio;

              const newImage: ImageElement = {
                id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
                type: 'image',
                x: worldPos.x - worldWidth / 2,
                y: currentY,
                width: worldWidth, 
                height: worldHeight, 
                src: dataUrl, 
                alt: `${file.name} - strona ${i}`,
              };
              
              handleImageCreate(newImage);
              currentY += worldHeight + padding; // Przesuwamy wskaźnik Y dla następnej strony
              
              // Bardzo krótkie opóźnienie, aby state wyrobił przy dużych dokumentach i nie zgubił obrazków
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          } catch (error) {
            console.error('Błąd podczas ładowania PDF:', error);
          }
        } 
        // 🖼️ OBSŁUGA ZWYKŁYCH OBRAZKÓW (Drag & Drop)
        else if (isImage) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.naturalHeight / Math.max(img.naturalWidth, 1);
              const worldWidth = 5.0;
              const worldHeight = worldWidth * aspectRatio;
              
              const newImage: ImageElement = {
                id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
                type: 'image',
                x: worldPos.x - worldWidth / 2,
                y: worldPos.y - worldHeight / 2,
                width: worldWidth, 
                height: worldHeight, 
                src: dataUrl, 
                alt: file.name,
              };
              handleImageCreate(newImage);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [userRole, canvasWidth, canvasHeight, vp.viewportRef, handleImageCreate]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HOST CONTEXT — gniazdko dla aktywnego narzędzia (wtyczki z rejestru)
  // ═══════════════════════════════════════════════════════════════════════════
  // Zbiera silnik + reaktywny stan + refy + istniejące handlery w jeden obiekt.
  // Konsumuje go tylko zamontowany overlay (<ActiveToolOverlay/>), więc zmiany
  // reaktywne re-renderują wyłącznie aktywne narzędzie (jak dawna drabinka).
  const hostValue = useMemo<ToolHostContextValue>(() => ({
    engine,
    viewport: vp.viewport,
    viewportRef: vp.viewportRef,
    canvasWidth,
    canvasHeight,
    isGestureActive,
    onViewportChange: handleViewportChange,
    elements: el.elements,
    selectedIds: sel.selectedElementIds,
    editingTextId: sel.editingTextId,
    overlaysVisible,
    htmlOverlaysRef,
    textEditorDivRef,
    imageToolRef,
    onPathCreate: handlePathCreate,
    onShapeCreate: handleShapeCreate,
    onFunctionCreate: handleFunctionCreate,
    onImageCreate: handleImageCreate,
    onNoteCreate: handleMarkdownNoteCreate,
    onTableCreate: handleTableCreate,
    onArrowCreate: handleArrowCreate,
    onTextCreate: handleTextCreate,
    onTextUpdate: handleTextUpdate,
    onTextDelete: handleTextDelete,
    onEditingComplete: handleEditingComplete,
    onTextEdit: handleTextEdit,
    onSelectionChange: handleSelectionChange,
    onElementUpdate: handleElementUpdate,
    onElementUpdateWithHistory: handleElementUpdateWithHistory,
    onElementsUpdate: handleElementsUpdate,
    onOperationFinish: handleSelectionFinish,
    onMarkdownEdit: handleMarkdownEditStart,
    onActiveGuidesChange: setActiveGuides,
    onDeleteSelected: deleteSelectedElements,
    onCopySelected: clip.handleCopy,
    onDuplicateSelected: clip.handleDuplicate,
    onSaveGroupTemplate: handleSaveGroupTemplate,
    onElementDelete: handleElementDelete,
    onPanStart: hideOverlaysForPan,
    onPanEnd: restoreOverlaysAfterPan,
  }), [
    engine, vp.viewport, vp.viewportRef, canvasWidth, canvasHeight, isGestureActive,
    handleViewportChange, el.elements, sel.selectedElementIds, sel.editingTextId, overlaysVisible,
    handlePathCreate, handleShapeCreate, handleFunctionCreate, handleImageCreate,
    handleMarkdownNoteCreate, handleTableCreate, handleArrowCreate, handleTextCreate,
    handleTextUpdate, handleTextDelete, handleEditingComplete, handleTextEdit,
    handleSelectionChange, handleElementUpdate, handleElementUpdateWithHistory, handleElementsUpdate,
    handleSelectionFinish, handleMarkdownEditStart, deleteSelectedElements,
    clip.handleCopy, clip.handleDuplicate, handleSaveGroupTemplate, handleElementDelete,
    hideOverlaysForPan, restoreOverlaysAfterPan,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className={`relative w-full h-full bg-[#FEF2F2] ${className}`}>

      {/* Loading overlay — zakrywa canvas aż elementy się załadują */}
      <LoadingOverlay isLoading={el.isLoading} progress={el.loadingProgress} />

    {/* Wewnętrzny kontener (narzędzia, overlaye, canvas) */}
      <div
        ref={containerRef}
        tabIndex={-1}
        className="absolute inset-0 overflow-hidden touch-none overscroll-none outline-none"
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={handleAssetDragOver}
        onDrop={(e) => {
          handleAssetDropCenter(e);
        }}       
        style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
      >

        {/* ── ONLINE USERS ──────────────────────────────────────────────── */}
        <OnlineUsers
          onFollowUser={handleFollowUser}
          onStopFollowing={handleStopFollowing}
          followingUserId={vp.followingUserId}
          userRole={userRole}
          isHistoryOpen={isHistoryOpen}
          onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
        />

        {/* ── FOLLOW MODE BANNER (Minimalist Version) ────────────────────────── */}
        {vp.followingUserId && (
          <div className="absolute top-20 right-6 z-50 flex items-center gap-4 px-4 py-2 bg-white border border-zinc-200 shadow-sm rounded-full">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-zinc-800 rounded-full" /> {/* Dyskretny wskaźnik zamiast emoji */}
              <span className="text-[13px] font-medium text-zinc-600 tracking-tight">
                Śledzisz użytkownika
              </span>
            </div>
            
            <div className="w-[1px] h-4 bg-zinc-200" /> {/* Separator */}

            <button
              onClick={handleStopFollowing}
              className="text-[13px] font-bold text-zinc-900 hover:text-red-600 transition-colors duration-200"
            >
              Przestań śledzić
            </button>
          </div>
        )}

        {/* ── SMARTSEARCH BAR ───────────────────────────────────────────── */}
        {userRole !== 'viewer' && settings.smartsearch_visible && !(isSidebarOpen && windowWidth <= 1140) && (
          <div
            className="absolute z-50 pointer-events-auto"
            style={{
              top: '16px',
              left:
                windowWidth <= 760
                  ? '82px'
                  : windowWidth <= 1299
                    ? '90px'
                    : windowWidth <= 1640
                      ? '350px'
                      : '50%',
              transform:
                windowWidth <= 760
                  ? 'none'
                  : windowWidth <= 1299
                    ? 'none'
                    : windowWidth <= 1640
                      ? 'none'
                      : 'translateX(-50%)',
              right:
                windowWidth <= 600
                  ? '50px'
                  : windowWidth <= 760
                    ? '350px'
                  : windowWidth <= 1299
                    ? '380px'
                    : windowWidth <= 1640
                      ? '470px'
                      : 'auto',
              maxWidth:
                windowWidth <= 600
                  ? 'calc(100vw - 82px - 50px)'
                  : windowWidth <= 760
                    ? 'calc(100vw - 82px - 350px)'
                  : windowWidth <= 1300
                    ? 'calc(100vw - 90px - 380px)'
                    : windowWidth <= 1640
                      ? 'calc(100vw - 300px - 420px)'
                      : '900px',
            }}
          >
            <SmartSearchBar
              onFormulaSelect={handleFormulaSelect}
              onCardSelect={handleCardSelect}
              onActiveChange={setIsSearchActive}
              userRole={userRole}
              browseButtonPlacement="outside-right"
            />
          </div>
        )}

        {/* ── CARD VIEWER MODAL ─────────────────────────────────────────── */}
        {activeCard && (
          <CardViewer
            card={activeCard}
            onClose={() => setActiveCard(null)}
            onAddFormulas={handleAddFormulasFromCard}
            onActiveChange={setIsCardViewerActive}
          />
        )}

        {/* ── VIEWER BANNER ─────────────────────────────────────────────── */}
        {userRole === 'viewer' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[150] bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-lg shadow-md flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="font-medium">Tryb tylko do odczytu</span>
          </div>
        )}

        {/* ── TOOLBAR ───────────────────────────────────────────────────── */}
        {settings.toolbar_visible && (
          <Toolbar
            onUndo={hist.undo}
            onRedo={hist.redo}
            onClear={clearCanvas}
            canUndo={hist.canUndo}
            canRedo={hist.canRedo}
            hasSelection={sel.selectedElementIds.size > 0}
            onDeleteSelected={deleteSelectedElements}
            onToggleAssetsLibrary={() => setShowAssetsLibrary(v => !v)}
            isCalculatorOpen={isCalculatorOpen}
            onCalculatorToggle={() => setIsCalculatorOpen((v) => !v)}
            isReadOnly={userRole === 'viewer'}
            leftOffset={toolbarLeftOffset}
          />
        )}

        {/* ── ZOOM CONTROLS ─────────────────────────────────────────────── */}
        <ZoomControls
          zoom={vp.viewport.scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
        />

        {/* ═══════════════════════════════════════════════════════════════
            NARZĘDZIE AKTYWNE — jeden slot z rejestru (zastępuje drabinkę).
            ActiveToolOverlay czyta activeTool ze store, znajduje definicję
            w rejestrze i renderuje jej Overlay, pobierający stan/handlery
            z ToolHostProvider. Dodanie narzędzia nie wymaga zmian tutaj.
            ═══════════════════════════════════════════════════════════════ */}
        <ToolHostProvider value={hostValue}>
          <ActiveToolOverlay />
        </ToolHostProvider>

        {/* ═══════════════════════════════════════════════════════════════
            HTML OVERLAY (Markdown) — notatki pozycjonowane w world-pixels (×100).
            Transform wrappera aktualizowany synchronicznie z canvas RAF → zero lagu.
            Każda notatka: left=x×100 top=y×100, wrapper skaluje przez viewport.
            Tabela: renderowana wyłącznie na canvasie (drawTable).
            ═══════════════════════════════════════════════════════════════ */}
        <div
          ref={mdTableOverlaysRef}
          style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', pointerEvents: 'none', overflow: 'visible' }}
        >
          {canvasWidth > 0 &&
            el.elements
              .filter((e) => e.type === 'markdown')
              .map((e) => {
                const note = e as MarkdownNote;
                const isBeingEdited = sel.editingMarkdownId === note.id;
                const contentScale = note.contentScale ?? 1;

                return (
                  <div
                    key={note.id}
                    className="absolute rounded-lg shadow-lg border overflow-hidden backdrop-blur-md"
                    style={{
                      left: note.x * 100,
                      top: note.y * 100,
                      width: note.width * 100,
                      height: note.height * 100,
                      backgroundColor: note.backgroundColor || 'rgba(255, 255, 255, 0.75)',
                      borderColor: note.borderColor || 'rgba(229, 231, 235, 0.8)',
                      pointerEvents: isBeingEdited ? 'auto' : 'none',
                      zIndex: isBeingEdited ? 50 : 10,
                    }}
                  >
                    {/* Inner wrapper dla contentScale (rozmiar tekstu wewnątrz notki) */}
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
                        remoteTypingUser={
                          rt.typingUsers.find((t) => t.elementId === note.id)?.username
                        }
                      />
                    </div>
                  </div>
                );
              })}
        </div>

        

        {/* ═══════════════════════════════════════════════════════════════
            CANVAS — pointer-events: none
            Narzędzia mają własne pełnoekranowe overlaye powyżej canvasa.
            Canvas tylko RYSUJE — nie obsługuje eventów myszy/dotyku.
            ═══════════════════════════════════════════════════════════════ */}
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor: getTool(tool)?.cursor ?? 'default',
            willChange: 'auto',
            imageRendering: 'crisp-edges',
            pointerEvents: 'none',
          }}
        />

          

        {/* ── EDYTOR KOMÓRKI TABELI ──────────────────────────── */}
        {editingTableCell && (() => {
          const table = el.elements.find((e) => e.id === editingTableCell.tableId) as TableElement | undefined;
          if (!table) return null;
          const cellValue = table.cells[editingTableCell.row]?.[editingTableCell.col] ?? '';
          const isHeader = editingTableCell.row === 0 && (table.headerRow ?? false);
          // Pozycja liczona dynamicznie z bieżącego vp.viewport — edytor zawsze
          // zostaje wyrównany do komórki nawet po pan/zoom (brak frozen screen coords)
          const cellW = table.width / table.cols;
          const cellH = table.height / table.rows;
          const tl = transformPoint(
            { x: table.x + editingTableCell.col * cellW, y: table.y + editingTableCell.row * cellH },
            vp.viewport, canvasWidth, canvasHeight
          );
          const br = transformPoint(
            { x: table.x + (editingTableCell.col + 1) * cellW, y: table.y + (editingTableCell.row + 1) * cellH },
            vp.viewport, canvasWidth, canvasHeight
          );
          const cellScreenW = br.x - tl.x;
          const cellScreenH = br.y - tl.y;
          return (
            <textarea
              ref={cellEditorInputRef}
              defaultValue={cellValue}
              onChange={(e) =>
                handleTableCellChange(
                  editingTableCell.tableId,
                  editingTableCell.row,
                  editingTableCell.col,
                  e.target.value
                )
              }
              onBlur={() => setEditingTableCell(null)}
              onKeyDown={handleCellEditorKeyDown}
              className="absolute z-[100] border-2 border-blue-500 outline-none px-1 resize-none no-scrollbar"
              style={{
                left:       tl.x,
                top:        tl.y,
                width:      cellScreenW,
                height:     cellScreenH,
                fontSize:   Math.max(10, Math.min(cellScreenH * 0.42, 30)),
                background: isHeader ? (table.headerBgColor || '#f3f4f6') : '#fff',
                fontWeight: isHeader ? 700 : 400,
                color:      '#111827',
                boxSizing:  'border-box',
                whiteSpace: 'pre-wrap',
                wordBreak:  'break-word',
                lineHeight: '1.2',
              }}
            />
          );
        })()}

        {/* ── KURSORY INNYCH UŻYTKOWNIKÓW ───────────────────────────────── */}
        {canvasWidth > 0 && (
          <div
            ref={remoteCursorsRef}
            style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', pointerEvents: 'none', overflow: 'visible' }}
          >
            {/* transform ustawiany synchronicznie w redrawCanvas — zero lagu */}
            <RemoteCursorsContainer />
          </div>
        )}

        {/* ── KALKULATOR ────────────────────────────────────────────────── */}
        {isCalculatorOpen && canvasWidth > 0 && (
          <CalculatorTool
            viewport={vp.viewport}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onViewportChange={handleViewportChange}
            onClose={() => setIsCalculatorOpen(false)}
          />
        )}

        {/* ── HISTORIA AKTYWNOŚCI ───────────────────────────────────────── */}
        {isHistoryOpen && (
          <ActivityHistory
            elements={el.elementsWithAuthor}
            viewport={vp.viewport}
            onCenterView={handleCenterViewAndSelectElements}
            onSelectElements={handleSelectElementsFromHistory}
            onClose={() => setIsHistoryOpen(false)}
          />
        )}

        {/* ── SNAP GUIDES ───────────────────────────────────────────────── */}
        <SnapGuides
          guides={activeGuides}
          viewport={vp.viewport}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />

        {/* ── STATUS INDICATORS ─────────────────────────────────────────── */}
        <StatusIndicators
          isSaving={el.isSaving}
          unsavedCount={el.unsavedElements.size}
          isConnected={rt.isConnected}
        />

        {/* ── MATH CHATBOT ──────────────────────────────────────────────── */}
        {settings.ai_enabled && (
          <MathChatbot
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onAddToBoard={handleChatbotAddToBoard}
            messages={chatMessages}
            setMessages={setChatMessages}
            onActiveChange={setIsCardViewerActive}
            userRole={userRole}
          />
        )}

        {bottomToastState && (
          <div className="fixed inset-x-0 bottom-8 z-[1200] pointer-events-none flex justify-center px-4">
            <div className={`whiteboard-toast-base ${isBottomToastExiting ? 'whiteboard-toast-exit' : 'whiteboard-toast-enter'}`}>
              {bottomToastState.message}
            </div>
          </div>
        )}

        {windowWidth > 0 && (windowWidth <= 320 || windowHeight <= 600) && (
          <div className="absolute inset-0 z-[1300] flex items-center justify-center px-6 text-center bg-[#FEF2F2]/95 backdrop-blur-[1px]">
            <div className="max-w-sm rounded-2xl border border-gray-300 bg-white/95 shadow-[0_10px_30px_rgba(0,0,0,0.12)] px-5 py-6">
              <p className="text-sm font-semibold text-gray-900 mb-2">Zbyt mały obszar roboczy</p>
              <p className="text-sm text-gray-600">
                Aby korzystać z aplikacji, zwiększ okno przeglądarki.
              </p>
            </div>
          </div>
        )}

        {/* ── PANEL BIBLIOTEKI SZABLONÓW ──────────────────────────────────── */}
        {showAssetsLibrary && (
          <SavedAssetsPanel onClose={() => setShowAssetsLibrary(false)} refreshKey={assetsRefreshKey} />
        )}

        {/* ── MODAL ZAPISU SZABLONU ────────────────────────────────────────── */}
        {assetModalOpen && (
          <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center pointer-events-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 p-4 border-b">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                  <FolderPlus size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Zapisz jako szablon</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Nazwij ten szablon ({frozenElementsForAsset.length} elementów), aby zapisać go do szybciej biblioteki i używać na innych tablicach.
                </p>
                <input
                  autoFocus
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Np. Wykres z fizyki..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitSaveAsset();
                    if (e.key === 'Escape') setAssetModalOpen(false);
                  }}
                />
              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                <button
                  onClick={() => setAssetModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={submitSaveAsset}
                  disabled={!assetName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Zapisz szablon
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Kursory narzędzi pochodzą teraz z rejestru (ToolDefinition.cursor) —
// patrz tools/registry.ts. Stara funkcja toolToCursor została usunięta.