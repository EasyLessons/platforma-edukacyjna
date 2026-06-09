/**
 * commands/from-user-action.ts — ADAPTER zgodności wstecznej (Faza 0)
 *
 * Most między starym światem (UserAction) a nowym (Command).
 * Pozwala zostawić wywołania pushUserAction(...) w whiteboard-canvas.tsx
 * i use-clipboard.ts BEZ ZMIAN, podczas gdy historia operuje już wyłącznie
 * na Commandach.
 *
 * Do usunięcia w Fazie 3 wraz z typem UserAction.
 */

import type { UserAction } from '@/_new/features/whiteboard/types';
import type { Command } from './types';
import { CreateElementsCommand } from './create-elements-command';
import { DeleteElementsCommand } from './delete-elements-command';
import { UpdateElementsCommand } from './update-elements-command';
import { CompositeCommand } from './composite-command';

export function commandFromUserAction(action: UserAction): Command {
  switch (action.type) {
    case 'create':
      return new CreateElementsCommand([action.element]);
    case 'delete':
      return new DeleteElementsCommand([action.element]);
    case 'update':
      return new UpdateElementsCommand([action.before], [action.after]);
    case 'batch':
      return new CompositeCommand(action.actions.map(commandFromUserAction));
  }
}
