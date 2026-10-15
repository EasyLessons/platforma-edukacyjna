import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as Y from 'yjs';
import { ELEMENTS_KEY } from './excalidraw-binding';
import { countLiveElements, elementLimitLevel, useElementLimit } from './use-element-limit';

const add = (doc: Y.Doc, id: string, isDeleted = false) =>
  doc.getMap<unknown>(ELEMENTS_KEY).set(id, { id, isDeleted });

describe('elementLimitLevel', () => {
  it('progi 80% i 100%', () => {
    expect(elementLimitLevel(799, 1000)).toBe('none');
    expect(elementLimitLevel(800, 1000)).toBe('warn');
    expect(elementLimitLevel(999, 1000)).toBe('warn');
    expect(elementLimitLevel(1000, 1000)).toBe('full');
  });

  it('brak limitu (null/undefined) = none', () => {
    expect(elementLimitLevel(5000, null)).toBe('none');
    expect(elementLimitLevel(5000, undefined)).toBe('none');
  });
});

describe('useElementLimit', () => {
  it('liczy tylko zywe elementy i reaguje na zmiany (takze zdalne tombstony)', () => {
    const doc = new Y.Doc();
    for (let i = 0; i < 8; i++) add(doc, `e${i}`);
    add(doc, 'martwy', true);
    expect(countLiveElements(doc)).toBe(8);

    const { result } = renderHook(() => useElementLimit(doc, 10));
    expect(result.current.count).toBe(8);
    expect(result.current.level).toBe('warn');

    act(() => {
      add(doc, 'e8');
      add(doc, 'e9');
    });
    expect(result.current.level).toBe('full');

    act(() => {
      add(doc, 'e9', true); // gumka / tombstone z serwera
    });
    expect(result.current.count).toBe(9);
    expect(result.current.level).toBe('warn');
  });

  it('limit null: brak banera', () => {
    const doc = new Y.Doc();
    for (let i = 0; i < 20; i++) add(doc, `e${i}`);
    const { result } = renderHook(() => useElementLimit(doc, null));
    expect(result.current.level).toBe('none');
  });
});
