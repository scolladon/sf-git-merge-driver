import assert from 'node:assert/strict'
import { chmodSync, readFileSync, statSync } from 'node:fs'
import { build } from 'esbuild'

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
)

const SHEBANG = '#!/usr/bin/env node'
const COMPILE_CACHE_BANNER =
  'try { const v = process.versions.node.split(".").map(Number);' +
  ' if (v[0] > 22 || (v[0] === 22 && v[1] >= 8))' +
  ' require("node:module").enableCompileCache(); } catch {}'

const OUTFILE = 'bin/merge-driver.cjs'
const SIZE_LIMIT_BYTES = 300_000

await build({
  entryPoints: ['lib/bin/driver.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  minify: true,
  keepNames: false,
  treeShaking: true,
  outfile: OUTFILE,
  banner: { js: `${SHEBANG}\n${COMPILE_CACHE_BANNER}` },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __BUNDLED__: 'true',
  },
})

chmodSync(OUTFILE, 0o755)

const size = statSync(OUTFILE).size
assert.ok(
  size < SIZE_LIMIT_BYTES,
  `Bundle size ${size} exceeds ${SIZE_LIMIT_BYTES} byte gate — something heavy leaked in`
)
process.stdout.write(`${OUTFILE}: ${(size / 1024).toFixed(1)} KB, mode 0755\n`)
