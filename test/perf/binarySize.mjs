import { statSync, writeFileSync } from 'node:fs'

const BINARY = 'bin/merge-driver.cjs'
const OUTFILE = 'perf-binary-size.json'

const bytes = statSync(BINARY).size

const entries = [
  {
    name: BINARY,
    unit: 'bytes',
    value: bytes,
  },
]

writeFileSync(OUTFILE, JSON.stringify(entries, null, 2))

// biome-ignore lint/suspicious/noConsole: reporting benchmark results
console.info(
  `${BINARY}: ${bytes} bytes (${(bytes / 1024).toFixed(2)} KB) → ${OUTFILE}`
)
