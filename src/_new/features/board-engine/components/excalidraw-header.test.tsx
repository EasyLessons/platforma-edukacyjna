/**
 * ExcalidrawHeader - logo i powrot: w demo (gosc) na landing "/", na zwyklej tablicy do panelu.
 * Plotno, metryki UI i rozmowa (CallButton bez providera renderuje null) sa poza tym testem.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics', () => ({
  useWhiteboardUiMetrics: () => ({ isPhoneLayout: false, showFullHeader: true }),
  safeInset: (value: number) => `${value}px`,
}));

import { ExcalidrawHeader } from './excalidraw-header';

const panels = { isOpen: () => false, toggle: vi.fn(), close: vi.fn() };

describe('ExcalidrawHeader - logo', () => {
  beforeEach(() => pushMock.mockClear());

  it('demo (gosc): to samo logo co na tablicy, klikniecie prowadzi na strone glowna', async () => {
    const user = userEvent.setup();
    render(
      <ExcalidrawHeader
        boardId="demo-abc123"
        panels={panels}
        available={['calculator']}
        guest={{ id: -42, username: 'Gosc-7K2P' }}
      />
    );

    const logo = screen.getByAltText('EasyLesson Logo');
    expect(logo.getAttribute('src')).toContain('LogoEasyLesson.webp');

    await user.click(screen.getByRole('button', { name: /easylesson logo/i }));
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('zwykla tablica: logo prowadzi do panelu przestrzeni', async () => {
    const user = userEvent.setup();
    render(
      <ExcalidrawHeader
        boardId="12"
        workspaceId={7}
        panels={panels}
        available={['calculator', 'search', 'chat']}
        currentUser={{ id: 1, username: 'patryk' }}
      />
    );

    await user.click(screen.getByRole('button', { name: /easylesson logo/i }));
    expect(pushMock).toHaveBeenCalledWith('/dashboard?workspace=7');
  });
});
