import { describe, expect, it } from 'vitest'
import { ContestedTagOrder } from '../../../../src/merger/tagOrder/contestedTagOrder.js'
import { mergePropertyOrder } from '../../../../src/merger/tagOrder/mergePropertyOrder.js'

const tagsOf = (text: string): string[] => [...text]
const objectOf = (tags: string[]) =>
  Object.fromEntries(tags.map(tag => [tag, tag]))

const canonicalOf = (ancestor: string, local: string, other: string) =>
  mergePropertyOrder(
    objectOf(tagsOf(ancestor)),
    objectOf(tagsOf(local)),
    objectOf(tagsOf(other)),
    ContestedTagOrder.CANONICAL
  )

describe('mergePropertyOrder with the canonical order for contested tags', () => {
  describe('given the sides reorder three tags into a cycle', () => {
    it.each([
      ['local first', 'bac', 'acb'],
      ['other first', 'acb', 'bac'],
    ])(
      'when %s then the tags stand in canonical order and no block is left',
      (_side, local, other) => {
        // Arrange
        const ancestor = 'abc'

        // Act
        const sut = canonicalOf(ancestor, local, other)

        // Assert
        expect(sut).toEqual({ order: tagsOf('abc'), blocks: new Map() })
      }
    )

    it('when the cycle is written against canonical order then it is still canonical', () => {
      // Arrange
      const [ancestor, local, other] = ['cba', 'bca', 'cab'].map(tagsOf)

      // Act
      const sut = mergePropertyOrder(
        objectOf(ancestor),
        objectOf(local),
        objectOf(other),
        ContestedTagOrder.CANONICAL
      )

      // Assert
      expect(sut).toEqual({ order: tagsOf('abc'), blocks: new Map() })
    })
  })

  describe('given a tag both sides add at positions that disagree', () => {
    it.each([
      ['local first', 'eab', 'abe'],
      ['other first', 'abe', 'eab'],
    ])(
      'when %s then the tags its block spans stand in canonical order',
      (_side, local, other) => {
        // Arrange
        const ancestor = 'ab'

        // Act
        const sut = canonicalOf(ancestor, local, other)

        // Assert
        expect(sut).toEqual({ order: tagsOf('abe'), blocks: new Map() })
      }
    )
  })

  describe('given a block among tags the sides agree on', () => {
    it('when merged then the block is replaced where it stood and the others keep their place', () => {
      // Arrange
      const [ancestor, local, other] = ['zabcy', 'zbacy', 'zacby']

      // Act
      const sut = canonicalOf(ancestor, local, other)

      // Assert
      expect(sut).toEqual({ order: tagsOf('zabcy'), blocks: new Map() })
    })
  })

  describe('given a block that holds fullName', () => {
    it('when merged then fullName comes first and the others follow by code point', () => {
      // Arrange
      const toNames = (text: string) =>
        objectOf(
          tagsOf(text).map(
            tag => ({ a: 'label', b: 'fullName', c: 'Zeta' })[tag]!
          )
        )

      // Act
      const sut = mergePropertyOrder(
        toNames('abc'),
        toNames('bac'),
        toNames('acb'),
        ContestedTagOrder.CANONICAL
      )

      // Assert
      expect(sut.order).toEqual(['fullName', 'Zeta', 'label'])
    })
  })

  describe('given a reorder no other change contradicts', () => {
    it.each([
      ['one side reorders', 'abc', 'cba', 'abc', 'cba'],
      ['the other side reorders', 'abc', 'abc', 'cba', 'cba'],
      ['two disjoint pair swaps', 'abcd', 'bacd', 'abdc', 'badc'],
    ])(
      'when %s then it is kept as written',
      (_case, ancestor, local, other, expected) => {
        // Arrange & Act
        const sut = canonicalOf(ancestor, local, other)

        // Assert
        expect(sut).toEqual({ order: tagsOf(expected), blocks: new Map() })
      }
    )
  })

  describe('given sides with nothing contested', () => {
    it('when merged then the result is the one the conflict policy gives', () => {
      // Arrange
      const sides = [
        objectOf(tagsOf('abc')),
        objectOf(tagsOf('bac')),
        objectOf(tagsOf('abc')),
      ]
      const [ancestor, local, other] = sides

      // Act
      const sut = mergePropertyOrder(
        ancestor,
        local,
        other,
        ContestedTagOrder.CANONICAL
      )

      // Assert
      expect(sut).toEqual(
        mergePropertyOrder(ancestor, local, other, ContestedTagOrder.CONFLICT)
      )
    })
  })
})

describe('mergePropertyOrder with the conflict policy', () => {
  describe('given the sides reorder three tags into a cycle', () => {
    it.each([
      ['named', ContestedTagOrder.CONFLICT],
      ['left to its default', undefined],
    ])(
      'when the policy is %s then one block holds them all',
      (_how, policy) => {
        // Arrange
        const [ancestor, local, other] = ['abc', 'bac', 'acb'].map(text =>
          objectOf(tagsOf(text))
        )

        // Act
        const sut = mergePropertyOrder(ancestor, local, other, policy)

        // Assert
        expect(sut).toEqual({
          order: ['a'],
          blocks: new Map([['a', tagsOf('abc')]]),
        })
      }
    )
  })
})
