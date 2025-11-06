/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/ImageTool.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, useRef, useCallback, useEffect)
 * - lucide-react (ikony: Upload, Clipboard, X, ImageIcon)
 * - ../whiteboard/types (Point, ViewportTransform, ImageElement)
 * - ../whiteboard/viewport (inverseTransformPoint, transformPoint, zoomViewport, panViewportWithWheel, constrainViewport)
 * 
 * EKSPORTUJE:
 * - ImageTool (component) - narzędzie wstawiania obrazów
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (aktywne gdy tool === 'image')
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - używa ImageElement
 * - viewport.ts - używa funkcji transformacji i zoom/pan
 * - WhiteboardCanvas.tsx - dostarcza callback: onImageCreate
 * 
 * ⚠️ WAŻNE - WHEEL EVENTS:
 * - Overlay ma touchAction: 'none' - blokuje domyślny zoom przeglądarki
 * - onWheel obsługuje zoom (Ctrl+scroll) i pan (scroll)
 * - Współdzieli viewport z WhiteboardCanvas przez onViewportChange
 * 
 * PRZEZNACZENIE:
 * Wstawianie obrazów na tablicę przez:
 * 1. Wklejenie ze schowka (Ctrl+V lub przycisk)
 * 2. Upload pliku (przycisk wyboru pliku)
 * 3. Drag & drop pliku z eksploratora
 * 
 * Konwersja obrazu do base64 i kompresja jeśli > 500KB.
 * ============================================================================
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Clipboard, X, ImageIcon } from 'lucide-react';
import { Point, ViewportTransform, ImageElement } from '../whiteboard/types';
import { inverseTransformPoint, transformPoint, zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';

interface ImageToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onImageCreate: (image: ImageElement) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

interface ImageDraft {
  id: string;
  screenStart: Point;
  screenEnd: Point;
  worldStart: Point;
  worldEnd: Point;
  imageData: string | null; // base64
  originalWidth: number;
  originalHeight: number;
}

export function ImageTool({
  viewport,
  canvasWidth,
  canvasHeight,
  onImageCreate,
  onViewportChange,
}: ImageToolProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [imageDraft, setImageDraft] = useState<ImageDraft | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🆕 Handler dla wheel event - obsługuje zoom i pan
  const handleWheel = (e: React.WheelEvent) => {
    if (!onViewportChange) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (e.ctrlKey) {
      // Zoom
      const newViewport = zoomViewport(viewport, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight);
      onViewportChange(constrainViewport(newViewport));
    } else {
      // Pan
      const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
      onViewportChange(constrainViewport(newViewport));
    }
  };

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
            width: img.width,  // Oryginalne wymiary (do proporcji)
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

  // 📋 Wklej ze schowka (Clipboard API)
  const handlePasteFromClipboard = useCallback(async () => {
    setError(null);
    setIsProcessing(true);

    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        // Szukamy obrazu w schowku
        const imageTypes = item.types.filter(type => type.startsWith('image/'));
        
        if (imageTypes.length > 0) {
          const blob = await item.getType(imageTypes[0]);
          const { data, width, height } = await fileToBase64(blob);
          
          // Ustaw draft z obrazem - pozycja środek ekranu
          const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
          const centerWorld = inverseTransformPoint(centerScreen, viewport, canvasWidth, canvasHeight);
          
          // Domyślny rozmiar: 3 jednostki szerokości (zachowaj proporcje)
          const aspectRatio = height / width;
          const worldWidth = 3;
          const worldHeight = worldWidth * aspectRatio;
          
          setImageDraft({
            id: Date.now().toString(),
            screenStart: centerScreen,
            screenEnd: {
              x: centerScreen.x + worldWidth * viewport.scale * 100,
              y: centerScreen.y + worldHeight * viewport.scale * 100,
            },
            worldStart: centerWorld,
            worldEnd: {
              x: centerWorld.x + worldWidth,
              y: centerWorld.y + worldHeight,
            },
            imageData: data,
            originalWidth: width,
            originalHeight: height,
          });
          
          setIsProcessing(false);
          return;
        }
      }
      
      setError('Brak obrazu w schowku');
    } catch (err) {
      console.error('Clipboard paste error:', err);
      setError('Błąd dostępu do schowka. Użyj Ctrl+V lub wybierz plik.');
    } finally {
      setIsProcessing(false);
    }
  }, [viewport, canvasWidth, canvasHeight, fileToBase64]);

  // 📂 Upload pliku
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      const { data, width, height } = await fileToBase64(file);
      
      // Ustaw draft z obrazem - pozycja środek ekranu
      const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
      const centerWorld = inverseTransformPoint(centerScreen, viewport, canvasWidth, canvasHeight);
      
      // Domyślny rozmiar: 3 jednostki szerokości (zachowaj proporcje)
      const aspectRatio = height / width;
      const worldWidth = 3;
      const worldHeight = worldWidth * aspectRatio;
      
      setImageDraft({
        id: Date.now().toString(),
        screenStart: centerScreen,
        screenEnd: {
          x: centerScreen.x + worldWidth * viewport.scale * 100,
          y: centerScreen.y + worldHeight * viewport.scale * 100,
        },
        worldStart: centerWorld,
        worldEnd: {
          x: centerWorld.x + worldWidth,
          y: centerWorld.y + worldHeight,
        },
        imageData: data,
        originalWidth: width,
        originalHeight: height,
      });
    } catch (err) {
      console.error('File upload error:', err);
      setError('Błąd wczytywania pliku. Wybierz plik obrazu.');
    } finally {
      setIsProcessing(false);
    }

    // Reset input
    if (e.target) {
      e.target.value = '';
    }
  }, [viewport, canvasWidth, canvasHeight, fileToBase64]);

  // 🎯 Drag & Drop z eksploratora
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setError('Upuść plik obrazu (PNG, JPEG, etc.)');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const { data, width, height } = await fileToBase64(file);
      
      // Pozycja gdzie upuszczono
      const dropScreen = { x: e.clientX, y: e.clientY };
      const dropWorld = inverseTransformPoint(dropScreen, viewport, canvasWidth, canvasHeight);
      
      // Domyślny rozmiar: 3 jednostki szerokości (zachowaj proporcje)
      const aspectRatio = height / width;
      const worldWidth = 3;
      const worldHeight = worldWidth * aspectRatio;
      
      setImageDraft({
        id: Date.now().toString(),
        screenStart: dropScreen,
        screenEnd: {
          x: dropScreen.x + worldWidth * viewport.scale * 100,
          y: dropScreen.y + worldHeight * viewport.scale * 100,
        },
        worldStart: dropWorld,
        worldEnd: {
          x: dropWorld.x + worldWidth,
          y: dropWorld.y + worldHeight,
        },
        imageData: data,
        originalWidth: width,
        originalHeight: height,
      });
    } catch (err) {
      console.error('Drop error:', err);
      setError('Błąd wczytywania pliku.');
    } finally {
      setIsProcessing(false);
    }
  }, [viewport, canvasWidth, canvasHeight, fileToBase64]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ⌨️ Keyboard - Ctrl+V wkleja ze schowka
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        handlePasteFromClipboard();
      }
      
      // ESC - anuluj draft
      if (e.key === 'Escape' && imageDraft) {
        setImageDraft(null);
        setError(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePasteFromClipboard, imageDraft]);

  // Mouse down - rozpocznij drag box (jeśli mamy już obraz)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Jeśli już mamy draft z obrazem - zapisz go
    if (imageDraft && imageDraft.imageData) {
      handleSave();
      return;
    }

    // Inaczej - rozpocznij rysowanie nowego box
    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    const newDraft: ImageDraft = {
      id: Date.now().toString(),
      screenStart: screenPoint,
      screenEnd: screenPoint,
      worldStart: worldPoint,
      worldEnd: worldPoint,
      imageData: null,
      originalWidth: 0,
      originalHeight: 0,
    };

    setImageDraft(newDraft);
    setIsDragging(true);
  };

  // Mouse move - aktualizuj rozmiar box
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageDraft) return;

    const screenPoint = { x: e.clientX, y: e.clientY };
    const worldPoint = inverseTransformPoint(screenPoint, viewport, canvasWidth, canvasHeight);

    setImageDraft({
      ...imageDraft,
      screenEnd: screenPoint,
      worldEnd: worldPoint,
    });
  };

  // Mouse up - zakończ rysowanie box
  const handleMouseUp = () => {
    if (!isDragging) return;

    setIsDragging(false);

    // Jeśli box za mały - wyczyść
    if (imageDraft) {
      const width = Math.abs(imageDraft.screenEnd.x - imageDraft.screenStart.x);
      const height = Math.abs(imageDraft.screenEnd.y - imageDraft.screenStart.y);

      if (width < 50 || height < 50) {
        setImageDraft(null);
        return;
      }
    }
  };

  // Zapisz obraz na tablicy
  const handleSave = () => {
    if (!imageDraft || !imageDraft.imageData) return;

    const width = Math.abs(imageDraft.worldEnd.x - imageDraft.worldStart.x);
    const height = Math.abs(imageDraft.worldEnd.y - imageDraft.worldStart.y);

    const newImage: ImageElement = {
      id: imageDraft.id,
      type: 'image',
      x: Math.min(imageDraft.worldStart.x, imageDraft.worldEnd.x),
      y: Math.min(imageDraft.worldStart.y, imageDraft.worldEnd.y),
      width: width,
      height: height,
      src: imageDraft.imageData,
      alt: 'Uploaded image',
    };

    onImageCreate(newImage);

    // Reset
    setImageDraft(null);
    setError(null);
  };

  // Anuluj draft
  const handleCancel = () => {
    setImageDraft(null);
    setError(null);
  };

  // Render preview
  const renderPreview = () => {
    if (!imageDraft) return null;

    const left = Math.min(imageDraft.screenStart.x, imageDraft.screenEnd.x);
    const top = Math.min(imageDraft.screenStart.y, imageDraft.screenEnd.y);
    const width = Math.abs(imageDraft.screenEnd.x - imageDraft.screenStart.x);
    const height = Math.abs(imageDraft.screenEnd.y - imageDraft.screenStart.y);

    return (
      <div
        className="absolute z-40 pointer-events-none"
        style={{
          left,
          top,
          width,
          height,
        }}
      >
        {imageDraft.imageData ? (
          // Pokazuj obraz
          <img
            src={imageDraft.imageData}
            alt="Preview"
            className="w-full h-full object-cover border-2 border-blue-500 rounded"
            style={{ opacity: 0.8 }}
          />
        ) : (
          // Pokazuj box
          <div className="w-full h-full border-2 border-dashed border-blue-500 bg-blue-50/20 rounded" />
        )}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-20" style={{ cursor: 'crosshair' }}>
      {/* Floating toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 pointer-events-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePasteFromClipboard}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Wklej obraz ze schowka (Ctrl+V)"
          >
            <Clipboard className="w-5 h-5" />
            <span className="text-sm font-medium">Wklej (Ctrl+V)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Wybierz plik z dysku"
          >
            <Upload className="w-5 h-5" />
            <span className="text-sm font-medium">Wybierz plik</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="w-px h-8 bg-gray-300" />

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ImageIcon className="w-4 h-4" />
            <span>lub przeciągnij obraz</span>
          </div>
        </div>

        {/* Status messages */}
        {isProcessing && (
          <div className="mt-2 text-sm text-blue-600 font-medium">
            Przetwarzanie obrazu...
          </div>
        )}

        {error && (
          <div className="mt-2 text-sm text-red-600 font-medium flex items-center gap-2">
            <X className="w-4 h-4" />
            {error}
          </div>
        )}

        {imageDraft && imageDraft.imageData && (
          <div className="mt-2 text-sm text-green-600 font-medium">
            ✓ Obraz załadowany. Kliknij aby umieścić na tablicy lub przeciągnij rozmiar.
          </div>
        )}
      </div>

      {/* Overlay dla mouse events */}
      <div
        className="absolute inset-0 pointer-events-auto z-30"
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />

      {/* Preview */}
      {renderPreview()}
    </div>
  );
}
