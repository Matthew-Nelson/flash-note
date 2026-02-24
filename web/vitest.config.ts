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
    exclude: ['tests/e2e/**', '.next/', 'node_modules/'],
    setupFiles: ['src/test/setup.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/lib/**', 'src/components/**', 'src/server/**'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/app/**',         // Next.js routes - E2E tested
        'src/lib/types.ts',   // Pure type definitions, no runtime code
        'src/lib/types/**',   // Pure type definitions, no runtime code
        'src/server/types.ts', // Pure type definitions + enum (tested via consumers)
        'src/server/db/migrate.ts', // CLI script, not unit-testable
        'src/**/index.ts',    // Barrel re-export files
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
