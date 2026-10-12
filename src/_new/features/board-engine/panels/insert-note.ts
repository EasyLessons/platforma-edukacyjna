/**
 * Odpowiedź czatu AI na tablicy Excalidraw: prostokąt (biała notatka) z tekstem jako etykietą -
 * Excalidraw sam zawija tekst do szerokości i dopasowuje wysokość. Treść idzie jako zwykły tekst;
 * notatka Markdown/KaTeX to etap B2 (ADR, "Decyzja 01.10.2026" pkt 1).
 *
 * `@excalidraw/excalidraw` importowany dynamicznie (moduł trafia do strony renderowanej na serwerze).
 */

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { viewportCenter } from './insert-resources';

export const NOTE_WIDTH = 520;
/** Wysokość startowa; Excalidraw powiększa notatkę do wysokości zawiniętego tekstu. */
const NOTE_MIN_HEIGHT = 120;
const NOTE_FONT_SIZE = 16;

export async function insertTextNote(api: ExcalidrawImperativeAPI, content: string): Promise<void> {
  const text = content.trim();
  if (!text) return;
  const { convertToExcalidrawElements, CaptureUpdateAction, FONT_FAMILY } =
    await import('@excalidraw/excalidraw');
  const center = viewportCenter(api.getAppState());
  const elements = convertToExcalidrawElements([
    {
      type: 'rectangle',
      x: center.x - NOTE_WIDTH / 2,
      y: center.y - NOTE_MIN_HEIGHT / 2,
      width: NOTE_WIDTH,
      height: NOTE_MIN_HEIGHT,
      strokeColor: '#d1d5db',
      backgroundColor: '#ffffff',
      fillStyle: 'solid',
      roughness: 0,
      roundness: { type: 3 },
      customData: { kind: 'ai-note' },
      label: {
        text,
        fontSize: NOTE_FONT_SIZE,
        fontFamily: FONT_FAMILY.Nunito,
        textAlign: 'left',
        verticalAlign: 'top',
      },
    },
  ]);
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
    appState: { selectedElementIds: { [elements[0].id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}
