import { defineConfig } from 'vitest/config';

/**
 * Vitest config for integration tests that require a live database.
 *
 * Unlike the main vitest.config.ts, this config does NOT load the global
 * test setup (which mocks pg). Tests here connect to the real test database.
 *
 * Usage: pnpm test:integration
 * Prerequisite: pnpm test:setup (runs migrations + seeds)
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 15000,
    pool: 'forks',
    singleFork: true,
  },
});
