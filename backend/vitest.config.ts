import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Include test files
    include: ['src/**/*.test.ts'],

    // Global test setup
    setupFiles: ['src/test/setup.ts'],

    // Coverage configuration
    coverage: {
      // Use v8 for coverage (faster than istanbul)
      provider: 'v8',

      // Output formats
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],

      // Output directory
      reportsDirectory: './coverage',

      // Files to include in coverage
      include: ['src/**/*.ts'],

      // Files to exclude from coverage
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/types/**',
        'src/index.ts', // Entry point
        'src/env-loader.ts', // Environment loading infrastructure
        'src/db/migrate.ts', // Migration script
        'src/db/seed-test.ts', // Test data seeding script
        'src/db/verify-audit-immutability.ts', // Audit immutability verification script
        // Exclude files that require external dependencies (not unit-testable)
        'src/config.ts', // Environment-dependent - validated through mocking in other tests
        'src/db/index.ts', // Database connection pool - needs real PostgreSQL
        'src/routes/**', // HTTP route handlers - need supertest integration tests
        'src/instrument.ts', // Sentry initialization - depends on external SDK, sanitization logic tested via sentry-sanitization.ts
      ],

      // Minimum coverage thresholds - fail if below these
      // NOTE: These thresholds apply only to included files (services, middleware, utils, prompts)
      // HEALTHCARE STANDARDS: High coverage requirements for patient safety and HIPAA compliance
      thresholds: {
        // Healthcare-grade thresholds - do not lower these
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },

    // Timeout for tests (ms)
    testTimeout: 10000,

    // Pool options (Vitest v4: poolOptions moved to top-level)
    pool: 'forks',
    singleFork: true,
  },
});
