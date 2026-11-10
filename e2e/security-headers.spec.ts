/**
 * E2E nagłówków bezpieczeństwa (SEC-16) na pełnym stosie:
 *  (a) odpowiedź /login ma CSP, HSTS, Permissions-Policy, X-Frame-Options, nie ma X-XSS-Protection;
 *      backend FastAPI oddaje nosniff / Referrer-Policy / no-store na /api/v1/auth/*;
 *  (b) tablica po zalogowaniu: rysowanie, notatka MD/KaTeX, PDF, obraz, f(x), Tutor AI, kalkulator
 *      działają i przeglądarka NIE zgłasza naruszeń CSP (zdarzenia `securitypolicyviolation`
 *      + komunikaty "Refused to ..." w konsoli + pageerror);
 *  (c) demo /demo/<id> tak samo.
 *
 * Rozmowa Daily z atrapą jest w voice-call.spec.ts - tamten test zbiera pageerror, więc CSP,
 * która zablokowałaby ramkę, posypałaby jego asercje.
 */

import { randomBytes } from 'node:crypto';
import { test, expect, type Browser, type Page } from '@playwright/test';
import {
  E2E_USERS,
  clickToolbarAction,
  closeBoard,
  drawRect,
  liveElements,
  makePdf,
  openBoardAs,
  openToolbarMore,
  sceneCenter,
} from './helpers';

const BACKEND_URL = `http://localhost:${process.env.E2E_BACKEND_PORT ?? 8210}`;
const SYNC_URL = `ws://localhost:${process.env.E2E_SYNC_PORT ?? 1294}`;

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

/** Rejestruje naruszenia CSP w przeglądarce (zdarzenie) i w konsoli; działa od następnej nawigacji. */
async function watchCsp(page: Page): Promise<{ violations: () => Promise<string[]> }> {
  const fromConsole: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      /Content Security Policy|Refused to (load|execute|apply|connect|frame|create|compile)|Failed to fetch font family/i.test(
        text
      )
    )
      fromConsole.push(`console: ${text}`);
  });
  page.on('pageerror', (error) => {
    if (/Content Security Policy|Refused to/i.test(error.message))
      fromConsole.push(`pageerror: ${error.message}`);
  });
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations!.push(
        `${e.violatedDirective} <- ${e.blockedURI || '(inline)'} @ ${e.sourceFile || ''}:${e.lineNumber}`
      );
    });
  });
  return {
    violations: async () => {
      const fromEvents = await page.evaluate(() => window.__cspViolations ?? []);
      return [...fromEvents, ...fromConsole];
    },
  };
}

/** Tablica zalogowanego użytkownika z podpiętym nasłuchem CSP (reload = pełne ładowanie pod nasłuchem). */
async function openWatchedBoard(browser: Browser, username: string) {
  const page = await openBoardAs(browser, username);
  const csp = await watchCsp(page);
  await page.reload();
  await page.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  await expect(page.getByText('Synchronizacja tablicy...')).toHaveCount(0);
  return { page, csp };
}

/** Upuszcza na płótno obraz PNG wygenerowany w przeglądarce (jak w board-engine-images.spec.ts). */
async function dropImage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, 0, 64, 48);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), 'image/png')
    );
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], 'csp.png', { type: 'image/png' }));
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

test('nagłówki /login (Next) i API (FastAPI): CSP, HSTS, Permissions-Policy, nosniff, no-store', async ({
  page,
}) => {
  const response = await page.goto('/login');
  expect(response).not.toBeNull();
  const headers = response!.headers();

  const csp = headers['content-security-policy'];
  expect(csp, 'brak Content-Security-Policy').toBeTruthy();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  // Hosty z env builda: backend i whiteboard-sync na portach e2e
  const connect = csp.split(';').find((p) => p.trim().startsWith('connect-src '))!;
  expect(connect).toContain(BACKEND_URL);
  expect(connect).toContain(SYNC_URL);
  expect(connect.split(/\s+/)).not.toContain('*');
  expect(csp).toContain('frame-src https://accounts.google.com https://*.daily.co');
  expect(headers['content-security-policy-report-only']).toBeUndefined();

  expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains; preload');
  expect(headers['permissions-policy']).toContain('microphone=(self "https://*.daily.co")');
  expect(headers['permissions-policy']).toContain('camera=(self "https://*.daily.co")');
  expect(headers['permissions-policy']).toContain('geolocation=()');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-xss-protection']).toBeUndefined();
  expect(headers['x-powered-by']).toBeUndefined();

  // Backend: core/security_headers.py
  const live = await page.request.get(`${BACKEND_URL}/api/v1/health/live`);
  expect(live.status()).toBe(200);
  expect(live.headers()['x-content-type-options']).toBe('nosniff');
  expect(live.headers()['referrer-policy']).toBe('no-referrer');
  expect(live.headers()['x-frame-options']).toBe('DENY');
  expect(live.headers()['cache-control']).toBeUndefined();

  const me = await page.request.get(`${BACKEND_URL}/api/v1/auth/me`);
  expect([401, 403]).toContain(me.status());
  expect(me.headers()['cache-control']).toBe('no-store');
  expect(me.headers()['x-content-type-options']).toBe('nosniff');
});

