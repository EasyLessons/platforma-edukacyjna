import { describe, it, expect } from 'vitest';
import { resolveWhiteboardEngine } from './engine-flag';

describe('resolveWhiteboardEngine', () => {
  it('bez zmiennej albo z inną wartością -> stary silnik', () => {
    expect(resolveWhiteboardEngine(undefined)).toBe('legacy');
    expect(resolveWhiteboardEngine('')).toBe('legacy');
    expect(resolveWhiteboardEngine('tldraw')).toBe('legacy');
    expect(resolveWhiteboardEngine('legacy')).toBe('legacy');
  });

  it('"excalidraw" (bez względu na wielkość liter i spacje) -> Excalidraw', () => {
    expect(resolveWhiteboardEngine('excalidraw')).toBe('excalidraw');
    expect(resolveWhiteboardEngine(' Excalidraw ')).toBe('excalidraw');
  });
});
