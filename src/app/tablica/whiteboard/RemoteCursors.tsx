/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                    REMOTE CURSORS - Wyświetlanie kursorów innych użytkowników
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renderuje kursory innych użytkowników na tablicy z płynnymi animacjami CSS.
 * Używa world coordinates i transformuje je do screen coordinates.
 *
 * ✅ ZOPTYMALIZOWANE:
 * - Używa CSS transition zamiast requestAnimationFrame + forceUpdate
 * - RemoteCursorsContainer sam subskrybuje kursory - nie powoduje re-renderów rodzica!
 * - Animacje są hardware-accelerated (GPU)
 */

'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { RemoteCursor, useBoardRealtime } from '@/app/context/BoardRealtimeContext';
import { ViewportTransform } from './types';
import { transformPoint } from './viewport';

interface RemoteCursorsProps {
  cursors: RemoteCursor[];
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
}

interface RemoteCursorsContainerProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
}

// Kolory w stylu Figjam - bardzo żywe i nasycone
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

/** Po ilu ms bezczynności kursor zanika */
const CURSOR_HIDE_DELAY_MS = 4000;

// Pojedynczy kursor - memo żeby nie re-renderować gdy inne kursory się zmieniają
const SingleCursor = memo(function SingleCursor({
  cursor,
  screenX,
  screenY,
  color,
}: {
  cursor: RemoteCursor;
  screenX: number;
  screenY: number;
  color: string;
}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Przy każdym ruchu kursora (lastUpdate się zmienia) — pokaż i resetuj timer
  useEffect(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), CURSOR_HIDE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cursor.lastUpdate]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 600ms ease-out',
        pointerEvents: 'none',
      }}
    >
      {/* Kursor - SVG arrow */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${screenX - 2}px, ${screenY - 2}px)`,
          transition: 'transform 100ms ease-out',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
          willChange: 'transform',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
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
          <path d="M7 7L13 18L14.5 13.5L19 12L7 7Z" fill="white" fillOpacity="0.3" />
        </svg>
      </div>

      {/* Nazwa użytkownika */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${screenX + 26}px, ${screenY + 14}px)`,
          transition: 'transform 150ms ease-out',
          willChange: 'transform',
        }}
      >
        <div
          className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-lg"
          style={{
            backgroundColor: color,
            color: '#FFFFFF',
            boxShadow: `0 2px 8px ${color}40`,
          }}
        >
          {cursor.username}
        </div>
      </div>
    </div>
  );
});

// Prezentacyjny komponent - memo
const RemoteCursorsInner = memo(function RemoteCursorsInner({
  cursors,
  viewport,
  canvasWidth,
  canvasHeight,
}: RemoteCursorsProps) {
  if (cursors.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40"
      style={{ width: canvasWidth, height: canvasHeight, overflow: 'visible' }}
    >
      {cursors.map((cursor) => {
        // Transform world coordinates to screen coordinates
        const screenPos = transformPoint(
          { x: cursor.x, y: cursor.y },
          viewport,
          canvasWidth,
          canvasHeight
        );

        // Ukryj kursory daleko poza widocznym obszarem (duży margines na wypadek lagu viewport)
        if (
          screenPos.x < -300 ||
          screenPos.x > canvasWidth + 300 ||
          screenPos.y < -300 ||
          screenPos.y > canvasHeight + 300
        ) {
          return null;
        }

        // Przypisz kolor (deterministycznie na podstawie userId)
        const colorIndex = Math.abs(cursor.userId) % CURSOR_COLORS.length;
        const color = CURSOR_COLORS[colorIndex];

        return (
          <SingleCursor
            key={cursor.userId}
            cursor={cursor}
            screenX={screenPos.x}
            screenY={screenPos.y}
            color={color}
          />
        );
      })}
    </div>
  );
});

/**
 * 🆕 CONTAINER - sam subskrybuje kursory z context
 *
 * To jest kluczowe dla wydajności! Ten komponent sam zarządza
 * subskrypcją kursorów, więc zmiany kursorów powodują re-render
 * TYLKO tego komponentu, nie WhiteboardCanvas.
 */
export function RemoteCursorsContainer({
  viewport,
  canvasWidth,
  canvasHeight,
}: RemoteCursorsContainerProps) {
  const { subscribeCursors } = useBoardRealtime();
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeCursors((newCursors) => {
      setCursors(newCursors);
    });
    return unsubscribe;
  }, [subscribeCursors]);

  return (
    <RemoteCursorsInner
      cursors={cursors}
      viewport={viewport}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
    />
  );
}

// Legacy export dla kompatybilności wstecznej
export const RemoteCursors = RemoteCursorsInner;
export default RemoteCursorsContainer;
