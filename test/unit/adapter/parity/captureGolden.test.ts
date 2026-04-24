import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { FxpXmlSerializer } from '../../../../src/adapter/FxpXmlSerializer.js'
import { XmlMerger } from '../../../../src/merger/XmlMerger.js'
import type { JsonArray, JsonObject } from '../../../../src/types/jsonTypes.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const ROOT = new URL('../../../fixtures/xml/', import.meta.url).pathname

// Guard: capture runs only when CAPTURE=1. Without the guard, this test
// would overwrite every fixture's expected.xml on every test run.
describe.skipIf(process.env['CAPTURE'] !== '1')(
  'capture golden fixtures',
  () => {
    const ids = readdirSync(ROOT).filter((n: string) => !n.startsWith('.'))
    for (const id of ids) {
      it(`captures ${id}`, () => {
        const dir = join(ROOT, id)
        const ancestorPath = join(dir, 'ancestor.xml')
        const orderedPath = join(dir, 'ordered-input.json')

        let bytes: string
        if (existsSync(ancestorPath)) {
          const ancestor = readFileSync(ancestorPath, 'utf8')
          const ours = readFileSync(join(dir, 'ours.xml'), 'utf8')
          const theirs = readFileSync(join(dir, 'theirs.xml'), 'utf8')
          const merger = new XmlMerger(defaultConfig)
          bytes = merger.mergeThreeWay(ancestor, ours, theirs).output
        } else if (existsSync(orderedPath)) {
          const parsed = JSON.parse(readFileSync(orderedPath, 'utf8')) as {
            ordered: JsonArray
            namespaces?: JsonObject
          }
          const serializer = new FxpXmlSerializer(defaultConfig)
          bytes = serializer.serialize(parsed.ordered, parsed.namespaces ?? {})
        } else {
          throw new Error(
            `[${id}] needs ancestor/ours/theirs.xml OR ordered-input.json`
          )
        }

        writeFileSync(join(dir, 'expected.xml'), bytes)
      })
    }
  }
)
