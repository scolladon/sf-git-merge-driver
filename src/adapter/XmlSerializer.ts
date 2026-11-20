import type { Writable } from 'node:stream'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

// The root attributes each side holds when they cannot be merged: the root
// start tag is then a conflict of its own.
export interface RootAttributeSides {
  readonly local: JsonObject
  readonly ancestor: JsonObject
  readonly other: JsonObject
}

export interface WriteOptions {
  readonly eol?: '\n' | '\r\n'
  readonly hasConflict?: boolean
  readonly contested?: RootAttributeSides | undefined
  // The root attributes each side parsed with: a conflict that occupies the
  // whole document renders every side with its own.
  readonly sides?: RootAttributeSides | undefined
}

export interface XmlSerializer {
  writeTo(
    out: Writable,
    ordered: JsonArray,
    rootAttributes: JsonObject,
    options?: WriteOptions
  ): Promise<void>
}
