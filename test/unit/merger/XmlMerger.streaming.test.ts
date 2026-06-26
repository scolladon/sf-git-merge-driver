import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import { defaultConfig } from '../../utils/testConfig.js'

const collect = async (stream: PassThrough): Promise<string> => {
  const chunks: Buffer[] = []
  stream.on('data', (c: Buffer) => chunks.push(c))
  await new Promise<void>(resolve => stream.on('end', () => resolve()))
  return Buffer.concat(chunks).toString('utf8')
}

const runMergeStreams = async (
  merger: XmlMerger,
  ancestor: string,
  ours: string,
  theirs: string
): Promise<{ output: string; hasConflict: boolean }> => {
  const sink = new PassThrough()
  const collector = collect(sink)
  const result = await merger.mergeThreeWay(
    Readable.from([ancestor]),
    Readable.from([ours]),
    Readable.from([theirs]),
    sink
  )
  sink.end()
  const output = await collector
  return { output, hasConflict: result.hasConflict }
}

describe('XmlMerger.mergeThreeWay', () => {
  const sut = new XmlMerger(defaultConfig)

  describe('given three identical documents', () => {
    it('when merged then no conflict and output matches any side', async () => {
      const doc = `<?xml version="1.0" encoding="UTF-8"?>
<Root xmlns="http://x"><v>a</v></Root>`
      const result = await runMergeStreams(sut, doc, doc, doc)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('<v>a</v>')
      expect(result.output).toContain('xmlns="http://x"')
    })
  })

  describe('given ours and theirs add disjoint keyed children', () => {
    it('when merged then both additions survive with no conflict', async () => {
      const ancestor = `<?xml version="1.0"?><Profile xmlns="http://soap.sforce.com/2006/04/metadata"><userPermissions><enabled>true</enabled><name>View</name></userPermissions></Profile>`
      const ours = `<?xml version="1.0"?><Profile xmlns="http://soap.sforce.com/2006/04/metadata"><userPermissions><enabled>true</enabled><name>View</name></userPermissions><userPermissions><enabled>true</enabled><name>Modify</name></userPermissions></Profile>`
      const theirs = `<?xml version="1.0"?><Profile xmlns="http://soap.sforce.com/2006/04/metadata"><userPermissions><enabled>true</enabled><name>View</name></userPermissions><userPermissions><enabled>true</enabled><name>Api</name></userPermissions></Profile>`
      const result = await runMergeStreams(sut, ancestor, ours, theirs)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('<name>Modify</name>')
      expect(result.output).toContain('<name>Api</name>')
      expect(result.output).toContain('<name>View</name>')
    })
  })

  describe('given namespace merge across three sides', () => {
    it('when merged then namespace order is ancestor-ours-theirs (declaration order)', async () => {
      // local URI for the SAME prefix wins over other; ancestor is
      // overridden by both.
      const ancestor = `<?xml version="1.0"?><R xmlns="http://anc"><v>a</v></R>`
      const ours = `<?xml version="1.0"?><R xmlns="http://ours"><v>a</v></R>`
      const theirs = `<?xml version="1.0"?><R xmlns="http://theirs"><v>a</v></R>`
      const result = await runMergeStreams(sut, ancestor, ours, theirs)
      // Object.assign({}, anc, local, other) => other wins
      expect(result.output).toContain('xmlns="http://theirs"')
    })
  })

  describe('given the ancestor stream is delayed behind ours and theirs', () => {
    it('when merged then namespace order is still ancestor-ours-theirs (declaration order, not resolution order)', async () => {
      // Design §6.4 F-NS-ORDER: Promise.allSettled results[] is
      // indexed by declaration order, so even if ancestor's parse
      // completes AFTER ours and theirs, the `Object.assign` that
      // builds the namespace map must still stack anc → ours → other.
      // This guards against a regression that accidentally indexes
      // the results by resolution order.
      const ancXml = `<?xml version="1.0"?><R xmlns="http://anc"><v>a</v></R>`
      const oursXml = `<?xml version="1.0"?><R xmlns="http://ours"><v>a</v></R>`
      const theirsXml = `<?xml version="1.0"?><R xmlns="http://theirs"><v>a</v></R>`

      // Make the ancestor stream slow — it will finish last.
      const slowAncestor = new Readable({
        read() {
          setTimeout(() => {
            this.push(ancXml)
            this.push(null)
          }, 30)
        },
      })
      // Ours and theirs emit immediately.
      const fastOurs = Readable.from([oursXml])
      const fastTheirs = Readable.from([theirsXml])

      const sink = new PassThrough()
      const collector = collect(sink)
      await sut.mergeThreeWay(slowAncestor, fastOurs, fastTheirs, sink)
      sink.end()
      const out = await collector
      // Declaration order preserved: `other` (theirs) wins the prefix
      // collision because `Object.assign({}, anc, ours, theirs)`
      // overwrites left-to-right.
      expect(out).toContain('xmlns="http://theirs"')
      expect(out).not.toContain('xmlns="http://anc"')
      expect(out).not.toContain('xmlns="http://ours"')
    })
  })

  describe('given ancestor/ours/theirs contain a CDATA block (no `]]>` inside)', () => {
    it('when merged then the CDATA survives parse → merge → write unchanged', async () => {
      // Exercises parse → merge → serialize for the common CDATA case.
      // The `]]>`-inside-CDATA variant (design §8 row 15) is covered
      // via the writer-only fixture 15-cdata-closing — the parser
      // splits that case into a segment array which the current
      // merger flattens as a text-array, a known limitation tracked
      // for a future fix (doesn't impact current Salesforce
      // metadata shapes, which don't contain `]]>` in CDATA).
      const base = `<?xml version="1.0"?><R><v><![CDATA[if (a < b) {}]]></v><label>x</label></R>`
      const ours = `<?xml version="1.0"?><R><v><![CDATA[if (a < b) {}]]></v><label>y-ours</label></R>`
      const theirs = `<?xml version="1.0"?><R><v><![CDATA[if (a < b) {}]]></v><label>x</label></R>`
      const result = await runMergeStreams(sut, base, ours, theirs)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toContain('<![CDATA[if (a < b) {}]]>')
      expect(result.output).toContain('<label>y-ours</label>')
    })
  })

  describe('given an empty-bodied root on both live sides (residual #3)', () => {
    const ROOT = `<?xml version="1.0"?><Root></Root>`
    const PRESERVED = `<?xml version="1.0" encoding="UTF-8"?>\n<Root></Root>\n`

    it('when all three sides are the empty root then it is preserved as <Root></Root>, not blanked', async () => {
      // JsonMerger on three empty-content roots produces an empty output
      // array; preserveEmptyRoot rebuilds the root because BOTH live sides
      // carry it (a blank file is never valid Salesforce metadata).
      const result = await runMergeStreams(sut, ROOT, ROOT, ROOT)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toBe(PRESERVED)
    })

    it('when the ancestor is empty but both live sides agree on the empty root then it is preserved', async () => {
      // The ancestor is never consulted: both live sides carrying the empty
      // root is what authorises preservation.
      const result = await runMergeStreams(sut, '', ROOT, ROOT)
      expect(result.output).toBe(PRESERVED)
    })

    it('when ours deletes the file and theirs leaves it unchanged then the deletion wins (empty output)', async () => {
      // ours dropped the file (empty document, no root key); the root must
      // NOT be resurrected from theirs, or the driver would re-create a
      // deleted file. localRoot === undefined → no preservation.
      const populated = `<?xml version="1.0"?><Root><v>1</v></Root>`
      const result = await runMergeStreams(sut, populated, '', populated)
      expect(result.hasConflict).toBe(false)
      expect(result.output).toBe('')
    })

    it('when theirs deletes the file and ours leaves it unchanged then the deletion wins (empty output)', async () => {
      // Symmetric guard: otherRoot === undefined → no preservation.
      const populated = `<?xml version="1.0"?><Root><v>1</v></Root>`
      const result = await runMergeStreams(sut, populated, populated, '')
      expect(result.hasConflict).toBe(false)
      expect(result.output).toBe('')
    })

    it('when no side has a root element then sink receives empty output', async () => {
      // Truly empty inputs: no root key anywhere, nothing to preserve.
      const result = await runMergeStreams(sut, '', '', '')
      expect(result.hasConflict).toBe(false)
      expect(result.output).toBe('')
    })
  })

  describe('given one side fails to parse mid-stream', () => {
    it('when merged then the failure is rethrown', async () => {
      const goodDoc = `<?xml version="1.0"?><Root><v>a</v></Root>`
      const badStream = new Readable({
        read() {
          this.destroy(new Error('injected stream failure'))
        },
      })
      const sink = new PassThrough()
      sink.resume() // drain so writes don't back up
      await expect(
        sut.mergeThreeWay(
          Readable.from([goodDoc]),
          Readable.from([goodDoc]),
          badStream,
          sink
        )
      ).rejects.toThrow()
    })
  })
})
