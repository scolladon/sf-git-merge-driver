export default {
  entry: [
    '.github/**/*.yml',
    '**/*.{nut,test}.ts',
    'test/perf/**/*.{ts,mjs}',
    'bin/dev.js',
    'bin/run.js',
    'src/commands/git/merge/driver/install.ts',
    'src/commands/git/merge/driver/run.ts',
    'src/commands/git/merge/driver/uninstall.ts',
  ],
  project: ['**/*.{ts,js,json,yml}'],
  ignoreDependencies: ['@commitlint/config-conventional'],
  ignoreBinaries: ['commitlint', 'jscpd', 'npm-check-updates'],
}
