import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../../src/adapter/parser/CompactXmlParser.js'
import { XmlStreamWriter } from '../../../src/adapter/writer/XmlStreamWriter.js'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import { isConflictBlock } from '../../../src/types/conflictBlock.js'
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from '../../../src/types/jsonTypes.js'
import { serializeToString } from '../../utils/serializeToString.js'
import { defaultConfig } from '../../utils/testConfig.js'

type Emission = 'sorted' | 'positional'
type Side = readonly JsonValue[]

interface KindSpec {
  readonly root: string
  readonly attribute: string
  readonly sibling: JsonObject
  readonly entry: (key: string) => fc.Arbitrary<JsonValue>
  readonly keyOf: (entry: JsonValue) => string
  readonly emission: Emission
}

interface MergeOutcome {
  readonly output: JsonArray
  readonly hasConflict: boolean
}

const KEYS = ['A', 'B', 'C', 'D', 'E']
const BOOLEAN_TEXT = fc.constantFrom('true', 'false')
// Three values, so local and other can edit one field to different values
// and reach the field-level conflict a two-value alphabet never produces
const FIELD_TEXT = fc.constantFrom('true', 'false', 'unset')
const LABEL_TEXT = fc.constantFrom('x', 'y', 'z')
const KEEP_WEIGHT = 3
const DROP_WEIGHT = 1
const MODIFY_WEIGHT = 1

const fieldOf = (entry: JsonValue, field: string): string =>
  String((entry as JsonObject)[field])

const keyed: KindSpec = {
  root: 'Profile',
  attribute: 'fieldPermissions',
  sibling: { custom: 'false' },
  entry: key =>
    fc.record({
      editable: FIELD_TEXT,
      field: fc.constant(key),
      readable: FIELD_TEXT,
    }),
  keyOf: entry => fieldOf(entry, 'field'),
  emission: 'sorted',
}

const ordered: KindSpec = {
  root: 'GlobalValueSet',
  attribute: 'customValue',
  sibling: { masterLabel: 'M' },
  entry: key =>
    fc.record({
      fullName: fc.constant(key),
      default: BOOLEAN_TEXT,
      label: LABEL_TEXT,
    }),
  keyOf: entry => fieldOf(entry, 'fullName'),
  emission: 'positional',
}

const text: KindSpec = {
  root: 'Package',
  attribute: 'members',
  sibling: { version: '60.0' },
  entry: key => fc.constant(key.toLowerCase()),
  keyOf: entry => String(entry).toUpperCase(),
  emission: 'sorted',
}

const sideArb = (spec: KindSpec): fc.Arbitrary<Side> =>
  fc.shuffledSubarray(KEYS).chain(keys => fc.tuple(...keys.map(spec.entry)))

const decisionArb = (spec: KindSpec, entry: JsonValue): fc.Arbitrary<Side> =>
  fc.oneof(
    { weight: KEEP_WEIGHT, arbitrary: fc.constant([entry]) },
    { weight: DROP_WEIGHT, arbitrary: fc.constant([]) },
    {
      weight: MODIFY_WEIGHT,
      arbitrary: spec.entry(spec.keyOf(entry)).map(modified => [modified]),
    }
  )

const insertAt = (
  side: Side,
  insertions: readonly { entry: JsonValue; position: number }[]
): Side =>
  insertions.reduce(
    (acc, { entry, position }) => {
      const index = position % (acc.length + 1)
      return [...acc.slice(0, index), entry, ...acc.slice(index)]
    },
    [...side]
  )

const insertionsArb = (spec: KindSpec, kept: Side): fc.Arbitrary<Side> => {
  const present = new Set(kept.map(spec.keyOf))
  const unused = KEYS.filter(key => !present.has(key))
  return fc.subarray(unused).chain(keys =>
    fc
      .tuple(
        fc.tuple(...keys.map(spec.entry)),
        fc.array(fc.nat(), {
          minLength: keys.length,
          maxLength: keys.length,
        })
      )
      .map(([entries, positions]) =>
        insertAt(
          kept,
          entries.map((entry, i) => ({ entry, position: positions[i] }))
        )
      )
  )
}

