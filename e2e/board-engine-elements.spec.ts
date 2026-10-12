/**
 * E2E elementów EasyLesson na tablicy Excalidraw (etap B2): tworzenie -> druga osoba widzi -> F5 -> nadal jest.
 */

import { test, expect } from '@playwright/test';
import { E2E_USERS, closeBoard, liveElements, openBoardAs } from './helpers';

test('notatka Markdown + KaTeX: utworzenie, edycja, widoczna u drugiej osoby i po F5', async ({
  browser,
}) => {
  const a = await openBoardAs(browser, E2E_USERS.owner);
  const b = await openBoardAs(browser, E2E_USERS.editor);
  const before = new Set((await liveElements(a)).map((e) => e.id));

  // Przycisk "Notatka" wstawia notatkę i od razu otwiera edycję
  await a.getByTestId('element-insert-note').filter({ visible: true }).click();
  const editor = a.locator('[data-testid="board-note"] textarea');
  await expect(editor).toBeVisible();
  await editor.fill('## Twierdzenie Pitagorasa\n\n$a^2 + b^2 = c^2$');
  await editor.blur();

  await expect
    .poll(async () => {
      const added = (await liveElements(a)).filter((e) => !before.has(e.id));
      return added.map((e) => [e.type, e.customData?.content]);
    })
    .toEqual([['embeddable', '## Twierdzenie Pitagorasa\n\n$a^2 + b^2 = c^2$']]);
  const note = (await liveElements(a)).find((e) => !before.has(e.id))!;

  // Render: nagłówek i wzór KaTeX
  const view = a.locator(`[data-note-id="${note.id}"]`);
  await expect(view.getByRole('heading', { name: 'Twierdzenie Pitagorasa' })).toBeVisible();
  await expect(view.locator('.katex')).toHaveCount(1);

  // Druga osoba widzi notatkę z treścią i wzorem
  await expect
    .poll(async () => (await liveElements(b)).find((e) => e.id === note.id)?.customData?.content)
    .toBe('## Twierdzenie Pitagorasa\n\n$a^2 + b^2 = c^2$');
  await expect(b.locator(`[data-note-id="${note.id}"] .katex`)).toHaveCount(1);

  // F5 - notatka zostaje
  await a.reload();
  await a.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  await expect.poll(async () => (await liveElements(a)).some((e) => e.id === note.id)).toBe(true);

  await closeBoard(a);
  await closeBoard(b);
});

test('viewer: bez przycisku notatki, notatkę tylko czyta', async ({ browser }) => {
  const v = await openBoardAs(browser, E2E_USERS.viewer);
  await expect(v.getByTestId('element-insert-note')).toHaveCount(0);
  await closeBoard(v);
});
