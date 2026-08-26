export interface GitRepository {
  readonly commonGitDir: string
  setConfig(key: string, value: string): Promise<void>
  removeSection(name: string): Promise<void>
}

export class NotAGitRepositoryError extends Error {
  public readonly path: string

  constructor(path: string) {
    super(
      `not a git repository: ${path} — ` +
        'run this command from inside a git working tree'
    )
    this.name = 'NotAGitRepositoryError'
    this.path = path
  }
}
