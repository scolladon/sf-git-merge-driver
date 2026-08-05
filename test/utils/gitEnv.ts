// Git exports these to every hook it runs. Inherited by a test process, they
// override `cwd` on every git invocation — the fixture repository under
// test/data is ignored and the enclosing repository is operated on instead, so
// the suite fails under `git push` and rewrites the developer's own git config.
const GIT_CONTEXT_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_PREFIX',
] as const

export const forgetAmbientGitContext = (): void => {
  for (const variable of GIT_CONTEXT_VARIABLES) {
    delete process.env[variable]
  }
}
