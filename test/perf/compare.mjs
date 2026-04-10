/**
 * Compares two benchmark JSON files (baseline vs current) on the same runner.
 *
 * Usage: node test/perf/compare.mjs <baseline.json> <current.json>
 *
 * Outputs a markdown table with per-benchmark comparison.
 * Exits with 0 (informational only — fail-on-alert is handled by github-action-benchmark).
 */

import { readFileSync } from 'node:fs'

const [baselinePath, currentPath] = process.argv.slice(2)

if (!baselinePath || !currentPath) {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.error('Usage: node compare.mjs <baseline.json> <current.json>')
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
const current = JSON.parse(readFileSync(currentPath, 'utf-8'))

const baselineMap = new Map(baseline.map(b => [b.name, b]))

// biome-ignore lint/suspicious/noConsole: CLI output
console.log('\n## Same-Runner Performance Comparison\n')
// biome-ignore lint/suspicious/noConsole: CLI output
console.log(
  '| Benchmark | Baseline (ops/sec) | Current (ops/sec) | Change |'
)
// biome-ignore lint/suspicious/noConsole: CLI output
console.log('|---|---|---|---|')

for (const entry of current) {
  const base = baselineMap.get(entry.name)
  if (!base) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`| ${entry.name} | _new_ | ${entry.value} | — |`)
    continue
  }

  const ratio = entry.value / base.value
  const pctChange = ((ratio - 1) * 100).toFixed(1)
  const arrow =
    ratio > 1.05 ? '🟢 faster' : ratio < 0.95 ? '🔴 slower' : '⚪ ~same'
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(
    `| ${entry.name} | ${base.value} | ${entry.value} | ${pctChange}% ${arrow} |`
  )
}

// biome-ignore lint/suspicious/noConsole: CLI output
console.log('')
