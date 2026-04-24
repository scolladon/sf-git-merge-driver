import { describe, expect, it } from 'vitest'
import { FlxXmlParser } from '../../../../src/adapter/FlxXmlParser.js'
import { StreamingXmlParser } from '../../../../src/adapter/StreamingXmlParser.js'
import { listFixtures } from '../../../utils/goldenFile.js'

describe('parser parity — StreamingXmlParser vs FlxXmlParser', () => {
  const fixtures = listFixtures().filter(
    f => f.inputs.ancestor !== undefined && f.inputs.ours !== undefined
  )

  for (const fixture of fixtures) {
    describe(`given fixture ${fixture.id}`, () => {
      const current = new FlxXmlParser()
      const next = new StreamingXmlParser()

      it('when parseString is run against ancestor.xml then tree is deepEqual to FlxXmlParser', () => {
        const a = current.parse(fixture.inputs.ancestor as string)
        const b = next.parseString(fixture.inputs.ancestor as string)
        expect(b).toEqual(a)
      })

      it('when parseString is run against ours.xml then tree is deepEqual', () => {
        const a = current.parse(fixture.inputs.ours as string)
        const b = next.parseString(fixture.inputs.ours as string)
        expect(b).toEqual(a)
      })

      it('when parseString is run against theirs.xml then tree is deepEqual', () => {
        const a = current.parse(fixture.inputs.theirs as string)
        const b = next.parseString(fixture.inputs.theirs as string)
        expect(b).toEqual(a)
      })
    })
  }
})
