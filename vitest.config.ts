import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['**/test/**/*.test.ts'],
    exclude: [
      'src',
      'e2e',
      'node_modules',
      'test/utils',
      'reports',
      '.stryker-tmp',
    ],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'reports/coverage',
      exclude: [
        'node_modules/',
        'test/utils/',
        'reports/',
        'e2e/',
        // oclif command classes have entrypoint side-effects at module
        // load (readline, Messages.loadMessages, etc.) that aren't
        // meaningfully unit-coverable without running the command
        // through oclif itself. They're covered by NUT tests, and any
        // pure helpers they expose (parsePromptAnswer, etc.) are
        // exercised by dedicated unit tests.
        'src/commands/',
      ],
      reporter: ['lcov'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
})
