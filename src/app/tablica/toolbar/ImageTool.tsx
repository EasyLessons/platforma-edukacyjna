/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/ImageTool.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - react (useState, useRef, useCallback)
 * - lucide-react (ikony: Upload, X, ImageIcon)
 * - ../whiteboard/types (Point, ViewportTransform, ImageElement)
 * - ../whiteboard/viewport (inverseTransformPoint)
 * 
 * EKSPORTUJE:
 * - ImageTool (component) - globalny handler wstawiania obrazów
 * 
 * UŻYWANE PRZEZ:
 * - WhiteboardCanvas.tsx (zawsze aktywny w tle)
 * 
 * ⚠️ ZALEŻNOŚCI:
 * - types.ts - używa ImageElement
 * - viewport.ts - używa funkcji transformacji
 * - WhiteboardCanvas.tsx - dostarcza callback: onImageCreate
 * 
 * PRZEZNACZENIE:
 * Globalny handler wstawiania obrazów - działa zawsze w tle, niezależnie od aktywnego narzędzia.
 * Obsługuje:
 * 1. Drag & drop pliku z eksploratora
 * 2. Ctrl+V (obsługiwane w WhiteboardCanvas globalnie)
 * 3. Upload pliku (przycisk w panelu - zawsze widoczny)
 * 
 * NIE blokuje innych narzędzi - nie ma overlay'a, nie przejmuje kontroli.
 * Konwersja obrazu do base64 i kompresja jeśli > 500KB.
 * Panel umieszczony w prawym dolnym rogu - zawsze dostępny.
 * ============================================================================
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { Point, ViewportTransform, ImageElement } from '../whiteboard/types';
import { inverseTransformPoint } from '../whiteboard/viewport';

interface ImageToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onImageCreate: (image: ImageElement) => void;
  onViewportChange?: (viewport: ViewportTransform) => void;
}

export function ImageTool({
  viewport,
  canvasWidth,
  canvasHeight,
  onImageCreate,
}: ImageToolProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔒 Zapobiegaj domyślnemu zachowaniu przeglądarki dla drag & drop
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔒 Zablokowano domyślne zachowanie drag/drop');
    };

    // Blokuj domyślne zachowanie dla całego dokumentu - NIE PASSIVE!
    window.addEventListener('dragover', preventDefaults, { passive: false });
    window.addEventListener('drop', preventDefaults, { passive: false });

    console.log('✅ ImageTool: Zainstalowano globalne handlery drag & drop');

    return () => {
      window.removeEventListener('dragover', preventDefaults);
      window.removeEventListener('drop', preventDefaults);
      console.log('❌ ImageTool: Odinstalowano globalne handlery drag & drop');
    };
  }, []);

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

  // 📂 Upload pliku
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      const { data, width, height } = await fileToBase64(file);
      
      // Ustaw obraz w środku widoku
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
        alt: 'Uploaded image',
      };

      onImageCreate(newImage);
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
  }, [viewport, canvasWidth, canvasHeight, fileToBase64, onImageCreate]);

  // 🎯 Drag & Drop z eksploratora
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    console.log('🎯 handleDrop wywołany!', e);
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    console.log('📦 Files w dataTransfer:', e.dataTransfer.files);
    console.log('📦 Items w dataTransfer:', e.dataTransfer.items);

    const file = e.dataTransfer.files?.[0];
    
    if (!file) {
      console.log('❌ Brak pliku!');
      setError('Nie znaleziono pliku');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    console.log('📄 Znaleziono plik:', file.name, 'typ:', file.type);
    
    if (!file.type.startsWith('image/')) {
      console.log('❌ To nie jest obraz!');
      setError('Upuść plik obrazu (PNG, JPEG, etc.)');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setIsProcessing(true);
    console.log('⏳ Rozpoczynam przetwarzanie obrazu...');

    try {
      const { data, width, height } = await fileToBase64(file);
      console.log('✅ Obraz przekonwertowany:', width, 'x', height);
      
      // Pozycja gdzie upuszczono
      const dropScreen = { x: e.clientX, y: e.clientY };
      const dropWorld = inverseTransformPoint(dropScreen, viewport, canvasWidth, canvasHeight);
      
      console.log('📍 Pozycja drop - screen:', dropScreen, 'world:', dropWorld);
      
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

      console.log('🖼️ Tworzę nowy element obrazu:', newImage);
      onImageCreate(newImage);
      console.log('✅ Obraz dodany do tablicy!');
    } catch (err) {
      console.error('❌ Drop error:', err);
      setError('Błąd wczytywania pliku.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  }, [viewport, canvasWidth, canvasHeight, fileToBase64, onImageCreate]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    console.log('📋 handleDragOver wywołany');
    e.preventDefault();
    e.stopPropagation();
    
    // Sprawdź czy to plik obrazu
    const hasImage = Array.from(e.dataTransfer.types).some(type => 
      type === 'Files' || type.startsWith('image/')
    );
    
    console.log('📋 DataTransfer types:', e.dataTransfer.types, 'hasImage:', hasImage);
    
    if (hasImage) {
      setIsDragOver(true);
      console.log('✅ Ustawiono isDragOver = true');
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    console.log('👋 handleDragLeave wywołany');
    e.preventDefault();
    e.stopPropagation();
    
    // Sprawdź czy faktycznie opuszczamy obszar (nie poruszamy się między child elementami)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragOver(false);
      console.log('❌ Ustawiono isDragOver = false (opuszczono obszar)');
    } else {
      console.log('⚠️ Pozostajemy w obszarze (ruch między child elementami)');
    }
  }, []);

  return (
    <>
      {/* Globalny overlay dla drag & drop - musi być pointer-events: auto żeby łapać drag eventy! */}
      <div
        className="absolute inset-0 z-10"
        onDragEnter={(e) => {
          console.log('🚪 onDragEnter - wejście do obszaru overlay!');
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ 
          pointerEvents: 'auto', // MUSI BYĆ auto żeby łapać drag eventy!
          background: 'transparent'
        }}
      >
        {/* Komunikat gdy przeciągamy */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-500/10 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-3">
              <ImageIcon className="w-12 h-12 text-blue-500" />
              <p className="text-lg font-semibold text-gray-800">Upuść obraz tutaj</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating button - prawy dolny róg */}
      <div className="absolute bottom-4 right-4 z-50 pointer-events-auto flex flex-col items-end gap-2">
        {/* Status messages */}
        {(isProcessing || error) && (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-xs">
            {isProcessing && (
              <div className="text-sm text-blue-600 font-medium flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Przetwarzanie obrazu...
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 font-medium flex items-center gap-2">
                <X className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
          title="Dodaj obraz (lub przeciągnij plik / Ctrl+V)"
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-sm font-medium hidden md:inline">Dodaj obraz</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Hint */}
        <div className="hidden md:block bg-white rounded-lg shadow-md border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-600 text-center">
            Przeciągnij obraz lub <strong>Ctrl+V</strong>
          </p>
        </div>
      </div>
    </>
  );
}
