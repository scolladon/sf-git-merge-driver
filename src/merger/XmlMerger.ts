import { FlxXmlParser } from '../adapter/FlxXmlParser.js'
import { FxpXmlSerializer } from '../adapter/FxpXmlSerializer.js'
import type { XmlParser } from '../adapter/XmlParser.js'
import type { XmlSerializer } from '../adapter/XmlSerializer.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonObject } from '../types/jsonTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { JsonMerger } from './JsonMerger.js'

const mergeNamespaces = (...maps: JsonObject[]): JsonObject =>
  Object.assign({}, ...maps)

export class XmlMerger {
  private readonly parser: XmlParser
  private readonly serializer: XmlSerializer

  constructor(private readonly config: MergeConfig) {
    this.parser = new FlxXmlParser()
    this.serializer = new FxpXmlSerializer(config)
  }

  @log
  mergeThreeWay(
    ancestorContent: string,
    ourContent: string,
    theirContent: string
  ): { output: string; hasConflict: boolean } {
    const ancestor = this.parser.parse(ancestorContent)
    const local = this.parser.parse(ourContent)
    const other = this.parser.parse(theirContent)

    const namespaces = mergeNamespaces(
      ancestor.namespaces,
      local.namespaces,
      other.namespaces
    )

    const jsonMerger = new JsonMerger(this.config)
    const mergedResult = jsonMerger.mergeThreeWay(
      ancestor.content,
      local.content,
      other.content
    )

    return {
      output: mergedResult.output.length
        ? this.serializer.serialize(mergedResult.output, namespaces)
        : '',
      hasConflict: mergedResult.hasConflict,
    }
  }
}
