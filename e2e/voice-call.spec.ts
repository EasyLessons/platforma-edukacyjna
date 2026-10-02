/**
 * E2E rozmowy przy tablicy (Daily, features/voice-call) na silniku Excalidraw.
 *
 * Backend w e2e nie ma DAILY_API_KEY, więc `POST /api/v1/whiteboard/{id}/call` odpowiada
 * 503 VOICE_NOT_CONFIGURED - sprawdzamy "grzeczne wyłączenie": komunikat, brak ramki, brak
 * wyjątku na stronie. Test z atrapą odpowiedzi (page.route) sprawdza okno rozmowy i zwijanie;
 * z prawdziwym Daily nic się tu nie łączy.
 */

import { randomUUID } from 'crypto';
import { test, expect, type Page } from '@playwright/test';
import { E2E_USERS, closeBoard, openBoardAs } from './helpers';

/** Przycisk jest w DOM dwa razy (prawy górny róg + pływający na telefonie) - bierzemy widoczny. */
const callButton = (page: Page) => page.getByTestId('call-button').filter({ visible: true });
const callFrames = (page: Page) => page.getByTestId('call-frame').locator('iframe');

const isCallRequest = (url: string, method: string) =>
  method === 'POST' && /\/api\/v1\/whiteboard\/\d+\/call$/.test(new URL(url).pathname);

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('rozmowa bez klucza Daily: komunikat, brak ramki, tablica działa dalej', async ({
  browser,
}) => {
  const page = await openBoardAs(browser, E2E_USERS.owner);
  const errors = collectPageErrors(page);

  const response = page.waitForResponse((r) => isCallRequest(r.url(), r.request().method()));
  await callButton(page).click();
  const status = (await response).status();
  // 503 = backend bez klucza; 404/405 = backend sprzed endpointu rozmowy (kolejność deployów).
  expect([503, 404, 405]).toContain(status);

  const notice = page.getByTestId('call-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(
    status === 503 ? /Rozmowy głosowe są chwilowo wyłączone/ : /Nie udało się połączyć z rozmową/
  );
  await expect(page.getByTestId('call-panel')).toBeHidden();
  await expect(callFrames(page)).toHaveCount(0);

  await notice.getByRole('button', { name: 'Zamknij' }).click();
  await expect(notice).toHaveCount(0);
  await expect(callButton(page)).toBeEnabled();
  await expect(page.getByTestId('excalidraw-board')).toBeVisible();
  expect(errors).toEqual([]);

  await closeBoard(page);
});

test('viewer widzi przycisk Rozmowa (bez panelu f(x))', async ({ browser }) => {
  const page = await openBoardAs(browser, E2E_USERS.viewer);
  await expect(callButton(page)).toBeVisible();
  await expect(page.getByTestId('function-panel-toggle')).toHaveCount(0);
  await closeBoard(page);
});

test('rozmowa z atrapą Daily: okno z ramką, zwinięcie jej nie usuwa, rozłączenie sprząta', async ({
  browser,
}) => {
  const page = await openBoardAs(browser, E2E_USERS.editor);
  const errors = collectPageErrors(page);
  const token = randomUUID();
  const roomUrl = 'https://easylesson-e2e.daily.co/e2e-room';

  // Strona pokoju Daily - pusta atrapa, żadnego ruchu do prawdziwego Daily.
  await page.route(/^https:\/\/[^/]*\.daily\.co\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>e2e</title>',
    })
  );
  await page.route('**/api/v1/whiteboard/*/call', (route) => {
    const origin = route.request().headers()['origin'] ?? '*';
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({
        success: true,
        data: {
          room_url: roomUrl,
          token,
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
      }),
    });
  });

  await callButton(page).click();

  const panel = page.getByTestId('call-panel');
  await expect(panel).toBeVisible();
  await expect(callFrames(page)).toHaveCount(1);
  await expect(callFrames(page)).toHaveAttribute('allow', /microphone/);
  await expect(callFrames(page)).toHaveAttribute('allow', /display-capture/);
  await expect(callFrames(page)).toHaveAttribute('src', /easylesson-e2e\.daily\.co/);
  // daily-js przekazuje token ramce w jej własnym adresie (domena Daily, parametr `t`) -
  // do adresu NASZEJ strony token trafić nie może.
  expect(page.url()).not.toContain(token);

  // Zwinięcie: ta sama ramka zostaje w DOM (odmontowanie zerwałoby rozmowę).
  await callFrames(page).evaluate((el) => ((el as HTMLElement).dataset.e2eMark = 'same'));
  await page.getByTestId('call-minimize').click();
  await expect(panel).toHaveAttribute('data-minimized', 'true');
  await expect(callFrames(page)).toHaveCount(1);
  await expect(callFrames(page)).toHaveAttribute('data-e2e-mark', 'same');
  await expect(page.getByTestId('call-leave')).toBeVisible();

  await page.getByTestId('call-minimize').click();
  await expect(panel).toHaveAttribute('data-minimized', 'false');
  await expect(callFrames(page)).toHaveAttribute('data-e2e-mark', 'same');

  // Rozłączenie: panel znika od razu, ramka najpóźniej po limicie czasu zamykania.
  await page.getByTestId('call-leave').click();
  await expect(panel).toBeHidden();
  await expect(callFrames(page)).toHaveCount(0);
  expect(errors).toEqual([]);

  await closeBoard(page);
});
