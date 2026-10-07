import type { Writable } from 'node:stream'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

export interface XmlSerializer {
  writeTo(
    out: Writable,
    ordered: JsonArray,
    rootAttributes: JsonObject,
    eol?: '\n' | '\r\n',
    hasConflict?: boolean
  ): Promise<void>
}
