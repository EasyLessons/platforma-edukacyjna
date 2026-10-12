/**
 * E2E paneli EasyLesson przy tablicy Excalidraw (etap B1): otwarcie i zamknięcie panelu,
 * panel nie zmienia tablicy, viewer ma panele tylko do odczytu.
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

test('viewer: kalkulator dostępny (nie zmienia tablicy)', async ({ browser }) => {
  const v = await openBoardAs(browser, E2E_USERS.viewer);
  await expect
    .poll(() => v.evaluate(() => window.__boardEngine!.api.getAppState().viewModeEnabled))
    .toBe(true);

  await v.getByTestId('panel-toggle-calculator').filter({ visible: true }).click();
  await expect(v.getByTestId('panel-calculator')).toBeVisible();

  await closeBoard(v);
});
