import FlxParser, { type X2jOptions } from '@nodable/flexible-xml-parser'
import { describe, expect, it } from 'vitest'
import {
  FLX_OPTIONS,
  NormalisingOutputBuilderFactory,
} from '../../../src/adapter/NormalisingOutputBuilder.js'

const parse = (xml: string) => {
  // Cast-through-unknown: upstream's OutputBuilder is typed against the
  // library's internal ValueParser shape; our factory satisfies the
  // runtime contract via CompactBuilderFactory inheritance.
  const options = {
    ...FLX_OPTIONS,
    OutputBuilder: new NormalisingOutputBuilderFactory(),
  } as unknown as X2jOptions
  return new FlxParser(options).parse(xml)
}

describe('NormalisingOutputBuilder', () => {
  describe('given an XML document with a namespaced root', () => {
    describe('when parsed', () => {
      it('should strip @_version and @_encoding from the root element', () => {
        const result = parse(
          `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://x"><v>1</v></Root>`
        )
        expect(result.content).toEqual({ Root: { v: '1' } })
      })

      it('should move @_xmlns into namespaces bucket', () => {
        const result = parse(
          `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://x"><v>1</v></Root>`
        )
        expect(result.namespaces).toEqual({ '@_xmlns': 'http://x' })
      })

      it('should move every xmlns:prefix into namespaces bucket', () => {
        const result = parse(
          `<?xml version="1.0"?><Root xmlns="http://x" xmlns:ns1="http://y"><v>1</v></Root>`
        )
        expect(result.namespaces).toEqual({
          '@_xmlns': 'http://x',
          '@_xmlns:ns1': 'http://y',
        })
      })
    })
  })

  describe('given an XML document without namespaces', () => {
    it('when parsed then namespaces is an empty object', () => {
      const result = parse(`<?xml version="1.0"?><Root><v>1</v></Root>`)
      expect(result.namespaces).toEqual({})
    })
  })

  describe('given attributes named version or encoding at non-root depth', () => {
    it('when parsed then they are dropped (any-depth defensive filter)', () => {
      const result = parse(
        `<?xml version="1.0"?><Root><child version="9" encoding="x" real="kept">v</child></Root>`
      )
      expect(result.content).toEqual({
        Root: { child: { '@_real': 'kept', '#text': 'v' } },
      })
    })
  })

  describe('given xmlns attribute on a non-root element', () => {
    it('when parsed then it stays on the element (not promoted to namespaces)', () => {
      const result = parse(
        `<?xml version="1.0"?><Root><inner xmlns="http://y">v</inner></Root>`
      )
      expect(result.namespaces).toEqual({})
      expect(result.content).toEqual({
        Root: { inner: { '@_xmlns': 'http://y', '#text': 'v' } },
      })
    })
  })

  describe('given CDATA containing ]]>', () => {
    it('when parsed then the CDATA value is preserved as array of segments', () => {
      // Upstream @nodable/flexible-xml-parser splits CDATA on `]]>` at
      // parse time (design §6.1 "CDATA ]]> artefact"). If this upstream
      // behaviour ever changes (to return a single pre-joined string),
      // this test breaks intentionally — the writer's
      // `]]]]><![CDATA[>` re-join assumes the array form.
      const result = parse(
        `<?xml version="1.0"?><R><v><![CDATA[has ]]]]><![CDATA[> inside]]></v></R>`
      )
      expect(result.content).toEqual({
        R: { v: { __cdata: ['has ]]', '> inside'] } },
      })
    })
  })

  describe('given a comment', () => {
    it('when parsed then it is preserved under #xml__comment', () => {
      const result = parse(`<?xml version="1.0"?><R><!-- hello --><v>1</v></R>`)
      expect(result.content).toEqual({
        R: { '#xml__comment': ' hello ', v: '1' },
      })
    })
  })

  describe('given a non-xmlns attribute on the root element', () => {
    it('when parsed then the attribute stays on the element (not routed to namespaces)', () => {
      // Guards the `name === XMLNS || name.startsWith("xmlns:")` check:
      // mutating the left-hand disjunct to `true` would incorrectly
      // route every root-level attribute into the namespaces bucket.
      const result = parse(
        `<?xml version="1.0"?><Root schemaLocation="http://x" id="42"><v>1</v></Root>`
      )
      expect(result.namespaces).toEqual({})
      expect(result.content).toEqual({
        Root: {
          '@_schemaLocation': 'http://x',
          '@_id': '42',
          v: '1',
        },
      })
    })
  })

  describe('given only an xmlns:prefix attribute on the root (no plain xmlns)', () => {
    it('when parsed then the prefix branch still routes it to the namespaces bucket', () => {
      // Separate from the plain `xmlns` path — this covers the
      // `name.startsWith(XMLNS + ":")` branch specifically. Mutating
      // that startsWith argument to the empty string would also match
      // non-xmlns attributes; the previous test would catch that.
      const result = parse(
        `<?xml version="1.0"?><Root xmlns:ns1="http://only-prefix"><v>1</v></Root>`
      )
      expect(result.namespaces).toEqual({
        '@_xmlns:ns1': 'http://only-prefix',
      })
      expect(result.content).toEqual({ Root: { v: '1' } })
    })
  })
})
