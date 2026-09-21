/**
 * Sidebar przestrzeni na telefonie: wysuwana szuflada zamiast kolumny,
 * ktora zabierala 72 px (a po rozwinieciu 344 px z 390 px ekranu).
 * Od md w gore zachowanie bez zmian.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

import WorkspaceSidebar from '../workspace-sidebar';
import { OpenWorkspacesButton } from '../open-workspaces-button';

function setViewportIsMobile(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === '(max-width: 767px)' ? isMobile : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

const workspaces = [
  {
    id: 1,
    name: 'Matura 2027',
    icon: 'Home',
    bg_color: 'blue-500',
    is_owner: true,
    role: 'owner',
    is_favourite: false,
  },
  {
    id: 2,
    name: 'Fizyka',
    icon: 'Home',
    bg_color: 'green-500',
    is_owner: true,
    role: 'owner',
    is_favourite: false,
  },
];

function renderSidebar(props: Record<string, unknown> = {}) {
  const noop = vi.fn(async () => undefined as any);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <WorkspaceSidebar
      activeWorkspaceId={1}
      onWorkspaceSelect={vi.fn()}
      onRecentSelect={vi.fn()}
      workspaces={workspaces}
      loading={false}
      error={null}
      createWorkspace={noop}
      updateWorkspace={noop}
      deleteWorkspace={noop}
      leaveWorkspace={noop}
      toggleFavourite={noop}
      {...props}
    />,
    { wrapper }
  );
}

afterEach(() => setViewportIsMobile(false));

describe('WorkspaceSidebar - telefon', () => {
  it('zamknieta szuflada: bez tla, poza ekranem (klasa max-md:-translate-x-full)', async () => {
    setViewportIsMobile(true);
    const { container } = renderSidebar({ mobileOpen: false });
    await act(async () => {});

    expect(container.querySelector('.bg-black\\/40')).toBeNull();
    const panel = container.querySelector('.max-md\\:fixed') as HTMLElement;
    expect(panel.className).toContain('max-md:-translate-x-full');
  });

  it('otwarta szuflada: tlo, pelna lista (nie zwinieta), klik w tlo zamyka', async () => {
    setViewportIsMobile(true);
    const onMobileClose = vi.fn();
    const user = userEvent.setup();
    const { container } = renderSidebar({ mobileOpen: true, onMobileClose });
    await act(async () => {});

    const panel = container.querySelector('.max-md\\:fixed') as HTMLElement;
    expect(panel.className).toContain('max-md:translate-x-0');
    // Pelna wersja: widac naglowek i pole wyszukiwania.
    expect(screen.getByPlaceholderText('Szukaj przestrzeni...')).toBeInTheDocument();

    const backdrop = container.querySelector('[aria-hidden="true"].fixed') as HTMLElement;
    await user.click(backdrop);
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });

  it('przycisk zwijania na telefonie zamyka szuflade zamiast zwijac do 72 px', async () => {
    setViewportIsMobile(true);
    const onMobileClose = vi.fn();
    const user = userEvent.setup();
    renderSidebar({ mobileOpen: true, onMobileClose });
    await act(async () => {});

    await user.click(screen.getByTitle('Zamknij listę przestrzeni'));
    expect(onMobileClose).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText('Szukaj przestrzeni...')).toBeInTheDocument();
  });
});

describe('WorkspaceSidebar - desktop bez zmian', () => {
  it('przycisk "Zwiń sidebar" zwija do wersji z ikonami, bez szuflady i tla', async () => {
    setViewportIsMobile(false);
    const onMobileClose = vi.fn();
    const user = userEvent.setup();
    const { container } = renderSidebar({ onMobileClose });
    await act(async () => {});

    expect(container.querySelector('[aria-hidden="true"].fixed')).toBeNull();
    await user.click(screen.getByTitle('Zwiń sidebar'));
    expect(onMobileClose).not.toHaveBeenCalled();
    expect(screen.getByTitle('Rozwiń sidebar')).toBeInTheDocument();
  });
});

describe('OpenWorkspacesButton', () => {
  it('ma etykiete dostepnosci, 44x44 i jest ukryty od md', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<OpenWorkspacesButton onClick={onClick} />);

    const btn = screen.getByRole('button', { name: 'Przestrzenie' });
    expect(btn.className).toContain('h-11');
    expect(btn.className).toContain('w-11');
    expect(btn.className).toContain('md:hidden');
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
