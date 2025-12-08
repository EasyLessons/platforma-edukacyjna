/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                    REMOTE CURSORS - Wyświetlanie kursorów innych użytkowników
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Renderuje kursory innych użytkowników na tablicy.
 * Używa world coordinates i transformuje je do screen coordinates.
 */

'use client';

import { RemoteCursor } from '@/app/context/BoardRealtimeContext';
import { ViewportTransform } from './types';
import { transformPoint } from './viewport';

interface RemoteCursorsProps {
  cursors: RemoteCursor[];
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
}

export function RemoteCursors({ cursors, viewport, canvasWidth, canvasHeight }: RemoteCursorsProps) {
  if (cursors.length === 0) return null;

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-40 overflow-hidden"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {cursors.map((cursor) => {
        // Transform world coordinates to screen coordinates
        const screenPos = transformPoint(
          { x: cursor.x, y: cursor.y },
          viewport,
          canvasWidth,
          canvasHeight
        );
        
        // Ukryj kursory poza widocznym obszarem (z marginesem)
        if (
          screenPos.x < -50 || screenPos.x > canvasWidth + 50 ||
          screenPos.y < -50 || screenPos.y > canvasHeight + 50
        ) {
          return null;
        }

        return (
          <div
            key={cursor.userId}
            className="absolute transition-all duration-75 ease-out"
            style={{
              left: screenPos.x,
              top: screenPos.y,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Kursor - SVG arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-md"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            >
              <path
                d="M4 4L12 20L14.5 13.5L21 11L4 4Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            
            {/* Nazwa użytkownika */}
            <div
              className="absolute left-5 top-4 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
              style={{
                backgroundColor: cursor.color,
                color: getContrastColor(cursor.color),
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              {cursor.username}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Oblicza kontrastowy kolor tekstu (biały lub czarny) dla danego tła
 */
function getContrastColor(hexColor: string): string {
  // Usuń # jeśli jest
  const hex = hexColor.replace('#', '');
  
  // Konwertuj na RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Oblicz luminancję (standard ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Zwróć biały dla ciemnych kolorów, czarny dla jasnych
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export default RemoteCursors;
