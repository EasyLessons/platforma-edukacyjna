/**
 * Dotyk (projekt `mobile`, devices['Pixel 7']): rysowanie palcem (freedraw) na tablicy
 * Excalidraw przez CDP Input.dispatchTouchEvent - Playwright `touchscreen` ma tylko tap.
 */

import { test, expect } from '@playwright/test';
import { E2E_USERS, liveElements, login, openBoard } from './helpers';

test('rysowanie palcem tworzy element freedraw', async ({ page, context }) => {
  await login(page, E2E_USERS.owner);
  await openBoard(page);

  const before = new Set((await liveElements(page)).map((e) => e.id));
  // Na telefonie bez skrótów klawiszowych - narzędzie z paska.
  await page
    .getByTitle(/^Rysuj/)
    .first()
    .click();

  const cdp = await context.newCDPSession(page);
  const box = (await page.locator('canvas.excalidraw__canvas.interactive').boundingBox())!;
  const x0 = box.x + box.width / 2;
  const y0 = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: x0, y: y0 }],
  });
  for (let i = 1; i <= 20; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + i * 6, y: y0 + Math.sin(i / 3) * 30 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect
    .poll(
      async () =>
        (await liveElements(page)).filter((e) => !before.has(e.id) && e.type === 'freedraw').length
    )
    .toBe(1);
  const free = (await liveElements(page)).find((e) => !before.has(e.id))!;
  expect(free.points!.length).toBeGreaterThan(5);
});
