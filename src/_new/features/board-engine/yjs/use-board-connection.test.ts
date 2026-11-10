import { describe, it, expect } from 'vitest';
import { isRemoteBoard } from './use-board-connection';

describe('isRemoteBoard', () => {
  it('zalogowany użytkownik i liczbowe id tablicy -> whiteboard-sync', () => {
    expect(isRemoteBoard('42', 7)).toBe(true);
  });

  it('brak zalogowanego użytkownika albo id tablicy -> tylko dokument lokalny', () => {
    expect(isRemoteBoard('42', null)).toBe(false);
    expect(isRemoteBoard('', 7)).toBe(false);
    expect(isRemoteBoard('nie-liczba', 7)).toBe(false);
  });

  it('demo łączy się z serwerem bez konta (gość: userId = null)', () => {
    expect(isRemoteBoard('demo-AbCdEfGhIjKlMnOpQrStUv', null)).toBe(true);
    expect(isRemoteBoard('demo-abc', 7)).toBe(true);
  });
});