const moveToEnd = (side: Side, index: number): Side =>
  side.length === 0
    ? side
    : [
        ...side.filter((_, i) => i !== index % side.length),
        side[index % side.length],
      ]

const permuteArb = (side: Side): fc.Arbitrary<Side> =>
  fc
    .tuple(fc.boolean(), fc.nat())
    .map(([shouldMove, index]) => (shouldMove ? moveToEnd(side, index) : side))

const editOf = (spec: KindSpec, ancestor: Side): fc.Arbitrary<Side> =>
  fc
    .tuple(...ancestor.map(entry => decisionArb(spec, entry)))
    .map(decided => decided.flat())
    .chain(kept => insertionsArb(spec, kept))
    .chain(permuteArb)

const changedSideArb = (spec: KindSpec, ancestor: Side): fc.Arbitrary<Side> =>
  fc.oneof(editOf(spec, ancestor), sideArb(spec))

const sidesArb = (spec: KindSpec): fc.Arbitrary<readonly [Side, Side, Side]> =>
  sideArb(spec).chain(ancestor =>
    fc.tuple(
      fc.constant(ancestor),
      changedSideArb(spec, ancestor),
      changedSideArb(spec, ancestor)
    )
  )

const byKey =
  (spec: KindSpec) =>
  (left: JsonValue, right: JsonValue): number => {
    const [l, r] = [spec.keyOf(left), spec.keyOf(right)]
    return l < r ? -1 : l > r ? 1 : 0
  }

const retrieveShaped = (spec: KindSpec, side: Side): Side =>
  spec.emission === 'sorted' ? [...side].sort(byKey(spec)) : side

const attributeValue = (side: Side): JsonValue =>
  side.length === 1 ? side[0] : [...side]

const toDoc = (spec: KindSpec, side: Side): JsonObject => ({
  [spec.root]: {
    ...spec.sibling,
    ...(side.length === 0 ? {} : { [spec.attribute]: attributeValue(side) }),
  },
})

const merge = (
  spec: KindSpec,
  ancestor: Side,
  local: Side,
  other: Side
): MergeOutcome =>
  new JsonMerger(defaultConfig).mergeThreeWay(
    toDoc(spec, ancestor),
    toDoc(spec, local),
    toDoc(spec, other)
  )

const render = (output: JsonArray): Promise<string> =>
  serializeToString(new XmlStreamWriter(defaultConfig), output, {})

const entriesOf = (spec: KindSpec, xml: string): Side => {
  const content = new CompactXmlParser().parseString(xml).content
  const value = (content[spec.root] as JsonObject)[spec.attribute]
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

const swapValue = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return swapAll(value)
  if (typeof value !== 'object' || value === null) return value
  if (isConflictBlock(value)) {
    return {
      ...value,
      local: swapAll(value.other),
      other: swapAll(value.local),
      ancestor: swapAll(value.ancestor),
    }
  }
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, swapValue(v)])
  )
}

const swapAll = (values: JsonArray): JsonArray => values.map(swapValue)

const assertEquivalent = async (
  left: MergeOutcome,
  right: MergeOutcome
): Promise<void> => {
  expect(left.hasConflict).toBe(false)
  expect(right.hasConflict).toBe(false)
  expect(await render(left.output)).toBe(await render(right.output))
}

const idempotence = (spec: KindSpec) =>
  fc.asyncProperty(sideArb(spec), async x => {
    // Arrange
    const side = x

    // Act
    const sut = merge(spec, side, side, side)

    // Assert
    expect(sut.hasConflict).toBe(false)
    expect(entriesOf(spec, await render(sut.output))).toEqual(side)
  })

