import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('prewarmWhiteboardSync', () => {
  beforeEach(() => {
    // Moduł trzyma flagę "prewarmed" i czyta adres przy imporcie - każdy test ładuje go od nowa.
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_WHITEBOARD_SYNC_URL', 'wss://sync.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({} as Response))
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('wysyła GET na adres http(s) sync, tylko raz przy wielu wywołaniach', async () => {
    const { prewarmWhiteboardSync } = await import('./prewarm-sync');

    prewarmWhiteboardSync();
    prewarmWhiteboardSync();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://sync.example.com', {
      mode: 'no-cors',
      cache: 'no-store',
    });
  });

  it('nie rzuca, gdy żądanie się nie powiedzie', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    const { prewarmWhiteboardSync } = await import('./prewarm-sync');

    expect(() => prewarmWhiteboardSync()).not.toThrow();
    // Odrzucona obietnica jest obsłużona przez .catch - brak "unhandled rejection".
    await Promise.resolve();
  });
});
