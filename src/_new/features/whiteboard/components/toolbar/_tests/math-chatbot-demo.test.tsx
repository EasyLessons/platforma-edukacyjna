/**
 * Tryb demo w Tutorze AI.
 *
 * Gosc demo nie ma tokenu JWT (demo/guest-identity.ts daje tylko tozsamosc
 * kliencka), a /api/chat od PR #34 wymaga zalogowania. Te testy pilnuja, ze
 * w demo zamiast pytania leci prosba o zalogowanie i ZADNE zadanie nie wychodzi.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/_new/lib/auth', () => ({
  getAccessToken: vi.fn(() => null),
  refreshAccessToken: vi.fn(async () => null),
}));

// react-markdown i wtyczki to czysty ESM i nie sa potrzebne do tych testow —
// w trybie demo panel z wiadomosciami i tak sie nie renderuje.
vi.mock('react-markdown', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('remark-gfm', () => ({ default: () => {} }));
vi.mock('remark-math', () => ({ default: () => {} }));
vi.mock('rehype-katex', () => ({ default: () => {} }));

import { MathChatbot } from '../math-chatbot';

function renderChatbot(props: Record<string, unknown> = {}) {
  return render(
    <MathChatbot
      canvasWidth={1200}
      canvasHeight={800}
      messages={[]}
      setMessages={vi.fn()}
      {...props}
    />
  );
}

/** Rozwija czat — komponent startuje zwiniety do babelka "Tutor AI". */
async function otworzTutora(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /tutor ai/i }));
}

describe('MathChatbot — tryb demo', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushMock.mockClear();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('pokazuje prosbe o zalogowanie zamiast czatu', async () => {
    const user = userEvent.setup();
    renderChatbot({ isDemo: true });
    await otworzTutora(user);

    expect(screen.getByText(/zaloguj sie, aby korzystac z tutora ai/i)).toBeInTheDocument();
    // Brak pola wpisywania = strukturalnie nie da sie wyslac pytania.
    expect(screen.queryByPlaceholderText(/zadaj pytanie/i)).not.toBeInTheDocument();
  });

  it('NIE wysyla zadnego zadania do /api/chat', async () => {
    const user = userEvent.setup();
    renderChatbot({ isDemo: true });
    await otworzTutora(user);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('przycisk logowania prowadzi na /login', async () => {
    const user = userEvent.setup();
    renderChatbot({ isDemo: true });
    await otworzTutora(user);

    await user.click(screen.getByRole('button', { name: /^zaloguj sie$/i }));
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('przyciski w panelu demo maja kursor raczki', async () => {
    const user = userEvent.setup();
    renderChatbot({ isDemo: true });
    await otworzTutora(user);

    // Tailwind v4 nie daje przyciskom cursor: pointer z automatu — musi byc jawnie.
    expect(screen.getByRole('button', { name: /^zaloguj sie$/i })).toHaveClass('cursor-pointer');
    expect(screen.getByRole('button', { name: /zamknij/i })).toHaveClass('cursor-pointer');
  });

  it('poza demo dziala normalnie — jest pole wpisywania, nie ma prosby o logowanie', async () => {
    const user = userEvent.setup();
    renderChatbot({ isDemo: false });
    await otworzTutora(user);

    expect(screen.getByPlaceholderText(/zadaj pytanie/i)).toBeInTheDocument();
    expect(screen.queryByText(/zaloguj sie, aby korzystac z tutora ai/i)).not.toBeInTheDocument();
  });
});
