import { describe, expect, it } from 'vitest'
import { buildConflictMarkers } from '../../../../../src/merger/ConflictMarkerBuilder.js'
import type { MergedReading } from '../../../../../src/merger/nodes/ordered/mergeReading.js'
import {
  fewestPhantomSwaps,
  trimmedBlock,
} from '../../../../../src/merger/nodes/ordered/tieCombination.js'
import type { JsonObject } from '../../../../../src/types/jsonTypes.js'
import { withConflict } from '../../../../../src/types/mergeResult.js'
import { ORDERED_ATTRIBUTE, toEntry } from '../../../../utils/orderedTokens.js'

// A spread passes one argument per reading and overflows the stack from about
// 100 000 of them: twice that leaves room for any depth the runner adds.
const READINGS = 200_000

// Coverage and mutation runs slow the merge code several-fold.
const LARGE_TIMEOUT_MS = 120_000

const ITEM: JsonObject = { [ORDERED_ATTRIBUTE]: toEntry('R') }

const ZERO_SWAP_READING: MergedReading = {
  output: [ITEM],
  hasConflict: false,
  phantomSwaps: () => 0,
}

describe('fewestPhantomSwaps', () => {
  describe('given more zero-swap readings than a spread can pass', () => {
    describe('when keeping the readings with the fewest swaps', () => {
      it(
        'then every reading is kept',
        () => {
          // Arrange
          const merged = Array.from(
            { length: READINGS },
            () => ZERO_SWAP_READING
          )
          const sut = fewestPhantomSwaps

          // Act
          const result = sut(merged)

          // Assert
          expect(result).toHaveLength(READINGS)
        },
        LARGE_TIMEOUT_MS
      )
    })
  })
})

describe('trimmedBlock', () => {
  describe('given more outputs than a spread can pass', () => {
    describe('when building the block', () => {
      it(
        'then the block holds what the outputs and both sides do not share',
        () => {
          // Arrange
          const outputs = Array.from({ length: READINGS }, (_, at) =>
            at === 0 ? [ITEM, ITEM] : [ITEM]
          )
          const wrapped = {
            ancestor: [ITEM],
            local: [ITEM, ITEM],
            other: [ITEM],
          }
          const sut = trimmedBlock

          // Act
          const result = sut(wrapped, outputs)

          // Assert
          expect(result).toStrictEqual(
            withConflict([ITEM, buildConflictMarkers([ITEM], [], [])])
          )
        },
        LARGE_TIMEOUT_MS
      )
    })
  })
})
