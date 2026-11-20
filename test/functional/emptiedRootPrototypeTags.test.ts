import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { defaultConfig } from '../utils/testConfig.js'

const profile = (tags: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="u">\n${tags
    .map(tag => `    ${tag}\n`)
    .join('')}</Profile>\n`

const collect = async (sink: PassThrough): Promise<string> => {
  const chunks: Buffer[] = []
  sink.on('data', (chunk: Buffer) => chunks.push(chunk))
  await new Promise<void>(resolve => sink.on('end', () => resolve()))
  return Buffer.concat(chunks).toString('utf8')
}

const merged = async (
  ancestor: string,
  ours: string,
  theirs: string
): Promise<string> => {
  const sink = new PassThrough()
  const collector = collect(sink)
  await new XmlMerger(defaultConfig).mergeThreeWay(
    Readable.from([ancestor]),
    Readable.from([ours]),
    Readable.from([theirs]),
    sink
  )
  sink.end()
  return collector
}

describe('given a side that empties the root of tags named like Object.prototype members', () => {
  it('when merging then the tags read as the deleted ones, never as inherited functions', async () => {
    // Arrange
    const ancestor = profile([
      '<constructor>v</constructor>',
      '<toString>v</toString>',
      '<valueOf>v</valueOf>',
    ])
    const ours = profile([
      '<constructor>v</constructor>',
      '<toString>v</toString>',
      '<valueOf>v</valueOf>',
      '<c>n</c>',
    ])
    const theirs = profile([])

    // Act
    const sut = await merged(ancestor, ours, theirs)

    // Assert
    expect(sut).toBe(profile(['<c>n</c>']))
  })

  it('when the other side edits one of them then that tag conflicts as a modified one', async () => {
    // Arrange
    const ancestor = profile(['<constructor>v</constructor>'])
    const ours = profile(['<constructor>w</constructor>'])
    const theirs = profile([])

    // Act
    const sut = await merged(ancestor, ours, theirs)

    // Assert
    expect(sut).toContain('<<<<<<< ours')
    expect(sut).not.toContain('native code')
  })
})
