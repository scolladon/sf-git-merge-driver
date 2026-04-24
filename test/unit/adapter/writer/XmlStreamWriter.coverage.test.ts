import { PassThrough, Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import {
  ANCESTOR_CONFLICT_MARKER,
  LOCAL_CONFLICT_MARKER,
  SEPARATOR,
} from '../../../../src/constant/conflictConstant.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const sut = new XmlStreamWriter(defaultConfig)
const size = defaultConfig.conflictMarkerSize
const localMk = LOCAL_CONFLICT_MARKER.repeat(size)
const ancMk = ANCESTOR_CONFLICT_MARKER.repeat(size)
const sepMk = SEPARATOR.repeat(size)

describe('XmlStreamWriter (coverage corners)', () => {
  describe('given a scalar at the top-level input array', () => {
    it('when serialized then emits it as a raw text chunk', async () => {
      const out = await serializeToString(
        sut,
        ['raw' as unknown as never, { Root: [{ v: '1' }] }],
        {}
      )
      expect(out).toContain('raw')
      expect(out).toContain('<Root>')
    })
  })

  describe('given a compact tree where an element body is null', () => {
    it('when serialized then element has no children', async () => {
      const out = await serializeToString(sut, [{ Root: [{ n: null }] }], {})
      expect(out).toContain('<n></n>')
    })
  })

  describe('given a compact tree where an element body is a scalar', () => {
    it('when serialized then scalar wraps as inline text', async () => {
      const out = await serializeToString(sut, [{ Root: [{ v: 42 }] }], {})
      expect(out).toContain('<v>42</v>')
    })
  })

  describe('given a compact tree where an element body is an array', () => {
    it('when serialized then array entries become child elements', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: { child: [{ a: '1' }, { a: '2' }] } }],
        {}
      )
      expect(out).toContain('<child>')
      expect(out).toContain('<a>1</a>')
      expect(out).toContain('<a>2</a>')
    })
  })

  describe('given an element with both attributes and children', () => {
    it('when serialized then attributes emit on the open tag', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: { '@_id': '7', '#text': 'hi' } }] }],
        {}
      )
      expect(out).toContain('<v id="7">hi</v>')
    })
  })

  describe('given a non-object child among siblings', () => {
    it('when serialized then the scalar is emitted as raw text', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: ['before', { inner: 'x' }] }] }],
        {}
      )
      expect(out).toContain('before')
      expect(out).toContain('<inner>x</inner>')
    })
  })

  describe('given a namespace-root marker key in the tree', () => {
    it('when serialized then the :@ key is skipped', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: '1' }], ':@': { ignored: 'x' } } as never],
        {}
      )
      expect(out).toContain('<Root>')
      expect(out).not.toContain('ignored')
    })
  })

  describe('given text containing a conflict marker with leading indent', () => {
    it('when serialized then pass-1 strips the horizontal whitespace', async () => {
      const out = await serializeToString(
        sut,
        [
          {
            Root: [
              {
                '#text': `\n    ${localMk} ours\n    x\n    ${sepMk}\n    y\n    ${ancMk} theirs`,
              },
            ],
          },
        ],
        {}
      )
      expect(out).toContain(`${localMk} ours`)
      expect(out).not.toMatch(
        new RegExp(`    ${localMk.replace(/\|/g, '\\|')}`)
      )
    })
  })

  describe('given text chunks that produce whitespace-only lines', () => {
    it('when serialized then the blank lines are dropped', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ '#text': 'a\n   \nb' }] }],
        {}
      )
      expect(out).not.toMatch(/\n\s+\n/)
      expect(out).toContain('a')
      expect(out).toContain('b')
    })
  })

  describe('given a CRLF target EOL', () => {
    it('when serialized then LF is rewritten to CRLF', async () => {
      const writer = new XmlStreamWriter(defaultConfig)
      const sink = new PassThrough()
      const chunks: Buffer[] = []
      sink.on('data', (c: Buffer) => chunks.push(c))
      await writer.writeTo(sink, [{ Root: [{ v: '1' }] }], {}, '\r\n')
      const out = Buffer.concat(chunks).toString('utf8')
      expect(out).toContain('\r\n')
      expect(out).not.toMatch(/(?<!\r)\n/)
    })
  })

  describe('given a throttled Writable that always signals backpressure', () => {
    it('when serialized then writer awaits drain between chunks', async () => {
      const written: string[] = []
      const throttled = new Writable({
        write(chunk: Buffer, _enc: string, cb: (e?: Error | null) => void) {
          written.push(chunk.toString('utf8'))
          cb()
        },
      })
      const origWrite = throttled.write.bind(throttled)
      throttled.write = ((
        // biome-ignore lint/suspicious/noExplicitAny: narrow in test
        ...args: any[]
      ) => {
        // biome-ignore lint/suspicious/noExplicitAny: narrow in test
        ;(origWrite as any)(...args)
        setImmediate(() => throttled.emit('drain'))
        return false
      }) as typeof throttled.write
      const writer = new XmlStreamWriter(defaultConfig)
      await writer.writeTo(throttled, [{ Root: [{ v: '1' }] }], {})
      expect(written.join('')).toContain('<Root>')
    })
  })

  describe('given CDATA after a sibling element', () => {
    it('when serialized then CDATA gets a leading newline+indent', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ a: '1' }, { __cdata: 'boom' }] }],
        {}
      )
      expect(out).toContain('<a>1</a>')
      expect(out).toContain('<![CDATA[boom]]>')
    })
  })

  describe('given CDATA body as array of segments', () => {
    it('when serialized then segments concatenate for the escape', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: { __cdata: ['a ]]', '> b'] } }] }],
        {}
      )
      expect(out).toContain('<![CDATA[a ]]]]><![CDATA[> b]]>')
    })
  })

  describe('given mixed content: text after an element inside the same parent', () => {
    it('when serialized then the trailing text gets indented', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: [{ a: '1' }, 'trailing'] }] }],
        {}
      )
      expect(out).toContain('<a>1</a>')
      expect(out).toContain('trailing')
    })
  })

  describe('given multiple top-level elements in the compact array', () => {
    it('when serialized then namespaces attach to the FIRST only', async () => {
      const out = await serializeToString(sut, [{ A: 'x' }, { B: 'y' }], {
        '@_xmlns': 'http://a',
      })
      expect(out).toContain('<A xmlns="http://a">')
      expect(out).not.toContain('<B xmlns=')
      expect(out).toContain('<B>y</B>')
    })
  })

  describe('given a ConflictBlock at top-level', () => {
    it('when serialized then the conflict markers expand in place', async () => {
      const block = {
        __conflict: true as const,
        local: [{ v: 'L' }],
        ancestor: [{ v: 'A' }],
        other: [{ v: 'O' }],
      }
      const out = await serializeToString(sut, [block as never], {})
      expect(out).toContain('<<<<<<<')
      expect(out).toContain('=======')
      expect(out).toContain('>>>>>>>')
      expect(out).toContain('<v>L</v>')
    })
  })

  describe('given a ConflictBlock as a direct property value', () => {
    it('when serialized then the wrapper expands inline', async () => {
      const block = {
        __conflict: true as const,
        local: [{ inner: 'L' }],
        ancestor: [{ inner: 'A' }],
        other: [{ inner: 'O' }],
      }
      const out = await serializeToString(
        sut,
        [{ Root: [{ wrapper: block as never }] }],
        {}
      )
      expect(out).toContain('<<<<<<<')
      expect(out).toContain('<inner>L</inner>')
    })
  })

  describe('given a ConflictBlock with an empty side', () => {
    it('when serialized then the empty side emits an EOL placeholder', async () => {
      const block = {
        __conflict: true as const,
        local: [],
        ancestor: [{ v: 'A' }],
        other: [{ v: 'O' }],
      }
      const out = await serializeToString(sut, [block as never], {})
      // Empty side still produces markers; ancestor/other expand normally.
      expect(out).toContain('<<<<<<<')
      expect(out).toContain('<v>A</v>')
      expect(out).toContain('<v>O</v>')
    })
  })

  describe('given a ConflictBlock whose content contains a scalar', () => {
    it('when serialized then the scalar renders as raw text', async () => {
      const block = {
        __conflict: true as const,
        local: ['raw-local' as unknown],
        ancestor: [],
        other: ['raw-other' as unknown],
      }
      const out = await serializeToString(sut, [block as never], {})
      expect(out).toContain('raw-local')
      expect(out).toContain('raw-other')
    })
  })

  describe('given a nested ConflictBlock inside another conflict side', () => {
    it('when serialized then the inner block expands recursively', async () => {
      const inner = {
        __conflict: true as const,
        local: [{ deep: 'dL' }],
        ancestor: [{ deep: 'dA' }],
        other: [{ deep: 'dO' }],
      }
      const outer = {
        __conflict: true as const,
        local: [inner as never],
        ancestor: [{ s: 'A' }],
        other: [{ s: 'O' }],
      }
      const out = await serializeToString(sut, [outer as never], {})
      expect(out).toContain('dL')
      expect(out).toContain('dO')
    })
  })
})
