import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node loads the benchmarks and the compiled lib/ natively. Through
    // Vite's module runner every cross-module call becomes an export
    // getter, and that cost dominates the parser's per-character loop.
    experimental: { viteModuleRunner: false },
    benchmark: {
      include: ['test/perf/**/*.bench.ts'],
    },
  },
})
