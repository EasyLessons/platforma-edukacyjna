import { describe, expect, it } from 'vitest';
import { isSharedPath, sharedFileId, sharedFileUrl, sharedPathOf } from './shared-files';

describe('wspólne pliki - ścieżki', () => {
  it('tylko nasze katalogi, .webp, bez `..` i `//`', () => {
    expect(isSharedPath('templates/arkusze/egzamin-8-2025/p01.webp')).toBe(true);
    expect(isSharedPath('resources/matematyka/wzory/funkcja kwadratowa/delta.webp')).toBe(true);
    expect(isSharedPath('templates/../../etc/passwd.webp')).toBe(false);
    expect(isSharedPath('templates//x.webp')).toBe(false);
    expect(isSharedPath('arkusze/x.webp')).toBe(false);
    expect(isSharedPath('templates/x.png')).toBe(false);
    expect(isSharedPath('https://evil.example/templates/x.webp')).toBe(false);
    expect(isSharedPath(42)).toBe(false);
  });

  it('id <-> ścieżka, adres z zakodowanymi spacjami', () => {
    expect(sharedFileId('/templates/a/p01.webp')).toBe('tpl:templates/a/p01.webp');
    expect(sharedPathOf('tpl:templates/a/p01.webp')).toBe('templates/a/p01.webp');
    expect(sharedPathOf('tpl:inne/a.webp')).toBeNull();
    expect(sharedPathOf('res-123')).toBeNull();
    expect(sharedFileUrl('resources/a b/c.webp')).toBe('/resources/a%20b/c.webp');
    expect(() => sharedFileId('/inne/a.webp')).toThrow();
  });
});
