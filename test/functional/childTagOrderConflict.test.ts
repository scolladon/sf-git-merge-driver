import { readFileSync } from 'node:fs'
import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { defaultConfig } from '../utils/testConfig.js'

const FIXTURES = [
  [
    'both sides reorder the child tags of a nested element into a cycle',
    'test/fixtures/xml/90-nested-child-tag-order-cycle',
  ],
  [
    'both sides add a child tag to a nested element at positions that disagree',
    'test/fixtures/xml/91-nested-child-tag-added-at-two-positions',
  ],
  [
    'both sides reorder the child tags of a keyed entry of equal content into a cycle',
    'test/fixtures/xml/92-nested-child-tag-cycle-equal-content-keyed-entry',
  ],
] as const

const read = (fixture: string, name: string): string =>
  readFileSync(`${fixture}/${name}`, 'utf8')

const collect = async (sink: PassThrough): Promise<string> => {
  const chunks: Buffer[] = []
  sink.on('data', (chunk: Buffer) => chunks.push(chunk))
  await new Promise<void>(resolve => sink.on('end', () => resolve()))
  return Buffer.concat(chunks).toString('utf8')
}

const merged = async (fixture: string): Promise<string> => {
  const sink = new PassThrough()
  const collector = collect(sink)
  await new XmlMerger(defaultConfig).mergeThreeWay(
    Readable.from([read(fixture, 'ancestor.xml')]),
    Readable.from([read(fixture, 'ours.xml')]),
    Readable.from([read(fixture, 'theirs.xml')]),
    sink
  )
  sink.end()
  return collector
}

// Keeps the lines outside the markers and the ones of the chosen side
const resolvedTo = (conflicted: string, side: 'ours' | 'theirs'): string => {
  const kept: string[] = []
  let section = 'outside'
  for (const line of conflicted.split('\n')) {
    if (line === '<<<<<<< ours') section = 'ours'
    else if (line === '||||||| base') section = 'base'
    else if (line === '=======') section = 'theirs'
    else if (line === '>>>>>>> theirs') section = 'outside'
    else if (section === 'outside' || section === side) kept.push(line)
  }
  return kept.join('\n')
}

describe.each(FIXTURES)('given %s', (_name, fixture) => {
  it.each([
    ['ours', 'ours.xml'],
    ['theirs', 'theirs.xml'],
  ] as const)(
    'when the conflict is resolved to %s then the element is exactly that side',
    async (side, file) => {
      // Arrange
      const sut = await merged(fixture)

      // Act
      const resolved = resolvedTo(sut, side)

      // Assert
      expect(resolved).toBe(read(fixture, file))
    }
  )
})

describe('given tags both sides add in opposite orders under the root element', () => {
  const ROOT_FIXTURES = [
    'test/fixtures/xml/49-permissionset-incompatible-group-order',
    'test/fixtures/xml/50-permissionset-incompatible-group-order-swapped',
  ]

  it('when merging with the sides swapped then both merges are the same, with no conflict', async () => {
    // Arrange & Act
    const [ours, theirs] = await Promise.all(ROOT_FIXTURES.map(merged))

    // Assert
    expect(ours).toBe(theirs)
    expect(ours).not.toContain('<<<<<<<')
  })
})
