/**
 * Compares two benchmark JSON files (baseline vs current) on the same runner.
 *
 * Usage: node test/perf/compare.mjs <baseline.json> <current.json>
 *
 * Outputs a markdown table with per-benchmark comparison.
 * Posts a PR comment when GITHUB_TOKEN and PR_NUMBER env vars are set.
 * Exits with code 1 if any benchmark regresses more than 20%.
 */

import { readFileSync } from 'node:fs'

const [baselinePath, currentPath] = process.argv.slice(2)

if (!baselinePath || !currentPath) {
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
const current = JSON.parse(readFileSync(currentPath, 'utf-8'))

const baselineMap = new Map(baseline.map(b => [b.name, b]))

const lines = []
lines.push('## Same-Runner Performance Comparison\n')
lines.push(
  '| Benchmark | Baseline (ops/sec) | Current (ops/sec) | Change |',
)
lines.push('|---|---|---|---|')

let hasRegression = false

for (const entry of current) {
  const base = baselineMap.get(entry.name)
  if (!base) {
    lines.push(`| ${entry.name} | _new_ | ${entry.value} | — |`)
    continue
  }

  const ratio = entry.value / base.value
  const pctChange = ((ratio - 1) * 100).toFixed(1)
  const arrow =
    ratio > 1.05
      ? '🟢 faster'
      : ratio < 0.95
        ? '🔴 slower'
        : '⚪ ~same'
  lines.push(
    `| ${entry.name} | ${base.value} | ${entry.value} | ${pctChange}% ${arrow} |`,
  )

  if (ratio < 0.8) {
    hasRegression = true
  }
}

lines.push('')

const body = lines.join('\n')
console.log(body)

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY
const prNumber = process.env.PR_NUMBER

if (token && repo && prNumber) {
  const commentMarker = '<!-- same-runner-perf -->'
  const commentBody = `${commentMarker}\n${body}`
  const [owner, repoName] = repo.split('/')
  const apiBase = `https://api.github.com/repos/${owner}/${repoName}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  // Find existing comment to update
  const commentsRes = await fetch(
    `${apiBase}/issues/${prNumber}/comments?per_page=100`,
    { headers },
  )
  const comments = await commentsRes.json()
  const existing = comments.find?.(c =>
    c.body?.includes(commentMarker),
  )

  if (existing) {
    await fetch(`${apiBase}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body: commentBody }),
    })
  } else {
    await fetch(`${apiBase}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: commentBody }),
    })
  }
}

if (hasRegression) {
  console.error(
    '\n❌ Performance regression detected (>20% slower)',
  )
  process.exit(1)
}
