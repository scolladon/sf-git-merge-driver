import { describe, expect, it } from 'vitest'
import type { OrderedEntry } from '../../../../../src/merger/nodes/ordered/orderedEntry.js'
import {
  INHERITED_PLACE,
  orderingView,
  phantomSwaps,
  type ReplacementRun,
  replacementRuns,
} from '../../../../../src/merger/nodes/ordered/replacement.js'
import { statusesOf } from '../../../../utils/orderedContext.js'
import { readingsOf } from '../../../../utils/orderedTokens.js'

const keyList = (entries: readonly OrderedEntry[]): string =>
  entries.map(entry => entry.key).join('')

const runsOf = (
  ancestor: string,
  local: string,
  other: string
): { readonly local: string; readonly other: string } => {
  const [reading] = readingsOf(ancestor, local, other)
  const statuses = statusesOf(reading!)
  const describeRun = ({ inserted, replaced }: ReplacementRun): string =>
    `${keyList(inserted)}>${keyList(replaced)}`
  return {
    local: replacementRuns(reading!, statuses, 'local')
      .map(describeRun)
      .join(' '),
    other: replacementRuns(reading!, statuses, 'other')
      .map(describeRun)
      .join(' '),
  }
}

const viewOf = (ancestor: string, local: string, other: string) => {
  const [reading] = readingsOf(ancestor, local, other)
  const statuses = statusesOf(reading!)
  const sut = orderingView(reading!, statuses)
  const byKey = (key: string): OrderedEntry =>
    sut.view.find(entry => entry.key === key) as OrderedEntry
  return { sut, byKey, reading: reading!, statuses }
}

describe('replacementRuns', () => {
  describe('given a side removing an entry and inserting another one', () => {
    describe('when scanning that side', () => {
      it('then the insertion replaces the removed entry', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B', 'X B', 'A B')

        // Assert
        expect(result).toEqual({ local: 'X>A', other: '' })
      })

      it('then a run at the end replaces the entries up to the end', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C', 'A X', 'A B C')

        // Assert
        expect(result).toEqual({ local: 'X>BC', other: '' })
      })

      it('then a run keeps every insertion made between the same neighbours', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C', 'A X Y C', 'A B C')

        // Assert
        expect(result).toEqual({ local: 'XY>B', other: '' })
      })

      it('then each stretch between kept entries is its own run', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C D E', 'A X C Y E', 'A B C D E')

        // Assert
        expect(result).toEqual({ local: 'X>B Y>D', other: '' })
      })
    })
  })

  describe('given a side inserting without removing anything', () => {
    describe('when scanning that side', () => {
      it('then there is no run', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B', 'A X B', 'A B')

        // Assert
        expect(result).toEqual({ local: '', other: '' })
      })
    })
  })

  describe('given a side moving the entry that sat between its neighbours', () => {
    describe('when scanning that side', () => {
      it('then the insertion replaces nothing', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C', 'A X C B', 'A B C')

        // Assert
        expect(result).toEqual({ local: '', other: '' })
      })
    })
  })

  describe('given a side whose neighbours were reordered around the insertion', () => {
    describe('when scanning that side', () => {
      it('then there is no run between neighbours that left the ancestor order', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B', 'B X A', 'A B')

        // Assert
        expect(result).toEqual({ local: '', other: '' })
      })
    })
  })

  describe('given an insertion both sides made beside the removal', () => {
    describe('when scanning that side', () => {
      it('then the agreed insertion is transparent', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B', 'A Z X', 'A Z B')

        // Assert
        expect(result).toEqual({ local: 'X>B', other: '' })
      })
    })
  })

  describe('given a replaced entry the other side edited', () => {
    describe('when scanning that side', () => {
      it('then the insertion is a plain one', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A', 'X', 'A*')

        // Assert
        expect(result).toEqual({ local: '', other: '' })
      })
    })
  })

  describe('given a replaced entry the other side moved', () => {
    describe('when scanning that side', () => {
      it('then the insertion is a plain one', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C', 'X B C', 'B C A')

        // Assert
        expect(result).toEqual({ local: '', other: '' })
      })
    })
  })

  describe('given a side moving one of the entries that sat between its neighbours', () => {
    describe('when scanning that side', () => {
      it('then the insertion replaces nothing', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C D', 'A X D B', 'A B C D')

        // Assert
        expect(result).toEqual({ local: '', other: '' })
      })
    })
  })

  describe('given a side that kept some of the entries between its neighbours elsewhere', () => {
    describe('when scanning that side', () => {
      it('then only the side that removed them all replaces them', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C D', 'A V', 'B C A Z')

        // Assert
        expect(result).toEqual({ local: 'V>BCD', other: '' })
      })
    })
  })

  describe('given one of the replaced entries in conflict', () => {
    describe('when scanning that side', () => {
      it('then the insertion is a plain one', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C', 'X C', 'A B* C')

        // Assert
        expect(result).toEqual({ local: '', other: '' })
      })
    })
  })

  describe('given a replaced entry the other side kept in place', () => {
    describe('when scanning that side', () => {
      it('then the insertion replaces it', () => {
        // Arrange
        const sut = runsOf

        // Act
        const result = sut('A B C', 'X B C', 'A B C Y')

        // Assert
        expect(result).toEqual({ local: 'X>A', other: '' })
      })
    })
  })
})

