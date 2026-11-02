import { describe, expect, it } from 'vitest'
import { isExplicitNeighbour } from '../../../../../src/merger/nodes/ordered/orderedContext.js'
import type { OrderedEntry } from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import { contextOf, keysOf } from '../../../../utils/orderedContext.js'

const keyList = (entries: readonly OrderedEntry[]): string =>
  entries.map(entry => entry.key).join('')

describe('buildOrderedContext', () => {
  describe('given an entry deleted by both sides', () => {
    describe('when the context is built', () => {
      it('then it is absent from the sequences', () => {
        // Arrange / Act
        const sut = contextOf('A B C', 'A C', 'A C')

        // Assert
        expect(keyList(sut.sequence.local)).toBe('AC')
        expect(keyList(sut.sequence.other)).toBe('AC')
      })
    })
  })

  describe('given sides that reorder and insert entries', () => {
    describe('when the context is built', () => {
      it('then sequences follow side order and indexIn their rank', () => {
        // Arrange / Act
        const sut = contextOf('A B', 'B X A', 'A B Y')

        // Assert
        expect(keyList(sut.sequence.local)).toBe('BXA')
        expect(keyList(sut.sequence.other)).toBe('ABY')
        expect(sut.indexIn.local.get(0)).toBe(2)
        expect(sut.indexIn.other.get(0)).toBe(0)
      })

      it('then keptByAll lists the kept entries in id order', () => {
        // Arrange / Act
        const sut = contextOf('A B', 'B X A', 'A B Y')

        // Assert
        expect(keyList(sut.keptByAll)).toBe('AB')
      })
    })
  })

  describe('given an entry inserted by both sides', () => {
    describe('when the context is built', () => {
      it('then it is agreed, unlike one inserted by a single side', () => {
        // Arrange / Act
        const sut = contextOf('A', 'A X Y', 'A X Z')

        // Assert
        expect(keyList(sut.agreed)).toBe('X')
      })
    })
  })

  describe('given a swap on each side', () => {
    describe('when the context is built', () => {
      it('then moved holds what each side possibly moved', () => {
        // Arrange / Act
        const sut = contextOf('A B C D', 'B A C D', 'A B D C')

        // Assert
        expect(keysOf(sut, sut.moved.local)).toEqual(['A', 'B'])
        expect(keysOf(sut, sut.moved.other)).toEqual(['C', 'D'])
      })
    })
  })
})

describe('buildOrderedContext without a replacement', () => {
  describe('given sides that replace nothing', () => {
    describe('when the context is built', () => {
      it('then the sides as written are the live sequences', () => {
        // Arrange / Act
        const sut = contextOf('A B', 'B A', 'A B X')

        // Assert
        expect(sut.view).toBe(sut.entries)
        expect(sut.written).toBe(sut.sequence)
      })
    })
  })
})

describe('buildOrderedContext with a replacement', () => {
  describe('given a side replacing an entry the other side kept', () => {
    describe('when the context is built', () => {
      it('then the order axis reads the replacement as a kept entry', () => {
        // Arrange / Act
        const sut = contextOf('A B', 'X B', 'A B Y')

        // Assert
        expect(keyList(sut.keptByAll)).toBe('BX')
        expect(keyList(sut.agreed)).toBe('')
        expect(keyList(sut.sequence.other)).toBe('XBY')
      })

      it('then the sides as written keep the replacement on its own side', () => {
        // Arrange / Act
        const sut = contextOf('A B', 'X B', 'A B Y')

        // Assert
        expect(keyList(sut.written.local)).toBe('XB')
        expect(keyList(sut.written.other)).toBe('BY')
        expect(keyList(sut.entries)).toBe('ABXY')
        expect(sut.view).not.toBe(sut.entries)
      })

      it('then the place of the replacement is exposed', () => {
        // Arrange / Act
        const sut = contextOf('A B', 'X B', 'A B Y')

        // Assert
        expect([...sut.place.keys()]).toEqual([2])
        expect(sut.place.get(2)).toBe(0.5)
      })
    })
  })
})

describe('isExplicitNeighbour', () => {
  describe('given a one-sided run between shared entries', () => {
    const sut = contextOf('A B C D', 'A X Y Z D', 'A X W Z D')
    const entry = (key: string): OrderedEntry =>
      sut.entries.find(candidate => candidate.key === key) as OrderedEntry

    describe('when asking about the entries around X on local', () => {
      it('then A and Z are explicit and the local-only Y is skipped', () => {
        // Act
        const neighbours = (key: string) =>
          'ABCDXYWZ'
            .split('')
            .filter(
              other =>
                other !== key &&
                isExplicitNeighbour(sut, entry(other), entry(key), 'local')
            )

        // Assert
        expect(neighbours('X')).toEqual(['A', 'Z'])
        expect(neighbours('Y')).toEqual(['X', 'Z'])
      })
    })
  })

  describe('given an entry at a sequence end', () => {
    describe('when asking whether a farther entry is its neighbour', () => {
      it('then it is not', () => {
        // Arrange
        const sut = contextOf('A B C', 'A B C', 'A B C')
        const [a, , c] = sut.entries as readonly OrderedEntry[]

        // Act
        const result = isExplicitNeighbour(
          sut,
          c as OrderedEntry,
          a as OrderedEntry,
          'other'
        )

        // Assert
        expect(result).toBe(false)
      })
    })
  })

  describe('given the first and the last entry of a sequence', () => {
    describe('when asking whether an unrelated entry is their neighbour', () => {
      it('then the missing neighbour matches no entry', () => {
        // Arrange
        const sut = contextOf('A B C', 'A C B', 'B C A')
        const entry = (key: string) =>
          sut.entries.find(candidate => candidate.key === key) as OrderedEntry

        // Act
        const beforeFirst = isExplicitNeighbour(
          sut,
          entry('B'),
          entry('A'),
          'local'
        )
        const afterLast = isExplicitNeighbour(
          sut,
          entry('B'),
          entry('A'),
          'other'
        )

        // Assert
        expect(beforeFirst).toBe(false)
        expect(afterLast).toBe(false)
      })
    })
  })
})
