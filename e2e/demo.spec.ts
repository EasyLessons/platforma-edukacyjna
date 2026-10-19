/**
 * E2E tablicy demo bez konta (/demo/<id>, silnik Excalidraw): wejście bez logowania, rysowanie,
 * druga osoba z tego samego linku, wspólna praca na żywo i brak zapisu - po wyjściu wszystkich
 * link otwiera pustą tablicę (dokument demo żyje tylko w pamięci whiteboard-sync).
 */

import { randomBytes } from 'node:crypto';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { drawRect, liveElements, sceneCenter } from './helpers';

const newSessionId = () => randomBytes(16).toString('base64url'); // 22 znaki jak createDemoSessionId()

/** Gość: świeży kontekst bez ciasteczek, localStorage ani logowania. */
async function openDemo(browser: Browser, sessionId: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/demo/${sessionId}`);
  await page.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  return page;
}

test('demo: gość rysuje, druga osoba z linku widzi to na żywo, po wyjściu nic nie zostaje', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const sessionId = newSessionId();

  // Gość A wchodzi bez konta (żadnego przekierowania na /login) i rysuje
  const a = await openDemo(browser, sessionId);
  expect(new URL(a.url()).pathname).toBe(`/demo/${sessionId}`);
  await expect(a.getByText('Zaloguj się, aby otworzyć tablicę.')).toHaveCount(0);
  const center = await sceneCenter(a);
  const rect = await drawRect(a, center.x - 60, center.y - 40);
  expect(rect.type).toBe('rectangle');

  // Gość B z tego samego linku widzi prostokąt (synchronizacja przez whiteboard-sync, bez tokenu)
  const b = await openDemo(browser, sessionId);
  await expect
    .poll(async () => (await liveElements(b)).some((e) => e.id === rect.id), { timeout: 30_000 })
    .toBe(true);

  // ...a jego rysunek trafia do A
  const fromB = await drawRect(b, center.x + 100, center.y - 40);
  await expect
    .poll(async () => (await liveElements(a)).some((e) => e.id === fromB.id), { timeout: 30_000 })
    .toBe(true);

  // Kursory: każdy widzi drugiego gościa
  await expect
    .poll(() => a.evaluate(() => window.__boardEngine!.awarenessUsers()?.length ?? 0))
    .toBeGreaterThanOrEqual(2);

  // Obaj wychodzą -> serwer zwalnia dokument, nic nie jest zapisane: ten sam link otwiera pustą tablicę
  await a.context().close();
  await b.context().close();
  // Hocuspocus zwalnia dokument po ostatnim rozłączeniu (z opóźnieniem zapisu ~2 s).
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const later = await openDemo(browser, sessionId);
  await later.waitForTimeout(1500); // czas na ewentualną synchronizację (nie ma czego dostarczyć)
  expect(await liveElements(later)).toHaveLength(0);
  await later.context().close();
});
