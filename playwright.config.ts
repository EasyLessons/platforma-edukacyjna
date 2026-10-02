/**
 * Playwright - testy E2E tablicy na Excalidraw (e2e/*.spec.ts), NEXT_PUBLIC_WHITEBOARD_ENGINE=excalidraw.
 *
 * Uruchomienie lokalne (pelny opis: docs/testing.md, sekcja "E2E"):
 *   docker compose -f docker-compose.e2e.yml up -d      # Postgres + Redis
 *   npm --prefix whiteboard-sync ci                     # raz
 *   npm run test:e2e
 *
 * Backend (z seedem), whiteboard-sync, frontend i atrapę Supabase Storage
 * (e2e/fake-storage.mjs - obrazy tablicy) startuje sam Playwright (webServer).
 * Wszystkie sekrety ponizej to ZASLEPKI - te same, ktorych uzywa ci.yml.
 * Frontend lokalnie to osobny `next dev` (flaga silnika jest wklejana w czasie builda).
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isCI = !!process.env.CI;
// Backend i whiteboard-sync na nietypowych portach celowo: na 8000/1234 potrafi dzialac
// inny backend albo serwer z innej galezi, a Playwright z reuseExistingServer "pozyczylby"
// cudzy serwer bez seeda. Frontend musi byc na 3000 - tylko ten localhost jest w CORS
// backendu (backend/main.py). Ponowne uzycie dzialajacych serwerow: E2E_REUSE=1.
const reuse = !isCI && process.env.E2E_REUSE === '1';

const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 3000);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8210);
const SYNC_PORT = Number(process.env.E2E_SYNC_PORT ?? 1294);
const STORAGE_PORT = Number(process.env.E2E_STORAGE_PORT ?? 8211);
const baseURL = `http://localhost:${FRONTEND_PORT}`;
const apiURL = `http://localhost:${BACKEND_PORT}`;
// Atrapa Supabase Storage (e2e/fake-storage.mjs): backend wysyła tam pliki tablicy.
const storageURL = `http://127.0.0.1:${STORAGE_PORT}`;
// Gdy 3000 jest zajety lokalnie (E2E_FRONTEND_PORT=...), CORS backendu odrzuca origin -
// wtedy i tylko wtedy Chromium bez sprawdzania CORS. W CI zawsze 3000 i pelny CORS.
const corsBypass = FRONTEND_PORT !== 3000 ? ['--disable-web-security'] : [];

// Lokalnie wskaz interpreter z venv przez E2E_PYTHON (np. backend\.venv\Scripts\python.exe).
const python = process.env.E2E_PYTHON ?? 'python';
// Playwright startuje z katalogu repo; e2e/helpers.ts czyta ten sam plik.
const E2E_STATE_FILE = path.resolve('e2e/.state/seed.json');

const backendEnv = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgresql://e2e:e2e@localhost:55432/e2e',
  REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://localhost:56379/0',
  SUPABASE_URL: storageURL,
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-real',
  SECRET_KEY: 'test-secret-key-not-real',
  // "SKIP" = AuthService nie wysyla maili.
  RESEND_API_KEY: 'SKIP',
  FROM_EMAIL: 'test@example.com',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  GOOGLE_REDIRECT_URI: `${apiURL}/auth/google/callback`,
  FRONTEND_URL: baseURL,
  E2E_STATE_FILE,
};

const frontendEnv = {
  NEXT_PUBLIC_API_URL: apiURL,
  NEXT_PUBLIC_WHITEBOARD_SYNC_URL: `ws://localhost:${SYNC_PORT}`,
  NEXT_PUBLIC_WHITEBOARD_ENGINE: 'excalidraw',
  // Wystawia window.__excalidrawAPI dla asercji w testach (excalidraw-board.tsx).
  NEXT_PUBLIC_E2E: '1',
  // Supabase Realtime nie polaczy sie z zaslepka - testy tego nie sprawdzaja,
  // ale bez tych zmiennych src/_new/lib/supabase/client.ts rzuca przy imporcie.
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-not-real',
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'test-google-client-id',
  GEMINI_API_KEY: 'test-gemini-key-not-real',
};

export default defineConfig({
  testDir: './e2e',
  // Tablica w trybie dev kompiluje sie przy pierwszym wejsciu kilkadziesiat sekund.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    launchOptions: { args: corsBypass },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /.*mobile.*\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /.*mobile.*\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'node e2e/fake-storage.mjs',
      url: `${storageURL}/health`,
      env: { PORT: String(STORAGE_PORT) },
      timeout: 30_000,
      reuseExistingServer: reuse,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `"${python}" scripts/seed_e2e.py && "${python}" -m uvicorn main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: './backend',
      url: `${apiURL}/`,
      env: backendEnv,
      timeout: 120_000,
      reuseExistingServer: reuse,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm start',
      cwd: './whiteboard-sync',
      port: SYNC_PORT,
      env: { PORT: String(SYNC_PORT), BACKEND_URL: apiURL },
      timeout: 60_000,
      reuseExistingServer: reuse,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // W CI build produkcyjny (stabilniejszy, bez kompilacji on-demand); lokalnie dev.
      command: isCI
        ? `npm run build && npm run start -- --port ${FRONTEND_PORT}`
        : `npm run dev -- --port ${FRONTEND_PORT}`,
      url: `${baseURL}/login`,
      env: frontendEnv,
      timeout: 300_000,
      reuseExistingServer: reuse,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
