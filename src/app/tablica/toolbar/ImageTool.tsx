/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/ImageTool.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useRef, useEffect, useImperativeHandle, forwardRef)
 * - lucide-react (Upload, Clipboard)
 * - ../whiteboard/types (ViewportTransform, ImageElement)
 * - ../whiteboard/viewport (zoomViewport, panViewportWithWheel, constrainViewport, inverseTransformPoint)
 * 
 * EKSPORTUJE:
 * - ImageToolRef (interface) - ref API dla toolbar buttons
 * - ImageTool (component) - narzędzie do wstawiania obrazów
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główny komponent)
 * - Toolbar.tsx (przyciski Paste/Upload)
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - ImageElement interface
 * - viewport.ts - transformacje współrzędnych, pan/zoom
 * 
 * ✅ POPRAWKI:
 * - USUNIĘTO: Preview logic (previewImage, previewPosition)
 * - USUNIĘTO: Lokalne handlePaste/handleDrop (duplikacja globalnych funkcji)
 * - USUNIĘTO: Wymuszanie kliknięcia (handleCanvasClick)
 * - USUNIĘTO: UI z instrukcjami (niepotrzebne wizualnie)
 * - ZOSTAWIONO: File upload przez input (jedyna unikalna funkcja)
 * - ZOSTAWIONO: Wheel events (pan/zoom)
 * 
 * PRZEZNACZENIE:
 * Narzędzie do wstawiania obrazów - obsługuje tylko upload z dysku.
 * Ctrl+V i drag&drop obsługiwane są GLOBALNIE w WhiteboardCanvas.
 * Wszystkie obrazy dodawane są OD RAZU bez preview!
 * ============================================================================
 */

'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { ViewportTransform, ImageElement } from '../whiteboard/types';
import { zoomViewport, panViewportWithWheel, constrainViewport, inverseTransformPoint } from '../whiteboard/viewport';

export interface ImageToolRef {
  handlePasteFromClipboard: () => void;
  triggerFileUpload: () => void;
}

interface ImageToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onImageCreate: (image: ImageElement) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export const ImageTool = forwardRef<ImageToolRef, ImageToolProps>(
  ({ viewport, canvasWidth, canvasHeight, onImageCreate, onViewportChange }, ref) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Wheel events for pan/zoom
    useEffect(() => {
      const overlay = overlayRef.current;
      if (!overlay || !onViewportChange) return;

      const handleNativeWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey) {
          const newViewport = zoomViewport(viewport, e.deltaY, e.clientX, e.clientY, canvasWidth, canvasHeight);
          onViewportChange(constrainViewport(newViewport));
        } else {
          const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
          onViewportChange(constrainViewport(newViewport));
        }
      };

      overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
      return () => overlay.removeEventListener('wheel', handleNativeWheel);
    }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

    // Expose ref methods (for toolbar buttons)
    useImperativeHandle(ref, () => ({
      handlePasteFromClipboard: () => {
        // ✅ Deleguje do globalnej funkcji w WhiteboardCanvas
        console.log('📋 Paste handled by global function (Ctrl+V)');
      },
      triggerFileUpload: () => {
        fileInputRef.current?.click();
      }
    }));

    // File upload przez input (jedyna lokalna funkcja ImageTool)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      try {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const img = new Image();
          img.onload = () => {
            const dataUrl = evt.target?.result as string;
            
            // Wstaw w centrum widoku
            const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
            const centerWorld = inverseTransformPoint(centerScreen, viewport, canvasWidth, canvasHeight);
            
            // Domyślny rozmiar: 3 jednostki szerokości (zachowaj proporcje)
            const aspectRatio = img.height / img.width;
            const worldWidth = 3;
            const worldHeight = worldWidth * aspectRatio;
            
            const newImage: ImageElement = {
              id: Date.now().toString(),
              type: 'image',
              x: centerWorld.x - worldWidth / 2,
              y: centerWorld.y - worldHeight / 2,
              width: worldWidth,
              height: worldHeight,
              src: dataUrl,
              alt: file.name,
            };

            // ✅ Od razu tworzy element - BEZ PREVIEW!
            onImageCreate(newImage);
          };
          img.onerror = () => {
            console.error('Failed to load image');
          };
          img.src = evt.target?.result as string;
        };
        reader.onerror = () => {
          console.error('Failed to read file');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('File upload error:', err);
      }

      // Reset input (żeby można było wgrać ten sam plik ponownie)
      e.target.value = '';
    };

    return (
      <>
        {/* Invisible overlay for wheel events only */}
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none z-20"
          style={{ touchAction: 'none' }}
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </>
    );
  }
);

ImageTool.displayName = 'ImageTool';