test('tablica pod CSP: rysowanie, notatka KaTeX, PDF, obraz, f(x), Tutor AI i kalkulator bez naruszeń', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { page, csp } = await openWatchedBoard(browser, E2E_USERS.owner);
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: { response: 'Pole koła: $P = \\pi r^2$.' },
    })
  );
  const before = new Set((await liveElements(page)).map((e) => e.id));
  const added = async () => (await liveElements(page)).filter((e) => !before.has(e.id));

  // Rysowanie
  const center = await sceneCenter(page);
  const rect = await drawRect(page, center.x - 200, center.y - 150);
  expect(rect.type).toBe('rectangle');

  // Notatka Markdown + KaTeX (fonty KaTeX z własnego originu, style inline)
  await clickToolbarAction(page, 'element-insert-note');
  const editor = page.locator('[data-testid="board-note"] textarea');
  await expect(editor).toBeVisible();
  await editor.fill('## CSP\n\n$\\frac{a^2 + b^2}{c}$');
  await editor.blur();
  await expect
    .poll(async () => (await added()).filter((e) => e.customData?.content).length)
    .toBe(1);
  const note = (await added()).find((e) => e.customData?.content)!;
  await expect(page.locator(`[data-note-id="${note.id}"] .katex`)).toHaveCount(1);

  // PDF (pdf.js worker z bundla, nie z CDN)
  await openToolbarMore(page);
  await page.getByTestId('pdf-file-input').setInputFiles({
    name: 'csp.pdf',
    mimeType: 'application/pdf',
    buffer: makePdf(['CSP']),
  });
  await expect(page.getByTestId('pdf-status')).toContainText('Dodano PDF', { timeout: 60_000 });
  await expect
    .poll(async () => (await added()).filter((e) => e.customData?.kind === 'pdf-page').length)
    .toBe(1);

  // Obraz (upload do Storage przez backend, dataURL w pamięci Excalidraw)
  await dropImage(page);
  await expect
    .poll(async () =>
      (await added()).some((e) => e.type === 'image' && !e.customData?.kind && !!e.fileId)
    )
    .toBe(true);

  // f(x) - wykres SVG (mathjs bez eval)
  await page.getByTestId('function-panel-toggle').filter({ visible: true }).click();
  await page.getByTestId('function-expression').filter({ visible: true }).fill('sin(x) * 2');
  await page.getByTestId('function-submit').filter({ visible: true }).click();
  await expect
    .poll(async () => (await added()).find((e) => e.customData?.kind === 'function'))
    .toBeTruthy();
  const fn = (await added()).find((e) => e.customData?.kind === 'function')!;
  await expect
    .poll(() =>
      page.evaluate(
        (fileId) => window.__boardEngine!.api.getFiles()[fileId as string]?.mimeType ?? null,
        fn.fileId
      )
    )
    .toBe('image/svg+xml');

  // Tutor AI (panel + odpowiedź z atrapy /api/chat renderowana jako Markdown/KaTeX)
  await page.getByTestId('panel-toggle-chat').filter({ visible: true }).click();
  const chat = page.getByTestId('panel-chat');
  const input = chat.getByPlaceholder('Zadaj pytanie...');
  await input.fill('Wzór na pole koła?');
  await input.press('Enter');
  await expect(chat).toContainText('Pole koła');
  await expect(chat.locator('.katex')).toHaveCount(1);
  await chat.getByTitle('Zwiń').click();

  // Kalkulator
  await clickToolbarAction(page, 'panel-toggle-calculator');
  const calc = page.getByTestId('panel-calculator');
  await expect(calc).toBeVisible();
  await calc.getByRole('button', { name: '7', exact: true }).click();
  await calc.getByRole('button', { name: '×', exact: true }).click();
  await calc.getByRole('button', { name: '6', exact: true }).click();
  await calc.getByRole('button', { name: '=', exact: true }).click();
  await expect(calc).toContainText('42');

  expect(await csp.violations()).toEqual([]);
  await closeBoard(page);
});

test('demo /demo/<id> pod CSP: wejście bez konta, rysowanie i notatka KaTeX bez naruszeń', async ({
  browser,
}) => {
  const sessionId = randomBytes(16).toString('base64url');
  const context = await browser.newContext();
  const page = await context.newPage();
  const csp = await watchCsp(page);

  await page.goto(`/demo/${sessionId}`);
  await page.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  expect(new URL(page.url()).pathname).toBe(`/demo/${sessionId}`);

  const center = await sceneCenter(page);
  const rect = await drawRect(page, center.x - 60, center.y - 40);
  expect(rect.type).toBe('rectangle');

  await clickToolbarAction(page, 'element-insert-note');
  const editor = page.locator('[data-testid="board-note"] textarea');
  await expect(editor).toBeVisible();
  await editor.fill('$x = \\sqrt{2}$');
  await editor.blur();
  await expect(page.locator('[data-note-id] .katex')).toHaveCount(1);

  expect(await csp.violations()).toEqual([]);
  await context.close();
});
