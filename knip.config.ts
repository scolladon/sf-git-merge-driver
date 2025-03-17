export default {
  packageManager: 'npm',
  entry: [
    '.github/**/*.yml',
    '**/*.{nut,test}.ts',
    'bin/dev.js',
    'bin/run.js',
    'src/commands/git/merge/driver/install.ts',
    'src/commands/git/merge/driver/run.ts',
    'src/commands/git/merge/driver/uninstall.ts',
  ],
  project: ['**/*.{ts,js,json,yml}'],
  ignoreDependencies: ['@commitlint/config-conventional', 'ts-node', 'lodash'],
  ignoreBinaries: ['commitlint', 'npm-check-updates'],
}
