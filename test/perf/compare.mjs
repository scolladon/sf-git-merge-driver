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
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
const current = JSON.parse(readFileSync(currentPath, 'utf-8'))

const baselineMap = new Map(baseline.map(b => [b.name, b]))

console.log('\n## Same-Runner Performance Comparison\n')
console.log('| Benchmark | Baseline (ops/sec) | Current (ops/sec) | Change |')
console.log('|---|---|---|---|')

for (const entry of current) {
  const base = baselineMap.get(entry.name)
  if (!base) {
    console.log(`| ${entry.name} | _new_ | ${entry.value} | — |`)
    continue
  }

  const ratio = entry.value / base.value
  const pctChange = ((ratio - 1) * 100).toFixed(1)
  const arrow =
    ratio > 1.05 ? '🟢 faster' : ratio < 0.95 ? '🔴 slower' : '⚪ ~same'
  console.log(
    `| ${entry.name} | ${base.value} | ${entry.value} | ${pctChange}% ${arrow} |`
  )
}

console.log('')
