import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as Y from 'yjs';

type ProviderConfig = {
  token?: () => Promise<string>;
  onStatus?: (d: { status: string }) => void;
  onSynced?: (d: { state: boolean }) => void;
  onAuthenticated?: () => void;
  onAuthenticationFailed?: (d: { reason: string }) => void;
};

type FakeProvider = {
  config: ProviderConfig;
  destroy: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  emit: (event: string, value: unknown) => void;
};

const { providers } = vi.hoisted(() => ({ providers: [] as FakeProvider[] }));

vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: class {
    config: ProviderConfig;
    destroy = vi.fn();
    connect = vi.fn();
    listeners = new Map<string, (value: unknown) => void>();
    constructor(config: ProviderConfig) {
      this.config = config;
      providers.push(this as unknown as FakeProvider);
    }
    on(event: string, fn: (value: unknown) => void) {
      this.listeners.set(event, fn);
    }
    off(event: string) {
      this.listeners.delete(event);
    }
    emit(event: string, value: unknown) {
      this.listeners.get(event)?.(value);
    }
  },
}));

vi.mock('@/_new/lib/auth/tokenStore', () => ({ getAccessToken: vi.fn() }));
vi.mock('@/_new/lib/auth/tokenService', () => ({
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

import { getAccessToken } from '@/_new/lib/auth/tokenStore';
import { isTokenExpired, refreshAccessToken } from '@/_new/lib/auth/tokenService';
import { RefreshUnavailableError } from '@/_new/lib/auth/refresh-error';
import { useYjsSync, ACCESS_DENIED, SESSION_EXPIRED } from './use-yjs-sync';

function render(options: { boardId?: string; userId?: number | null; enabled?: boolean } = {}) {
  const doc = new Y.Doc();
  return renderHook(
    (props: { enabled: boolean }) =>
      useYjsSync({
        doc,
        boardId: options.boardId ?? '1',
        userId: options.userId === undefined ? 1 : options.userId,
        enabled: props.enabled,
      }),
    { initialProps: { enabled: options.enabled ?? true } }
  );
}

beforeEach(() => {
  providers.length = 0;
  vi.clearAllMocks();
  vi.mocked(getAccessToken).mockReturnValue('token');
  vi.mocked(isTokenExpired).mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useYjsSync - połączenie i stan', () => {
  it('hasSynced to zatrzask, isSynced śledzi stan bieżący', () => {
    const { result } = render();

    act(() => providers[0].config.onSynced?.({ state: true }));
    expect(result.current.hasSynced).toBe(true);
    expect(result.current.isSynced).toBe(true);

    act(() => providers[0].config.onSynced?.({ state: false }));
    expect(result.current.hasSynced).toBe(true);
    expect(result.current.isSynced).toBe(false);
  });

  it('enabled: false nie tworzy providera, włączenie go tworzy', () => {
    const { rerender } = render({ enabled: false });
    expect(providers).toHaveLength(0);

    rerender({ enabled: true });
    expect(providers).toHaveLength(1);
  });

  it('bez userId nie tworzy providera', () => {
    render({ userId: null });
    expect(providers).toHaveLength(0);
  });

  it('przekazuje licznik niepotwierdzonych zmian z providera', () => {
    const { result } = render();

    act(() => providers[0].emit('unsyncedChanges', 3));

    expect(result.current.unsyncedChanges).toBe(3);
  });

  it('odmontowanie niszczy provider', () => {
    const { unmount } = render();
    unmount();
    expect(providers[0].destroy).toHaveBeenCalled();
  });
});

describe('useYjsSync - odmowy i ponawianie', () => {
  it('access-denied: authError i brak ponowień', () => {
    vi.useFakeTimers();
    const { result } = render();

    act(() => providers[0].config.onAuthenticationFailed?.({ reason: ACCESS_DENIED }));
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.authError).toBe(ACCESS_DENIED);
    expect(providers[0].connect).not.toHaveBeenCalled();
  });

  it('przejściowa odmowa: ponowienie z rosnącym odstępem, bez authError', () => {
    vi.useFakeTimers();
    const { result } = render();

    act(() => providers[0].config.onAuthenticationFailed?.({ reason: 'server-unavailable' }));
    act(() => vi.advanceTimersByTime(1_999));
    expect(providers[0].connect).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(providers[0].connect).toHaveBeenCalledTimes(1);

    act(() => providers[0].config.onAuthenticationFailed?.({ reason: 'token-expired' }));
    act(() => vi.advanceTimersByTime(4_999));
    expect(providers[0].connect).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(providers[0].connect).toHaveBeenCalledTimes(2);

    expect(result.current.authError).toBeNull();
  });

  it('udane uwierzytelnienie zeruje odstęp ponowień', () => {
    vi.useFakeTimers();
    render();

    act(() => providers[0].config.onAuthenticationFailed?.({ reason: 'server-unavailable' }));
    act(() => vi.advanceTimersByTime(2_000));
    act(() => providers[0].config.onAuthenticated?.());
    act(() => providers[0].config.onAuthenticationFailed?.({ reason: 'server-unavailable' }));
    act(() => vi.advanceTimersByTime(2_000));

    expect(providers[0].connect).toHaveBeenCalledTimes(2);
  });
});

describe('useYjsSync - token', () => {
  it('ważny token idzie bez refreshu', async () => {
    render();

    await expect(providers[0].config.token?.()).resolves.toBe('token');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('wygasły token jest odświeżany', async () => {
    vi.mocked(isTokenExpired).mockReturnValue(true);
    vi.mocked(refreshAccessToken).mockResolvedValue('fresh');
    render();

    await expect(providers[0].config.token?.()).resolves.toBe('fresh');
  });

  it('odrzucony refresh: session-expired, bez ponowień', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Refresh failed'));
    const { result } = render();

    await expect(providers[0].config.token?.()).rejects.toThrow('Refresh failed');
    vi.useFakeTimers();
    act(() => providers[0].config.onAuthenticationFailed?.({ reason: 'Failed to get token' }));
    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.authError).toBe(SESSION_EXPIRED);
    expect(providers[0].connect).not.toHaveBeenCalled();
  });

  it('refresh niedostępny (brak sieci): ponowienie, bez authError', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);
    vi.mocked(refreshAccessToken).mockRejectedValue(new RefreshUnavailableError());
    const { result } = render();

    await expect(providers[0].config.token?.()).rejects.toBeInstanceOf(RefreshUnavailableError);
    vi.useFakeTimers();
    act(() => providers[0].config.onAuthenticationFailed?.({ reason: 'Failed to get token' }));
    act(() => vi.advanceTimersByTime(2_000));

    expect(result.current.authError).toBeNull();
    expect(providers[0].connect).toHaveBeenCalledTimes(1);
  });
});
