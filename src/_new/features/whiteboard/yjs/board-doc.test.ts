import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  createBoardDoc,
  getElementsMap,
  getElement,
  getElements,
  getElementsWithAuthor,
  upsertElement,
  upsertElements,
  deleteElement,
  deleteElements,
  hydrate,
} from './board-doc';
import type { DrawingPath, Shape, TextElement } from '../types';

// Fixtures

const path = (id: string): DrawingPath => ({
  id,
  type: 'path',
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  color: '#000000',
  width: 2,
});

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

const text = (id: string): TextElement => ({
  id,
  type: 'text',
  x: 5,
  y: 5,
  text: 'hello',
  fontSize: 16,
  color: '#000000',
});

// upsertElement + getElements

describe('upsertElement + getElements', () => {
  it('round-trip - zapisany element wraca z tymi samymi polami', () => {
    const doc = createBoardDoc();
    const el = path('p1');
    upsertElement(doc, el, 'user-1');
    expect(getElements(doc)).toEqual([el]);
    expect(getElement(doc, 'p1')).toEqual(el);
  });

  it('kolejność wstawiania = z-order zwracany przez getElements', () => {
    const doc = createBoardDoc();
    upsertElement(doc, shape('c'), 'user-1');
    upsertElement(doc, path('a'), 'user-1');
    upsertElement(doc, text('b'), 'user-1');
    expect(getElements(doc).map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });

  it('update nie zmienia z-order elementu', () => {
    const doc = createBoardDoc();
    upsertElement(doc, shape('a'), 'user-1');
    upsertElement(doc, shape('b'), 'user-1');
    upsertElement(doc, shape('c'), 'user-1');

    upsertElement(doc, { ...shape('b'), color: '#00ff00' }, 'user-1');

    expect(getElements(doc).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect((getElement(doc, 'b') as Shape).color).toBe('#00ff00');
  });

  it('update usuwa pola, których nowy element już nie ma', () => {
    const doc = createBoardDoc();
    upsertElement(doc, { ...text('t1'), width: 100 }, 'user-1');
    expect(getElement(doc, 't1')).toHaveProperty('width', 100);

    upsertElement(doc, text('t1'), 'user-1'); // bez `width`
    expect(getElement(doc, 't1')).not.toHaveProperty('width');
  });

  it('bbox nie trafia do dokumentu (liczy go hook, nie board-doc)', () => {
    const doc = createBoardDoc();
    const withBbox: DrawingPath = { ...path('p1'), bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 } };
    upsertElement(doc, withBbox, 'user-1');
    expect(getElement(doc, 'p1')).not.toHaveProperty('bbox');
  });

  it('getElement zwraca null dla nieznanego id', () => {
    const doc = createBoardDoc();
    expect(getElement(doc, 'brak')).toBeNull();
  });
});

// deleteElement

describe('deleteElement', () => {
  it('usuwa element z dokumentu', () => {
    const doc = createBoardDoc();
    upsertElement(doc, shape('a'), 'user-1');
    upsertElement(doc, shape('b'), 'user-1');

    deleteElement(doc, 'a', 'user-1');

    expect(getElement(doc, 'a')).toBeNull();
    expect(getElements(doc).map((e) => e.id)).toEqual(['b']);
  });
});

// deleteElements (batch)

describe('deleteElements (batch)', () => {
  it('usuwa wiele elementów w jednej transakcji (jedno cofnięcie)', () => {
    const doc = createBoardDoc();
    const um = new Y.UndoManager(getElementsMap(doc), { trackedOrigins: new Set(['user-1']) });
    upsertElements(doc, [shape('a'), shape('b'), shape('c')], 'user-1');
    um.stopCapturing(); // nowa transakcja poniżej ma być osobnym krokiem undo

    deleteElements(doc, ['a', 'b', 'c'], 'user-1');
    expect(getElements(doc)).toEqual([]);

    um.undo();
    expect(getElements(doc).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});

// upsertElements (batch)

describe('upsertElements', () => {
  it('zapisuje wiele elementów naraz, w kolejności podanej tablicy', () => {
    const doc = createBoardDoc();
    upsertElements(doc, [shape('a'), path('b'), text('c')], 'user-1');
    expect(getElements(doc).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('to JEDNA transakcja - jedna pozycja na stosie Y.UndoManager', () => {
    const doc = createBoardDoc();
    const um = new Y.UndoManager(getElementsMap(doc), { trackedOrigins: new Set(['user-1']) });

    upsertElements(doc, [shape('a'), path('b'), text('c')], 'user-1');
    expect(um.undoStack.length).toBe(1);

    um.undo();
    expect(getElements(doc)).toEqual([]);
  });
});

// hydrate

describe('hydrate', () => {
  it('zasiewa pusty doc z zachowaniem kolejności wejściowej', () => {
    const doc = createBoardDoc();
    hydrate(doc, [shape('a'), path('b'), text('c')], 'load');
    expect(getElements(doc).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('czyści istniejącą zawartość przed zasiewem', () => {
    const doc = createBoardDoc();
    upsertElement(doc, shape('stary'), 'user-1');

    hydrate(doc, [path('nowy')], 'load');

    expect(getElements(doc).map((e) => e.id)).toEqual(['nowy']);
  });
});

// getElementsWithAuthor

describe('getElementsWithAuthor', () => {
  it('mapuje metadane autora na kształt BoardElementWithAuthor', () => {
    const doc = createBoardDoc();
    upsertElement(doc, shape('a'), 'user-1', { createdBy: 7, createdByName: 'Kasia' });

    const [row] = getElementsWithAuthor(doc);
    expect(row.element_id).toBe('a');
    expect(row.type).toBe('shape');
    expect(row.created_by_id).toBe(7);
    expect(row.created_by_username).toBe('Kasia');
    expect(row.created_at).not.toBeNull();
    expect(new Date(row.created_at as string).toString()).not.toBe('Invalid Date');
    expect(row.data).toEqual(shape('a'));
  });

  it('bez podanych meta — created_by_id/username = null', () => {
    const doc = createBoardDoc();
    upsertElement(doc, shape('a'), 'user-1');
    const [row] = getElementsWithAuthor(doc);
    expect(row.created_by_id).toBeNull();
    expect(row.created_by_username).toBeNull();
  });

  it('update NIE nadpisuje metadanych autora ustawionych przy insert', () => {
    const doc = createBoardDoc();
    upsertElement(doc, shape('a'), 'user-1', { createdBy: 7, createdByName: 'Kasia' });
    upsertElement(doc, { ...shape('a'), color: '#00ff00' }, 'user-1', {
      createdBy: 99,
      createdByName: 'Ktoś inny',
    });

    const [row] = getElementsWithAuthor(doc);
    expect(row.created_by_id).toBe(7);
    expect(row.created_by_username).toBe('Kasia');
  });
});

// origin / Y.UndoManager - "cofnij tylko moje"

describe('origin trafia do transakcji (Y.UndoManager)', () => {
  it('undo cofa tylko zmiany ze śledzonego originu', () => {
    const doc = createBoardDoc();
    const um = new Y.UndoManager(getElementsMap(doc), { trackedOrigins: new Set(['user-1']) });

    upsertElement(doc, shape('mine'), 'user-1');
    upsertElement(doc, shape('other'), 'user-2'); // nieśledzony origin

    um.undo();

    expect(getElement(doc, 'mine')).toBeNull();
    expect(getElement(doc, 'other')).not.toBeNull();
  });
});
