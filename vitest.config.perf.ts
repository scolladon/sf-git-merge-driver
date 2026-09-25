import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    benchmark: {
      include: ['test/perf/**/*.bench.ts'],
      // The getter-access tracker behind this warning instruments every
      // cross-module export read and roughly halves parser throughput.
      suppressExportGetterWarnings: true,
    },
  },
})
