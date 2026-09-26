import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as Y from 'yjs';

type ProviderConfig = {
  onStatus?: (d: { status: string }) => void;
  onSynced?: (d: { state: boolean }) => void;
  onAuthenticationFailed?: (d: { reason: string }) => void;
};

const { providers } = vi.hoisted(() => ({
  providers: [] as Array<{ config: ProviderConfig; destroy: () => void }>,
}));

vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: class {
    config: ProviderConfig;
    destroy = vi.fn();
    constructor(config: ProviderConfig) {
      this.config = config;
      providers.push(this);
    }
  },
}));

vi.mock('@/_new/lib/auth/tokenStore', () => ({ getAccessToken: () => 'token' }));

import { useYjsSync } from './use-yjs-sync';

describe('useYjsSync', () => {
  beforeEach(() => {
    providers.length = 0;
  });

  it('hasSynced = true po pierwszym onSynced i zostaje przy reconnect', () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useYjsSync({ doc, boardId: '1', userId: 1 }));
    expect(result.current.hasSynced).toBe(false);

    act(() => providers[0].config.onSynced?.({ state: true }));
    expect(result.current.hasSynced).toBe(true);

    act(() => providers[0].config.onSynced?.({ state: false }));
    expect(result.current.hasSynced).toBe(true);
  });

  it('ustawia authError po odrzuceniu uwierzytelniania', () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useYjsSync({ doc, boardId: '1', userId: 1 }));

    act(() => providers[0].config.onAuthenticationFailed?.({ reason: 'forbidden' }));
    expect(result.current.authError).toBe('forbidden');
  });

  it('bez userId nie tworzy providera', () => {
    const doc = new Y.Doc();
    const { result } = renderHook(() => useYjsSync({ doc, boardId: '1', userId: null }));
    expect(providers).toHaveLength(0);
    expect(result.current.hasSynced).toBe(false);
  });

  it('zmiana boardId niszczy stary provider i zeruje hasSynced', () => {
    const doc = new Y.Doc();
    const { result, rerender } = renderHook(
      ({ boardId }) => useYjsSync({ doc, boardId, userId: 1 }),
      { initialProps: { boardId: '1' } }
    );
    act(() => providers[0].config.onSynced?.({ state: true }));

    rerender({ boardId: '2' });
    expect(providers[0].destroy).toHaveBeenCalled();
    expect(providers).toHaveLength(2);
    expect(result.current.hasSynced).toBe(false);
  });
});
