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
import { ViewportTransform, ImageElement } from '@/_new/features/whiteboard/types';
import {
  zoomViewport,
  panViewportWithWheel,
  constrainViewport,
  inverseTransformPoint,
} from '@/_new/features/whiteboard/navigation/viewport-math';

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
          const rect = overlay?.getBoundingClientRect() ?? { left: 0, top: 0 };
          const newViewport = zoomViewport(
            viewport,
            e.deltaY,
            e.clientX - rect.left,
            e.clientY - rect.top,
            canvasWidth,
            canvasHeight
          );
          onViewportChange(constrainViewport(newViewport));
        } else {
          const newViewport = panViewportWithWheel(viewport, e.deltaX, e.deltaY);
          onViewportChange(constrainViewport(newViewport));
        }
      };

      overlay.addEventListener('wheel', handleNativeWheel, { passive: false });
      return () => overlay.removeEventListener('wheel', handleNativeWheel);
    }, [viewport, canvasWidth, canvasHeight, onViewportChange]);

    // 🍎 FIX: Apple Pencil bug z iOS 14+ Scribble
    // Dodanie preventDefault na touchmove naprawia problem z brakującymi eventami Apple Pencil
    useEffect(() => {
      const overlay = overlayRef.current;
      if (!overlay) return;

      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
      };

      overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
      return () => overlay.removeEventListener('touchmove', handleTouchMove);
    }, []);

    // Expose ref methods (for toolbar buttons)
    useImperativeHandle(ref, () => ({
      handlePasteFromClipboard: () => {
        // ✅ Deleguje do globalnej funkcji w WhiteboardCanvas
        console.log('📋 Paste handled by global function (Ctrl+V)');
      },
      triggerFileUpload: () => {
        fileInputRef.current?.click();
      },
    }));

    // 🆕 Konwersja PDF → obrazki (wszystkie strony)
    const convertPDFToImages = async (file: File): Promise<string[]> => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const images: string[] = [];

      // Konwertuj wszystkie strony
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x dla lepszej jakości
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Cannot get canvas context');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        }).promise;

        images.push(canvas.toDataURL('image/jpeg', 0.9));
      }

      console.log(`✅ Skonwertowano ${images.length} stron PDF`);
      return images;
    };

    // File upload przez input - obsługuje obrazy i PDF
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';

      if (!isImage && !isPDF) {
        console.error('Only images and PDFs are supported');
        return;
      }

      try {
        // 🆕 Obsługa PDF → konwersja wszystkich stron
        if (isPDF) {
          console.log('📄 Converting PDF to images...');
          const images = await convertPDFToImages(file);

          const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
          const centerWorld = inverseTransformPoint(
            centerScreen,
            viewport,
            canvasWidth,
            canvasHeight
          );

          const worldWidth = 3;
          const padding = 0.5; // Odstęp między stronami
          let currentY = centerWorld.y;

          // Dodaj każdą stronę jako osobny obrazek
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
              x: centerWorld.x - worldWidth / 2,
              y: currentY,
              width: worldWidth,
              height: worldHeight,
              src: dataUrl,
              alt: `${file.name} - Strona ${i + 1}/${images.length}`,
            };

            console.log(`✅ Creating page ${i + 1}/${images.length}, ID: ${newImage.id}`);
            onImageCreate(newImage);
            currentY += worldHeight + padding; // Następna strona niżej

            // Małe opóźnienie żeby ID były unikalne i state się zaktualizował
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          console.log(`✅ Dodano ${images.length} stron z PDF`);
        } else {
          // Obsługa zwykłego obrazka
          const reader = new FileReader();
          const result = await new Promise<string>((resolve, reject) => {
            reader.onload = (evt) => resolve(evt.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const dataUrl = result;

          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
          });
          const width = img.width;
          const height = img.height;

          // Wstaw w centrum widoku
          const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
          const centerWorld = inverseTransformPoint(
            centerScreen,
            viewport,
            canvasWidth,
            canvasHeight
          );

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
            src: dataUrl,
            alt: file.name,
          };

          // ✅ Od razu tworzy element - BEZ PREVIEW!
          onImageCreate(newImage);
        }

        console.log('✅ Image created from', isPDF ? 'PDF' : 'image');
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

        {/* Hidden file input - akceptuje obrazy i PDF */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
      </>
    );
  }
);

ImageTool.displayName = 'ImageTool';

