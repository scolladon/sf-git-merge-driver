import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { XML_DECL } from '../../../src/constant/parserConstant.js'
import { ConflictMarkerFormatter } from '../../../src/merger/ConflictMarkerFormatter.js'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import { builderOptions, parserOptions } from '../../../src/merger/XmlMerger.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'
import type { PhaseTimer } from './PhaseTimer.js'

const correctComments = (xml: string): string =>
  xml.includes('<!--') ? xml.replace(/\s+<!--(.*?)-->\s+/g, '<!--$1-->') : xml

export interface InstrumentedResult {
  readonly output: string
  readonly hasConflict: boolean
  readonly inputSizeBytes: number
  readonly outputSizeBytes: number
}

export const instrumentedMerge = (
  ancestorContent: string,
  localContent: string,
  otherContent: string,
  config: MergeConfig,
  timer: PhaseTimer
): InstrumentedResult => {
  const inputSizeBytes =
    Buffer.byteLength(ancestorContent) +
    Buffer.byteLength(localContent) +
    Buffer.byteLength(otherContent)

  const parser = new XMLParser(parserOptions)

  timer.startPhase('xml-parse')
  const ancestorObj = parser.parse(ancestorContent)
  const localObj = parser.parse(localContent)
  const otherObj = parser.parse(otherContent)
  timer.endPhase('xml-parse')

  timer.startPhase('json-merge')
  const jsonMerger = new JsonMerger(config)
  const mergedResult = jsonMerger.mergeThreeWay(ancestorObj, localObj, otherObj)
  timer.endPhase('json-merge')

  timer.startPhase('xml-build')
  const builder = new XMLBuilder(builderOptions)
  const mergedXml: string = builder.build(mergedResult.output)
  timer.endPhase('xml-build')

  timer.startPhase('conflict-format')
  let output = ''
  if (mergedXml.length) {
    const formatter = new ConflictMarkerFormatter(config)
    let result = XML_DECL.concat(mergedXml)
    result = formatter.handleSpecialEntities(result)
    result = correctComments(result)
    result = formatter.correctConflictIndent(result)
    output = result
  }
  timer.endPhase('conflict-format')

  return {
    output,
    hasConflict: mergedResult.hasConflict,
    inputSizeBytes,
    outputSizeBytes: Buffer.byteLength(output),
  }
}
