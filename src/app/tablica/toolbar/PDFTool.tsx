/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/PDFTool.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useRef, useEffect, useImperativeHandle, forwardRef)
 * - ../whiteboard/types (ViewportTransform, PDFElement)
 * - ../whiteboard/viewport (zoomViewport, panViewportWithWheel, constrainViewport, inverseTransformPoint)
 * 
 * EKSPORTUJE:
 * - PDFToolRef (interface) - ref API dla toolbar buttons
 * - PDFTool (component) - narzędzie do wstawiania PDFów
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (główny komponent)
 * - Toolbar.tsx (przycisk Upload)
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - PDFElement interface
 * - viewport.ts - transformacje współrzędnych, pan/zoom
 * 
 * PRZEZNACZENIE:
 * Narzędzie do wstawiania dokumentów PDF na tablicę.
 * Obsługuje upload z dysku oraz drag&drop (globalnie w WhiteboardCanvas).
 * ============================================================================
 */

'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { ViewportTransform, PDFElement } from '../whiteboard/types';
import { zoomViewport, panViewportWithWheel, constrainViewport, inverseTransformPoint } from '../whiteboard/viewport';

export interface PDFToolRef {
  triggerFileUpload: () => void;
}

interface PDFToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onPDFCreate: (pdf: PDFElement) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export const PDFTool = forwardRef<PDFToolRef, PDFToolProps>(
  ({ viewport, canvasWidth, canvasHeight, onPDFCreate, onViewportChange }, ref) => {
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
      triggerFileUpload: () => {
        fileInputRef.current?.click();
      }
    }));

    // File upload handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || file.type !== 'application/pdf') {
        console.error('Only PDF files are supported');
        return;
      }

      try {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const pdfDataUrl = evt.target?.result as string;
          
          // Wstaw w centrum widoku
          const centerScreen = { x: canvasWidth / 2, y: canvasHeight / 2 };
          const centerWorld = inverseTransformPoint(centerScreen, viewport, canvasWidth, canvasHeight);
          
          // Domyślny rozmiar PDF: 4 jednostki szerokości (A4 proporcje: ~1.414)
          const worldWidth = 4;
          const worldHeight = worldWidth * 1.414; // A4 aspect ratio
          
          const newPDF: PDFElement = {
            id: `pdf-${Date.now()}`,
            type: 'pdf',
            x: centerWorld.x - worldWidth / 2,
            y: centerWorld.y - worldHeight / 2,
            width: worldWidth,
            height: worldHeight,
            src: pdfDataUrl,
            fileName: file.name,
            currentPage: 1,
            totalPages: 1, // Will be updated when PDF is rendered
          };

          // Create element immediately
          onPDFCreate(newPDF);
        };
        reader.onerror = () => {
          console.error('Failed to read PDF file');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('PDF upload error:', err);
      }

      // Reset input
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
          accept="application/pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
      </>
    );
  }
);

PDFTool.displayName = 'PDFTool';
