import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      { find: '@new', replacement: path.resolve(__dirname, './src/_new') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Excalidraw 0.18 (ESM) importuje `roughjs/bin/rough` bez rozszerzenia; Node/Vite
      // w trybie ESM tego nie rozwiąże. Dotyczy tylko testów prototypu whiteboard-excalidraw.
      { find: /^roughjs\/bin\/(.*)$/, replacement: 'roughjs/bin/$1.js' },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './src/test/setup-canvas-stub.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.{ts,tsx}'],
    server: {
      deps: {
        // Excalidraw musi przejść przez Vite (alias roughjs powyżej), nie przez Node ESM.
        inline: ['@excalidraw/excalidraw'],
      },
    },
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'src/_new/features/auth/**/*.{ts,tsx}',
        'src/_new/lib/auth/**/*.ts',
        'src/_new/lib/errors/**/*.ts',
      ],
    },
  },
});
