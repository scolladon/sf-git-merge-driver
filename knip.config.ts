export default {
  entry: [
    '.github/**/*.yml',
    '**/*.{nut,test}.ts',
    'test/perf/**/*.{ts,mjs}',
    'bin/dev.js',
    'bin/run.js',
    'src/bin/driver.ts',
    'src/commands/git/merge/driver/install.ts',
    'src/commands/git/merge/driver/run.ts',
    'src/commands/git/merge/driver/uninstall.ts',
  ],
  project: ['**/*.{ts,js}'],
  // @jsforce/jsforce-node is pinned in dependencies as a transitive cap (keeps
  // undici off Node-20-incompatible 8.5 when oclif installs the plugin nested,
  // where overrides don't apply); it is not imported directly.
  ignoreDependencies: [
    '@commitlint/config-conventional',
    '@jsforce/jsforce-node',
  ],
  ignore: ['vitest.config.perf.ts'],
}
