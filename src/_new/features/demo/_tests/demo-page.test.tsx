/**
 * Widok /demo/[sessionId] — nawigacja i czystosc UI.
 *
 * Ciezkie zaleznosci (plotno, realtime) sa zamockowane: te testy sprawdzaja
 * wylacznie to, co widzi uzytkownik w warstwie nad plotnem.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'abc123' }),
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/_new/features/whiteboard/components/canvas/whiteboard-canvas', () => ({
  default: () => <div data-testid="canvas" />,
}));

vi.mock('@/app/context/BoardRealtimeContext', () => ({
  BoardRealtimeProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/_new/features/demo/use-demo-session', () => ({
  useDemoSession: () => ({
    boardId: 'demo-abc123',
    guest: { id: -42, username: 'Gosc-7K2P', isGuest: true },
    isLoading: false,
  }),
}));

import DemoBoardPage from '@/app/(whiteboard)/demo/[sessionId]/page';

describe('Strona demo', () => {
  beforeEach(() => pushMock.mockClear());

  it('pokazuje to samo logo co zwykla tablica (LogoEasyLesson.webp)', () => {
    render(<DemoBoardPage />);

    // Ten sam alt i ta sama grafika co w BoardHeader — demo uzywa BoardLogoButton.
    const logo = screen.getByAltText('EasyLesson Logo');
    expect(logo.getAttribute('src')).toContain('LogoEasyLesson.webp');
  });

  it('klikniecie logo prowadzi na strone glowna', async () => {
    const user = userEvent.setup();
    render(<DemoBoardPage />);

    await user.click(screen.getByRole('button', { name: /easylesson logo/i }));
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('przycisk logo ma kursor raczki', () => {
    render(<DemoBoardPage />);

    const button = screen.getByRole('button', { name: /easylesson logo/i });
    expect(button.style.cursor).toBe('pointer');
  });

  it('nie pokazuje juz plakietki o trybie goscia nad smart search barem', () => {
    const { container } = render(<DemoBoardPage />);

    expect(screen.queryByText(/tryb demo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/jestes tu jako/i)).not.toBeInTheDocument();
    // Czarny prostokat mial klase bg-black/70 — nie moze zostac po nim slad.
    // Sprawdzamy przez innerHTML, zeby nie escapowac '/' w selektorze CSS.
    expect(container.innerHTML).not.toContain('bg-black');
  });
});
