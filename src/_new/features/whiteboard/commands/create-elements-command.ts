/**
 * commands/create-elements-command.ts
 *
 * Utworzenie jednego lub wielu elementów.
 *  - do   → materializuje elementy (applyRedo 'create')
 *  - undo → usuwa je (applyUndo 'create')
 */

import type { Command, CommandContext } from './types';
import type { DrawingElement } from '@/_new/features/whiteboard/types';
import { createEffect, removeEffect } from './command-effects';

export class CreateElementsCommand implements Command {
  readonly label = 'create';

  constructor(private readonly elements: readonly DrawingElement[]) {}

  do(ctx: CommandContext): void {
    this.elements.forEach((e) => createEffect(ctx, e));
  }

  undo(ctx: CommandContext): void {
    this.elements.forEach((e) => removeEffect(ctx, e));
  }
}
