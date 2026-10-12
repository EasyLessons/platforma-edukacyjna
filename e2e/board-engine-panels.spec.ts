/**
 * E2E paneli EasyLesson przy tablicy Excalidraw (etap B1): otwarcie i zamknięcie panelu,
 * panel nie zmienia tablicy, wstawienie wzoru z SmartSearch, viewer bez paneli zmieniających tablicę.
 */

import { test, expect } from '@playwright/test';
import { E2E_USERS, closeBoard, liveElements, openBoardAs } from './helpers';

test('kalkulator: otwarcie z przycisku, liczenie, zamknięcie', async ({ browser }) => {
  const page = await openBoardAs(browser, E2E_USERS.owner);
  const before = (await liveElements(page)).length;

  const toggle = page.getByTestId('panel-toggle-calculator').filter({ visible: true });
  await toggle.click();
  const panel = page.getByTestId('panel-calculator');
  await expect(panel).toBeVisible();

  await panel.getByRole('button', { name: '7', exact: true }).click();
  await panel.getByRole('button', { name: '×', exact: true }).click();
  await panel.getByRole('button', { name: '6', exact: true }).click();
  await panel.getByRole('button', { name: '=', exact: true }).click();
  await expect(panel).toContainText('42');

  // Kalkulator nie wstawia niczego na tablicę
  expect((await liveElements(page)).length).toBe(before);

  // Ten sam przycisk zamyka panel
  await toggle.click();
  await expect(panel).toHaveCount(0);

  await closeBoard(page);
});

test('wzory: wyszukanie i wstawienie obrazu wzoru, widoczny u drugiej osoby', async ({
  browser,
}) => {
  const a = await openBoardAs(browser, E2E_USERS.owner);
  const b = await openBoardAs(browser, E2E_USERS.editor);
  const before = new Set((await liveElements(a)).map((e) => e.id));

  await a.getByTestId('panel-toggle-search').filter({ visible: true }).click();
  const search = a.getByTestId('panel-search');
  const input = search.locator('input');
  await expect(input).toBeFocused();
  await input.fill('ciąg arytmetyczny');
  await expect(search.locator('li').first()).toBeVisible();
  await input.press('Enter');

  // Wybór wzoru zamyka wyszukiwarkę i wstawia obraz na środek widoku
  await expect(search).toHaveCount(0);
  await expect
    .poll(async () => (await liveElements(a)).filter((e) => !before.has(e.id)).map((e) => e.type))
    .toEqual(['image']);
  await expect(a.getByTestId('panel-notice')).toContainText('Dodano');
  const formula = (await liveElements(a)).find((e) => !before.has(e.id))!;

  // Obraz idzie przez Storage jak wklejony plik - druga osoba widzi element
  await expect
    .poll(async () => (await liveElements(b)).some((e) => e.id === formula.id))
    .toBe(true);

  await closeBoard(a);
  await closeBoard(b);
});

test('viewer: kalkulator dostępny (nie zmienia tablicy), bez panelu wzorów', async ({
  browser,
}) => {
  const v = await openBoardAs(browser, E2E_USERS.viewer);
  await expect
    .poll(() => v.evaluate(() => window.__boardEngine!.api.getAppState().viewModeEnabled))
    .toBe(true);

  await v.getByTestId('panel-toggle-calculator').filter({ visible: true }).click();
  await expect(v.getByTestId('panel-calculator')).toBeVisible();
  await expect(v.getByTestId('panel-toggle-search')).toHaveCount(0);

  await closeBoard(v);
});
