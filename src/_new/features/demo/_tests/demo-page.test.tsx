/**
 * Widok /demo/[sessionId] — nawigacja i czystosc UI.
 *
 * Ciezkie zaleznosci (plotno, realtime) sa zamockowane: te testy sprawdzaja
 * wylacznie to, co widzi uzytkownik w warstwie nad plotnem.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'abc123' }),
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
  it('ma w lewym gornym rogu link powrotny na strone glowna', () => {
    render(<DemoBoardPage />);

    const link = screen.getByRole('link', { name: /easylesson/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('nie pokazuje juz plakietki o trybie goscia nad smart search barem', () => {
    const { container } = render(<DemoBoardPage />);

    expect(screen.queryByText(/tryb demo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/jestes tu jako/i)).not.toBeInTheDocument();
    // Czarny prostokaz mial klase bg-black/70 — nie moze zostac po nim slad.
    // Sprawdzamy przez innerHTML, zeby nie escapowac '/' w selektorze CSS.
    expect(container.innerHTML).not.toContain('bg-black');
  });
});
