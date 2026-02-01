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
      // HEALTHCARE STANDARDS: High coverage requirements for patient safety and HIPAA compliance
      // Current coverage: ~97% statements, ~92% branches, ~98% functions, ~97% lines
      thresholds: {
        // Healthcare-grade thresholds for the codebase (excluding routes/config/db)
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
