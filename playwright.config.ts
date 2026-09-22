/**
 * Konfiguracja Playwright dla PROTOTYPU tablicy Excalidraw (e2e/).
 * Repo nie miało wcześniej Playwrighta - to jedyny config, testy tylko w `e2e/`.
 *
 * `webServer` sam podnosi serwer Yjs (1234) i Next dev (3100), a jeśli już
 * działają (`reuseExistingServer`) - używa ich. Uruchomienie: `npm run proto:e2e`.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PROTO_PORT ?? 3100);
const YJS_PORT = Number(process.env.PROTO_YJS_PORT ?? 1234);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /.*mobile.*\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /.*mobile.*\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `node scripts/proto-yjs-server.mjs`,
      port: YJS_PORT,
      reuseExistingServer: true,
      timeout: 30_000,
      env: { PROTO_YJS_PORT: String(YJS_PORT) },
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/proto-excalidraw/healthcheck`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: { NEXT_PUBLIC_PROTO_EXPOSE_API: '1' },
    },
  ],
});
