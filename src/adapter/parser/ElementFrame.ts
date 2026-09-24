import { ATTR_PREFIX, TEXT_TAG } from '../../constant/parserConstant.js'
import type { JsonObject, JsonValue } from '../../types/jsonTypes.js'

type ElementAttrs = Readonly<Record<string, string | null>>

// `hasAttrs` travels with the bag so the frame never recounts keys.
export interface AttrSet {
  readonly attrs: ElementAttrs
  readonly hasAttrs: boolean
}

export const NO_ATTRS: AttrSet = Object.freeze({
  attrs: Object.freeze(Object.create(null)),
  hasAttrs: false,
})

// Per-open-element accumulator the scanner pushes on `<name` and pops
// on the matching close. `grouped` stays undefined until the first
// element, comment or CDATA child arrives, so a leaf — the dominant
// node shape in Salesforce metadata — never allocates a Map.
export class ElementFrame {
  readonly name: string
  private readonly attrs: ElementAttrs
  private readonly hasAttrs: boolean
  private textBuf = ''
  private grouped: Map<string, JsonValue[]> | undefined

  constructor(name: string, { attrs, hasAttrs }: AttrSet) {
    this.name = name
    this.attrs = attrs
    this.hasAttrs = hasAttrs
  }

  addText(text: string): void {
    this.textBuf += text
  }

  addChild(key: string, value: JsonValue): void {
    if (this.grouped === undefined) this.grouped = new Map()
    const existing = this.grouped.get(key)
    if (existing === undefined) {
      this.grouped.set(key, [value])
    } else {
      existing.push(value)
    }
  }

  toCompact(): JsonValue {
    if (!this.hasAttrs && this.grouped === undefined) {
      return this.textBuf
    }
    const out: JsonObject = Object.create(null)
    this.writeAttrsInto(out)
    this.writeGroupedInto(out)
    this.writeTextInto(out)
    return out
  }

  private writeAttrsInto(out: JsonObject): void {
    for (const k in this.attrs) out[`${ATTR_PREFIX}${k}`] = this.attrs[k]
  }

  private writeGroupedInto(out: JsonObject): void {
    if (this.grouped === undefined) return
    for (const [tag, values] of this.grouped) {
      out[tag] = values.length === 1 ? values[0]! : values
    }
  }

  // An element with attributes but no children still carries `#text: ''`.
  private writeTextInto(out: JsonObject): void {
    if (this.textBuf !== '' || this.grouped === undefined) {
      out[TEXT_TAG] = this.textBuf
    }
  }
}
