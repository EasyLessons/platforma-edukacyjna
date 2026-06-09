/**
 * commands/composite-command.ts
 *
 * Złożenie wielu komend w jedną atomową operację undo/redo
 * (zastępuje dawne { type: 'batch' }).
 *
 * Kolejność jest istotna i zgodna z poprzednią implementacją:
 *  - do   → w kolejności            (action.actions.forEach(applyRedo))
 *  - undo → w kolejności ODWROTNEJ  ([...actions].reverse().forEach(applyUndo))
 */

import type { Command, CommandContext } from './types';

export class CompositeCommand implements Command {
  readonly label: string;

  constructor(
    private readonly commands: readonly Command[],
    label = 'batch',
  ) {
    this.label = label;
  }

  do(ctx: CommandContext): void {
    this.commands.forEach((c) => c.do(ctx));
  }

  undo(ctx: CommandContext): void {
    [...this.commands].reverse().forEach((c) => c.undo(ctx));
  }
}
