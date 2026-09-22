/**
 * Dotyk (projekt `mobile`, devices['Pixel 7']): rysowanie palcem (freedraw)
 * przez CDP Input.dispatchTouchEvent - Playwright `touchscreen` ma tylko tap.
 */

import { test, expect } from '@playwright/test';

test('rysowanie palcem tworzy element freedraw', async ({ page, context }) => {
  const id = `e2e-mobile-${Date.now()}`;
  await page.goto(`/proto-excalidraw/${id}?name=Palec`);
  await page.waitForFunction(() => !!window.__excalidrawAPI, null, { timeout: 90_000 });

  // narzędzie pióro - na telefonie brak skrótów klawiszowych, klikamy w toolbar
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
    .poll(() =>
      page.evaluate(
        () => window.__excalidrawAPI!.getSceneElements().filter((e) => e.type === 'freedraw').length
      )
    )
    .toBeGreaterThanOrEqual(1);
  const free = await page.evaluate(
    () =>
      window.__excalidrawAPI!.getSceneElements().find((e) => e.type === 'freedraw') as unknown as {
        points: number[][];
      }
  );
  expect(free.points.length).toBeGreaterThan(5);
});
