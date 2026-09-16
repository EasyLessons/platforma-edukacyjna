import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useYjsBoard } from './use-yjs-board';
import { upsertElement } from '../yjs/board-doc';
import type { Shape, ImageElement } from '../types';

const shape = (id: string): Shape => ({
  id,
  type: 'shape',
  shapeType: 'rectangle',
  startX: 0,
  startY: 0,
  endX: 10,
  endY: 10,
  color: '#ff0000',
  strokeWidth: 1,
  fill: true,
});

describe('useYjsBoard', () => {
  it('mutators.upsert dodaje element do elements/elementsRef/spatialIndex', () => {
    const { result } = renderHook(() => useYjsBoard({ userId: 1, username: 'Ala' }));

    act(() => result.current.mutators.upsert(shape('a')));

    expect(result.current.elements.map((e) => e.id)).toEqual(['a']);
    expect(result.current.elementsRef.current.map((e) => e.id)).toEqual(['a']);
    expect(result.current.spatialIndex.size).toBe(1);
  });

  it('mutators.delete usuwa element z elements i spatialIndex', () => {
    const { result } = renderHook(() => useYjsBoard({ userId: 1, username: 'Ala' }));

    act(() => result.current.mutators.upsert(shape('a')));
    act(() => result.current.mutators.delete('a'));

    expect(result.current.elements).toEqual([]);
    expect(result.current.spatialIndex.size).toBe(0);
  });

  it('mutators.batch - kolejność wejściowa, jedna pozycja undo', () => {
    const { result } = renderHook(() => useYjsBoard({ userId: 1, username: 'Ala' }));

    act(() => result.current.mutators.batch([shape('a'), shape('b'), shape('c')]));

    expect(result.current.elements.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.elements).toEqual([]);
  });

  it('elementsWithAuthor niesie userId/username przekazane do hooka', () => {
    const { result } = renderHook(() => useYjsBoard({ userId: 7, username: 'Kasia' }));

    act(() => result.current.mutators.upsert(shape('a')));

    const [row] = result.current.elementsWithAuthor;
    expect(row.created_by_id).toBe(7);
    expect(row.created_by_username).toBe('Kasia');
  });

  it('undo cofa tylko zmiany bieżącego usera (origin = userId)', () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: number }) => useYjsBoard({ userId, username: 'Ala' }),
      { initialProps: { userId: 1 } }
    );

    act(() => result.current.mutators.upsert(shape('mine')));

    // Symulacja zmiany zdalnej pod innym originem - bezpośrednio przez board-doc,
    // z pominięciem `mutators` (który zawsze pisze jako bieżący userId).
    act(() => upsertElement(result.current.doc, shape('other'), 999));
    rerender({ userId: 1 });

    act(() => result.current.undo());

    expect(result.current.elements.map((e) => e.id).sort()).toEqual(['other']);
  });

  describe('loadImage', () => {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    }

    beforeEach(() => {
      vi.stubGlobal('Image', FakeImage);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('doładowuje bitmapę dla nowego elementu image', async () => {
      const { result } = renderHook(() => useYjsBoard({ userId: 1, username: 'Ala' }));
      const img: ImageElement = {
        id: 'img1',
        type: 'image',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        src: 'data:image/png;base64,xxx',
      };

      act(() => result.current.mutators.upsert(img));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.loadedImages.has('img1')).toBe(true);
    });
  });
});
