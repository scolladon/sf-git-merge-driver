import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Converts the Vitest JSON reporter output to benchmark-action/github-action-benchmark format.
 *
 * Vitest JSON reporter structure (v5.x), benchmark statistics come from Tinybench:
 * {
 *   "testResults": [{
 *     "name": "/abs/path/test/perf/merge.bench.ts",
 *     "assertionResults": [{
 *       "fullName": "merge-small merge-small-no-conflict",
 *       "benchmarks": [{
 *         "name": "merge-small > merge-small-no-conflict",
 *         "tasks": [{
 *           "name": "merge-small-no-conflict",
 *           "latency": { "mean": 1.304, "rme": 1.76, ... },
 *           "throughput": { "mean": 812.3, "rme": 1.52, ... },
 *           ...
 *         }]
 *       }]
 *     }]
 *   }]
 * }
 *
 * ops/sec is derived as 1000 / latency.mean (not throughput.mean) so the figure
 * stays comparable with baselines recorded by the Vitest 4 `hz` field, which
 * was computed the same way.
 *
 * benchmark-action customBiggerIsBetter format:
 * [{ "name": "...", "unit": "ops/sec", "value": 1234, "range": "±1.2%" }]
 *
 * benchmark-action customSmallerIsBetter format:
 * [{ "name": "...", "unit": "ms", "value": 0.81, "range": "±1.2%" }]
 */

const inputPath = 'perf-raw.json'
const runtimeOutputPath = 'perf-runtime.json'
const memoryOutputPath = 'perf-memory.json'
const MS_PER_SECOND = 1000

const raw = JSON.parse(readFileSync(inputPath, 'utf-8'))

const benchmarks = (raw.testResults ?? [])
  .flatMap(file => file.assertionResults ?? [])
  .flatMap(assertion => assertion.benchmarks ?? [])
  .flatMap(benchmark => benchmark.tasks ?? [])
  .map(task => ({
    name: task.name,
    hz: MS_PER_SECOND / task.latency.mean,
    mean: task.latency.mean,
    rme: task.latency.rme,
  }))

const runtimeEntries = benchmarks.map(b => ({
  name: b.name,
  unit: 'ops/sec',
  value: Math.round(b.hz),
  range: `±${b.rme.toFixed(2)}%`,
}))

const memoryEntries = benchmarks.map(b => ({
  name: b.name,
  unit: 'ms',
  value: Number(b.mean.toFixed(4)),
  range: `±${b.rme.toFixed(2)}%`,
}))

writeFileSync(runtimeOutputPath, JSON.stringify(runtimeEntries, null, 2))
writeFileSync(memoryOutputPath, JSON.stringify(memoryEntries, null, 2))

// biome-ignore lint/suspicious/noConsole: reporting benchmark results
console.info(
  `Written ${runtimeEntries.length} runtime entries to ${runtimeOutputPath}`
)
// biome-ignore lint/suspicious/noConsole: reporting benchmark results
console.info(
  `Written ${memoryEntries.length} latency entries to ${memoryOutputPath}`
)

for (const entry of runtimeEntries) {
  // biome-ignore lint/suspicious/noConsole: reporting benchmark results
  console.info(`  ${entry.name}: ${entry.value} ${entry.unit} (${entry.range})`)
}
