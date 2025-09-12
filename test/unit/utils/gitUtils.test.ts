import { sep } from 'node:path'
import { getGitAttributesPath } from '../../../src/utils/gitUtils.js'

const mockRevparse = jest.fn()
const mockSimpleGit = jest.fn(() => ({
  revparse: mockRevparse,
}))

jest.mock('simple-git', () => ({
  simpleGit: (..._args: unknown[]) => mockSimpleGit(),
}))

describe('gitUtils.getGitAttributesPath', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('given git returns path with whitespace when getGitAttributesPath then it returns trimmed path', async () => {
    // Arrange
    mockRevparse.mockResolvedValue('.git\n')

    // Act
    const result = await getGitAttributesPath()

    // Assert
    expect(mockRevparse).toHaveBeenCalledWith(['--git-dir'])
    expect(result).toBe('.git' + sep + 'info' + sep + 'attributes')
  })

  it('when git revparse fails then getGitAttributesPath should propagate the error', async () => {
    // Arrange
    mockRevparse.mockRejectedValue(new Error('rev-parse failed'))

    // Act & Assert
    await expect(getGitAttributesPath()).rejects.toThrow('rev-parse failed')
  })
})
