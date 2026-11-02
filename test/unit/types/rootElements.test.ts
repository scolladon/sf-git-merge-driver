import { describe, expect, it } from 'vitest'
import { NAMESPACE_ROOT } from '../../../src/constant/parserConstant.js'
import { buildConflictBlock } from '../../../src/types/conflictBlock.js'
import { rootElementsIn } from '../../../src/types/rootElements.js'

describe('rootElementsIn', () => {
  describe.each([
    ['a conflict block', buildConflictBlock([], [], []), 1],
    ['an object of one tag', { Profile: '' }, 1],
    ['an object of two tags', { PermA: '', PermB: '' }, 2],
    [
      'an object holding only the namespace marker',
      { [NAMESPACE_ROOT]: {} },
      0,
    ],
    [
      'an object of a tag and the namespace marker',
      { [NAMESPACE_ROOT]: {}, A: '' },
      1,
    ],
    ['a scalar', 'text', 0],
    ['null', null, 0],
    ['an array', [{ Profile: '' }], 0],
  ])('given %s', (_, item, expected) => {
    it('when counted then it opens the expected roots', () => {
      // Act
      const sut = rootElementsIn(item as never)

      // Assert
      expect(sut).toBe(expected)
    })
  })
})
