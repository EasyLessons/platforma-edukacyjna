/**
 * Klikniecie w select-tool: ktory element laduje w zaznaczeniu.
 *
 * Odtworzenie bledu: kolko narysowane dlugopisem (path) wokol mniejszego
 * prostokata. Klik w srodek kolka (daleko od kreski, ale wewnatrz jej bboxa)
 * ma zaznaczyc prostokat, nie kolko. Przy kilku trafieniach wygrywa element
 * najwyzej w kolejnosci rysowania (ostatni w tablicy).
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SelectTool } from '../select-tool';
import type {
  DrawingElement,
  DrawingPath,
  Shape,
  ViewportTransform,
} from '@/_new/features/whiteboard/types';

// Viewport identycznosciowy: srodek canvasu 1000x1000 = punkt swiata (0, 0);
// 100 px ekranu = 1 jednostka swiata (transformPoint w navigation/viewport-math).
const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };
const CANVAS = 1000;
const CENTER_PX = CANVAS / 2;

/** Kolko z dlugopisu o promieniu r wokol (cx, cy) - 32 punkty na obwodzie. */
function circlePath(id: string, cx: number, cy: number, r: number): DrawingPath {
  const points = Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return { id, type: 'path', points, color: '#000', width: 2 };
}

function rect(id: string, x1: number, y1: number, x2: number, y2: number): Shape {
  return {
    id,
    type: 'shape',
    shapeType: 'rectangle',
    startX: x1,
    startY: y1,
    endX: x2,
    endY: y2,
    color: '#000',
    strokeWidth: 2,
    fill: false,
  };
}

function renderSelectTool(elements: DrawingElement[]) {
  const onSelectionChange = vi.fn();
  const { container } = render(
    <SelectTool
      viewport={viewport}
      canvasWidth={CANVAS}
      canvasHeight={CANVAS}
      elements={elements}
      selectedIds={new Set()}
      onSelectionChange={onSelectionChange}
      onElementUpdate={vi.fn()}
      onElementsUpdate={vi.fn()}
    />
  );
  const overlay = container.querySelector('.z-30.pointer-events-auto');
  if (!overlay) throw new Error('brak interaktywnego overlaya select-tool');
  return { overlay, onSelectionChange };
}

/** jsdom nie ma PointerEvent - MouseEvent o typie 'pointerdown' niesie clientX/Y. */
function clickAt(overlay: Element, screenX: number, screenY: number) {
  fireEvent(
    overlay,
    new MouseEvent('pointerdown', { clientX: screenX, clientY: screenY, button: 0, bubbles: true })
  );
}

function selectedIdsOf(onSelectionChange: ReturnType<typeof vi.fn>): string[] {
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
  return [...(onSelectionChange.mock.calls[0][0] as Set<string>)];
}

describe('SelectTool - klik w element', () => {
  it('kolko z dlugopisu wokol prostokata (prostokat narysowany WCZESNIEJ): klik w srodek zaznacza prostokat', () => {
    const inner = rect('rect', -0.2, -0.2, 0.2, 0.2);
    const circle = circlePath('circle', 0, 0, 1);
    const { overlay, onSelectionChange } = renderSelectTool([inner, circle]);

    clickAt(overlay, CENTER_PX, CENTER_PX);

    expect(selectedIdsOf(onSelectionChange)).toEqual(['rect']);
  });

  it('kolko z dlugopisu wokol prostokata (prostokat narysowany POZNIEJ): klik w srodek zaznacza prostokat', () => {
    const circle = circlePath('circle', 0, 0, 1);
    const inner = rect('rect', -0.2, -0.2, 0.2, 0.2);
    const { overlay, onSelectionChange } = renderSelectTool([circle, inner]);

    clickAt(overlay, CENTER_PX, CENTER_PX);

    expect(selectedIdsOf(onSelectionChange)).toEqual(['rect']);
  });

  it('klik w srodek samego kolka (daleko od kreski) nie zaznacza niczego - startuje ramke', () => {
    const circle = circlePath('circle', 0, 0, 1);
    const { overlay, onSelectionChange } = renderSelectTool([circle]);

    clickAt(overlay, CENTER_PX, CENTER_PX);

    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('klik w kreske kolka zaznacza kolko', () => {
    const circle = circlePath('circle', 0, 0, 1);
    const { overlay, onSelectionChange } = renderSelectTool([circle]);

    // punkt (1, 0) swiata = 100 px na prawo od srodka
    clickAt(overlay, CENTER_PX + 100, CENTER_PX);

    expect(selectedIdsOf(onSelectionChange)).toEqual(['circle']);
  });

  it('dwa nachodzace prostokaty: wygrywa narysowany pozniej (wyzej)', () => {
    const lower = rect('lower', -1, -1, 1, 1);
    const upper = rect('upper', -0.5, -0.5, 0.5, 0.5);
    const { overlay, onSelectionChange } = renderSelectTool([lower, upper]);

    clickAt(overlay, CENTER_PX, CENTER_PX);

    expect(selectedIdsOf(onSelectionChange)).toEqual(['upper']);
  });
});
