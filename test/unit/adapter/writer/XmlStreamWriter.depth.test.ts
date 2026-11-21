import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import type { JsonArray, JsonValue } from '../../../../src/types/jsonTypes.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'

// How deep a document can nest is bounded by the stack, whose size belongs
// to the host: what the writer owns is the frames one nesting level costs
const FRAMES_PER_LEVEL = 3
const SHALLOW_DEPTH = 2
const DEEP_DEPTH = 6

// The frames below the walk's entry are the caller's, and differ from one
// call to the next: only those above it are counted
const WALK_ENTRY = 'writeTo'

type Wrap = (child: JsonValue) => JsonValue

const insideAnAttributedElement: Wrap = child => ({ '@_k': 'v', a: child })
const insideAnElementOnlyBody: Wrap = child => ({ a: child })
const insideARepeatedElement: Wrap = child => ({ a: [child] })

// Read as an attribute value at the innermost element, it records how many
// frames the walk has stacked by then
class StackProbe {
  frames = 0

  toString(): string {
    const stack = String(new Error().stack).split('\n')
    this.frames = stack.findIndex(line => line.includes(WALK_ENTRY))
    return 'v'
  }
}

const nestedAround = (
  probe: StackProbe,
  wrap: Wrap,
  depth: number
): JsonArray => {
  let node: JsonValue = { '@_k': probe as unknown as JsonValue }
  for (let level = 0; level < depth; level++) node = wrap(node)
  return [{ Root: node }]
}

const framesAt = async (wrap: Wrap, depth: number): Promise<number> => {
  const probe = new StackProbe()
  const writer = new XmlStreamWriter(defaultConfig)
  await serializeToString(writer, nestedAround(probe, wrap, depth), {}, {})
  return probe.frames
}

describe('XmlStreamWriter nesting', () => {
  let stackTraceLimit: number

  beforeEach(() => {
    stackTraceLimit = Error.stackTraceLimit
    Error.stackTraceLimit = Number.POSITIVE_INFINITY
  })

  afterEach(() => {
    Error.stackTraceLimit = stackTraceLimit
  })

  describe.each([
    ['elements carrying an attribute', insideAnAttributedElement],
    ['elements holding child elements only', insideAnElementOnlyBody],
    ['repeated elements holding child elements only', insideARepeatedElement],
  ])('given nested %s', (_shape, wrap) => {
    it('when written then each nesting level costs three frames', async () => {
      // Arrange
      const shallow = await framesAt(wrap, SHALLOW_DEPTH)

      // Act
      const sut = await framesAt(wrap, DEEP_DEPTH)

      // Assert
      const perLevel = (sut - shallow) / (DEEP_DEPTH - SHALLOW_DEPTH)
      expect(perLevel).toBe(FRAMES_PER_LEVEL)
    })
  })
})
