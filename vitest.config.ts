import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@new': path.resolve(__dirname, './src/_new'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      // text-summary: czytelne w CI; json-summary: coverage/coverage-summary.json
      // dla progu pokrycia (bez dodatkowych zaleznosci).
      reporter: ['text', 'text-summary', 'json-summary'],
      include: ['src/_new/features/**/*.{ts,tsx}', 'src/_new/lib/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/_mock/**', // dane atrapy (decyzja P2 z REFAKTOR-PLAN)
        '**/index.ts', // barrele bez logiki
      ],
      // Prog pokrycia = stan z 2026-09-22 (543 testy) zaokraglony w dol do 0,5 pkt.
      // Podnosic, nie obnizac. Vitest failuje sam, gdy ktorys wynik spadnie ponizej.
      // autoUpdate: false - progi zmieniamy swiadomie w PR, nie automatem.
      thresholds: {
        lines: 22.5,
        statements: 22,
        branches: 17,
        functions: 20,
        autoUpdate: false,
      },
    },
  },
});
