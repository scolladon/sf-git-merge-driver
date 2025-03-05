export default {
  packageManager: 'npm',
  entry: [
    'src/commands/git/merge/driver/install.ts',
    'src/commands/git/merge/driver/uninstall.ts',
    'bin/dev.js',
    'bin/run.js',
    '**/*.{nut,test}.ts',
    '.github/**/*.yml',
  ],
  project: ['**/*.{ts,js,json,yml}'],
  ignoreDependencies: [
    '@commitlint/config-conventional',
    'ts-jest-mock-import-meta',
    'ts-node',
  ],
  ignoreBinaries: ['commitlint', 'npm-check-updates'],
}
