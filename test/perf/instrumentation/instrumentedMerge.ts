import { FlxXmlParser } from '../../../src/adapter/FlxXmlParser.js'
import { FxpXmlSerializer } from '../../../src/adapter/FxpXmlSerializer.js'
import { JsonMerger } from '../../../src/merger/JsonMerger.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'
import type { JsonObject } from '../../../src/types/jsonTypes.js'
import type { PhaseTimer } from './PhaseTimer.js'

export interface InstrumentedResult {
  readonly output: string
  readonly hasConflict: boolean
  readonly inputSizeBytes: number
  readonly outputSizeBytes: number
}

const mergeNamespaces = (...maps: JsonObject[]): JsonObject =>
  Object.assign({}, ...maps)

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

  const parser = new FlxXmlParser()

  timer.startPhase('xml-parse')
  const ancestor = parser.parse(ancestorContent)
  const local = parser.parse(localContent)
  const other = parser.parse(otherContent)
  timer.endPhase('xml-parse')

  const namespaces = mergeNamespaces(
    ancestor.namespaces,
    local.namespaces,
    other.namespaces
  )

  timer.startPhase('json-merge')
  const jsonMerger = new JsonMerger(config)
  const mergedResult = jsonMerger.mergeThreeWay(
    ancestor.content,
    local.content,
    other.content
  )
  timer.endPhase('json-merge')

  timer.startPhase('xml-serialize')
  const serializer = new FxpXmlSerializer(config)
  let output = ''
  if (mergedResult.output.length) {
    output = serializer.serialize(mergedResult.output, namespaces)
  }
  timer.endPhase('xml-serialize')

  return {
    output,
    hasConflict: mergedResult.hasConflict,
    inputSizeBytes,
    outputSizeBytes: Buffer.byteLength(output),
  }
}
