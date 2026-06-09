/**
 * ============================================================================
 * PLIK: tools/active-tool-overlay.tsx — Jeden slot zamiast drabinki JSX
 * ============================================================================
 *
 * Zastępuje ~160 linii `{tool === 'x' && <XTool/>}` w whiteboard-canvas.tsx.
 * Czyta aktywne narzędzie ze store'a, znajduje jego definicję w rejestrze
 * i renderuje jej Overlay (który sam pobiera kontekst przez useToolHost).
 *
 * Musi być renderowany WEWNĄTRZ <ToolHostProvider> (canvas, Krok 3).
 * ============================================================================
 */

'use client';

import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';
import { getTool } from './registry';
import { useToolHost } from './tool-host-context';

export function ActiveToolOverlay() {
  const activeTool = useToolStore((s) => s.activeTool);
  const { canvasWidth } = useToolHost();

  const def = getTool(activeTool);
  if (!def?.Overlay || canvasWidth === 0) return null;

  const Overlay = def.Overlay;
  return <Overlay />;
}
