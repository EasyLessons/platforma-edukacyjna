import { describe, it, expect } from 'vitest';
import { isRemoteBoard } from './use-board-connection';

describe('isRemoteBoard', () => {
  it('zalogowany użytkownik i liczbowe id tablicy -> whiteboard-sync', () => {
    expect(isRemoteBoard('42', 7)).toBe(true);
  });

  it('demo, gość albo brak id -> tylko dokument lokalny', () => {
    expect(isRemoteBoard('demo-abc', 7)).toBe(false);
    expect(isRemoteBoard('42', null)).toBe(false);
    expect(isRemoteBoard('', 7)).toBe(false);
  });
});
