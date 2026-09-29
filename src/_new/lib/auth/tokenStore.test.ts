import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/_new/lib/board-cache/board-cache', () => ({ clearAllBoardCaches: vi.fn() }));

import { clearAllBoardCaches } from '@/_new/lib/board-cache/board-cache';
import { clearSession, getAccessToken, setAccessToken } from './tokenStore';

describe('clearSession', () => {
  beforeEach(() => vi.mocked(clearAllBoardCaches).mockClear());

  it('czyści token i domyślnie zostawia kopie tablic z niewysłanymi zmianami', () => {
    setAccessToken('t');

    clearSession();

    expect(getAccessToken()).toBeNull();
    expect(clearAllBoardCaches).toHaveBeenCalledWith({ keepDirty: true });
  });

  it('keepDirty: false usuwa wszystkie kopie', () => {
    clearSession({ keepDirty: false });

    expect(clearAllBoardCaches).toHaveBeenCalledWith({ keepDirty: false });
  });
});
