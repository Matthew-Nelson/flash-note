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
        'src/db/migrate.ts', // Migration script
        // Exclude files that need integration tests (routes, config, db)
        'src/config.ts',
        'src/db/index.ts',
        'src/routes/**',
        'src/prompts/**',
      ],

      // Minimum coverage thresholds - fail if below these
      // NOTE: These thresholds apply only to included files (services, middleware, utils)
      // Current coverage: ~74% lines, ~69% functions, ~90% branches
      // TODO: Increase thresholds as more tests are added for ai-service, usage-service, etc.
      thresholds: {
        // Global thresholds for the codebase (excluding routes/config/db)
        lines: 70,
        functions: 65,
        branches: 85,
        statements: 70,
      },
    },

    // Timeout for tests (ms)
    testTimeout: 10000,

    // Pool options
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
