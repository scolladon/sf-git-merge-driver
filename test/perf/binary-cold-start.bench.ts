/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { bench, describe } from 'vitest'

// Measures the end-to-end cost of spawning the bundled binary. This is the
// figure git pays per merge driver invocation — the hot path we're optimizing.
// Expected median: ~70-100ms on macOS dev, <200ms on GitHub Linux/macOS,
// <400ms on Windows runners (see binary-entrypoint design doc).
const BINARY = resolve(process.cwd(), 'bin', 'merge-driver.cjs')

describe('binary cold start', () => {
  bench('node bin/merge-driver.cjs --version', () => {
    execFileSync('node', [BINARY, '--version'], { stdio: 'ignore' })
  })
})
