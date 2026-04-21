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
  ignoreDependencies: ['@commitlint/config-conventional'],
  ignore: ['vitest.config.perf.ts'],
  ignoreBinaries: ['commitlint', 'jscpd', 'npm-check-updates'],
}
