/**
 * Panel Tutora AI przy Excalidraw: otwiera się od razu rozwinięty, zwinięcie zamyka panel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/_new/lib/auth', () => ({
  getAccessToken: vi.fn(() => null),
  refreshAccessToken: vi.fn(async () => null),
}));
// react-markdown i wtyczki to czysty ESM - niepotrzebne do tych testów (jak w math-chatbot-demo.test.tsx)
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));
vi.mock('remark-gfm', () => ({ default: () => {} }));
vi.mock('remark-math', () => ({ default: () => {} }));
vi.mock('rehype-katex', () => ({ default: () => {} }));

import { PanelLayer, PanelToggles, useBoardPanels, type BoardPanelId } from './board-panels';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  // jsdom nie ma scrollIntoView (czat przewija się do ostatniej wiadomości)
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const AVAILABLE: BoardPanelId[] = ['calculator', 'chat'];

function Harness({ demo = false }: { demo?: boolean }) {
  const panels = useBoardPanels();
  return (
    <>
      <PanelToggles panels={panels} available={AVAILABLE} placement="top-right" />
      <PanelLayer panels={panels} available={AVAILABLE} api={null} demo={demo} />
    </>
  );
}

describe('panel Tutora AI', () => {
  it('przycisk otwiera rozwinięty czat (bez bąbelka), "Zwiń" zamyka panel', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('panel-toggle-chat'));

    const panel = screen.getByTestId('panel-chat');
    expect(panel.querySelector('textarea')).not.toBeNull();

    fireEvent.click(screen.getByTitle('Zwiń'));
    await waitFor(() => expect(screen.queryByTestId('panel-chat')).toBeNull());
    expect(screen.getByTestId('panel-toggle-chat').getAttribute('aria-pressed')).toBe('false');
  });

  it('demo: prośba o zalogowanie, zamknięcie zamyka panel', async () => {
    render(<Harness demo />);
    fireEvent.click(screen.getByTestId('panel-toggle-chat'));
    expect(screen.getByTestId('demo-tutor-locked')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    await waitFor(() => expect(screen.queryByTestId('panel-chat')).toBeNull());
  });
});
