/**
 * commands/_tests/commands.test.ts
 *
 * Test fidelity: każda komenda musi wywoływać dokładnie te same efekty
 * (i w tej samej kolejności), co pierwotne applyUndo / applyRedo z historii.
 * Atrapa CommandContext zapisuje
 * kolejność wywołań jako listę stringów i porównujemy ją 1:1.
 */

import { describe, it, expect, vi } from 'vitest';
import { CreateElementsCommand } from '../create-elements-command';
import { DeleteElementsCommand } from '../delete-elements-command';
import { UpdateElementsCommand } from '../update-elements-command';
import { CompositeCommand } from '../composite-command';
import type { CommandContext } from '../types';
import type { DrawingElement } from '@/_new/features/whiteboard/types';

function makeCtx(boardId: string | null = '7', unsaved = new Set<string>()) {
  const calls: string[] = [];
  const ctx: CommandContext = {
    addElement: (e) => void calls.push(`add:${e.id}`),
    removeElement: (id) => void calls.push(`remove:${id}`),
    updateElement: (e) => void calls.push(`update:${e.id}`),
    broadcastCreated: (e) => void calls.push(`bcCreated:${e.id}`),
    broadcastDeleted: (id) => void calls.push(`bcDeleted:${id}`),
    broadcastUpdated: (e) => void calls.push(`bcUpdated:${e.id}`),
    saveElement: vi.fn(async (_b: number, e: DrawingElement) => void calls.push(`save:${e.id}`)),
    deleteElement: vi.fn(async (_b: number, id: string) => void calls.push(`del:${id}`)),
    boardIdRef: { current: boardId },
    unsavedElementsRef: { current: unsaved },
  };
  return { ctx, calls };
}

const el = (id: string): DrawingElement =>
  ({ id, type: 'text', x: 0, y: 0, text: '', fontSize: 10, color: '#000' } as DrawingElement);

describe('CreateElementsCommand', () => {
  it('do → add + broadcast + save; undo → remove + broadcast + delete', () => {
    const { ctx, calls } = makeCtx();
    const cmd = new CreateElementsCommand([el('a')]);

    cmd.do(ctx);
    expect(calls).toEqual(['add:a', 'bcCreated:a', 'save:a']);

    calls.length = 0;
    cmd.undo(ctx);
    expect(calls).toEqual(['remove:a', 'bcDeleted:a', 'del:a']);
  });

  it('undo NIE usuwa z bazy gdy element jest "unsaved"', () => {
    const { ctx, calls } = makeCtx('7', new Set(['a']));
    new CreateElementsCommand([el('a')]).undo(ctx);
    expect(calls).toEqual(['remove:a', 'bcDeleted:a']); // brak del:a
  });

  it('boardId NaN → pomija operacje na bazie (stan + broadcast zostają)', () => {
    const { ctx, calls } = makeCtx('not-a-number');
    new CreateElementsCommand([el('a')]).do(ctx);
    expect(calls).toEqual(['add:a', 'bcCreated:a']); // brak save:a
  });

  it('boardId "0" traktowany jak brak bazy (semantyka if(boardId))', () => {
    const { ctx, calls } = makeCtx('0');
    new CreateElementsCommand([el('a')]).do(ctx);
    expect(calls).toEqual(['add:a', 'bcCreated:a']); // brak save:a
  });
});

describe('DeleteElementsCommand', () => {
  it('do → remove; undo → add (lustro create)', () => {
    const { ctx, calls } = makeCtx();
    const cmd = new DeleteElementsCommand([el('z')]);

    cmd.do(ctx);
    expect(calls).toEqual(['remove:z', 'bcDeleted:z', 'del:z']);

    calls.length = 0;
    cmd.undo(ctx);
    expect(calls).toEqual(['add:z', 'bcCreated:z', 'save:z']);
  });
});

describe('UpdateElementsCommand', () => {
  it('do → stan "after", undo → stan "before"', () => {
    const { ctx, calls } = makeCtx();
    const cmd = new UpdateElementsCommand([el('x')], [el('x')]);

    cmd.do(ctx);
    expect(calls).toEqual(['update:x', 'bcUpdated:x', 'save:x']);

    calls.length = 0;
    cmd.undo(ctx);
    expect(calls).toEqual(['update:x', 'bcUpdated:x', 'save:x']);
  });
});

describe('CompositeCommand', () => {
  it('do w kolejności, undo w odwrotnej', () => {
    const { ctx, calls } = makeCtx();
    const cmd = new CompositeCommand([
      new CreateElementsCommand([el('a')]),
      new CreateElementsCommand([el('b')]),
    ]);

    cmd.do(ctx);
    expect(calls).toEqual([
      'add:a', 'bcCreated:a', 'save:a',
      'add:b', 'bcCreated:b', 'save:b',
    ]);

    calls.length = 0;
    cmd.undo(ctx);
    expect(calls).toEqual([
      'remove:b', 'bcDeleted:b', 'del:b',
      'remove:a', 'bcDeleted:a', 'del:a',
    ]);
  });
});