describe('orderingView', () => {
  describe('given a replacement of an entry the other side kept', () => {
    describe('when building the view', () => {
      it('then the run stands where the replaced entry stood on both sides', () => {
        // Arrange
        const { byKey, reading } = viewOf('A B', 'X B', 'A B Y')
        const replaced = reading.find(entry => entry.key === 'A')!

        // Act
        const sut = byKey('X')

        // Assert
        expect(sut.ancestor).toBe(INHERITED_PLACE)
        expect(sut.other).toBe(INHERITED_PLACE)
        expect(sut.ancestorPos).toBe(replaced.ancestorPos + 0.5)
        expect(sut.otherPos).toBe(replaced.otherPos + 0.5)
        expect(sut.localPos).toBe(0)
      })
    })
  })

  describe('given a replacement of entries the other side removed too', () => {
    describe('when building the view', () => {
      it('then the run keeps its own side and only the ancestor place', () => {
        // Arrange
        const { byKey, sut } = viewOf('A B C', 'B X', 'Y B')

        // Act
        const result = byKey('X')

        // Assert
        expect(result.ancestor).toBe(INHERITED_PLACE)
        expect(result.other).toBeUndefined()
        expect(result.ancestorPos).toBe(2.5)
        expect(sut.place.get(result.id)).toBe(2.5)
      })
    })
  })

  describe('given a run of several insertions', () => {
    describe('when building the view', () => {
      it('then the insertions share the place in their written order', () => {
        // Arrange
        const { byKey } = viewOf('A B C', 'A X Y C', 'A B C')

        // Act
        const sut = [byKey('X'), byKey('Y')].map(entry => entry.ancestorPos)

        // Assert
        expect(sut[0]).toBeGreaterThan(1)
        expect(sut[1]).toBeGreaterThan(sut[0] as number)
        expect(sut[1]).toBeLessThan(2)
      })
    })
  })

  describe('given a replacement the other side inserted inside of', () => {
    describe('when building the view', () => {
      it('then the run stays a plain insertion joined with the inside entry', () => {
        // Arrange
        const { byKey, reading, sut } = viewOf('A B', 'X', 'A Y B')

        // Act
        const result = sut.marks.joins

        // Assert
        expect(byKey('X')).toBe(reading.find(entry => entry.key === 'X'))
        expect(sut.place.size).toBe(0)
        expect(result).toEqual([[2, 3]])
      })
    })
  })

  describe('given a replacement of two entries of which the other side kept one', () => {
    describe('when building the view', () => {
      it('then nothing is inside the span the other side held', () => {
        // Arrange
        const { sut } = viewOf('A B', 'X', 'Y A')

        // Act
        const result = sut.marks

        // Assert
        expect(result).toEqual({ joins: [], seeds: [] })
        expect(sut.place.size).toBe(1)
      })
    })
  })

  describe('given no replacement', () => {
    describe('when building the view', () => {
      it('then the view is the reading itself and nothing is marked', () => {
        // Arrange
        const { sut, reading } = viewOf('A B', 'A B', 'A B C')

        // Act
        const result = sut

        // Assert
        expect(result.view).toBe(reading)
        expect(result.place.size).toBe(0)
        expect(result.marks).toEqual({ joins: [], seeds: [] })
      })
    })
  })

  describe('given a replacement spanning one entry of the other side', () => {
    describe('when building the view', () => {
      it('then nothing can be inside it', () => {
        // Arrange
        const { sut } = viewOf('A B', 'X B', 'A Y B')

        // Act
        const result = sut.marks.joins

        // Assert
        expect(result).toEqual([])
      })
    })
  })

  describe('given both sides replacing a common entry', () => {
    describe('when building the view', () => {
      it('then both runs stay plain and are joined together', () => {
        // Arrange
        const { sut } = viewOf('A', 'X', 'Y')

        // Act
        const result = sut.marks.joins

        // Assert
        expect(sut.place.size).toBe(0)
        expect(result).toEqual([[1, 2]])
        expect(sut.marks.seeds).toEqual([])
      })
    })
  })

  describe('given both sides replacing different entries', () => {
    describe('when building the view', () => {
      it('then each run keeps its own place and nothing is joined', () => {
        // Arrange
        const { sut } = viewOf('A B C', 'X B C', 'A B Y')

        // Act
        const result = sut.marks.joins

        // Assert
        expect(sut.place.size).toBe(2)
        expect(result).toEqual([])
      })
    })
  })

  describe('given each side replacing the same two entries separately', () => {
    describe('when building the view', () => {
      it('then each pair of runs sharing an entry is joined', () => {
        // Arrange
        const { sut, reading } = viewOf('A B C D E', 'A X C Y E', 'A Z C W E')
        const keyOf = (id: number) => (reading[id] as OrderedEntry).key

        // Act
        const result = sut.marks.joins.map(([first, second]) =>
          [keyOf(first), keyOf(second)].join('')
        )

        // Assert
        expect(result.sort()).toEqual(['XZ', 'YW'])
      })
    })
  })

  describe('given the runs of the two sides interleaving', () => {
    describe('when building the view', () => {
      it('then only the runs sharing an ancestor entry are joined', () => {
        // Arrange
        const { sut, reading } = viewOf('A B C D E', 'A X C Y E', 'A Z C D E')
        const keyOf = (id: number) => (reading[id] as OrderedEntry).key

        // Act
        const result = sut.marks.joins.map(([first, second]) =>
          [keyOf(first), keyOf(second)].join('')
        )

        // Assert
        expect(result).toEqual(['XZ'])
        expect(sut.place.size).toBe(1)
      })
    })
  })
})

