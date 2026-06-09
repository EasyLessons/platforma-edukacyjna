/**
 * commands/delete-elements-command.ts
 *
 * Usunięcie jednego lub wielu elementów — lustro CreateElementsCommand.
 *  - do   → usuwa elementy (applyRedo 'delete')
 *  - undo → przywraca je (applyUndo 'delete')
 */

import type { Command, CommandContext } from './types';
import type { DrawingElement } from '@/_new/features/whiteboard/types';
import { createEffect, removeEffect } from './command-effects';

export class DeleteElementsCommand implements Command {
  readonly label = 'delete';

  constructor(private readonly elements: readonly DrawingElement[]) {}

  do(ctx: CommandContext): void {
    this.elements.forEach((e) => removeEffect(ctx, e));
  }

  undo(ctx: CommandContext): void {
    this.elements.forEach((e) => createEffect(ctx, e));
  }
}
