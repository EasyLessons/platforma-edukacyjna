import fs from 'fs';
import path from 'path';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Użytkownicy z backend/scripts/seed_e2e.py (dane testowe, jawne). */
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'E2ePassword123!';
export const E2E_USERS = {
  owner: 'e2e_owner',
  editor: 'e2e_editor',
  viewer: 'e2e_viewer',
} as const;

export interface SeedState {
  workspace_id: number;
  board_id: number;
}

/** Id workspace'u i tablicy zapisane przez seed (Playwright startuje z katalogu repo). */
export function seedState(): SeedState {
  const file = path.resolve('e2e/.state/seed.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as SeedState;
}

export type SceneEl = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted: boolean;
  fileId?: string | null;
  customData?: { kind?: string; spec?: { expression: string }; content?: string };
  link?: string | null;
  points?: number[][];
  originalText?: string;
};

/** Loguje użytkownika przez formularz (pole przyjmuje e-mail) i czeka na dashboard. */
export async function login(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Login').fill(`${username}@example.com`);
  await page.locator('input[name="password"]').fill(E2E_PASSWORD);
  // exact: obok jest "Zaloguj się przez Google".
  await page.getByRole('button', { name: 'Zaloguj', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Otwiera tablicę z seeda i czeka, aż Excalidraw będzie gotowy. */
export async function openBoard(page: Page): Promise<void> {
  const { board_id, workspace_id } = seedState();
  await page.goto(`/whiteboard?boardId=${board_id}&workspace=${workspace_id}`);
  await page.waitForFunction(() => !!window.__boardEngine, null, { timeout: 90_000 });
  // Nakładka "Synchronizacja tablicy..." znika po pierwszej synchronizacji z whiteboard-sync.
  await expect(page.getByText('Synchronizacja tablicy...')).toHaveCount(0);
}

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/**
 * Sesje zalogowanych użytkowników w obrębie przebiegu. Backend limituje logowanie
 * (10 prób / 5 min na login), więc każdy użytkownik loguje się raz, a kolejne
 * konteksty dostają jego storageState (access token w localStorage + ciasteczka).
 * Stan zapisujemy po KAŻDYM otwarciu tablicy: aplikacja przy starcie odświeża sesję,
 * a backend rotuje refresh token, więc stan sprzed odświeżenia jest już nieważny.
 */
const sessions = new Map<string, StorageState>();
const pageUsers = new WeakMap<Page, string>();

/** Nowa karta (osobny kontekst = osobne ciasteczka) z zalogowanym użytkownikiem na tablicy. */
export async function openBoardAs(browser: Browser, username: string): Promise<Page> {
  const saved = sessions.get(username);
  const context = await browser.newContext(saved ? { storageState: saved } : {});
  const page = await context.newPage();
  if (!saved) await login(page, username);
  await openBoard(page);
  sessions.set(username, await context.storageState());
  pageUsers.set(page, username);
  return page;
}

/** Zamyka kartę z openBoardAs, zapisując najświeższą sesję (np. po F5 i kolejnej rotacji). */
export async function closeBoard(page: Page): Promise<void> {
  const username = pageUsers.get(page);
  if (username) sessions.set(username, await page.context().storageState());
  await page.context().close();
}

export const liveElements = (page: Page) =>
  page.evaluate(() => window.__boardEngine!.api.getSceneElements() as unknown as SceneEl[]);

/** Współrzędne sceny -> ekran (screen = (scene + scroll) * zoom + offset). */
export async function toScreen(page: Page, x: number, y: number) {
  return page.evaluate(
    ([sx, sy]) => {
      const s = window.__boardEngine!.api.getAppState();
      return {
        x: (sx + s.scrollX) * s.zoom.value + s.offsetLeft,
        y: (sy + s.scrollY) * s.zoom.value + s.offsetTop,
      };
    },
    [x, y]
  );
}

/** Środek widocznej sceny w układzie sceny (żeby nie rysować pod nagłówkiem i panelami). */
export async function sceneCenter(page: Page) {
  return page.evaluate(() => {
    const s = window.__boardEngine!.api.getAppState();
    return {
      x: s.width / 2 / s.zoom.value - s.scrollX,
      y: s.height / 2 / s.zoom.value - s.scrollY,
    };
  });
}

export async function drag(
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

/** Wybiera narzędzie z paska Excalidraw po `title` (np. /^Prostokąt/). */
export async function selectTool(page: Page, title: RegExp) {
  await page.getByTitle(title).first().click();
}

/** Rysuje prostokąt w punkcie sceny i zwraca nowy element. */
export async function drawRect(page: Page, sx: number, sy: number, w = 120, h = 80) {
  const before = new Set((await liveElements(page)).map((e) => e.id));
  await selectTool(page, /^Prostokąt/);
  await drag(page, await toScreen(page, sx, sy), await toScreen(page, sx + w, sy + h));
  await expect
    .poll(async () => (await liveElements(page)).filter((e) => !before.has(e.id)).length)
    .toBe(1);
  return (await liveElements(page)).find((e) => !before.has(e.id))!;
}

/** Minimalny poprawny PDF (strony A4, każda z jednym napisem Helvetica) - plik testowy importu PDF. */
export function makePdf(texts: string[]): Buffer {
  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${texts.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${texts.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  texts.forEach((text, i) => {
    const stream = `BT /F1 48 Tf 72 700 Td (${text}) Tj ET`;
    objs[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
