/**
 * E2E obrazów tablicy na Excalidraw: plik idzie do Storage (przez backend), a w Y.Doc
 * zostaje samo odwołanie - bez dataURL.
 *
 * Storage to atrapa w pamięci (e2e/fake-storage.mjs, startowana przez playwright.config.ts);
 * backend rozmawia z nią jak z prawdziwym Supabase Storage, łącznie z utworzeniem
 * prywatnego bucketu przy pierwszym uploadzie.
 */

import { test, expect, type Page } from '@playwright/test';
import { E2E_USERS, closeBoard, liveElements, openBoardAs, seedState } from './helpers';

const FILE_NAME = /^[0-9a-f]{32}\.webp$/;
const STORAGE_URL = `http://127.0.0.1:${process.env.E2E_STORAGE_PORT ?? 8211}`;
const FILES_PATH = /\/api\/v1\/whiteboard\/\d+\/files(\/|$)/;

/** Upuszcza na płótno obraz PNG wygenerowany w przeglądarce (jak przeciągnięcie pliku z dysku). */
async function dropImage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, 96, 64);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(16, 16, 40, 24);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), 'image/png')
    );
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], 'obraz.png', { type: 'image/png' }));

    const target =
      document.querySelector('.excalidraw canvas.interactive') ??
      document.querySelector('.excalidraw');
    if (!target) throw new Error('brak płótna Excalidraw');
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(
      new DragEvent('drop', {
        dataTransfer,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

/** dataURL pliku w pamięci Excalidraw (null, dopóki plik nie dotarł). */
const loadedDataURL = (page: Page, fileId: string) =>
  page.evaluate((id) => window.__boardEngine!.api.getFiles()[id]?.dataURL ?? null, fileId);

const storedFile = (page: Page, fileId: string) =>
  page.evaluate(
    (id) => window.__boardEngine!.storedFile(id) as Record<string, unknown> | null,
    fileId
  );

test('obraz: upload do Storage, widoczny u drugiej osoby, po F5 i u viewera; w Y.Doc bez dataURL', async ({
  browser,
  request,
}) => {
  const { board_id } = seedState();
  const a = await openBoardAs(browser, E2E_USERS.owner);
  const b = await openBoardAs(browser, E2E_USERS.editor);
  const before = new Set((await liveElements(a)).map((e) => e.id));

  // 1. Wrzucenie obrazu w A -> upload przez backend
  const upload = a.waitForResponse(
    (res) => res.request().method() === 'POST' && FILES_PATH.test(new URL(res.url()).pathname)
  );
  await dropImage(a);
  const uploadResponse = await upload;
  expect(uploadResponse.status()).toBe(200);
  const uploaded = (await uploadResponse.json()) as { data: { file_name: string } };
  expect(uploaded.data.file_name).toMatch(FILE_NAME);

  await expect
    .poll(async () =>
      (await liveElements(a)).some((e) => !before.has(e.id) && e.type === 'image' && !!e.fileId)
    )
    .toBe(true);
  const image = (await liveElements(a)).find((e) => !before.has(e.id) && e.type === 'image')!;
  const fileId = image.fileId as string;

  // 2. Druga osoba dostaje element i plik (pobrany przez backend, dataURL tylko w pamięci)
  await expect.poll(async () => (await liveElements(b)).some((e) => e.id === image.id)).toBe(true);
  await expect.poll(() => loadedDataURL(b, fileId)).toMatch(/^data:image\/webp;base64,/);

  // 3. W dokumencie (u obu osób) jest samo odwołanie do pliku - bez dataURL
  for (const page of [a, b]) {
    await expect.poll(async () => (await storedFile(page, fileId))?.ref ?? null).not.toBeNull();
    const entry = (await storedFile(page, fileId))!;
    expect((entry.ref as { v: number; name: string }).v).toBe(1);
    expect((entry.ref as { v: number; name: string }).name).toBe(uploaded.data.file_name);
    expect(entry.dataURL).toBeUndefined();
    expect(JSON.stringify(entry)).not.toContain('data:');
  }

  // Plik leży w PRYWATNYM buckecie pod {board_id}/{nazwa z serwera}
  const state = (await (await request.get(`${STORAGE_URL}/__state`)).json()) as {
    buckets: Record<string, { public: boolean }>;
    objects: { key: string; contentType: string }[];
  };
  expect(state.buckets['board-files']?.public).toBe(false);
  expect(state.objects).toContainEqual(
    expect.objectContaining({
      key: `board-files/${board_id}/${uploaded.data.file_name}`,
      contentType: 'image/webp',
    })
  );

  // 4. F5 w B - obraz wraca (pobranie z backendu)
  const download = b.waitForResponse(
    (res) =>
      res.request().method() === 'GET' &&
      new URL(res.url()).pathname.endsWith(`/files/${uploaded.data.file_name}`)
  );
  await b.reload();
  expect((await download).status()).toBe(200);
  await b.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  await expect.poll(async () => (await liveElements(b)).some((e) => e.id === image.id)).toBe(true);
  await expect.poll(() => loadedDataURL(b, fileId)).toMatch(/^data:image\/webp;base64,/);
  // Odbiór nie wysyła pliku ponownie i nie zamienia odwołania na dataURL
  expect((await storedFile(b, fileId))?.dataURL).toBeUndefined();

  // 5. Viewer widzi obraz
  const v = await openBoardAs(browser, E2E_USERS.viewer);
  await expect.poll(async () => (await liveElements(v)).some((e) => e.id === image.id)).toBe(true);
  await expect.poll(() => loadedDataURL(v, fileId)).toMatch(/^data:image\/webp;base64,/);

  const after = (await (await request.get(`${STORAGE_URL}/__state`)).json()) as {
    objects: { key: string }[];
  };
  expect(after.objects.filter((o) => o.key.startsWith(`board-files/${board_id}/`))).toHaveLength(
    state.objects.filter((o) => o.key.startsWith(`board-files/${board_id}/`)).length
  );

  await closeBoard(v);
  await closeBoard(a);
  await closeBoard(b);
});
