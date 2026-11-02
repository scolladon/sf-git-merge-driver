import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CompactXmlParser } from '../../../../src/adapter/parser/CompactXmlParser.js'
import { mergeXml } from './arbitraries.js'

// Attributes follow the doctrines of fields: a one-sided change is kept, the
// same change on both sides is kept once, attributes changed apart merge, and
// different changes of one attribute (or a deletion against an edit) conflict.

const NAMES = ['a', 'b', 'c']
const VALUES = ['0', '1', '2']
const MARKERS = ['<<<<<<< ours', '||||||| base', '=======', '>>>>>>> theirs']
const REACH_SAMPLES = 400
const MINIMUM_REACH = 0.2

type Value = string | undefined
type Attributes = Record<string, Value>
type Trio = readonly [Attributes, Attributes, Attributes]

const valueArb = fc.constantFrom<Value>(undefined, ...VALUES)

const attributesArb: fc.Arbitrary<Attributes> = fc
  .tuple(...NAMES.map(() => valueArb))
  .map(values => Object.fromEntries(NAMES.map((name, i) => [name, values[i]])))

const trioArb: fc.Arbitrary<Trio> = fc.tuple(
  attributesArb,
  attributesArb,
  attributesArb
)

const isContested = (name: string, [a, l, o]: Trio): boolean =>
  a[name] !== l[name] && a[name] !== o[name] && l[name] !== o[name]

const settled = (name: string, [a, l, o]: Trio): Value => {
  if (a[name] === l[name]) return o[name]
  if (a[name] === o[name]) return l[name]
  return l[name]
}

const contestedNames = (trio: Trio): string[] =>
  NAMES.filter(name => isContested(name, trio))

const fileOf = (attributes: Attributes): string => {
  const written = NAMES.filter(name => attributes[name] !== undefined)
    .map(name => ` ${name}="${attributes[name]}"`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="u"${written}>\n    <base>v</base>\n</Profile>\n`
}

const mergedFile = (trio: Trio) =>
  mergeXml([fileOf(trio[0]), fileOf(trio[1]), fileOf(trio[2])])

const rootAttributesOf = (xml: string): Attributes => {
  const { rootAttributes } = new CompactXmlParser().parseString(xml)
  return Object.fromEntries(
    NAMES.map(name => [name, rootAttributes[`@_${name}`] as Value])
  )
}

type Side = 'ours' | 'theirs'

// The lines outside the markers and the ones of the chosen side
const resolvedTo = (conflicted: string, side: Side): string => {
  let section = 'outside'
  const kept: string[] = []
  for (const line of conflicted.split('\n')) {
    if (line === MARKERS[0]) section = 'ours'
    else if (line === MARKERS[1]) section = 'base'
    else if (line === MARKERS[2]) section = 'theirs'
    else if (line === MARKERS[3]) section = 'outside'
    else if (section === 'outside' || section === side) kept.push(line)
  }
  return kept.join('\n')
}

const settledEverywhere = (trio: Trio, resolved: Attributes): void => {
  for (const name of NAMES.filter(n => !isContested(n, trio))) {
    expect(resolved[name]).toBe(settled(name, trio))
  }
}

const cleanWhenNothingIsContested = fc.asyncProperty(trioArb, async trio => {
  // Arrange
  const contested = contestedNames(trio)

  // Act
  const sut = await mergedFile(trio)

  // Assert
  expect(sut.hasConflict).toBe(contested.length > 0)
  if (contested.length === 0) {
    expect(rootAttributesOf(sut.output)).toEqual(
      Object.fromEntries(NAMES.map(name => [name, settled(name, trio)]))
    )
  }
})

const eachResolutionKeepsItsSide = fc.asyncProperty(trioArb, async trio => {
  // Arrange
  const contested = contestedNames(trio)
  const [, local, other] = trio
  const sut = await mergedFile(trio)

  // Act
  const [ours, theirs] = (['ours', 'theirs'] as const).map(side =>
    rootAttributesOf(resolvedTo(sut.output, side))
  ) as [Attributes, Attributes]

  // Assert
  for (const name of contested) {
    expect(ours[name]).toBe(local[name])
    expect(theirs[name]).toBe(other[name])
  }
  settledEverywhere(trio, ours)
  settledEverywhere(trio, theirs)
})

const mirrorsWhenSwapped = fc.asyncProperty(trioArb, async trio => {
  // Arrange
  const [a, l, o] = trio
  const swapped: Trio = [a, o, l]

  // Act
  const [sut, mirror] = await Promise.all([
    mergedFile(trio),
    mergedFile(swapped),
  ])

  // Assert
  expect(sut.hasConflict).toBe(mirror.hasConflict)
  if (contestedNames(trio).length > 0) {
    expect(rootAttributesOf(resolvedTo(sut.output, 'ours'))).toEqual(
      rootAttributesOf(resolvedTo(mirror.output, 'theirs'))
    )
  }
})

describe('JsonMerger laws: root attributes', () => {
  it('when nothing is contested then the merge is clean and settles every attribute', async () => {
    await fc.assert(cleanWhenNothingIsContested)
  })

  it('when an attribute is contested then each resolution keeps its side and the settled ones', async () => {
    await fc.assert(eachResolutionKeepsItsSide)
  })

  it('when local and other are swapped then the merge mirrors', async () => {
    await fc.assert(mirrorsWhenSwapped)
  })

  it('when sampled then a contested attribute is reached often', () => {
    // Arrange
    const samples = fc.sample(trioArb, REACH_SAMPLES)

    // Act
    const reached = samples.filter(trio => contestedNames(trio).length > 0)

    // Assert
    expect(reached.length / REACH_SAMPLES).toBeGreaterThanOrEqual(MINIMUM_REACH)
  })
})
