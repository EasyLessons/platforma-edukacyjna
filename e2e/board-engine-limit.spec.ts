/**
 * E2E limitu elementów planu Free (1000 na tablicę): ostrzeżenie przy 80%, blokada rysowania
 * przy 1000 i odrzucenie 1001. elementu przez serwer (whiteboard-sync cofa nadmiar tombstonem).
 *
 * Właściciel z seeda jest na planie Free (brak wiersza w user_plans), więc limit pochodzi z backendu
 * (GET /boards/{id} -> element_limit, /access -> whiteboard-sync). Test tworzy własną tablicę
 * i na końcu ją usuwa, żeby nie zmieniać liczby tablic w przestrzeni z seeda (limit 3 na przestrzeń).
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  E2E_PASSWORD,
  E2E_USERS,
  closeBoard,
  drag,
  liveElements,
  openBoardAs,
  seedState,
  selectTool,
  sceneCenter,
  toScreen,
} from './helpers';

const API = `http://localhost:${process.env.E2E_BACKEND_PORT ?? 8210}/api/v1`;
const LIMIT = 1000;
const WARN_AT = 800; // ceil(0.8 * 1000), ELEMENT_LIMIT_WARN_RATIO

async function ownerToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { login: `${E2E_USERS.owner}@example.com`, password: E2E_PASSWORD },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { data: { access_token: string } }).data.access_token;
}

/** Dokłada `count` małych prostokątów o id `lim-<start>...` (jedna zmiana sceny, jak wklejenie). */
async function addRectangles(page: Page, start: number, count: number) {
  await page.evaluate(
    ([from, n]) => {
      const api = window.__boardEngine!.api;
      const added = Array.from({ length: n }, (_, k) => {
        const i = from + k;
        return {
          id: `lim-${i}`,
          type: 'rectangle',
          x: (i % 50) * 30,
          y: Math.floor(i / 50) * 30,
          width: 20,
          height: 20,
          angle: 0,
          strokeColor: '#1e1e1e',
          backgroundColor: 'transparent',
          fillStyle: 'solid',
          strokeWidth: 1,
          strokeStyle: 'solid',
          roughness: 0,
          opacity: 100,
          groupIds: [],
          frameId: null,
          index: null,
          roundness: null,
          seed: i + 1,
          version: 1,
          versionNonce: i + 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          link: null,
          locked: false,
        };
      });
      api.updateScene({
        elements: [...api.getSceneElementsIncludingDeleted(), ...added] as never,
      });
    },
    [start, count] as const
  );
}

const liveCount = async (page: Page) => (await liveElements(page)).length;
const banner = (page: Page) => page.getByTestId('board-element-limit');
const activeTool = (page: Page) =>
  page.evaluate(() => window.__boardEngine!.api.getAppState().activeTool.type);

test('limit elementów (Free): ostrzeżenie przy 80%, blokada przy 1000, 1001. element odrzucony', async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const { workspace_id } = seedState();
  const headers = { Authorization: `Bearer ${await ownerToken(request)}` };
  const created = await request.post(`${API}/boards`, {
    headers,
    data: { name: 'E2E limit elementów', workspace_id, icon: 'FileText', bg_color: 'bg-green-500' },
  });
  expect(created.ok()).toBe(true);
  const boardId = ((await created.json()) as { data: { id: number } }).data.id;

  try {
    const a = await openBoardAs(browser, E2E_USERS.owner, boardId);
    const b = await openBoardAs(browser, E2E_USERS.editor, boardId);
    expect(await liveCount(a)).toBe(0);

    // Poniżej 80% - bez komunikatu
    await addRectangles(a, 0, WARN_AT - 1);
    await expect.poll(() => liveCount(a)).toBe(WARN_AT - 1);
    await expect.poll(() => liveCount(b), { timeout: 60_000 }).toBe(WARN_AT - 1);
    await expect(banner(a)).toHaveCount(0);

    // 800. element: ostrzeżenie z licznikiem (u obu osób), rysowanie nadal działa
    await addRectangles(a, WARN_AT - 1, 1);
    await expect(banner(a)).toContainText(`Tablica się zapełnia: ${WARN_AT}/${LIMIT} elementów.`);
    await expect(banner(b)).toContainText(`${WARN_AT}/${LIMIT}`);
    await selectTool(a, /^Prostokąt/);
    expect(await activeTool(a)).toBe('rectangle');
    await a.keyboard.press('Escape');

    // Dojście do 1000: blokada (komunikat o limicie, narzędzie rysujące wraca do zaznaczania)
    await addRectangles(a, WARN_AT, LIMIT - WARN_AT);
    await expect.poll(() => liveCount(a)).toBe(LIMIT);
    await expect(banner(a)).toContainText(`Tablica osiągnęła limit ${LIMIT} elementów`);
    await expect.poll(() => liveCount(b), { timeout: 60_000 }).toBe(LIMIT);

    // 1001. element z UI: narzędzie nie zostaje aktywne, rysowanie niczego nie dodaje
    await selectTool(a, /^Prostokąt/);
    await expect.poll(() => activeTool(a)).toBe('selection');
    const center = await sceneCenter(a);
    await drag(
      a,
      await toScreen(a, center.x + 400, center.y + 400),
      await toScreen(a, center.x + 500, center.y + 480)
    );
    expect(await liveCount(a)).toBe(LIMIT);

    // 1001. element z obejściem UI (klient wysyła go wprost): serwer cofa go tombstonem,
    // więc u obu osób zostaje 1000 żywych
    await addRectangles(a, LIMIT, 1);
    await expect.poll(() => liveCount(a), { timeout: 30_000 }).toBe(LIMIT);
    await expect.poll(() => liveCount(b), { timeout: 30_000 }).toBe(LIMIT);
    expect((await liveElements(a)).some((e) => e.id === `lim-${LIMIT}`)).toBe(false);

    // Po usunięciu elementu (gumka/Delete) blokada znika i można znów dodawać
    await a.evaluate(() => {
      const api = window.__boardEngine!.api;
      api.updateScene({
        elements: api
          .getSceneElementsIncludingDeleted()
          .map((el) =>
            el.id === 'lim-0' ? { ...el, isDeleted: true, version: el.version + 1 } : el
          ),
      });
    });
    await expect.poll(() => liveCount(a)).toBe(LIMIT - 1);
    await expect(banner(a)).toContainText(`${LIMIT - 1}/${LIMIT}`);
    await addRectangles(a, LIMIT + 1, 1);
    await expect.poll(() => liveCount(a)).toBe(LIMIT);
    await expect.poll(() => liveCount(b), { timeout: 30_000 }).toBe(LIMIT);

    await closeBoard(a);
    await closeBoard(b);
  } finally {
    await request.delete(`${API}/boards/${boardId}`, { headers });
  }
});
