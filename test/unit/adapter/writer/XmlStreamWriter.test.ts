import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const sut = new XmlStreamWriter(defaultConfig)

describe('XmlStreamWriter', () => {
  describe('given a leaf element', () => {
    it('when serialized then emits inline text between tags', async () => {
      const out = await serializeToString(
        sut,
        [{ Root: [{ leaf: 'text' }] }],
        {}
      )
      expect(out).toBe(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Root>\n    <leaf>text</leaf>\n</Root>`
      )
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
        `<?xml version="1.0" encoding="UTF-8"?>\n<Root>\n    <empty></empty>\n    <filled>v</filled>\n</Root>`
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
        `<?xml version="1.0" encoding="UTF-8"?>\n<Root>\n    <v><![CDATA[a ]]]]><![CDATA[> b]]>\n    </v>\n</Root>`
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
        `<?xml version="1.0" encoding="UTF-8"?>\n<Root><!--first--><!--second-->\n    <val>x</val>\n</Root>`
      )
    })
  })

  describe('given namespaces on the root element', () => {
    it('when serialized then xmlns attribute is emitted on the first top-level element', async () => {
      const out = await serializeToString(sut, [{ Root: [{ v: '1' }] }], {
        '@_xmlns': 'http://x',
      })
      expect(out).toBe(
        `<?xml version="1.0" encoding="UTF-8"?>\n<Root xmlns="http://x">\n    <v>1</v>\n</Root>`
      )
    })
  })

  describe('given an empty output array', () => {
    it('when serialized then returns empty string (caller chooses what to do)', async () => {
      const out = await serializeToString(sut, [], {})
      expect(out).toBe('')
    })
  })
})
