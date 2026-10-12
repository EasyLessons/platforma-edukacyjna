/**
 * E2E elementów EasyLesson na tablicy Excalidraw (etap B2): tworzenie -> druga osoba widzi -> F5 -> nadal jest.
 */

import { test, expect, type Page } from '@playwright/test';
import { E2E_USERS, closeBoard, liveElements, makePdf, openBoardAs } from './helpers';

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

test('tabela: utworzenie, dodanie wiersza, widoczna u drugiej osoby i po F5', async ({
  browser,
}) => {
  const a = await openBoardAs(browser, E2E_USERS.owner);
  const b = await openBoardAs(browser, E2E_USERS.editor);
  const tableCells = async (page: Page) =>
    (await liveElements(page)).filter((e) => e.customData?.kind === 'table-cell');
  const before = (await tableCells(a)).length;

  await a.getByTestId('element-insert-table').filter({ visible: true }).click();
  await expect.poll(async () => (await tableCells(a)).length).toBe(before + 9);

  // Mini-pasek tabeli (tabela zaznaczona po wstawieniu): + wiersz
  await a.getByTestId('table-add-row').click();
  await expect.poll(async () => (await tableCells(a)).length).toBe(before + 12);
  const ids = (await tableCells(a)).map((e) => e.id).sort();

  await expect.poll(async () => (await tableCells(b)).map((e) => e.id).sort()).toEqual(ids);

  await a.reload();
  await a.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  await expect.poll(async () => (await tableCells(a)).map((e) => e.id).sort()).toEqual(ids);

  await closeBoard(a);
  await closeBoard(b);
});

test('PDF: strony jako obrazy, widoczne u drugiej osoby i po F5; zły plik = komunikat', async ({
  browser,
}) => {
  const a = await openBoardAs(browser, E2E_USERS.owner);
  const b = await openBoardAs(browser, E2E_USERS.editor);
  const pdfPages = async (page: Page) =>
    (await liveElements(page)).filter((e) => e.customData?.kind === 'pdf-page');
  const before = new Set((await pdfPages(a)).map((e) => e.id));

  await expect(a.getByTestId('element-insert-pdf').filter({ visible: true })).toHaveCount(1);
  await a.getByTestId('pdf-file-input').setInputFiles({
    name: 'zadania.pdf',
    mimeType: 'application/pdf',
    buffer: makePdf(['Zadanie 1', 'Zadanie 2']),
  });
  await expect(a.getByTestId('pdf-status')).toHaveText('Dodano PDF: 2 strony', { timeout: 60_000 });
  const added = (await pdfPages(a)).filter((e) => !before.has(e.id));
  expect(added.map((e) => e.type)).toEqual(['image', 'image']);
  const ids = added.map((e) => e.id).sort();

  // Pliki stron idą do Storage jak każdy obraz (#106) - druga osoba widzi strony
  await expect
    .poll(async () =>
      (await pdfPages(b))
        .map((e) => e.id)
        .filter((id) => ids.includes(id))
        .sort()
    )
    .toEqual(ids);

  await a.reload();
  await a.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  await expect
    .poll(async () =>
      (await pdfPages(a))
        .map((e) => e.id)
        .filter((id) => ids.includes(id))
        .sort()
    )
    .toEqual(ids);

  await a.getByTestId('pdf-file-input').setInputFiles({
    name: 'zly.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('to nie jest pdf'),
  });
  await expect(a.getByTestId('pdf-status')).toContainText('Nie udało się otworzyć pliku PDF');

  await closeBoard(a);
  await closeBoard(b);
});

test('viewer: bez przycisków notatki, tabeli i PDF', async ({ browser }) => {
  const v = await openBoardAs(browser, E2E_USERS.viewer);
  await expect(v.getByTestId('element-insert-note')).toHaveCount(0);
  await expect(v.getByTestId('element-insert-table')).toHaveCount(0);
  await expect(v.getByTestId('element-insert-pdf')).toHaveCount(0);
  await closeBoard(v);
});
