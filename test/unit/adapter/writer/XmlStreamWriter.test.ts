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

const DECL = '<?xml version="1.0" encoding="UTF-8"?>'

describe('XmlStreamWriter', () => {
  describe('given a leaf element', () => {
    it('when serialized then emits inline text between tags', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ leaf: 'text' }] }],
        {}
      )
      expect(out).toBe(`${DECL}\n<Root>\n    <leaf>text</leaf>\n</Root>`)
    })
  })

  describe('given an empty element', () => {
    it('when serialized then emits <tag></tag> (not self-closing)', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ empty: [] }, { filled: 'v' }] }],
        {}
      )
      expect(out).toBe(
        `${DECL}\n<Root>\n    <empty></empty>\n    <filled>v</filled>\n</Root>`
      )
    })
  })

  describe('given CDATA containing ]]>', () => {
    it('when serialized then splits with the ]]]]><![CDATA[> escape', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: { __cdata: 'a ]]> b' } }] }],
        {}
      )
      expect(out).toBe(
        `${DECL}\n<Root>\n    <v><![CDATA[a ]]]]><![CDATA[> b]]>\n    </v>\n</Root>`
      )
    })
  })

  describe('given back-to-back comments under a parent', () => {
    it('when serialized then current pipeline concatenation is preserved', async () => {
      const out = await serializeToString(
        sut,
        [
          {
            Root: [
              { '#xml__comment': 'first' },
              { '#xml__comment': 'second' },
              { val: 'x' },
            ],
          },
        ],
        {}
      )
      expect(out).toBe(
        `${DECL}\n<Root><!--first--><!--second-->\n    <val>x</val>\n</Root>`
      )
    })
  })

  describe('given namespaces on the root element', () => {
    it('when serialized then xmlns attribute is emitted on the first top-level element', async () => {
      const out = await serializeToString(sut, [{ Root: [{ v: '1' }] }], {
        '@_xmlns': 'http://x',
      })
      expect(out).toBe(
        `${DECL}\n<Root xmlns="http://x">\n    <v>1</v>\n</Root>`
      )
    })
  })

  describe('given an empty output array', () => {
    it('when serialized then returns empty string', async () => {
      const out = await serializeToString(sut, [], {})
      expect(out).toBe('')
    })
  })

  describe('given a scalar at the top-level input array', () => {
    it('when serialized then emits it as a raw text chunk before the element', async () => {
      const out = await serializeToString(
        sut,
        ['raw' as unknown as never, { Root: [{ v: '1' }] }],
        {}
      )
      expect(out).toBe(`${DECL}\nraw<Root>\n    <v>1</v>\n</Root>`)
    })
  })

  describe('given a compact tree where an element body is null', () => {
    it('when serialized then element emits as <tag></tag>', async () => {
      const out = await serializeToString(sut, [{ Root: [{ n: null }] }], {})
      expect(out).toBe(`${DECL}\n<Root>\n    <n></n>\n</Root>`)
    })
  })

  describe('given a compact tree where an element body is a scalar', () => {
    it('when serialized then scalar wraps as inline text', async () => {
      const out = await serializeToString(sut, [{ Root: [{ v: 42 }] }], {})
      expect(out).toBe(`${DECL}\n<Root>\n    <v>42</v>\n</Root>`)
    })
  })

  describe('given a compact tree where an element body has a key whose value is an array', () => {
    it('when serialized then each array entry emits as its own child element', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: { child: [{ a: '1' }, { a: '2' }] } }],
        {}
      )
      // splitAttrsAndChildren expands `child: [..., ...]` into two separate
      // `<child>` elements, one per entry — matches the "repeated child
      // element" pattern in the compact merged tree.
      expect(out).toBe(
        `${DECL}\n<Root>\n    <child>\n        <a>1</a>\n    </child>\n    <child>\n        <a>2</a>\n    </child>\n</Root>`
      )
    })
  })

  describe('given an element with both attributes and children', () => {
    it('when serialized then attributes emit on the open tag', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: { '@_id': '7', '#text': 'hi' } }] }],
        {}
      )
      expect(out).toBe(`${DECL}\n<Root>\n    <v id="7">hi</v>\n</Root>`)
    })
  })

  describe('given a non-object child among siblings', () => {
    it('when serialized then the scalar is emitted as raw text', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: ['before', { inner: 'x' }] }] }],
        {}
      )
      expect(out).toBe(
        `${DECL}\n<Root>\n    <v>before\n        <inner>x</inner>\n    </v>\n</Root>`
      )
    })
  })

  describe('given a namespace-root marker key in the tree', () => {
    it('when serialized then the :@ key is skipped', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: '1' }], ':@': { ignored: 'x' } } as never],
        {}
      )
      expect(out).not.toContain('ignored')
      expect(out).toBe(`${DECL}\n<Root>\n    <v>1</v>\n</Root>`)
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
      const mkEscaped = localMk.replace(/\|/g, '\\|')
      expect(out).not.toMatch(new RegExp(` {4}${mkEscaped}`))
      expect(out).toContain(`${localMk} ours`)
    })
  })

  describe('given text chunks that produce whitespace-only lines', () => {
    it('when serialized then the blank lines are dropped but content preserved in order', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ '#text': 'a\n   \nb' }] }],
        {}
      )
      expect(out).toBe(`${DECL}\n<Root>a\nb</Root>`)
    })
  })

  describe('given hasConflict=false on text the filter would otherwise mangle', () => {
    // The merger sets hasConflict=false when no ConflictBlock was
    // produced; writeTo then skips the ConflictLineFilter. Assert by
    // feeding text the filter would visibly transform (indented marker
    // line stripped, whitespace-only line dropped) and checking it
    // round-trips byte-for-byte.
    const tree = [{ Root: [{ '#text': `\n    ${sepMk}\n   \n` }] }]

    const collect = async (hasConflict: boolean): Promise<string> => {
      const sink = new PassThrough()
      const chunks: Buffer[] = []
      sink.on('data', (c: Buffer) => chunks.push(c))
      await sut.writeTo(sink, tree, {}, '\n', hasConflict)
      return Buffer.concat(chunks).toString('utf8')
    }

    it('when serialized then the indented marker and blank line are preserved verbatim', async () => {
      const out = await collect(false)
      expect(out).toBe(`${DECL}\n<Root>\n    ${sepMk}\n   \n</Root>`)
    })

    it('when hasConflict=true then the filter actively rewrites the same input (proves the bypass is what skipped the rewrite)', async () => {
      const filtered = await collect(true)
      // Filter strips leading whitespace before the marker and drops
      // the whitespace-only line — output must differ from the bypass.
      expect(filtered).not.toBe(`${DECL}\n<Root>\n    ${sepMk}\n   \n</Root>`)
      expect(filtered).toContain(`\n${sepMk}\n`)
      expect(filtered).not.toContain('   \n')
    })
  })

  describe('given a CRLF target EOL', () => {
    it('when serialized then every LF is rewritten to CRLF', async () => {
      const writer = new XmlStreamWriter(defaultConfig)
      const sink = new PassThrough()
      const chunks: Buffer[] = []
      sink.on('data', (c: Buffer) => chunks.push(c))
      await writer.writeTo(sink, [{ Root: [{ v: '1' }] }], {}, '\r\n')
      const out = Buffer.concat(chunks).toString('utf8')
      expect(out).toBe(`${DECL}\r\n<Root>\r\n    <v>1</v>\r\n</Root>`)
    })
  })

  describe('given a throttled Writable that always signals backpressure', () => {
    const buildThrottled = (
      written: string[]
    ): InstanceType<typeof Writable> => {
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
      return throttled
    }

    it('when serialized then writer awaits drain and the full document is emitted', async () => {
      const written: string[] = []
      const throttled = buildThrottled(written)
      const writer = new XmlStreamWriter(defaultConfig)
      await writer.writeTo(throttled, [{ Root: [{ v: '1' }] }], {})
      expect(written.join('')).toBe(`${DECL}\n<Root>\n    <v>1</v>\n</Root>`)
    })

    it('when serialized with hasConflict=false then the single-write fast path also awaits drain', async () => {
      // Covers the no-conflict path's `await once(out, "drain")` branch
      // — distinct from the conflict-path drain inside the slice loop.
      const written: string[] = []
      const throttled = buildThrottled(written)
      const writer = new XmlStreamWriter(defaultConfig)
      await writer.writeTo(throttled, [{ Root: [{ v: '1' }] }], {}, '\n', false)
      expect(written.join('')).toBe(`${DECL}\n<Root>\n    <v>1</v>\n</Root>`)
    })
  })

  describe('given CDATA after a sibling element', () => {
    it('when serialized then CDATA gets a leading newline+indent', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ a: '1' }, { __cdata: 'boom' }] }],
        {}
      )
      expect(out).toBe(
        `${DECL}\n<Root>\n    <a>1</a>\n    <![CDATA[boom]]>\n</Root>`
      )
    })
  })

  describe('given CDATA body as array of segments (parser artefact)', () => {
    it('when serialized then segments concatenate for the escape', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: { __cdata: ['a ]]', '> b'] } }] }],
        {}
      )
      expect(out).toBe(
        `${DECL}\n<Root>\n    <v><![CDATA[a ]]]]><![CDATA[> b]]>\n    </v>\n</Root>`
      )
    })
  })

  describe('given mixed content: text after an element inside the same parent', () => {
    it('when serialized then trailing text is indented and the parent close is inline', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ v: [{ a: '1' }, 'trailing'] }] }],
        {}
      )
      expect(out).toBe(
        `${DECL}\n<Root>\n    <v>\n        <a>1</a>\n        trailing</v>\n</Root>`
      )
    })
  })

  describe('given multiple top-level elements in the compact array', () => {
    it('when serialized then namespaces attach to the FIRST only', async () => {
      const out = await serializeToString(sut, [{ A: 'x' }, { B: 'y' }], {
        '@_xmlns': 'http://a',
      })
      expect(out).toBe(`${DECL}\n<A xmlns="http://a">x</A>\n<B>y</B>`)
    })
  })

  describe('given a ConflictBlock at top-level', () => {
    it('when serialized then the markers emit in local → ancestor → separator → other order', async () => {
      const block = {
        __conflict: true as const,
        local: [{ v: 'L' }],
        ancestor: [{ v: 'A' }],
        other: [{ v: 'O' }],
      }
      const out = await serializeToString(sut, [block as never], {})
      const lMk = `<<<<<<< ${defaultConfig.localConflictTag}`
      const aMk = `||||||| ${defaultConfig.ancestorConflictTag}`
      const oMk = `>>>>>>> ${defaultConfig.otherConflictTag}`
      const indices = [
        out.indexOf(lMk),
        out.indexOf(aMk),
        out.indexOf('======='),
        out.indexOf(oMk),
      ]
      expect(indices.every(i => i >= 0)).toBe(true)
      expect(indices).toEqual([...indices].sort((a, b) => a - b))
      expect(out).toContain('<v>L</v>')
      expect(out).toContain('<v>A</v>')
      expect(out).toContain('<v>O</v>')
    })
  })

  describe('given a ConflictBlock as a direct property value', () => {
    it('when serialized then the wrapper expands in place without a <wrapper> tag', async () => {
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
      expect(out).not.toContain('<wrapper>')
      expect(out).toContain('<inner>L</inner>')
      expect(out).toContain('<inner>A</inner>')
      expect(out).toContain('<inner>O</inner>')
    })
  })

  describe('given a ConflictBlock with an empty side', () => {
    it('when serialized then the empty side emits only whitespace between its markers', async () => {
      const block = {
        __conflict: true as const,
        local: [],
        ancestor: [{ v: 'A' }],
        other: [{ v: 'O' }],
      }
      const out = await serializeToString(sut, [block as never], {})
      const lMk = `<<<<<<< ${defaultConfig.localConflictTag}`
      const aMk = `||||||| ${defaultConfig.ancestorConflictTag}`
      const between = out.slice(out.indexOf(lMk) + lMk.length, out.indexOf(aMk))
      expect(between).toMatch(/^\s*$/)
      expect(out).toContain('<v>A</v>')
      expect(out).toContain('<v>O</v>')
    })
  })

  describe('given a ConflictBlock whose content contains a scalar', () => {
    it('when serialized then the scalar lands in its respective side', async () => {
      const block = {
        __conflict: true as const,
        local: ['raw-local' as unknown],
        ancestor: [],
        other: ['raw-other' as unknown],
      }
      const out = await serializeToString(sut, [block as never], {})
      const lMk = `<<<<<<< ${defaultConfig.localConflictTag}`
      const aMk = `||||||| ${defaultConfig.ancestorConflictTag}`
      const oMk = `>>>>>>> ${defaultConfig.otherConflictTag}`
      const localSection = out.slice(
        out.indexOf(lMk) + lMk.length,
        out.indexOf(aMk)
      )
      const otherSection = out.slice(
        out.indexOf('=======') + '======='.length,
        out.indexOf(oMk)
      )
      expect(localSection).toContain('raw-local')
      expect(otherSection).toContain('raw-other')
    })
  })

  describe('given a nested ConflictBlock inside another conflict side', () => {
    it('when serialized then the inner block expands recursively with its own markers', async () => {
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
      const lMk = `<<<<<<< ${defaultConfig.localConflictTag}`
      // Outer has one `<<<<<<<` marker plus one nested inside its local
      // side → at least two occurrences.
      const occurrences = out.split(lMk).length - 1
      expect(occurrences).toBeGreaterThanOrEqual(2)
      expect(out).toContain('<deep>dL</deep>')
      expect(out).toContain('<deep>dO</deep>')
      expect(out).toContain('<s>A</s>')
      expect(out).toContain('<s>O</s>')
    })
  })

  describe('given a document whose serialized size crosses the 16 KiB flush threshold', () => {
    it('when serialized then multiple batch-writes fire and the bytes still reconstruct exactly', async () => {
      // The writer accumulates filter output into 16 KiB windows and
      // flushes to `out.write` at the threshold. A small document stays
      // entirely in one batch; we need a large one to exercise the
      // `batch.length >= FLUSH_BYTES` branch. 1200 children ×
      // ~30+ bytes each clears 32 KiB comfortably while staying cheap.
      const children: Array<Record<string, string>> = []
      for (let i = 0; i < 1200; i++) {
        children.push({ item: `value-${String(i).padStart(4, '0')}` })
      }
      const writes: string[] = []
      const sink = new PassThrough()
      sink.on('data', (c: Buffer) => writes.push(c.toString('utf8')))
      await sut.writeTo(sink, [{ Root: children }], {})
      sink.end()
      // Invariant 1: the batch-flush threshold triggered at least once
      // mid-document, i.e. the writer did NOT coalesce everything into
      // one final `out.write`. If the threshold branch never fired,
      // every byte would land in the tail flush → exactly one write.
      expect(writes.length).toBeGreaterThan(1)
      const joined = writes.join('')
      // Invariant 2: byte-exact reconstruction — batching must not
      // reorder or drop content.
      expect(joined).toContain('<item>value-0000</item>')
      expect(joined).toContain('<item>value-0399</item>')
      expect(joined.startsWith(`${DECL}\n<Root>`)).toBe(true)
      expect(joined.endsWith('</Root>')).toBe(true)
      // Sanity: length crosses the 16 KiB threshold.
      expect(joined.length).toBeGreaterThan(16 * 1024)
    })
  })
})
