/**
 * Uklad tablicy na telefonie: kontrolki zajmuja mniej ekranu, a desktop
 * (brak dotyku) zostaje dokladnie taki jak wczesniej.
 */
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { ZoomControls } from '../zoom-controls';
import { ToolbarUI } from '../toolbar-ui';

function setScreen(width: number, height: number, touch: boolean) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === '(pointer: coarse)' ? touch : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

afterEach(() => {
  setScreen(1440, 900, false);
});

const zoomProps = {
  zoom: 1,
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onResetView: vi.fn(),
};

describe('ZoomControls', () => {
  it('telefon: tylko powrot na srodek i skala (zoom szczypnieciem)', async () => {
    setScreen(390, 664, true);
    const { container } = render(<ZoomControls {...zoomProps} />);
    await act(async () => {});

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('desktop: pelny zestaw trzech przyciskow', async () => {
    setScreen(1440, 900, false);
    const { container } = render(<ZoomControls {...zoomProps} />);
    await act(async () => {});

    expect(container.querySelectorAll('button')).toHaveLength(3);
  });

  it('pozycja uwzglednia safe area (iOS)', async () => {
    setScreen(390, 664, true);
    const { container } = render(<ZoomControls {...zoomProps} />);
    await act(async () => {});

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('style')).toContain('safe-area-inset-bottom');
    expect(root.getAttribute('style')).toContain('safe-area-inset-left');
  });
});

const toolbarProps = {
  canUndo: false,
  canRedo: false,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onClear: vi.fn(),
  onCalculatorToggle: vi.fn(),
  onToggleAssetsLibrary: vi.fn(),
};

function countButtons(container: HTMLElement) {
  return container.querySelectorAll('button').length;
}

describe('ToolbarUI', () => {
  it('telefon (maxHeight): wariant kompaktowy z menu "Wiecej" nawet na wysokim ekranie', async () => {
    setScreen(412, 839, true); // Pixel 7 - wysoki, wczesniej pelny pasek
    const { container } = render(<ToolbarUI {...toolbarProps} maxHeight="calc(100dvh - 208px)" />);
    await act(async () => {});

    const box = container.firstElementChild as HTMLElement;
    expect(box.style.maxHeight).toBe('calc(100dvh - 208px)');
    expect(box.className).toContain('overflow-y-auto');

    const desktop = render(<ToolbarUI {...toolbarProps} />);
    await act(async () => {});
    // Na telefonie mniej przyciskow niz w pelnym pasku na tym samym ekranie.
    expect(countButtons(container)).toBeLessThan(countButtons(desktop.container));
  });

  it('bez maxHeight (desktop): pasek bez ograniczenia wysokosci i przewijania', async () => {
    setScreen(1440, 900, false);
    const { container } = render(<ToolbarUI {...toolbarProps} />);
    await act(async () => {});

    const box = container.firstElementChild as HTMLElement;
    expect(box.style.maxHeight).toBe('');
    expect(box.className).not.toContain('overflow-y-auto');
  });
});
