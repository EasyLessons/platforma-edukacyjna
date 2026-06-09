/**
 * commands/update-elements-command.ts
 *
 * Aktualizacja elementów — trzyma stan PRZED i PO.
 *  - do   → aplikuje stan "after"  (applyRedo 'update')
 *  - undo → aplikuje stan "before" (applyUndo 'update')
 *
 * before[] i after[] muszą opisywać te same elementy (po id), w dowolnej,
 * ale spójnej kolejności — jeden wpis "before" na jeden wpis "after".
 */

import type { Command, CommandContext } from './types';
import type { DrawingElement } from '@/_new/features/whiteboard/types';
import { updateEffect } from './command-effects';

export class UpdateElementsCommand implements Command {
  readonly label = 'update';

  constructor(
    private readonly before: readonly DrawingElement[],
    private readonly after: readonly DrawingElement[],
  ) {}

  do(ctx: CommandContext): void {
    this.after.forEach((e) => updateEffect(ctx, e));
  }

  undo(ctx: CommandContext): void {
    this.before.forEach((e) => updateEffect(ctx, e));
  }
}
