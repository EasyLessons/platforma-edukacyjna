/**
 * E2E wspólnych szablonów: karta arkusza na dashboardzie -> nowa tablica z arkuszem strona pod stroną.
 * Strony to wspólne pliki statyczne (`tpl:`) - żadnego uploadu do Storage tablicy; druga osoba widzi
 * arkusz, F5 nie dubluje stron. Karty wzorów z panelu "Wzory" - ten sam mechanizm (bez uploadu).
 */

import { test, expect, type Page } from '@playwright/test';
import { E2E_USERS, closeBoard, liveElements, openBoardAs, openPageAs, seedState } from './helpers';

const SHEET_PAGES = 25; // egzamin-8-2025 w templates/catalog.ts

const templatePages = async (page: Page) =>
  (await liveElements(page)).filter((e) => e.customData?.kind === 'template-page');

/** Liczy żądania uploadu plików tablicy (POST /api/v1/whiteboard/<id>/files). */
function countUploads(page: Page) {
  const counter = { value: 0 };
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/v1\/whiteboard\/[^/]+\/files/.test(req.url())) {
      counter.value += 1;
    }
  });
  return counter;
}

test('arkusz z dashboardu: strony na tablicy bez uploadu, druga osoba widzi, F5 nie dubluje', async ({
  browser,
}) => {
  const { workspace_id } = seedState();
  const a = await openPageAs(browser, E2E_USERS.owner, `/dashboard?workspace=${workspace_id}`);
  const uploads = countUploads(a);

  await a.getByTestId('template-card-egz8-2025-main').click();
  await a.waitForURL(/\/whiteboard\?.*boardId=\d+/);
  await a.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  await expect
    .poll(async () => (await templatePages(a)).length, { timeout: 60_000 })
    .toBe(SHEET_PAGES);
  // Po wstawieniu parametr ?arkusz= znika z adresu
  await expect(a).not.toHaveURL(/arkusz=/);
  const boardId = new URL(a.url()).searchParams.get('boardId')!;

  const pages = await templatePages(a);
  expect(pages.every((e) => e.type === 'image' && e.fileId?.startsWith('tpl:templates/'))).toBe(
    true
  );
  // W Y.Doc tylko odwołanie do wspólnego pliku
  const stored = await a.evaluate((id) => window.__boardEngine!.storedFile(id), pages[0].fileId!);
  expect(stored).toMatchObject({ ref: { v: 1, shared: pages[0].fileId!.slice(4) } });
  expect(stored).not.toHaveProperty('dataURL');

  const b = await openBoardAs(browser, E2E_USERS.editor, boardId);
  await expect.poll(async () => (await templatePages(b)).length).toBe(SHEET_PAGES);
  // Druga osoba ma obrazy stron (pobrane z adresu statycznego)
  await expect
    .poll(() =>
      b.evaluate((id) => !!window.__boardEngine!.api.getFiles()[id]?.dataURL, pages[0].fileId!)
    )
    .toBe(true);

  await a.reload();
  await a.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  await expect.poll(async () => (await templatePages(a)).length).toBe(SHEET_PAGES);
  expect(uploads.value).toBe(0);

  await closeBoard(a);
  await closeBoard(b);
});

test('karta wzoru z panelu "Wzory" - wspólny plik, bez uploadu', async ({ browser }) => {
  const a = await openBoardAs(browser, E2E_USERS.owner);
  const uploads = countUploads(a);
  const before = new Set((await liveElements(a)).map((e) => e.id));

  await a.getByTestId('panel-toggle-search').filter({ visible: true }).click();
  const input = a.getByTestId('panel-search').locator('input');
  await input.fill('ciąg arytmetyczny');
  await expect(a.getByTestId('panel-search').locator('li').first()).toBeVisible();
  await input.press('Enter');

  await expect
    .poll(async () => (await liveElements(a)).filter((e) => !before.has(e.id)).map((e) => e.fileId))
    .toEqual([expect.stringMatching(/^tpl:resources\//)]);
  expect(uploads.value).toBe(0);
  await closeBoard(a);
});