describe('phantomSwaps', () => {
  const swapsOf = (ancestor: string, local: string, other: string) =>
    readingsOf(ancestor, local, other)
      .map(reading => {
        const statuses = statusesOf(reading)
        return phantomSwaps(orderingView(reading, statuses).view, statuses)
      })
      .sort()

  describe('given a surplus copy of an agreed value', () => {
    describe('when counting for each reading', () => {
      it('then only the reading that swaps interchangeable copies counts one', () => {
        // Arrange
        const sut = swapsOf

        // Act
        const result = sut('~a ~b', '~a ~p', '~p ~p')

        // Assert
        expect(result).toEqual([0, 1])
      })
    })
  })

  describe('given copies of different values in different orders', () => {
    describe('when counting', () => {
      it('then nothing is a phantom swap', () => {
        // Arrange
        const sut = swapsOf

        // Act
        const result = sut('~a ~b', '~b ~a', '~a ~b ~c')

        // Assert
        expect(result).toEqual([0])
      })
    })
  })

  describe('given interchangeable copies the sides keep in the same order', () => {
    describe('when counting', () => {
      it('then nothing is a phantom swap', () => {
        // Arrange
        const sut = swapsOf

        // Act
        const result = sut('~p ~p', '~p ~p ~x', '~p ~p ~y')

        // Assert
        expect(result).toEqual([0])
      })
    })
  })
})

describe('orderingView at scale', () => {
  const ENTRIES = 100_000
  const tokens = (prefix: string): string =>
    Array.from({ length: ENTRIES }, (_, i) => `${prefix}${i}`).join(' ')

  describe('given 100000 entries replacing two, with 100000 more inserted inside by the other side', () => {
    describe('when building the view', () => {
      it('then it joins every inserted entry without overflowing the stack', () => {
        // Arrange
        const [reading] = readingsOf('A B', tokens('X'), `A ${tokens('Y')} B`)
        const statuses = statusesOf(reading!)

        // Act
        const sut = orderingView(reading!, statuses)

        // Assert
        expect(sut.marks.joins).toHaveLength(2 * ENTRIES - 1)
      })
    })
  })

  describe('given both sides replacing the same two entries with 100000 entries each', () => {
    describe('when building the view', () => {
      it('then it joins the two runs without overflowing the stack', () => {
        // Arrange
        const [reading] = readingsOf('A B', tokens('X'), tokens('Y'))
        const statuses = statusesOf(reading!)

        // Act
        const sut = orderingView(reading!, statuses)

        // Assert
        expect(sut.marks.joins).toHaveLength(2 * ENTRIES - 1)
      })
    })
  })
})
