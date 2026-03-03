/**
 * snap-guides.tsx
 *
 * Renderuje niebieskie przerywane linie snap (prowadnice) podczas przeciągania elementów.
 *
 * Co to jest snap i po co linie?
 *   Gdy użytkownik przeciąga element, aplikacja wykrywa czy jego krawędź jest blisko
 *   krawędzi innego elementu. Jeśli tak — "przyciąga" element do tej pozycji (snap).
 *   Żeby użytkownik WIDZIAŁ do czego się przyciąga, rysujemy tymczasową niebieską linię
 *   przez cały ekran (pionową lub poziomą). Linie znikają po puszczeniu elementu.
 *
 * Wydzielono z: WhiteboardCanvas.tsx linie 4110–4168 (był inline JSX w return).
 * Teraz to osobny komponent — zero logiki, tylko rendering SVG.
 */

import type { GuideLine } from '../../selection/snap-utils';
import type { ViewportTransform } from '../../types';
import { transformPoint } from '../../navigation/viewport-math';

// ─── Typy ────────────────────────────────────────────────────────────────────

interface SnapGuidesProps {
  /** Aktywne prowadnice — pusta tablica gdy nic się nie przeciąga */
  guides: GuideLine[];
  /** Aktualny widok kamery — potrzebny do przeliczenia world → screen */
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
}

// ─── Komponent ───────────────────────────────────────────────────────────────

export function SnapGuides({ guides, viewport, canvasWidth, canvasHeight }: SnapGuidesProps) {
  if (guides.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 1000,
        width: '100%',
        height: '100%',
      }}
    >
      {guides.map((guide, idx) => {
        if (guide.orientation === 'vertical') {
          // Pionowa linia — stała X w przestrzeni świata, rozciąga się przez cały ekran
          const screenX = transformPoint(
            { x: guide.value, y: 0 },
            viewport,
            canvasWidth,
            canvasHeight
          ).x;

          return (
            <line
              key={`${guide.sourceId}-v-${idx}`}
              x1={screenX} y1={0}
              x2={screenX} y2={canvasHeight}
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="8 4"
              opacity="1"
            />
          );
        } else {
          // Pozioma linia — stała Y w przestrzeni świata, rozciąga się przez cały ekran
          const screenY = transformPoint(
            { x: 0, y: guide.value },
            viewport,
            canvasWidth,
            canvasHeight
          ).y;

          return (
            <line
              key={`${guide.sourceId}-h-${idx}`}
              x1={0} y1={screenY}
              x2={canvasWidth} y2={screenY}
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="8 4"
              opacity="0.8"
            />
          );
        }
      })}
    </svg>
  );
}
