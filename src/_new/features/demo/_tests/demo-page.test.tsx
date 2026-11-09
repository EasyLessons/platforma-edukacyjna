/**
 * Widok /demo/[sessionId] — nawigacja i czystosc UI.
 *
 * Ciezkie zaleznosci (plotno, realtime) sa zamockowane: te testy sprawdzaja
 * wylacznie to, co widzi uzytkownik w warstwie nad plotnem.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'abc123' }),
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}));

const whiteboardProps = vi.fn();
vi.mock('@/_new/features/board-engine/components/excalidraw-whiteboard', () => ({
  ExcalidrawWhiteboard: (props: unknown) => {
    whiteboardProps(props);
    return <div data-testid="excalidraw-board" />;
  },
}));

vi.mock('@/_new/features/demo/use-demo-session', () => ({
  useDemoSession: () => ({
    boardId: 'demo-abc123',
    guest: { id: -42, username: 'Gosc-7K2P', isGuest: true },
    isLoading: false,
  }),
}));

import DemoBoardPage from '@/app/(whiteboard)/demo/[sessionId]/page';
import { DEMO_ELEMENT_LIMIT } from '@/_new/features/demo/demo-limits';

describe('Strona demo', () => {
  beforeEach(() => {
    pushMock.mockClear();
    whiteboardProps.mockClear();
  });

  it('renderuje tablice Excalidraw dla goscia: bez konta, rola edytora, limit elementow demo', () => {
    render(<DemoBoardPage />);

    expect(screen.getByTestId('excalidraw-board')).toBeInTheDocument();
    expect(whiteboardProps).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: 'demo-abc123',
        userRole: 'editor',
        guest: { id: -42, username: 'Gosc-7K2P', isGuest: true },
        elementLimit: DEMO_ELEMENT_LIMIT,
      })
    );
  });

  it('nie renderuje wlasnego naglowka - logo i powrot na landing daje ExcalidrawWhiteboard', () => {
    // Od #123 naglowek (logo -> "/", osoby online) jest czescia ExcalidrawWhiteboard/ExcalidrawHeader
    // (test: components/excalidraw-header.test.tsx). Strona demo ma tylko plotno.
    const { container } = render(<DemoBoardPage />);

    expect(screen.queryByAltText('EasyLesson Logo')).not.toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(screen.getByTestId('excalidraw-board')).toBeInTheDocument();
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
