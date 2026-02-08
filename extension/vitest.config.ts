/**
 * Vitest config for the extension package.
 *
 * IMPORTANT: This is a standalone config - it does NOT merge with vite.config.ts.
 * The chrome extension build plugin in vite.config.ts would break tests.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'dist/', 'node_modules/'],
    setupFiles: ['src/test/setup.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/shared/**',
        'src/sidepanel/hooks/**',
        'src/sidepanel/components/**',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/shared/types.ts',       // Pure type definitions, no runtime code
        'src/shared/sentry.ts',      // BrowserClient init requires integration testing; public API tested via no-op tests
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },

    testTimeout: 10000,
  },
});
