/**
 * Rozmowa na telefonie (projekt `mobile`, Pixel 7): przycisk "Rozmowa" jest pływającym
 * przyciskiem nad stopką Excalidraw, a brak klucza Daily kończy się komunikatem.
 */

import { test, expect } from '@playwright/test';
import { E2E_USERS, login, openBoard } from './helpers';

test('telefon: przycisk Rozmowa widoczny, bez klucza Daily komunikat zamiast ramki', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await login(page, E2E_USERS.owner);
  await openBoard(page);

  const button = page.getByTestId('call-button').filter({ visible: true });
  await expect(button).toHaveCount(1);
  await button.click();

  await expect(page.getByTestId('call-notice')).toBeVisible();
  await expect(page.getByTestId('call-panel')).toBeHidden();
  await expect(page.getByTestId('call-frame').locator('iframe')).toHaveCount(0);
  expect(errors).toEqual([]);
});
