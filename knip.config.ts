export default {
  entry: [
    '.github/**/*.yml',
    '**/*.{nut,test}.ts',
    'test/perf/**/*.{ts,mjs}',
    'bin/dev.js',
    'bin/run.js',
    'src/bin/driver.ts',
  ],
  project: ['**/*.{ts,js}'],
  // tsx is loaded through indirections knip cannot follow: the `import=tsx`
  // node-option in .mocharc.json and the bin/dev.js shebang.
  ignoreDependencies: ['@commitlint/config-conventional', 'tsx'],
  ignore: ['vitest.config.perf.ts'],
}
