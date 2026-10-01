import { defineConfig } from 'vitest/config';

// Własny config - bez niego vitest bierze ../vitest.config.ts frontendu (jsdom, src/**).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
