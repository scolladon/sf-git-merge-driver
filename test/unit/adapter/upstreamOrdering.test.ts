import FlxParser from '@nodable/flexible-xml-parser'
import { describe, expect, it } from 'vitest'
import {
  FLX_OPTIONS,
  NormalisingOutputBuilderFactory,
} from '../../../src/adapter/NormalisingOutputBuilder.js'

// Pin the upstream @nodable/flexible-xml-parser invariant that
// NormalisingOutputBuilder.addAttribute relies on: XML-declaration
// attributes (version, encoding) AND root-element attributes both fire
// through addAttribute BEFORE the first addElement is called — meaning
// tagsStack is empty at that moment. If this contract changes in a
// future upstream release, the version/encoding leak-filter and
// root-xmlns routing both silently break; this test catches that.
describe('upstream @nodable/flexible-xml-parser ordering invariant', () => {
  describe('given a document with XML declaration and a namespaced root', () => {
    it('when parsing then addAttribute fires with empty tagsStack for decl + root attrs', () => {
      const trace: Array<{ name: string; stackLen: number }> = []

      class Probe extends NormalisingOutputBuilderFactory {
        override getInstance(parserOptions: unknown, matcher: unknown) {
          const b = super.getInstance(parserOptions, matcher)
          const origAdd = b.addAttribute.bind(b)
          b.addAttribute = (
            name: string,
            value: unknown,
            m?: unknown
          ): void => {
            trace.push({
              name,
              stackLen: (b as unknown as { tagsStack: unknown[] }).tagsStack
                .length,
            })
            origAdd(name, value, m)
          }
          return b
        }
      }

      const parser = new FlxParser({
        ...FLX_OPTIONS,
        OutputBuilder: new Probe(),
      })
      parser.parse(
        `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://x"><v>1</v></Root>`
      )

      // Every attribute on the root element and every leaked decl attr
      // must fire with stackLen === 0 (before addElement for Root).
      const rootOrDeclAttrs = trace.filter(t =>
        ['version', 'encoding', 'xmlns'].includes(t.name)
      )
      expect(rootOrDeclAttrs.length).toBe(3)
      for (const t of rootOrDeclAttrs) {
        expect(t.stackLen).toBe(0)
      }
    })
  })
})
