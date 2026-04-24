import { describe, expect, it } from 'vitest'
import { XmlStreamWriter } from '../../../../src/adapter/writer/XmlStreamWriter.js'
import { listFixtures } from '../../../utils/goldenFile.js'
import { serializeToString } from '../../../utils/serializeToString.js'
import { defaultConfig } from '../../../utils/testConfig.js'

describe('writer parity — XmlStreamWriter vs current pipeline', () => {
  const fixtures = listFixtures().filter(f => f.inputs.ordered !== undefined)

  for (const fixture of fixtures) {
    describe(`given fixture ${fixture.id}`, () => {
      it('when writeTo is run then output bytes match expected.xml', async () => {
        const writer = new XmlStreamWriter(defaultConfig)
        const out = await serializeToString(
          writer,
          fixture.inputs.ordered!,
          fixture.inputs.namespaces ?? {}
        )
        const expected =
          fixture.parity.mode === 'divergence' && fixture.expectedNew
            ? fixture.expectedNew
            : fixture.expectedCurrent
        expect(out).toBe(expected)
      })
    })
  }
})
