import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotAGitRepositoryError } from '../../../src/adapter/GitRepository.js'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

const { withGitRepositoryMock } = vi.hoisted(() => ({
  withGitRepositoryMock: vi.fn(),
}))

vi.mock('../../../src/adapter/TsgitRepository.js', () => ({
  withGitRepository: (...args: unknown[]) => withGitRepositoryMock(...args),
}))

describe('gitUtils.getGitAttributesPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Given the repository common dir, When getGitAttributesPath, Then it returns an absolute path ending in info/attributes', async () => {
    // Arrange
    withGitRepositoryMock.mockImplementation(use =>
      use({ commonGitDir: '/repo/.git' })
    )

    // Act
    const result = await getGitAttributesPath()

    // Assert
    expect(result).toBe(join('/repo/.git', 'info', 'attributes'))
  })

  it('When withGitRepository rejects, Then getGitAttributesPath propagates the error', async () => {
    // Arrange
    const rejection = new Error('open failed')
    withGitRepositoryMock.mockRejectedValue(rejection)

    // Act & Assert
    await expect(getGitAttributesPath()).rejects.toThrow('open failed')
  })

  it('Given withGitRepository rejects with a NotAGitRepositoryError, When getGitAttributesPath, Then the same instance propagates unchanged', async () => {
    // Arrange
    const rejection = new NotAGitRepositoryError('/plain')
    withGitRepositoryMock.mockRejectedValue(rejection)

    // Act
    const error = await getGitAttributesPath().catch(e => e)

    // Assert
    expect(error).toBe(rejection)
  })
})
