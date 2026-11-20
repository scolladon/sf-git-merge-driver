import { describe, expect, it } from 'vitest'
import { BlockClosure } from '../../../../../src/merger/nodes/ordered/blockClosure.js'

// Linear closure takes ~20 ms at LARGE_SIZE under coverage; the quadratic
// stop-extension (Math.min) takes ~26 s plain. The bound sits between the two
// so that CPU load and coverage instrumentation cannot push the linear code
// over it.
const LARGE_SIZE = 20_000
const MAX_CLOSURE_MS = 1000
const QUADRATIC_GUARD_TIMEOUT_MS = 120_000

describe('BlockClosure', () => {
  describe('given two members far apart with thousands of entries between', () => {
    describe('when settling', () => {
      it(
        'then one sweep per sequence absorbs them all',
        () => {
          // Arrange
          const sut = new BlockClosure(LARGE_SIZE)
          const output = Array.from({ length: LARGE_SIZE }, (_, id) => id)
          sut.seed(0, 0)
          sut.seed(LARGE_SIZE - 1, 0)
          const started = performance.now()

          // Act
          sut.settle(output, [])

          // Assert
          expect(output.every(id => sut.root(id) === sut.root(0))).toBe(true)
          expect(output.every(id => sut.isMember(id))).toBe(true)
          expect(performance.now() - started).toBeLessThan(MAX_CLOSURE_MS)
        },
        QUADRATIC_GUARD_TIMEOUT_MS
      )
    })
  })
})
