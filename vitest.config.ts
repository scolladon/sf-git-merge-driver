import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['**/test/**/*.test.ts'],
    exclude: ['src', 'e2e', 'node_modules', 'test/utils', 'reports'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'reports/coverage',
      exclude: ['node_modules/', 'test/utils/', 'reports/', 'e2e/'],
      reporter: ['lcov'],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 95,
        statements: 95,
      },
    },
  },
})
