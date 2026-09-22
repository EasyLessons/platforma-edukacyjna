/**
 * E2E prototypu tablicy Excalidraw + Yjs.
 *
 * Dwa niezależne konteksty przeglądarki (A i B) na tym samym boardId:
 * rysowanie / przesuwanie / usuwanie / cofanie w A ma być widoczne w B.
 * Plus sprawdzenia z pkt 4 zadania: zaznaczanie przez freedraw, warstwy,
 * grupowanie, polskie znaki, eksport PNG. Dotyk jest w osobnym pliku
 * (`proto-excalidraw.mobile.spec.ts`, projekt `mobile`).
 *
 * Dostęp do stanu przez `window.__excalidrawAPI` (wystawione gdy
 * NEXT_PUBLIC_PROTO_EXPOSE_API=1 albo dev).
 */

import { test, expect, type Page, type Browser } from '@playwright/test';

type SceneEl = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted: boolean;
  index: string | null;
  groupIds: string[];
  text?: string;
  version: number;
};

const boardId = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function openBoard(browser: Browser, id: string, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/proto-excalidraw/${id}?name=${name}`);
  await page.waitForFunction(() => !!window.__excalidrawAPI, null, { timeout: 90_000 });
  await page.waitForFunction(() => window.__proto?.status() === 'connected', null, {
    timeout: 30_000,
  });
  return page;
}

const elements = (page: Page) =>
  page.evaluate(
    () => window.__excalidrawAPI!.getSceneElementsIncludingDeleted() as unknown as SceneEl[]
  );
const liveElements = (page: Page) =>
  page.evaluate(() => window.__excalidrawAPI!.getSceneElements() as unknown as SceneEl[]);
const selectedIds = (page: Page) =>
  page.evaluate(() => Object.keys(window.__excalidrawAPI!.getAppState().selectedElementIds));

/**
 * Współrzędne sceny -> ekran (Excalidraw: screen = (scene + scroll) * zoom + offset).
 * Uwaga: testy używają x >= 450, bo po wyborze narzędzia po lewej (x < 220) pojawia się
 * panel właściwości, a u góry (y < 60) jest toolbar.
 */
async function toScreen(page: Page, x: number, y: number) {
  return page.evaluate(
    ([sx, sy]) => {
      const s = window.__excalidrawAPI!.getAppState();
      return {
        x: (sx + s.scrollX) * s.zoom.value + s.offsetLeft,
        y: (sy + s.scrollY) * s.zoom.value + s.offsetTop,
      };
    },
    [x, y]
  );
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 10
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

/** Wybiera narzędzie klikając w toolbar (po `title`, np. /^Prostokąt/) - niezależnie od fokusu. */
async function selectTool(page: Page, title: RegExp) {
  await page.getByTitle(title).first().click();
}

/** Rysuje prostokąt i zwraca jego element. */
async function drawRect(
  page: Page,
  sx: number,
  sy: number,
  w: number,
  h: number
): Promise<SceneEl> {
  const before = new Set((await elements(page)).map((e) => e.id));
  await page.keyboard.press('Escape');
  await selectTool(page, /^Prostokąt/);
  const a = await toScreen(page, sx, sy);
  const b = await toScreen(page, sx + w, sy + h);
  await drag(page, a, b);
  const after = await liveElements(page);
  const created = after.find((e) => !before.has(e.id) && e.type === 'rectangle');
  expect(created, 'prostokąt powinien powstać').toBeTruthy();
  return created!;
}

async function waitForElement(page: Page, id: string, pred: (e: SceneEl) => boolean, what: string) {
  await expect
    .poll(
      async () => {
        const el = (await elements(page)).find((e) => e.id === id);
        return el ? pred(el) : false;
      },
      { message: what, timeout: 10_000 }
    )
    .toBe(true);
}

test.describe('proto-excalidraw: współpraca A <-> B', () => {
  test('rysuj / przesuń / usuń / cofnij w A -> widoczne w B', async ({ browser }) => {
    const id = boardId();
    const A = await openBoard(browser, id, 'Ala');
    const B = await openBoard(browser, id, 'Bartek');

    // obie strony widzą siebie w awareness
    await expect.poll(() => A.evaluate(() => window.__proto!.peers())).toBe(1);

    // 1. rysuj prostokąt w A
    const rect = await drawRect(A, 500, 150, 200, 120);
    await waitForElement(
      B,
      rect.id,
      (e) => e.type === 'rectangle' && !e.isDeleted,
      'prostokąt w B'
    );
    const inB = (await liveElements(B)).find((e) => e.id === rect.id)!;
    expect(Math.round(inB.width)).toBe(Math.round(rect.width));

    // 2. przesuń w A. UWAGA (zachowanie Excalidraw): kształt BEZ wypełnienia zaznacza
    // się tylko kliknięciem w obrys, nie we wnętrze - łapiemy za górną krawędź.
    const edge = await toScreen(A, rect.x + rect.width / 2, rect.y);
    await A.keyboard.press('Escape');
    await selectTool(A, /^Zaznaczenie/);
    await A.mouse.click(edge.x, edge.y);
    expect(await selectedIds(A)).toEqual([rect.id]);
    await drag(A, edge, { x: edge.x + 150, y: edge.y + 60 });
    const moved = (await liveElements(A)).find((e) => e.id === rect.id)!;
    expect(moved.x).toBeGreaterThan(rect.x + 100);
    await waitForElement(
      B,
      rect.id,
      (e) => Math.abs(e.x - moved.x) < 1 && Math.abs(e.y - moved.y) < 1,
      'nowa pozycja w B'
    );

    // 3. usuń w A -> isDeleted w B
    await A.keyboard.press('Delete');
    await waitForElement(A, rect.id, (e) => e.isDeleted, 'usunięty w A');
    await waitForElement(B, rect.id, (e) => e.isDeleted, 'isDeleted w B');
    expect((await liveElements(B)).find((e) => e.id === rect.id)).toBeUndefined();

    // 4. cofnij w A -> wraca w B
    await A.keyboard.press('Control+z');
    await waitForElement(A, rect.id, (e) => !e.isDeleted, 'przywrócony w A');
    await waitForElement(B, rect.id, (e) => !e.isDeleted, 'przywrócony w B');

    // 5. tombstone w Y.Doc: liczniki zgodne po obu stronach
    const cA = await A.evaluate(() => window.__proto!.counts());
    const cB = await B.evaluate(() => window.__proto!.counts());
    expect(cA).toEqual(cB);
    expect(cA.live).toBeGreaterThanOrEqual(1);
  });

  test('wykres funkcji (image SVG) dodany w A pojawia się w B razem z plikiem', async ({
    browser,
  }) => {
    const id = boardId();
    const A = await openBoard(browser, id, 'Ala');
    const B = await openBoard(browser, id, 'Bartek');

    await A.getByTestId('function-panel-toggle').click();
    await A.getByTestId('function-expression').fill('x^2 - 3');
    await A.getByTestId('function-submit').click();

    const fn = (await liveElements(A)).find((e) => e.type === 'image');
    expect(fn).toBeTruthy();
    await waitForElement(B, fn!.id, (e) => e.type === 'image' && !e.isDeleted, 'wykres w B');
    const fileInB = await B.evaluate((fid) => {
      const el = window.__excalidrawAPI!.getSceneElements().find((e) => e.id === fid) as {
        fileId?: string;
      };
      const files = window.__excalidrawAPI!.getFiles();
      return el?.fileId ? files[el.fileId as keyof typeof files]?.mimeType : null;
    }, fn!.id);
    expect(fileInB).toBe('image/svg+xml');
    const custom = await B.evaluate(
      (fid) =>
        (
          window.__excalidrawAPI!.getSceneElements().find((e) => e.id === fid) as {
            customData?: unknown;
          }
        ).customData,
      fn!.id
    );
    expect(custom).toMatchObject({ kind: 'function', spec: { expression: 'x^2 - 3' } });
  });
});

test.describe('proto-excalidraw: zachowania Excalidraw (pkt 4)', () => {
  test('polskie znaki w elemencie tekstowym', async ({ browser }) => {
    const A = await openBoard(browser, boardId(), 'Ala');
    await selectTool(A, /^Tekst/);
    const p = await toScreen(A, 500, 300);
    await A.mouse.click(p.x, p.y);
    await A.keyboard.type('zażółć gęślą jaźń');
    await A.keyboard.press('Escape');
    const text = (await liveElements(A)).find((e) => e.type === 'text');
    expect(text?.text).toBe('zażółć gęślą jaźń');
  });

  test('kółko freedraw wokół prostokąta + klik w środek -> zaznacza prostokąt', async ({
    browser,
  }) => {
    const A = await openBoard(browser, boardId(), 'Ala');
    const rect = await drawRect(A, 600, 300, 120, 80);
    await A.keyboard.press('Escape');

    // freedraw: okrąg o promieniu 120 wokół środka prostokąta
    await selectTool(A, /^Rysuj/);
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const r = 120;
    const start = await toScreen(A, cx + r, cy);
    await A.mouse.move(start.x, start.y);
    await A.mouse.down();
    for (let i = 1; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const q = await toScreen(A, cx + r * Math.cos(a), cy + r * Math.sin(a));
      await A.mouse.move(q.x, q.y);
    }
    await A.mouse.up();
    const free = (await liveElements(A)).find((e) => e.type === 'freedraw');
    expect(free).toBeTruthy();

    await A.keyboard.press('Escape');
    await selectTool(A, /^Zaznaczenie/);
    const center = await toScreen(A, cx, cy);

    // (a) prostokąt BEZ wypełnienia: klik w środek nie zaznacza NICZEGO
    //     (Excalidraw hit-testuje tylko obrys przezroczystych kształtów; freedraw też tylko po linii)
    await A.mouse.click(center.x, center.y);
    expect(await selectedIds(A)).toEqual([]);

    // (b) ten sam prostokąt Z wypełnieniem: klik w środek zaznacza prostokąt, nie kółko
    await A.evaluate((id) => {
      const api = window.__excalidrawAPI!;
      api.updateScene({
        elements: api
          .getSceneElementsIncludingDeleted()
          .map((e) =>
            e.id === id
              ? {
                  ...e,
                  backgroundColor: '#a5d8ff',
                  version: e.version + 1,
                  versionNonce: e.versionNonce + 1,
                }
              : e
          ),
      });
    }, rect.id);
    await A.mouse.click(center.x, center.y);
    expect(await selectedIds(A)).toEqual([rect.id]);

    // (c) klik dokładnie w linię kółka zaznacza freedraw
    await A.keyboard.press('Escape');
    const onCircle = await toScreen(A, cx + r, cy);
    await A.mouse.click(onCircle.x, onCircle.y);
    expect(await selectedIds(A)).toEqual([free!.id]);
  });

  test('warstwy: Ctrl+] przenosi element wyżej (fractional index)', async ({ browser }) => {
    const A = await openBoard(browser, boardId(), 'Ala');
    const r1 = await drawRect(A, 500, 150, 150, 150);
    const r2 = await drawRect(A, 550, 200, 150, 150);
    const before = await liveElements(A);
    const idx = (list: SceneEl[], id: string) => list.findIndex((e) => e.id === id);
    expect(idx(before, r1.id)).toBeLessThan(idx(before, r2.id));

    await A.keyboard.press('Escape');
    await selectTool(A, /^Zaznaczenie/);
    const p = await toScreen(A, 510, 150); // górna krawędź r1, poza r2 (obrys - patrz uwaga wyżej)
    await A.mouse.click(p.x, p.y);
    expect(await selectedIds(A)).toEqual([r1.id]);
    await A.keyboard.press('Control+]');
    const after = await liveElements(A);
    expect(idx(after, r1.id)).toBeGreaterThan(idx(after, r2.id));
    expect(
      after.find((e) => e.id === r1.id)!.index! > after.find((e) => e.id === r2.id)!.index!
    ).toBe(true);
  });

  test('grupowanie Ctrl+G nadaje wspólne groupIds', async ({ browser }) => {
    const A = await openBoard(browser, boardId(), 'Ala');
    const r1 = await drawRect(A, 500, 150, 80, 80);
    const r2 = await drawRect(A, 700, 150, 80, 80);
    await A.keyboard.press('Escape');
    await selectTool(A, /^Zaznaczenie/);
    const a = await toScreen(A, 450, 120);
    const b = await toScreen(A, 850, 300);
    await drag(A, a, b);
    expect((await selectedIds(A)).sort()).toEqual([r1.id, r2.id].sort());
    await A.keyboard.press('Control+g');
    const after = await liveElements(A);
    const g1 = after.find((e) => e.id === r1.id)!.groupIds;
    const g2 = after.find((e) => e.id === r2.id)!.groupIds;
    expect(g1.length).toBe(1);
    expect(g1).toEqual(g2);
  });

  test('eksport PNG przez exportToBlob daje niepusty plik', async ({ browser }) => {
    const A = await openBoard(browser, boardId(), 'Ala');
    await drawRect(A, 500, 150, 100, 100);
    const size = await A.evaluate(() => window.__proto!.exportPng());
    expect(size).toBeGreaterThan(1000);
  });
});
