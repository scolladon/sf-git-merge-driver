import { isAbsolute, resolve, sep } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

const mockRevparse = vi.fn()
const mockSimpleGit = vi.fn(() => ({
  revparse: mockRevparse,
}))

vi.mock('simple-git', () => ({
  simpleGit: (..._args: unknown[]) => mockSimpleGit(),
}))

describe('gitUtils.getGitAttributesPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Given git returns path with trailing whitespace, When getGitAttributesPath, Then it returns an absolute canonicalised path ending with info/attributes', async () => {
    // Arrange — relative path with trailing newline, the canonical result from `git rev-parse --git-dir`
    mockRevparse.mockResolvedValue('.git\n')

    // Act
    const result = await getGitAttributesPath()

    // Assert
    expect(mockRevparse).toHaveBeenCalledWith(['--git-dir'])
    expect(isAbsolute(result)).toBe(true)
    expect(result).toBe(resolve('.git') + `${sep}info${sep}attributes`)
  })

  it('Given git returns a path containing ".." traversal, When getGitAttributesPath, Then the result is canonicalised (no literal ".." in the output)', async () => {
    // Arrange — a hostile GIT_DIR setting could yield a path like this
    mockRevparse.mockResolvedValue('../../.git\n')

    // Act
    const result = await getGitAttributesPath()

    // Assert — resolve() eliminates the ".." components; the returned path must not contain them
    expect(isAbsolute(result)).toBe(true)
    expect(result.includes(`${sep}..${sep}`)).toBe(false)
    expect(result.endsWith(`${sep}info${sep}attributes`)).toBe(true)
  })

  it('When git revparse fails, Then getGitAttributesPath propagates the error', async () => {
    // Arrange
    mockRevparse.mockRejectedValue(new Error('rev-parse failed'))

    // Act & Assert
    await expect(getGitAttributesPath()).rejects.toThrow('rev-parse failed')
  })
})
