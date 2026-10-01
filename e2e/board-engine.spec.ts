/**
 * E2E tablicy na Excalidraw (NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw) na pełnym stosie:
 * backend (seed) + whiteboard-sync z autoryzacją + frontend.
 *
 * Dwie przeglądarki (osobne konteksty, dwóch użytkowników z jednego workspace'u) na tej
 * samej tablicy: zmiany w A widać w B, kursory przez awareness, F5 nie gubi treści,
 * viewer ma tryb tylko do odczytu, wykres f(x) i eksport PNG działają.
 * Dotyk: board-engine.mobile.spec.ts (projekt `mobile`).
 */

import { test, expect } from '@playwright/test';
import {
  E2E_USERS,
  closeBoard,
  drag,
  drawRect,
  liveElements,
  openBoardAs,
  sceneCenter,
  selectTool,
  toScreen,
} from './helpers';

test('współpraca A↔B: rysowanie, przesunięcie, usunięcie, kursor i F5', async ({ browser }) => {
  const a = await openBoardAs(browser, E2E_USERS.owner);
  const b = await openBoardAs(browser, E2E_USERS.editor);

  // Awareness: każdy widzi drugą osobę jako współpracownika
  await expect
    .poll(() => b.evaluate(() => window.__boardEngine!.api.getAppState().collaborators.size))
    .toBeGreaterThanOrEqual(1);

  const c = await sceneCenter(a);
  const rect = await drawRect(a, c.x - 60, c.y - 40);

  // Rysowanie w A -> element w B
  await expect.poll(async () => (await liveElements(b)).some((e) => e.id === rect.id)).toBe(true);

  // Przesunięcie w A (prostokąt jest zaznaczony po narysowaniu - przeciągamy jego krawędź)
  const from = await toScreen(a, rect.x, rect.y + rect.height / 2);
  await drag(a, from, { x: from.x + 100, y: from.y + 50 });
  const moved = (await liveElements(a)).find((e) => e.id === rect.id)!;
  expect(moved.x).not.toBe(rect.x);
  await expect
    .poll(async () => Math.round((await liveElements(b)).find((e) => e.id === rect.id)!.x))
    .toBe(Math.round(moved.x));

  // Kursor A widoczny w B (pointer w awareness)
  await a.mouse.move(from.x + 20, from.y + 20);
  await expect
    .poll(() =>
      b.evaluate(() =>
        [...window.__boardEngine!.api.getAppState().collaborators.values()].some((c) => !!c.pointer)
      )
    )
    .toBe(true);

  // F5 w B - treść wraca z serwera / kopii lokalnej
  await b.reload();
  await b.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  await expect.poll(async () => (await liveElements(b)).some((e) => e.id === rect.id)).toBe(true);

  // Usunięcie w A -> znika w B
  await a.keyboard.press('Delete');
  await expect.poll(async () => (await liveElements(b)).some((e) => e.id === rect.id)).toBe(false);

  await closeBoard(a);
  await closeBoard(b);
});

test('viewer: tryb tylko do odczytu, bez panelu f(x)', async ({ browser }) => {
  const v = await openBoardAs(browser, E2E_USERS.viewer);
  await expect
    .poll(() => v.evaluate(() => window.__boardEngine!.api.getAppState().viewModeEnabled))
    .toBe(true);
  await expect(v.getByTestId('function-panel-toggle')).toHaveCount(0);

  const before = (await liveElements(v)).length;
  const c = await sceneCenter(v);
  await v.keyboard.press('r');
  await drag(v, await toScreen(v, c.x, c.y), await toScreen(v, c.x + 100, c.y + 60));
  expect((await liveElements(v)).length).toBe(before);

  await closeBoard(v);
});

test('wykres f(x): dodanie z panelu, bez błędu SVG, widoczny u drugiej osoby', async ({
  browser,
}) => {
  const a = await openBoardAs(browser, E2E_USERS.owner);
  const errors: string[] = [];
  a.on('console', (msg) => {
    if (msg.type() === 'error' && /InvalidCharacterError/.test(msg.text())) errors.push(msg.text());
  });
  const b = await openBoardAs(browser, E2E_USERS.editor);

  const before = new Set((await liveElements(a)).map((e) => e.id));
  await a.getByTestId('function-panel-toggle').filter({ visible: true }).click();
  await a.getByTestId('function-expression').filter({ visible: true }).fill('x^2 - 3');
  await a.getByTestId('function-submit').filter({ visible: true }).click();

  await expect
    .poll(async () =>
      (await liveElements(a)).find((e) => !before.has(e.id) && e.customData?.kind === 'function')
    )
    .toBeTruthy();
  const fn = (await liveElements(a)).find(
    (e) => !before.has(e.id) && e.customData?.kind === 'function'
  )!;
  expect(fn.customData?.spec?.expression).toBe('x^2 - 3');

  await expect
    .poll(() =>
      b.evaluate(
        (fileId) => window.__boardEngine!.api.getFiles()[fileId as string]?.mimeType ?? null,
        fn.fileId
      )
    )
    .toBe('image/svg+xml');
  expect(errors).toEqual([]);

  await closeBoard(a);
  await closeBoard(b);
});

test('eksport PNG całej sceny', async ({ browser }) => {
  const page = await openBoardAs(browser, E2E_USERS.owner);
  const c = await sceneCenter(page);
  await drawRect(page, c.x - 50, c.y - 30);
  const size = await page.evaluate(() => window.__boardEngine!.exportPng());
  expect(size).toBeGreaterThan(1000);
  await closeBoard(page);
});

test('kształt ma domyślne lekkie wypełnienie i klik w środek go zaznacza', async ({ browser }) => {
  const page = await openBoardAs(browser, E2E_USERS.owner);
  const c = await sceneCenter(page);
  const rect = await drawRect(page, c.x - 80, c.y - 50, 160, 100);
  const stored = (await liveElements(page)).find((e) => e.id === rect.id) as unknown as {
    backgroundColor: string;
  };
  expect(stored.backgroundColor).not.toBe('transparent');

  // Odznacz (Escape), potem klik w środek prostokąta narzędziem zaznaczania
  await page.keyboard.press('Escape');
  await selectTool(page, /^Zaznaczenie/);
  const mid = await toScreen(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.click(mid.x, mid.y);
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys(window.__boardEngine!.api.getAppState().selectedElementIds))
    )
    .toEqual([rect.id]);

  // Pióro po prostokącie nie dziedziczy wypełnienia
  await selectTool(page, /^Rysuj/);
  await expect
    .poll(() =>
      page.evaluate(() => window.__boardEngine!.api.getAppState().currentItemBackgroundColor)
    )
    .toBe('transparent');
  await closeBoard(page);
});

test('fonty Excalidraw z własnego serwera, bez CDN', async ({ browser }) => {
  const fontRequests: string[] = [];
  const page = await openBoardAs(browser, E2E_USERS.owner);
  page.on('request', (req) => {
    if (/\.woff2(\?|$)/.test(req.url()) || req.url().includes('esm.sh'))
      fontRequests.push(req.url());
  });
  // Tekst wymusza załadowanie fontu Excalifont
  const c = await sceneCenter(page);
  await selectTool(page, /^Tekst/);
  const at = await toScreen(page, c.x, c.y);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.type('zażółć gęślą jaźń');
  await page.keyboard.press('Escape');

  await expect.poll(() => fontRequests.length).toBeGreaterThan(0);
  console.log('[fonty]', fontRequests.map((u) => new URL(u).pathname).join(', '));
  expect(fontRequests.filter((u) => !u.includes('/excalidraw-assets/fonts/'))).toEqual([]);
  await closeBoard(page);
});
