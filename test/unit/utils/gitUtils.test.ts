import { sep } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

const mockRevparse = vi.fn()
const mockSimpleGit = vi.fn(() => ({
  revparse: mockRevparse,
}))

vi.mock('simple-git', () => ({
  simpleGit: (..._args: unknown[]) => mockSimpleGit(),
}))

const GIT_DIR_WITH_NEWLINE = '.git\n'
const EXPECTED_ATTRIBUTES_PATH = `.git${sep}info${sep}attributes`

describe('gitUtils.getGitAttributesPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('given git returns path with whitespace when getGitAttributesPath then it returns trimmed path', async () => {
    // Arrange
    mockRevparse.mockResolvedValue(GIT_DIR_WITH_NEWLINE)

    // Act
    const result = await getGitAttributesPath()

    // Assert
    expect(mockRevparse).toHaveBeenCalledWith(['--git-dir'])
    expect(result).toBe(EXPECTED_ATTRIBUTES_PATH)
  })

  it('when git revparse fails then getGitAttributesPath should propagate the error', async () => {
    // Arrange
    mockRevparse.mockRejectedValue(new Error('rev-parse failed'))

    // Act & Assert
    await expect(getGitAttributesPath()).rejects.toThrow('rev-parse failed')
  })
})
