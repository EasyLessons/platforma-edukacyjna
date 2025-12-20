/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                    REMOTE CURSORS - Wyświetlanie kursorów innych użytkowników
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Renderuje kursory innych użytkowników na tablicy z płynnymi animacjami.
 * Używa world coordinates i transformuje je do screen coordinates.
 * 
 * Featury:
 * - Żywe kolory jak w Figjam
 * - Motion blur podczas ruchu
 * - Animacja kliknięcia (powiększenie)
 * - Rotacja kursora w kierunku ruchu
 * - Nick podążający za kursorem z opóźnieniem
 */

'use client';

import { RemoteCursor } from '@/app/context/BoardRealtimeContext';
import { ViewportTransform } from './types';
import { transformPoint } from './viewport';
import { useEffect, useRef, useState } from 'react';

interface RemoteCursorsProps {
  cursors: RemoteCursor[];
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
}

// Kolory w stylu Figjam - bardzo żywe i nasycone (oczojebne)
const CURSOR_COLORS = [
  '#E63946', // Ciemnoczerwony
  '#06A77D', // Ciemny turkus
  '#0077CC', // Ciemnoniebieski
  '#D946EF', // Ciemnofioletowy
  '#10B981', // Ciemnozielony
  '#F59E0B', // Ciemnopomarańczowy/złoty
  '#DB2777', // Ciemnoróżowy
  '#0891B2', // Ciemny cyjan
  '#EA580C', // Ciemnopomarańczowy
  '#7C3AED', // Ciemnofioletowy
];

interface CursorState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  angle: number;
  isClicking: boolean;
  labelX: number;
  labelY: number;
}

export function RemoteCursors({ cursors, viewport, canvasWidth, canvasHeight }: RemoteCursorsProps) {
  // Przechowujemy stan każdego kursora dla animacji
  const cursorStates = useRef<Map<number, CursorState>>(new Map());
  const [, forceUpdate] = useState({});
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Animacja - smooth update pozycji kursorów i labelek co frame
  useEffect(() => {
    const animate = () => {
      let needsUpdate = false;

      cursorStates.current.forEach((state) => {
        // Kursor "goni" target pozycję - smooth interpolacja
        const cursorDx = state.x - state.prevX;
        const cursorDy = state.y - state.prevY;
        const cursorDistance = Math.sqrt(cursorDx * cursorDx + cursorDy * cursorDy);

        if (cursorDistance > 0.05) {
          const cursorSpeed = 0.25;
          state.prevX += cursorDx * cursorSpeed;
          state.prevY += cursorDy * cursorSpeed;
          needsUpdate = true;
        }

        // Labelka "goni" kursor z opóźnieniem
        const dx = state.prevX - state.labelX;
        const dy = state.prevY - state.labelY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.05) {
          const speed = 0.12;
          state.labelX += dx * speed;
          state.labelY += dy * speed;
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        forceUpdate({});
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (cursors.length === 0) return null;

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-40 overflow-hidden"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {cursors.map((cursor, index) => {
        // Transform world coordinates to screen coordinates
        const screenPos = transformPoint(
          { x: cursor.x, y: cursor.y },
          viewport,
          canvasWidth,
          canvasHeight
        );
        
        // Ukryj kursory poza widocznym obszarem
        if (
          screenPos.x < -50 || screenPos.x > canvasWidth + 50 ||
          screenPos.y < -50 || screenPos.y > canvasHeight + 50
        ) {
          return null;
        }

        // Pobierz lub utwórz stan kursora
        let state = cursorStates.current.get(cursor.userId);
        if (!state) {
          state = {
            x: screenPos.x,
            y: screenPos.y,
            prevX: screenPos.x,
            prevY: screenPos.y,
            angle: 0,
            isClicking: false,
            labelX: screenPos.x,
            labelY: screenPos.y,
          };
          cursorStates.current.set(cursor.userId, state);
        }

        // Update target pozycji (kursor będzie interpolował do tej pozycji w animate())
        state.x = screenPos.x;
        state.y = screenPos.y;

        // Przypisz kolor (deterministycznie na podstawie userId)
        const colorIndex = Math.abs(cursor.userId) % CURSOR_COLORS.length;
        const color = CURSOR_COLORS[colorIndex];

        return (
          <div key={cursor.userId}>
            {/* Kursor - SVG arrow z animacjami (zawsze widoczny) */}
            <div
              className="absolute"
              style={{
                left: state.prevX,
                top: state.prevY,
                transform: `
                  translate(-2px, -2px) 
                  rotate(${state.angle}deg)
                  scale(${state.isClicking ? 1.3 : 1})
                `,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
                transition: 'none',
                willChange: 'transform',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                className="transition-all duration-150"
              >
                {/* Cień kursora */}
                <path
                  d="M5 5L15 23L17.5 15.5L25 13L5 5Z"
                  fill="rgba(0,0,0,0.15)"
                  transform="translate(1, 1)"
                />
                {/* Główny kursor */}
                <path
                  d="M5 5L15 23L17.5 15.5L25 13L5 5Z"
                  fill={color}
                  stroke="#ffffffff"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {/* Wewnętrzny highlight */}
                <path
                  d="M7 7L13 18L14.5 13.5L19 12L7 7Z"
                  fill="white"
                  fillOpacity="0.3"
                />
              </svg>
            </div>
            
            {/* Nazwa użytkownika - podąża za kursorem, dalej w prawo i w dół */}
            <div
              className="absolute"
              style={{
                left: state.labelX,
                top: state.labelY,
                // ZMIENIONE: 20px → 28px w prawo, 8px → 16px w dół
                transform: 'translate(28px, 16px)',
                transition: 'none',
                willChange: 'transform',
              }}
            >
              <div
                className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-lg"
                style={{
                  backgroundColor: color,
                  color: '#FFFFFF', // <-- ZMIEŃ NA TO zamiast getContrastColor(color)
                  boxShadow: `0 2px 8px ${color}40`,
                }}
              >
                {cursor.username}
              </div>
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
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export default RemoteCursors;