const oneSidedChange = (spec: KindSpec) =>
  fc.asyncProperty(
    sideArb(spec).chain(a => fc.tuple(fc.constant(a), editOf(spec, a))),
    async ([ancestor, edit]) => {
      // Arrange
      const a = retrieveShaped(spec, ancestor)
      const o = retrieveShaped(spec, edit)

      // Act
      const sut = merge(spec, a, a, o)
      const mirrored = merge(spec, a, o, a)

      // Assert
      await assertEquivalent(sut, merge(spec, o, o, o))
      await assertEquivalent(mirrored, merge(spec, o, o, o))
    }
  )

const sameChange = (spec: KindSpec) =>
  fc.asyncProperty(
    sideArb(spec).chain(a => fc.tuple(fc.constant(a), changedSideArb(spec, a))),
    async ([ancestor, change]) => {
      // Arrange
      const a = retrieveShaped(spec, ancestor)
      const x = retrieveShaped(spec, change)

      // Act
      const sut = merge(spec, a, x, x)

      // Assert
      await assertEquivalent(sut, merge(spec, x, x, x))
    }
  )

const symmetry = (spec: KindSpec) =>
  fc.asyncProperty(sidesArb(spec), async ([a, l, o]) => {
    // Arrange
    const swapped = merge(spec, a, o, l)

    // Act
    const sut = merge(spec, a, l, o)

    // Assert
    expect(sut.hasConflict).toBe(swapped.hasConflict)
    expect(await render(sut.output)).toBe(await render(swapAll(swapped.output)))
  })

const expectedKeys = (
  spec: KindSpec,
  [a, l, o]: readonly [Side, Side, Side]
): string[] => {
  const [inA, inL, inO] = [a, l, o].map(side => side.map(spec.keyOf))
  return KEYS.filter(
    k =>
      (inL.includes(k) && inO.includes(k)) ||
      (!inA.includes(k) && (inL.includes(k) || inO.includes(k)))
  )
}

const noLossNoDuplication = (spec: KindSpec) =>
  fc.asyncProperty(sidesArb(spec), async sides => {
    // Arrange
    const [a, l, o] = sides
    const sut = merge(spec, a, l, o)
    fc.pre(!sut.hasConflict)

    // Act
    const keys = entriesOf(spec, await render(sut.output)).map(spec.keyOf)

    // Assert
    expect([...keys].sort()).toEqual(expectedKeys(spec, sides))
  })

const assertLaw = <T extends unknown[]>(
  property: fc.IAsyncProperty<T>
): Promise<void> => fc.assert(property)

describe('JsonMerger laws', () => {
  describe.each([
    ['keyed', keyed],
    ['text', text],
  ])('given %s arrays', (_name, spec) => {
    it('when merging identical sides then the merge is clean and unchanged', async () => {
      await assertLaw(idempotence(spec))
    })

    it('when one side changes then the merge renders as that change', async () => {
      await assertLaw(oneSidedChange(spec))
    })

    it('when both sides make the same change then the merge renders as that change merged with itself', async () => {
      await assertLaw(sameChange(spec))
    })

    it('when local and other are swapped then the merge mirrors', async () => {
      await assertLaw(symmetry(spec))
    })

    it('when the merge is clean then no key is lost or duplicated', async () => {
      await assertLaw(noLossNoDuplication(spec))
    })
  })

  describe('given ordered-keyed arrays', () => {
    it('when one side changes then the merge renders as that change', async () => {
      await assertLaw(oneSidedChange(ordered))
    })

    it('when merging identical sides then the merge is clean and unchanged', async () => {
      await assertLaw(idempotence(ordered))
    })

    it('when both sides make the same change then the merge renders as that change merged with itself', async () => {
      await assertLaw(sameChange(ordered))
    })

    it('when local and other are swapped then the merge mirrors', async () => {
      await assertLaw(symmetry(ordered))
    })

    it('when the merge is clean then no key is lost or duplicated', async () => {
      await assertLaw(noLossNoDuplication(ordered))
    })
  })
})
